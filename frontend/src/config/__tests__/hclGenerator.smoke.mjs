/**
 * Smoke test for HCL Generator.
 *
 * Run: node frontend/src/config/__tests__/hclGenerator.smoke.mjs
 *
 * Tests:
 *   1. Realistic 3-tier canvas → generates HCL for all resource types, no "undefined"
 *   2. Dangling references → warnings collected, no "undefined" in output
 *   3. Empty canvas → produces only provider block, no crash
 */

// ─── Minimal buildContext stub ───────────────────────────────────────────────
// We can't import the real buildContext (it imports from resourceRegistry which
// uses ES module syntax). Instead, build a minimal ctx that matches the shape
// the generator expects.

function buildTestContext(nodes, edges, roles = [], securityGroups = []) {
  const byType = (type) => nodes.filter((n) => n.data?.resourceType === type);
  const nodeById = (id) => nodes.find((n) => n.id === id);

  const TYPES = [
    "VPC", "Subnet", "EC2", "RDS", "LoadBalancer", "ECS", "IGW", "NATGateway",
    "RouteTable", "S3", "Lambda", "DynamoDB", "SQS", "SNS", "EventBridge",
    "SecretsManager", "APIGateway", "ElastiCache", "ECR", "Route53", "Kinesis",
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
    return assignedIds.map((sgId, idx) => {
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
    iamCapableNodes: nodes.filter((n) => ["EC2", "ECS", "Lambda"].includes(n.data?.resourceType)),
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

// ─── Test 1: Realistic 3-tier architecture ───────────────────────────────────

console.log("\nTest 1: Realistic 3-tier architecture");
{
  const nodes = [
    node("vpc1", "VPC", "prod-vpc", { cidr: "10.0.0.0/16", name: "prod-vpc" }),
    node("sub1", "Subnet", "public-1", { vpcId: "vpc1", cidr: "10.0.1.0/24", visibility: "Public", availability_zone: "us-east-1a", name: "public-1" }),
    node("sub2", "Subnet", "private-1", { vpcId: "vpc1", cidr: "10.0.2.0/24", visibility: "Private", availability_zone: "us-east-1b", name: "private-1" }),
    node("igw1", "IGW", "main-igw", { vpcId: "vpc1", name: "main-igw" }),
    node("nat1", "NATGateway", "main-nat", { subnetId: "sub1", connectivity_type: "public", name: "main-nat" }),
    node("rt1", "RouteTable", "public-rt", { vpcId: "vpc1", routes: [{ cidr: "0.0.0.0/0", target: "igw1" }], name: "public-rt" }),
    node("ec2_1", "EC2", "web-server", { subnetId: "sub1", ami: "ami-0123456789abcdef0", instance_type: "t3.micro", sg_ids: ["sg1"], iam_role_id: "role1", name: "web-server" }),
    node("rds1", "RDS", "app-db", { subnets: ["sub1", "sub2"], engine: "postgres", engine_version: "15.3", instance_class: "db.t3.micro", allocated_storage: "20", username: "admin", password: "secret123", storage_encrypted: "true", sg_ids: ["sg1"], name: "app-db" }),
    node("lb1", "LoadBalancer", "app-lb", { load_balancer_type: "application", internal: "false", subnets: ["sub1", "sub2"], tg_port: "80", tg_protocol: "HTTP", listener_port: "80", listener_protocol: "HTTP", sg_ids: ["sg1"], name: "app-lb" }),
    node("s3_1", "S3", "assets-bucket", { bucket_name: "my-assets-bucket", versioning: "Enabled", encryption: "SSE-S3 (AES-256)", block_public_access: "true", name: "assets-bucket" }),
    node("lam1", "Lambda", "processor", { runtime: "python3.12", handler: "index.handler", memory_size: "256", timeout: "30", iam_role_id: "role1", name: "processor" }),
    node("ddb1", "DynamoDB", "sessions", { table_name: "sessions", billing_mode: "PAY_PER_REQUEST", hash_key: "id", hash_key_type: "S", name: "sessions" }),
    node("sqs1", "SQS", "work-queue", { queue_name: "work-queue", fifo: "false", name: "work-queue" }),
    node("sns1", "SNS", "alerts", { topic_name: "alerts", fifo: "false", name: "alerts" }),
    node("evb1", "EventBridge", "app-bus", { bus_name: "app-events", name: "app-bus" }),
    node("sec1", "SecretsManager", "db-creds", { secret_name: "prod/db/password", name: "db-creds" }),
    node("apigw1", "APIGateway", "public-api", { api_name: "public-api", api_type: "HTTP", stage_name: "prod", name: "public-api" }),
    node("ecs1", "ECS", "app-service", { subnets: ["sub2"], launch_type: "FARGATE", cpu: "256", memory: "512", image: "nginx:latest", desired_count: "2", container_port: "80", iam_role_id: "role1", name: "app-service" }),
    node("ec_1", "ElastiCache", "redis-cache", { subnets: ["sub1", "sub2"], engine: "redis", node_type: "cache.t3.micro", num_cache_nodes: "1", sg_ids: ["sg1"], name: "redis-cache" }),
    node("ecr1", "ECR", "app-repo", { repository_name: "my-app/api", image_tag_mutability: "IMMUTABLE", scan_on_push: "true", name: "app-repo" }),
    node("r53_1", "Route53", "app-dns", { hosted_zone_name: "example.com", zone_type: "public", name: "app-dns" }),
    node("kin1", "Kinesis", "data-stream", { stream_name: "app-events", stream_mode: "ON_DEMAND", name: "data-stream" }),
  ];

  const edges = [
    { id: "e_assoc_rt1_sub1", type: "association", source: "rt1", target: "sub1" },
  ];

  const roles = [
    { id: "role1", name: "app-role", color: "#4d6bfe", policies: [{ name: "AmazonS3ReadOnlyAccess", arn: "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess" }] },
  ];

  const sgs = [
    { id: "sg1", name: "web-sg", color: "#52c41a", inbound: [{ port: "80", protocol: "tcp", cidr: "0.0.0.0/0" }], outbound: [] },
  ];

  const ctx = buildTestContext(nodes, edges, roles, sgs);
  const result = generateHCL(ctx, "us-east-1");

  assert(typeof result.hcl === "string", "Returns HCL string");
  assert(result.hcl.length > 500, `HCL is substantial (${result.hcl.length} chars)`);
  assert(!result.hcl.includes("undefined"), "No 'undefined' in HCL output");
  assert(!result.hcl.includes("MISSING_"), "No MISSING_ placeholders in output");
  assert(result.warnings.length === 0, `No warnings (got ${result.warnings.length})`);
  assert(typeof result.reverse === "object", "Returns reverse name map");

  // Check key resource blocks exist
  assert(result.hcl.includes('resource "aws_vpc"'), "Contains VPC resource");
  assert(result.hcl.includes('resource "aws_subnet"'), "Contains Subnet resource");
  assert(result.hcl.includes('resource "aws_instance"'), "Contains EC2 resource");
  assert(result.hcl.includes('resource "aws_db_instance"'), "Contains RDS resource");
  assert(result.hcl.includes('resource "aws_lb"'), "Contains LB resource");
  assert(result.hcl.includes('resource "aws_s3_bucket"'), "Contains S3 resource");
  assert(result.hcl.includes('resource "aws_lambda_function"'), "Contains Lambda resource");
  assert(result.hcl.includes('resource "aws_dynamodb_table"'), "Contains DynamoDB resource");
  assert(result.hcl.includes('resource "aws_sqs_queue"'), "Contains SQS resource");
  assert(result.hcl.includes('resource "aws_sns_topic"'), "Contains SNS resource");
  assert(result.hcl.includes('resource "aws_cloudwatch_event_bus"'), "Contains EventBridge resource");
  assert(result.hcl.includes('resource "aws_secretsmanager_secret"'), "Contains SecretsManager resource");
  assert(result.hcl.includes('resource "aws_apigatewayv2_api"'), "Contains API Gateway resource");
  assert(result.hcl.includes('resource "aws_ecs_service"'), "Contains ECS resource");
  assert(result.hcl.includes('resource "aws_elasticache_cluster"'), "Contains ElastiCache resource");
  assert(result.hcl.includes('resource "aws_ecr_repository"'), "Contains ECR resource");
  assert(result.hcl.includes('resource "aws_route53_zone"'), "Contains Route53 resource");
  assert(result.hcl.includes('resource "aws_kinesis_stream"'), "Contains Kinesis resource");
  assert(result.hcl.includes('resource "aws_security_group"'), "Contains SG resource");
  assert(result.hcl.includes('resource "aws_iam_role"'), "Contains IAM role resource");
  assert(result.hcl.includes('resource "aws_iam_instance_profile"'), "Contains IAM instance profile");
  assert(result.hcl.includes('resource "aws_internet_gateway"'), "Contains IGW resource");
  assert(result.hcl.includes('resource "aws_nat_gateway"'), "Contains NAT resource");
  assert(result.hcl.includes('resource "aws_route_table"'), "Contains RT resource");
  assert(result.hcl.includes('resource "aws_route_table_association"'), "Contains RT association");
  assert(result.hcl.includes('provider "aws"'), "Contains provider block");
  assert(result.hcl.includes('region = "us-east-1"'), "Region is set correctly");
}

// ─── Test 2: Dangling references ─────────────────────────────────────────────

console.log("\nTest 2: Dangling references");
{
  const nodes = [
    // Subnet references a VPC that doesn't exist
    node("sub1", "Subnet", "orphan-subnet", { vpcId: "deleted_vpc", cidr: "10.0.1.0/24", visibility: "Public", availability_zone: "us-east-1a" }),
    // EC2 references a deleted subnet and deleted SG
    node("ec2_1", "EC2", "orphan-ec2", { subnetId: "deleted_subnet", ami: "ami-abc", instance_type: "t3.micro", sg_ids: ["deleted_sg"] }),
  ];

  const ctx = buildTestContext(nodes, [], [], []);
  const result = generateHCL(ctx, "us-east-1");

  assert(!result.hcl.includes("undefined"), "No 'undefined' in dangling-ref output");
  assert(result.warnings.length > 0, `Warnings collected (got ${result.warnings.length})`);
  assert(result.hcl.includes("WARNING"), "HCL contains WARNING comments for broken refs");
}

// ─── Test 3: Empty canvas ────────────────────────────────────────────────────

console.log("\nTest 3: Empty canvas");
{
  const ctx = buildTestContext([], [], [], []);
  const result = generateHCL(ctx, "eu-west-1");

  assert(typeof result.hcl === "string", "Returns HCL string for empty canvas");
  assert(result.hcl.includes('provider "aws"'), "Contains provider block");
  assert(result.hcl.includes('region = "eu-west-1"'), "Region is set correctly");
  assert(result.warnings.length === 0, "No warnings for empty canvas");
  assert(!result.hcl.includes("undefined"), "No 'undefined' in empty canvas output");
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
