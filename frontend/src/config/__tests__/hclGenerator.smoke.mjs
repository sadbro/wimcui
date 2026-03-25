/**
 * Smoke test for HCL Generator.
 *
 * Run: node frontend/src/config/__tests__/hclGenerator.smoke.mjs
 *
 * Tests:
 *   1. Realistic 3-tier canvas with full edge topology → all resource types, references, SGs, IAM
 *   2. Cross-resource references → subnet refs VPC, EC2 refs subnet, LB refs subnets, etc.
 *   3. Security Group generation → ingress rules, VPC linkage, default egress
 *   4. IAM role generation → assume_role_policy services, instance profile, policy attachment
 *   5. Dangling references → warnings collected, no "undefined" in output
 *   6. Empty canvas → produces only provider block, no crash
 */

// ─── Minimal buildContext stub ───────────────────────────────────────────────

function buildTestContext(nodes, edges, roles = [], securityGroups = []) {
  const byType = (type) => nodes.filter((n) => n.data?.resourceType === type);
  const nodeById = (id) => nodes.find((n) => n.id === id);

  const TYPES = [
    "VPC", "Subnet", "EC2", "RDS", "LoadBalancer", "ECS", "IGW", "NATGateway",
    "RouteTable", "S3", "Lambda", "DynamoDB", "SQS", "SNS", "EventBridge",
    "SecretsManager", "APIGateway", "ElastiCache", "ECR", "Route53", "Kinesis",
    "ACM", "CloudFront", "WAF", "ASG",
  ];

  const byResourceType = {};
  TYPES.forEach((t) => { byResourceType[t] = byType(t); });

  const vpcs = byResourceType["VPC"];
  const subnets = byResourceType["Subnet"];
  const rts = byResourceType["RouteTable"];

  const structuralEdges = edges.filter((e) => e.type === "structural");
  const assocEdges = edges.filter((e) => e.type === "association");
  const trafficEdges = edges.filter((e) => e.type === "traffic");

  // RT ↔ Subnet associations
  const rtBySubnet = {};
  const subnetsByRt = {};
  assocEdges.filter((e) => !e.id.startsWith("e_route_")).forEach((e) => {
    const src = nodeById(e.source);
    const tgt = nodeById(e.target);
    const rt = [src, tgt].find((n) => n?.data?.resourceType === "RouteTable");
    const subnet = [src, tgt].find((n) => n?.data?.resourceType === "Subnet");
    if (rt && subnet) {
      rtBySubnet[subnet.id] = rt;
      if (!subnetsByRt[rt.id]) subnetsByRt[rt.id] = [];
      subnetsByRt[rt.id].push(subnet);
    }
  });

  const trafficNeighbors = (nodeId) =>
    trafficEdges
      .filter((e) => e.source === nodeId || e.target === nodeId)
      .map((e) => nodeById(e.source === nodeId ? e.target : e.source));

  const sgById = (id) => securityGroups.find((s) => s.id === id);

  const nodesWithSG = nodes.filter((n) => (n.data?.config?.sg_ids || []).length > 0);

  const deriveNodeSGs = (nodeId) => {
    const node = nodeById(nodeId);
    if (!node) return [];
    const assignedIds = node.data?.config?.sg_ids || [];
    return assignedIds.map((sgId) => {
      const sg = sgById(sgId);
      if (!sg) return null;
      return {
        sg,
        edgeDerived: { inbound: [], outbound: [] },
        manual: { inbound: sg.inbound || [], outbound: sg.outbound || [] },
      };
    }).filter(Boolean);
  };

  return {
    nodes, edges, byResourceType,
    vpcs, subnets,
    ec2: byResourceType["EC2"],
    rds: byResourceType["RDS"],
    lbs: byResourceType["LoadBalancer"],
    igws: byResourceType["IGW"],
    nats: byResourceType["NATGateway"],
    rts,
    structuralEdges, assocEdges, trafficEdges,
    subnetsByVpc: {},
    publicSubnets: subnets.filter((s) => s.data?.config?.visibility === "Public"),
    privateSubnets: subnets.filter((s) => s.data?.config?.visibility === "Private"),
    rtBySubnet, subnetsByRt,
    nodeById, trafficNeighbors,
    hasTrafficEdge: (id) => trafficEdges.some((e) => e.source === id || e.target === id),
    hasAnyEdge: (id) => edges.some((e) => e.source === id || e.target === id),
    routesForRt: (rt) => rt.data?.config?.routes || [],
    rtRoutesTo: (rt, targetId) => (rt.data?.config?.routes || []).some((r) => r.target === targetId),
    anyRtRoutesTo: (targetId) => rts.some((rt) => (rt.data?.config?.routes || []).some((r) => r.target === targetId)),
    securityGroups, sgById, nodesWithSG,
    nodesWithoutSG: [],
    deriveNodeSGs,
    roles,
    roleById: (id) => roles.find((r) => r.id === id),
    rolePolicies: (roleId) => roles.find((r) => r.id === roleId)?.policies || [],
    iamCapableNodes: nodes.filter((n) => ["EC2", "ECS", "Lambda", "ASG"].includes(n.data?.resourceType)),
    nodesWithRole: () => [],
    nodesWithoutRole: () => [],
    ec2WithRole: () => [],
    ec2WithoutRole: () => [],
    unassignedRoles: [],
  };
}

// ─── Import generator ────────────────────────────────────────────────────────

import { generateHCL } from "../hclGenerator.js";

// ─── Test helpers ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function node(id, type, label, config = {}) {
  return { id, data: { resourceType: type, label, config } };
}

function structEdge(source, target) {
  return { id: `e_struct_${source}_${target}`, type: "structural", source, target };
}

function trafficEdge(source, target, ingress = [], egress = []) {
  return { id: `e_traffic_${source}_${target}`, type: "traffic", source, target, data: { ingress, egress } };
}

function assocEdge(source, target) {
  return { id: `e_assoc_${source}_${target}`, type: "association", source, target };
}

// ─── Test 1: Realistic 3-tier with full edge topology ────────────────────────

console.log("\nTest 1: Realistic 3-tier architecture with edges");
{
  const nodes = [
    node("vpc1", "VPC", "prod-vpc", { cidr: "10.0.0.0/16", name: "prod-vpc" }),
    node("sub1", "Subnet", "public-1", { vpcId: "vpc1", cidr: "10.0.1.0/24", visibility: "Public", availability_zone: "us-east-1a", name: "public-1" }),
    node("sub2", "Subnet", "private-1", { vpcId: "vpc1", cidr: "10.0.2.0/24", visibility: "Private", availability_zone: "us-east-1b", name: "private-1" }),
    node("igw1", "IGW", "main-igw", { vpcId: "vpc1", name: "main-igw" }),
    node("nat1", "NATGateway", "main-nat", { subnetId: "sub1", connectivity_type: "public", name: "main-nat" }),
    node("rt1", "RouteTable", "public-rt", { vpcId: "vpc1", routes: [{ cidr: "0.0.0.0/0", target: "igw1" }], name: "public-rt" }),
    node("rt2", "RouteTable", "private-rt", { vpcId: "vpc1", routes: [{ cidr: "0.0.0.0/0", target: "nat1" }], name: "private-rt" }),
    node("lb1", "LoadBalancer", "app-lb", { load_balancer_type: "application", internal: "false", subnets: ["sub1", "sub2"], tg_port: "80", tg_protocol: "HTTP", listener_port: "80", listener_protocol: "HTTP", sg_ids: ["sg1"], name: "app-lb" }),
    node("ec2_1", "EC2", "web-server", { subnetId: "sub1", ami: "ami-0123456789abcdef0", instance_type: "t3.micro", sg_ids: ["sg1"], iam_role_id: "role1", name: "web-server" }),
    node("ecs1", "ECS", "app-service", { subnets: ["sub2"], launch_type: "FARGATE", cpu: "256", memory: "512", image: "nginx:latest", desired_count: "2", container_port: "80", iam_role_id: "role1", sg_ids: ["sg2"], name: "app-service" }),
    node("rds1", "RDS", "app-db", { subnets: ["sub1", "sub2"], engine: "postgres", engine_version: "15.3", instance_class: "db.t3.micro", allocated_storage: "20", username: "admin", password: "secret123", storage_encrypted: "true", sg_ids: ["sg2"], name: "app-db" }),
    node("ec_1", "ElastiCache", "redis-cache", { subnets: ["sub1", "sub2"], engine: "redis", node_type: "cache.t3.micro", num_cache_nodes: "1", sg_ids: ["sg2"], name: "redis-cache" }),
    node("lam1", "Lambda", "processor", { runtime: "python3.12", handler: "index.handler", memory_size: "256", timeout: "30", iam_role_id: "role2", name: "processor" }),
    node("s3_1", "S3", "assets-bucket", { bucket_name: "my-assets-bucket", versioning: "Enabled", encryption: "SSE-S3 (AES-256)", block_public_access: "true", name: "assets-bucket" }),
    node("ddb1", "DynamoDB", "sessions", { table_name: "sessions", billing_mode: "PAY_PER_REQUEST", hash_key: "id", hash_key_type: "S", name: "sessions" }),
    node("sqs1", "SQS", "work-queue", { queue_name: "work-queue", fifo: "false", name: "work-queue" }),
    node("sns1", "SNS", "alerts", { topic_name: "alerts", fifo: "false", name: "alerts" }),
    node("evb1", "EventBridge", "app-bus", { bus_name: "app-events", name: "app-bus" }),
    node("sec1", "SecretsManager", "db-creds", { secret_name: "prod/db/password", name: "db-creds" }),
    node("apigw1", "APIGateway", "public-api", { api_name: "public-api", api_type: "HTTP", stage_name: "prod", name: "public-api" }),
    node("ecr1", "ECR", "app-repo", { repository_name: "my-app/api", image_tag_mutability: "IMMUTABLE", scan_on_push: "true", name: "app-repo" }),
    node("r53_1", "Route53", "app-dns", { hosted_zone_name: "example.com", zone_type: "public", name: "app-dns" }),
    node("kin1", "Kinesis", "data-stream", { stream_name: "app-events", stream_mode: "ON_DEMAND", name: "data-stream" }),
    node("acm1", "ACM", "app-cert", { domain_name: "example.com", validation_method: "DNS", name: "app-cert" }),
    node("cf1", "CloudFront", "app-cdn", { origin_type: "S3", origin_id: "s3_1", price_class: "PriceClass_100", viewer_protocol_policy: "redirect-to-https", acm_certificate_id: "acm1", name: "app-cdn" }),
    node("waf1", "WAF", "app-waf", { waf_name: "app-waf", scope: "CLOUDFRONT", managed_rules: ["AWSManagedRulesCommonRuleSet"], default_action: "allow", name: "app-waf" }),
    node("asg1", "ASG", "web-asg", { subnets: ["sub1", "sub2"], ami: "ami-0123456789abcdef0", instance_type: "t3.micro", min_size: "1", max_size: "4", desired_capacity: "2", sg_ids: ["sg1"], iam_role_id: "role1", name: "web-asg" }),
  ];

  const edges = [
    // Structural: VPC → Subnets, VPC → IGW
    structEdge("vpc1", "sub1"),
    structEdge("vpc1", "sub2"),
    structEdge("vpc1", "igw1"),
    // Associations: RT ↔ Subnet
    assocEdge("rt1", "sub1"),
    assocEdge("rt2", "sub2"),
    // Traffic: LB → EC2 → RDS, LB → ECS → ElastiCache, EC2 → S3 (API)
    trafficEdge("lb1", "ec2_1", [{ port: 80, protocol: "tcp" }], []),
    trafficEdge("lb1", "ecs1", [{ port: 80, protocol: "tcp" }], []),
    trafficEdge("ec2_1", "rds1", [{ port: 5432, protocol: "tcp" }], []),
    trafficEdge("ecs1", "ec_1", [{ port: 6379, protocol: "tcp" }], []),
    trafficEdge("ecs1", "rds1", [{ port: 5432, protocol: "tcp" }], []),
    trafficEdge("lam1", "ddb1", [], []),
    trafficEdge("lam1", "sqs1", [], []),
  ];

  const roles = [
    { id: "role1", name: "app-role", color: "#4d6bfe", policies: [{ name: "AmazonS3ReadOnlyAccess", arn: "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess" }] },
    { id: "role2", name: "lambda-role", color: "#ff9900", policies: [{ name: "AWSLambdaBasicExecutionRole", arn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" }] },
  ];

  const sgs = [
    { id: "sg1", name: "web-sg", color: "#52c41a", inbound: [{ port: "80", protocol: "tcp", cidr: "0.0.0.0/0" }], outbound: [] },
    { id: "sg2", name: "internal-sg", color: "#1890ff", inbound: [{ port: "5432", protocol: "tcp", cidr: "10.0.0.0/16" }], outbound: [] },
  ];

  const ctx = buildTestContext(nodes, edges, roles, sgs);
  const result = generateHCL(ctx, "us-east-1");

  // --- Basics ---
  assert(typeof result.hcl === "string", "Returns HCL string");
  assert(result.hcl.length > 500, `HCL is substantial (${result.hcl.length} chars)`);
  assert(!result.hcl.includes("undefined"), "No 'undefined' in HCL output");
  assert(!result.hcl.includes("MISSING_"), "No MISSING_ placeholders in output");
  assert(result.warnings.length === 0, `No warnings (got ${result.warnings.length}: ${result.warnings.join("; ")})`);
  assert(typeof result.reverse === "object", "Returns reverse name map");

  // --- All 22 resource type blocks present ---
  const expectedBlocks = [
    ['resource "aws_vpc"', "VPC"],
    ['resource "aws_subnet"', "Subnet"],
    ['resource "aws_instance"', "EC2"],
    ['resource "aws_db_instance"', "RDS"],
    ['resource "aws_lb"', "LB"],
    ['resource "aws_s3_bucket"', "S3"],
    ['resource "aws_lambda_function"', "Lambda"],
    ['resource "aws_dynamodb_table"', "DynamoDB"],
    ['resource "aws_sqs_queue"', "SQS"],
    ['resource "aws_sns_topic"', "SNS"],
    ['resource "aws_cloudwatch_event_bus"', "EventBridge"],
    ['resource "aws_secretsmanager_secret"', "SecretsManager"],
    ['resource "aws_apigatewayv2_api"', "API Gateway"],
    ['resource "aws_ecs_service"', "ECS"],
    ['resource "aws_elasticache_cluster"', "ElastiCache"],
    ['resource "aws_ecr_repository"', "ECR"],
    ['resource "aws_route53_zone"', "Route53"],
    ['resource "aws_kinesis_stream"', "Kinesis"],
    ['resource "aws_acm_certificate"', "ACM"],
    ['resource "aws_cloudfront_distribution"', "CloudFront"],
    ['resource "aws_wafv2_web_acl"', "WAF"],
    ['resource "aws_launch_template"', "ASG Launch Template"],
    ['resource "aws_autoscaling_group"', "ASG"],
    ['resource "aws_internet_gateway"', "IGW"],
    ['resource "aws_nat_gateway"', "NAT"],
    ['resource "aws_route_table"', "RT"],
    ['resource "aws_route_table_association"', "RT association"],
    ['provider "aws"', "Provider"],
  ];
  expectedBlocks.forEach(([snippet, label]) => {
    assert(result.hcl.includes(snippet), `Contains ${label} block`);
  });

  assert(result.hcl.includes('region = "us-east-1"'), "Region is set correctly");
}

// ─── Test 2: Cross-resource reference resolution ─────────────────────────────

console.log("\nTest 2: Cross-resource references resolve correctly");
{
  const nodes = [
    node("vpc1", "VPC", "my-vpc", { cidr: "10.0.0.0/16", name: "my-vpc" }),
    node("sub1", "Subnet", "my-sub", { vpcId: "vpc1", cidr: "10.0.1.0/24", visibility: "Public", availability_zone: "us-east-1a", name: "my-sub" }),
    node("igw1", "IGW", "my-igw", { vpcId: "vpc1", name: "my-igw" }),
    node("nat1", "NATGateway", "my-nat", { subnetId: "sub1", connectivity_type: "public", name: "my-nat" }),
    node("rt1", "RouteTable", "my-rt", { vpcId: "vpc1", routes: [{ cidr: "0.0.0.0/0", target: "igw1" }], name: "my-rt" }),
    node("ec2_1", "EC2", "my-ec2", { subnetId: "sub1", ami: "ami-abc", instance_type: "t3.micro", name: "my-ec2" }),
    node("rds1", "RDS", "my-rds", { subnets: ["sub1"], engine: "postgres", engine_version: "15.3", instance_class: "db.t3.micro", allocated_storage: "20", username: "admin", password: "pw", name: "my-rds" }),
    node("lb1", "LoadBalancer", "my-lb", { load_balancer_type: "application", internal: "false", subnets: ["sub1"], tg_port: "80", tg_protocol: "HTTP", listener_port: "80", listener_protocol: "HTTP", name: "my-lb" }),
    node("ec_1", "ElastiCache", "my-cache", { subnets: ["sub1"], engine: "redis", node_type: "cache.t3.micro", num_cache_nodes: "1", name: "my-cache" }),
  ];

  const edges = [
    assocEdge("rt1", "sub1"),
    trafficEdge("lb1", "ec2_1", [{ port: 80, protocol: "tcp" }], []),
    trafficEdge("ec2_1", "rds1", [{ port: 5432, protocol: "tcp" }], []),
  ];

  const ctx = buildTestContext(nodes, edges, [], []);
  const result = generateHCL(ctx, "us-east-1");
  const hcl = result.hcl;

  assert(result.warnings.length === 0, `No warnings (got ${result.warnings.length})`);
  assert(!hcl.includes("undefined"), "No 'undefined' in cross-ref output");

  // Subnet references VPC id
  assert(hcl.includes("aws_vpc.my_vpc.id"), "Subnet refs VPC id via r.ref()");
  // EC2 references subnet id
  assert(hcl.includes("aws_subnet.my_sub.id"), "EC2 refs Subnet id via r.ref()");
  // IGW references VPC id
  assert(/aws_internet_gateway[\s\S]*aws_vpc\.my_vpc\.id/.test(hcl), "IGW refs VPC id");
  // NAT references subnet id
  assert(/aws_nat_gateway[\s\S]*aws_subnet\.my_sub\.id/.test(hcl), "NAT refs Subnet id");
  // Route table references VPC id
  assert(/aws_route_table[\s\S]*aws_vpc\.my_vpc\.id/.test(hcl), "RT refs VPC id");
  // RT association references both RT and subnet
  assert(hcl.includes("aws_route_table.my_rt.id"), "RT association refs RT id");
  // Route references IGW
  assert(hcl.includes("aws_internet_gateway.my_igw.id"), "Route refs IGW id");
  // LB references subnets
  assert(/aws_lb[\s\S]*aws_subnet\.my_sub\.id/.test(hcl), "LB refs subnet ids");
}

// ─── Test 3: Security Group generation ───────────────────────────────────────

console.log("\nTest 3: Security Group generation");
{
  const nodes = [
    node("vpc1", "VPC", "sg-vpc", { cidr: "10.0.0.0/16", name: "sg-vpc" }),
    node("sub1", "Subnet", "sg-sub", { vpcId: "vpc1", cidr: "10.0.1.0/24", visibility: "Public", availability_zone: "us-east-1a", name: "sg-sub" }),
    node("ec2_1", "EC2", "sg-ec2", { subnetId: "sub1", ami: "ami-abc", instance_type: "t3.micro", sg_ids: ["sg1"], name: "sg-ec2" }),
  ];

  const sgs = [
    {
      id: "sg1", name: "test-sg", color: "#52c41a",
      inbound: [
        { port: "443", protocol: "tcp", cidr: "0.0.0.0/0" },
        { port: "22", protocol: "tcp", cidr: "10.0.0.0/8" },
      ],
      outbound: [
        { port: "443", protocol: "tcp", cidr: "0.0.0.0/0" },
      ],
    },
  ];

  const ctx = buildTestContext(nodes, [], [], sgs);
  const result = generateHCL(ctx, "us-east-1");
  const hcl = result.hcl;

  assert(hcl.includes('resource "aws_security_group"'), "SG resource block generated");
  assert(hcl.includes("aws_vpc.sg_vpc.id"), "SG references correct VPC via node's subnet");

  // Ingress rules
  const ingressCount = (hcl.match(/ingress\s*\{/g) || []).length;
  assert(ingressCount === 2, `SG has 2 ingress blocks (got ${ingressCount})`);
  assert(hcl.includes("from_port = 443"), "SG has port 443 ingress");
  assert(hcl.includes("from_port = 22"), "SG has port 22 ingress");

  // Explicit egress rule (not default)
  const egressCount = (hcl.match(/egress\s*\{/g) || []).length;
  assert(egressCount >= 1, `SG has at least 1 egress block (got ${egressCount})`);

  // EC2 references SG
  assert(hcl.includes("aws_security_group.test_sg.id"), "EC2 refs SG id");
}

// ─── Test 4: IAM role generation ─────────────────────────────────────────────

console.log("\nTest 4: IAM role generation");
{
  const nodes = [
    node("vpc1", "VPC", "iam-vpc", { cidr: "10.0.0.0/16", name: "iam-vpc" }),
    node("sub1", "Subnet", "iam-sub", { vpcId: "vpc1", cidr: "10.0.1.0/24", visibility: "Public", availability_zone: "us-east-1a", name: "iam-sub" }),
    // EC2 with role → should produce instance_profile + ec2.amazonaws.com in assume_role_policy
    node("ec2_1", "EC2", "iam-ec2", { subnetId: "sub1", ami: "ami-abc", instance_type: "t3.micro", iam_role_id: "role1", name: "iam-ec2" }),
    // Lambda with different role → lambda.amazonaws.com, no instance_profile
    node("lam1", "Lambda", "iam-lambda", { runtime: "python3.12", handler: "index.handler", memory_size: "128", timeout: "30", iam_role_id: "role2", name: "iam-lambda" }),
    // ECS with shared role → ecs-tasks.amazonaws.com
    node("ecs1", "ECS", "iam-ecs", { subnets: ["sub1"], launch_type: "FARGATE", cpu: "256", memory: "512", image: "nginx:latest", desired_count: "1", container_port: "80", iam_role_id: "role1", name: "iam-ecs" }),
  ];

  const roles = [
    { id: "role1", name: "multi-role", color: "#4d6bfe", policies: [
      { name: "AmazonS3ReadOnlyAccess", arn: "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess" },
    ] },
    { id: "role2", name: "lambda-exec", color: "#ff9900", policies: [
      { name: "AWSLambdaBasicExecutionRole", arn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" },
    ] },
  ];

  const ctx = buildTestContext(nodes, [], roles, []);
  const result = generateHCL(ctx, "us-east-1");
  const hcl = result.hcl;

  assert(hcl.includes('resource "aws_iam_role"'), "IAM role resource generated");

  // role1 assigned to EC2 + ECS → assume_role_policy should have both services
  assert(hcl.includes("ec2.amazonaws.com"), "role1 has ec2.amazonaws.com in assume_role_policy");
  assert(hcl.includes("ecs-tasks.amazonaws.com"), "role1 has ecs-tasks.amazonaws.com in assume_role_policy");

  // role2 assigned to Lambda only
  assert(hcl.includes("lambda.amazonaws.com"), "role2 has lambda.amazonaws.com in assume_role_policy");

  // Instance profile for EC2 (role1 is assigned to EC2)
  assert(hcl.includes('resource "aws_iam_instance_profile"'), "Instance profile generated for EC2 role");

  // Policy attachments
  assert(hcl.includes('resource "aws_iam_role_policy_attachment"'), "Policy attachment generated");
  assert(hcl.includes("AmazonS3ReadOnlyAccess"), "S3 read policy attached");
  assert(hcl.includes("AWSLambdaBasicExecutionRole"), "Lambda exec policy attached");

  // EC2 references its IAM instance profile
  assert(hcl.includes("aws_iam_instance_profile.multi_role.name"), "EC2 refs instance profile");

  // Lambda references its IAM role ARN
  assert(hcl.includes("aws_iam_role.lambda_exec.arn"), "Lambda refs IAM role ARN");
}

// ─── Test 5: Dangling references ─────────────────────────────────────────────

console.log("\nTest 5: Dangling references produce warnings");
{
  const nodes = [
    node("sub1", "Subnet", "orphan-subnet", { vpcId: "deleted_vpc", cidr: "10.0.1.0/24", visibility: "Public", availability_zone: "us-east-1a" }),
    node("ec2_1", "EC2", "orphan-ec2", { subnetId: "deleted_subnet", ami: "ami-abc", instance_type: "t3.micro", sg_ids: ["deleted_sg"] }),
    node("rds1", "RDS", "orphan-rds", { subnets: ["deleted_sub1", "deleted_sub2"], engine: "postgres", engine_version: "15.3", instance_class: "db.t3.micro", allocated_storage: "20", username: "admin", password: "pw", name: "orphan-rds" }),
  ];

  const ctx = buildTestContext(nodes, [], [], []);
  const result = generateHCL(ctx, "us-east-1");

  assert(!result.hcl.includes("undefined"), "No 'undefined' in dangling-ref output");
  assert(result.warnings.length > 0, `Warnings collected (got ${result.warnings.length})`);
  assert(result.hcl.includes("WARNING"), "HCL contains WARNING comments for broken refs");

  // Verify warnings mention the right labels
  const warnText = result.warnings.join(" ");
  assert(warnText.includes("orphan-subnet") || warnText.includes("orphan_subnet"), "Warning mentions orphan-subnet");
  assert(warnText.includes("orphan-ec2") || warnText.includes("orphan_ec2"), "Warning mentions orphan-ec2");
}

// ─── Test 6: Empty canvas ────────────────────────────────────────────────────

console.log("\nTest 6: Empty canvas");
{
  const ctx = buildTestContext([], [], [], []);
  const result = generateHCL(ctx, "eu-west-1");

  assert(typeof result.hcl === "string", "Returns HCL string for empty canvas");
  assert(result.hcl.includes('provider "aws"'), "Contains provider block");
  assert(result.hcl.includes('region = "eu-west-1"'), "Region is set correctly");
  assert(result.warnings.length === 0, "No warnings for empty canvas");
  assert(!result.hcl.includes("undefined"), "No 'undefined' in empty canvas output");

  // Should only have provider/terraform blocks, no resource blocks
  const resourceCount = (result.hcl.match(/resource "/g) || []).length;
  assert(resourceCount === 0, `No resource blocks in empty canvas (got ${resourceCount})`);
}

// ─── Test 7: Default egress rule on SG with no outbound ──────────────────────

console.log("\nTest 7: SG default egress when no outbound rules");
{
  const nodes = [
    node("vpc1", "VPC", "egress-vpc", { cidr: "10.0.0.0/16", name: "egress-vpc" }),
    node("sub1", "Subnet", "egress-sub", { vpcId: "vpc1", cidr: "10.0.1.0/24", visibility: "Public", availability_zone: "us-east-1a", name: "egress-sub" }),
    node("ec2_1", "EC2", "egress-ec2", { subnetId: "sub1", ami: "ami-abc", instance_type: "t3.micro", sg_ids: ["sg1"], name: "egress-ec2" }),
  ];

  const sgs = [
    { id: "sg1", name: "no-outbound-sg", color: "#52c41a", inbound: [{ port: "80", protocol: "tcp", cidr: "0.0.0.0/0" }], outbound: [] },
  ];

  const ctx = buildTestContext(nodes, [], [], sgs);
  const result = generateHCL(ctx, "us-east-1");
  const hcl = result.hcl;

  // Should have default allow-all egress
  const egressCount = (hcl.match(/egress\s*\{/g) || []).length;
  assert(egressCount === 1, `Default egress block added (got ${egressCount})`);
  assert(hcl.includes('protocol = "-1"'), "Default egress uses protocol -1 (all)");
}

// ─── Test 8: Multiple resources of same type get unique names ────────────────

console.log("\nTest 8: Name deduplication for same-type resources");
{
  const nodes = [
    node("vpc1", "VPC", "vpc", { cidr: "10.0.0.0/16", name: "vpc" }),
    node("sub1", "Subnet", "sub-a", { vpcId: "vpc1", cidr: "10.0.1.0/24", visibility: "Public", availability_zone: "us-east-1a", name: "sub-a" }),
    node("sub2", "Subnet", "sub-b", { vpcId: "vpc1", cidr: "10.0.2.0/24", visibility: "Private", availability_zone: "us-east-1b", name: "sub-b" }),
    node("sub3", "Subnet", "sub-c", { vpcId: "vpc1", cidr: "10.0.3.0/24", visibility: "Private", availability_zone: "us-east-1c", name: "sub-c" }),
  ];

  const ctx = buildTestContext(nodes, [], [], []);
  const result = generateHCL(ctx, "us-east-1");

  // Count distinct subnet resource blocks
  const subnetBlocks = (result.hcl.match(/resource "aws_subnet"/g) || []).length;
  assert(subnetBlocks === 3, `3 distinct subnet blocks generated (got ${subnetBlocks})`);
  assert(!result.hcl.includes("undefined"), "No 'undefined' in multi-resource output");
  assert(result.warnings.length === 0, "No warnings for valid multi-resource canvas");
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
