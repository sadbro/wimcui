/**
 * HCL Generator — converts canvas context to Terraform HCL.
 *
 * Covers all 22 resource types in the registry:
 *   Network:  VPC, Subnet, IGW, NATGateway, RouteTable
 *   Compute:  EC2, RDS, LoadBalancer, ECS, ElastiCache
 *   Global:   S3, Lambda, DynamoDB, SQS, SNS, EventBridge, SecretsManager,
 *             APIGateway, ECR, Route53, Kinesis
 *   Cross-cutting: Security Groups, IAM Roles
 *
 * Entry point: generateHCL(ctx, region) → string
 */

// ─── Name Utilities ──────────────────────────────────────────────────────────

/** Convert a label to a valid Terraform resource name */
function tfName(label) {
  return (label || "unnamed")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/_{2,}/g, "_") || "unnamed";
}

/**
 * Build a name registry — maps canvas node IDs to unique TF resource names.
 * Handles deduplication by appending _2, _3, etc.
 * Also builds reverse map (tfName → nodeId) for error mapping.
 */
function buildNameRegistry(nodes) {
  const reg = {};
  const reverse = {};
  const counts = {};
  nodes.forEach((n) => {
    let base = tfName(n.data?.label || n.data?.resourceType || "resource");
    if (counts[base]) {
      counts[base]++;
      base = `${base}_${counts[base]}`;
    } else {
      counts[base] = 1;
    }
    reg[n.id] = base;
    reverse[base] = n.id;
  });
  return { names: reg, reverse };
}

// ─── Reference Resolution ────────────────────────────────────────────────────

/**
 * Creates a safe reference resolver that collects warnings for broken refs.
 * Every generator should use this instead of raw `names[id]` lookups.
 *
 *   const r = createRefResolver(names, warnings, "my_ec2");
 *   r.ref("aws_vpc", cfg.vpcId, "id")    → "aws_vpc.my_vpc.id"  or null + warning
 *   r.name(someId)                         → "my_vpc"              or null + warning
 *   r.list("aws_subnet", subnetIds, "id") → ["aws_subnet.a.id", ...] (filters broken)
 */
function createRefResolver(names, warnings, sourceLabel) {
  return {
    /** Resolve a single reference: tfType.names[id].prop */
    ref(tfType, id, prop) {
      if (!id) return null;
      const resolved = names[id];
      if (!resolved) {
        warnings.push(`${sourceLabel}: references a missing ${tfType} (node was deleted or unlinked)`);
        return null;
      }
      return `${tfType}.${resolved}.${prop}`;
    },

    /** Resolve just the name — for inline string interpolation */
    name(id) {
      if (!id) return null;
      const resolved = names[id];
      if (!resolved) {
        warnings.push(`${sourceLabel}: references a missing resource (node was deleted or unlinked)`);
        return null;
      }
      return resolved;
    },

    /** Resolve a list of refs, filtering out broken ones */
    list(tfType, ids, prop) {
      if (!ids || ids.length === 0) return [];
      return ids
        .map((id) => this.ref(tfType, id, prop))
        .filter(Boolean);
    },
  };
}

// ─── HCL Formatting Helpers ──────────────────────────────────────────────────

const indent = (level) => "  ".repeat(level);

function block(type, name, label, body, level = 0) {
  const lines = [`${indent(level)}resource "${type}" "${label}" {`];
  lines.push(...body.filter(Boolean));
  lines.push(`${indent(level)}}`);
  return lines.join("\n");
}

function attr(key, value, level = 1) {
  if (value === undefined || value === null || value === "") return null;
  return `${indent(level)}${key} = "${value}"`;
}

function rawAttr(key, value, level = 1) {
  if (value === undefined || value === null) return null;
  return `${indent(level)}${key} = ${value}`;
}

function boolAttr(key, value, level = 1) {
  if (value === undefined || value === null || value === "") return null;
  return `${indent(level)}${key} = ${value === "true" || value === true ? "true" : "false"}`;
}

function numAttr(key, value, level = 1) {
  if (value === undefined || value === null || value === "") return null;
  const n = parseInt(value, 10);
  if (isNaN(n)) return null;
  return `${indent(level)}${key} = ${n}`;
}

function refAttr(key, refType, refName, refProp, level = 1) {
  return `${indent(level)}${key} = ${refType}.${refName}.${refProp}`;
}

function listAttr(key, items, level = 1) {
  if (!items || items.length === 0) return null;
  return `${indent(level)}${key} = [${items.map((i) => `"${i}"`).join(", ")}]`;
}

function refListAttr(key, refs, level = 1) {
  if (!refs || refs.length === 0) return null;
  return `${indent(level)}${key} = [${refs.join(", ")}]`;
}

function innerBlock(name, body, level = 1) {
  const filtered = body.filter(Boolean);
  if (filtered.length === 0) return null;
  const lines = [`${indent(level)}${name} {`];
  lines.push(...filtered);
  lines.push(`${indent(level)}}`);
  return lines.join("\n");
}

/** HCL2 map assignment block: `name = { ... }` — used for tags, environment, etc. */
function mapBlock(name, body, level = 1) {
  const filtered = body.filter(Boolean);
  if (filtered.length === 0) return null;
  const lines = [`${indent(level)}${name} = {`];
  lines.push(...filtered);
  lines.push(`${indent(level)}}`);
  return lines.join("\n");
}

function comment(text, level = 0) {
  return `${indent(level)}# ${text}`;
}

// ─── Terraform Type Map ──────────────────────────────────────────────────────

const TF_TYPE_MAP = {
  VPC:            "aws_vpc",
  Subnet:         "aws_subnet",
  EC2:            "aws_instance",
  RDS:            "aws_db_instance",
  LoadBalancer:   "aws_lb",
  IGW:            "aws_internet_gateway",
  NATGateway:     "aws_nat_gateway",
  RouteTable:     "aws_route_table",
  ECS:            "aws_ecs_service",
  S3:             "aws_s3_bucket",
  Lambda:         "aws_lambda_function",
  DynamoDB:       "aws_dynamodb_table",
  SQS:            "aws_sqs_queue",
  SNS:            "aws_sns_topic",
  EventBridge:    "aws_cloudwatch_event_bus",
  SecretsManager: "aws_secretsmanager_secret",
  APIGateway:     "aws_apigatewayv2_api",
  ElastiCache:    "aws_elasticache_cluster",
  ECR:            "aws_ecr_repository",
  Route53:        "aws_route53_zone",
  Kinesis:        "aws_kinesis_stream",
  ACM:            "aws_acm_certificate",
  CloudFront:     "aws_cloudfront_distribution",
  WAF:            "aws_wafv2_web_acl",
  ASG:            "aws_autoscaling_group",
};

// ─── Per-Resource Generators ─────────────────────────────────────────────────
// Each receives (nodes, names, ctx, warnings) and returns an array of HCL block strings.
// All cross-resource references go through createRefResolver — no raw names[id] lookups.

const generators = {

  // ─── VPC ─────────────────────────────────────────────────────────────────
  VPC(nodes, names, ctx, warnings) {
    return nodes.map((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      return block("aws_vpc", name, name, [
        attr("cidr_block", cfg.cidr),
        rawAttr("enable_dns_support", "true"),
        rawAttr("enable_dns_hostnames", "true"),
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]);
    });
  },

  // ─── Subnet ──────────────────────────────────────────────────────────────
  Subnet(nodes, names, ctx, warnings) {
    return nodes.map((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);
      const vpcRef = r.ref("aws_vpc", cfg.vpcId, "id");
      return block("aws_subnet", name, name, [
        vpcRef ? rawAttr("vpc_id", vpcRef) : comment("WARNING: missing VPC reference"),
        attr("cidr_block", cfg.cidr),
        attr("availability_zone", cfg.availability_zone),
        cfg.visibility === "Public" ? boolAttr("map_public_ip_on_launch", "true") : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]);
    });
  },

  // ─── Internet Gateway ────────────────────────────────────────────────────
  IGW(nodes, names, ctx, warnings) {
    return nodes.map((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);
      const vpcRef = r.ref("aws_vpc", cfg.vpcId, "id");
      return block("aws_internet_gateway", name, name, [
        vpcRef ? rawAttr("vpc_id", vpcRef) : comment("WARNING: missing VPC reference"),
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]);
    });
  },

  // ─── NAT Gateway ─────────────────────────────────────────────────────────
  NATGateway(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);
      const subnetRef = r.ref("aws_subnet", cfg.subnetId, "id");

      // EIP for NAT
      if (cfg.allocate_eip !== "false") {
        blocks.push(block("aws_eip", `${name}_eip`, `${name}_eip`, [
          rawAttr("domain", '"vpc"'),
          "",
          mapBlock("tags", [
            attr("Name", `${cfg.name || n.data?.label}-eip`, 2),
          ]),
        ]));
      }

      blocks.push(block("aws_nat_gateway", name, name, [
        cfg.allocate_eip !== "false"
          ? rawAttr("allocation_id", `aws_eip.${name}_eip.id`)
          : null,
        subnetRef ? rawAttr("subnet_id", subnetRef) : comment("WARNING: missing Subnet reference"),
        attr("connectivity_type", cfg.connectivity_type || "public"),
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));
    });
    return blocks;
  },

  // ─── Route Table ─────────────────────────────────────────────────────────
  RouteTable(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);
      const vpcRef = r.ref("aws_vpc", cfg.vpcId, "id");
      const routes = cfg.routes || [];

      const routeBlocks = routes.map((route) => {
        const targetNode = ctx.nodeById(route.target);
        const targetType = targetNode?.data?.resourceType;
        let gwAttr = null;
        if (targetType === "IGW") {
          const igwRef = r.ref("aws_internet_gateway", route.target, "id");
          gwAttr = igwRef ? rawAttr("gateway_id", igwRef, 2) : null;
        } else if (targetType === "NATGateway") {
          const natRef = r.ref("aws_nat_gateway", route.target, "id");
          gwAttr = natRef ? rawAttr("nat_gateway_id", natRef, 2) : null;
        }
        return innerBlock("route", [
          attr("cidr_block", route.cidr || "0.0.0.0/0", 2),
          gwAttr,
        ]);
      }).filter(Boolean);

      blocks.push(block("aws_route_table", name, name, [
        vpcRef ? rawAttr("vpc_id", vpcRef) : comment("WARNING: missing VPC reference"),
        "",
        ...routeBlocks,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));

      // RT ↔ Subnet associations
      const linkedSubnets = ctx.subnetsByRt[n.id] || [];
      linkedSubnets.forEach((s) => {
        const subName = r.name(s.id);
        if (!subName) return; // skip broken refs
        const assocName = `${name}_${subName}`;
        blocks.push(block("aws_route_table_association", assocName, assocName, [
          rawAttr("subnet_id", `aws_subnet.${subName}.id`),
          rawAttr("route_table_id", `aws_route_table.${name}.id`),
        ]));
      });
    });
    return blocks;
  },

  // ─── EC2 ─────────────────────────────────────────────────────────────────
  EC2(nodes, names, ctx, warnings) {
    return nodes.map((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);
      const subnetRef = r.ref("aws_subnet", cfg.subnetId, "id");
      const sgRefs = r.list("aws_security_group", cfg.sg_ids, "id");
      const profileRef = cfg.iam_role_id ? r.ref("aws_iam_instance_profile", cfg.iam_role_id, "name") : null;
      return block("aws_instance", name, name, [
        attr("ami", cfg.ami),
        attr("instance_type", cfg.instance_type),
        subnetRef ? rawAttr("subnet_id", subnetRef) : comment("WARNING: missing Subnet reference"),
        cfg.key_name ? attr("key_name", cfg.key_name) : null,
        cfg.monitoring === "true" ? boolAttr("monitoring", "true") : null,
        sgRefs.length > 0 ? refListAttr("vpc_security_group_ids", sgRefs) : null,
        profileRef ? rawAttr("iam_instance_profile", profileRef) : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]);
    });
  },

  // ─── RDS ─────────────────────────────────────────────────────────────────
  RDS(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);
      const subnetIds = cfg.subnets || (cfg.subnetId ? [cfg.subnetId] : []);
      const subnetRefs = r.list("aws_subnet", subnetIds, "id");
      const sgRefs = r.list("aws_security_group", cfg.sg_ids, "id");

      // DB Subnet Group
      blocks.push(block("aws_db_subnet_group", name, name, [
        attr("name", `${cfg.name || n.data?.label}-subnet-group`),
        subnetRefs.length > 0 ? refListAttr("subnet_ids", subnetRefs) : comment("WARNING: no valid subnets"),
        "",
        mapBlock("tags", [
          attr("Name", `${cfg.name || n.data?.label}-subnet-group`, 2),
        ]),
      ]));

      blocks.push(block("aws_db_instance", name, name, [
        attr("identifier", cfg.name || n.data?.label),
        attr("engine", cfg.engine),
        attr("engine_version", cfg.engine_version),
        attr("instance_class", cfg.instance_class),
        numAttr("allocated_storage", cfg.allocated_storage),
        attr("username", cfg.username),
        attr("password", cfg.password),
        rawAttr("db_subnet_group_name", `aws_db_subnet_group.${name}.name`),
        sgRefs.length > 0 ? refListAttr("vpc_security_group_ids", sgRefs) : null,
        boolAttr("multi_az", cfg.multi_az),
        boolAttr("storage_encrypted", cfg.storage_encrypted),
        cfg.storage_encrypted === "true" && cfg.kms_key_id ? attr("kms_key_id", cfg.kms_key_id) : null,
        rawAttr("skip_final_snapshot", "true"),
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));
    });
    return blocks;
  },

  // ─── Load Balancer ───────────────────────────────────────────────────────
  LoadBalancer(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);
      const subnetIds = cfg.subnets || [];
      const subnetRefs = r.list("aws_subnet", subnetIds, "id");
      const sgRefs = r.list("aws_security_group", cfg.sg_ids, "id");
      const isALB = cfg.load_balancer_type !== "network";

      // LB
      blocks.push(block("aws_lb", name, name, [
        attr("name", cfg.name || n.data?.label),
        boolAttr("internal", cfg.internal),
        attr("load_balancer_type", cfg.load_balancer_type),
        isALB && sgRefs.length > 0 ? refListAttr("security_groups", sgRefs) : null,
        subnetRefs.length > 0 ? refListAttr("subnets", subnetRefs) : comment("WARNING: no valid subnets"),
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));

      // Find VPC from first subnet
      const firstSubnet = subnetIds[0] ? ctx.nodeById(subnetIds[0]) : null;
      const vpcId = firstSubnet?.data?.config?.vpcId;
      const vpcRef = vpcId ? r.ref("aws_vpc", vpcId, "id") : null;

      // Target Group
      blocks.push(block("aws_lb_target_group", name, name, [
        attr("name", `${(cfg.name || n.data?.label || "").slice(0, 24)}-tg`),
        numAttr("port", cfg.tg_port),
        attr("protocol", cfg.tg_protocol),
        vpcRef ? rawAttr("vpc_id", vpcRef) : comment("WARNING: missing VPC reference"),
        "",
        cfg.health_check_path ? innerBlock("health_check", [
          attr("path", cfg.health_check_path, 2),
          attr("protocol", cfg.health_check_protocol || "HTTP", 2),
        ]) : null,
      ]));

      // Listener
      blocks.push(block("aws_lb_listener", name, name, [
        rawAttr("load_balancer_arn", `aws_lb.${name}.arn`),
        numAttr("port", cfg.listener_port),
        attr("protocol", cfg.listener_protocol),
        "",
        innerBlock("default_action", [
          attr("type", "forward", 2),
          rawAttr("target_group_arn", `aws_lb_target_group.${name}.arn`, 2),
        ]),
      ]));
    });
    return blocks;
  },

  // ─── ECS Service ─────────────────────────────────────────────────────────
  ECS(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);
      const subnetIds = cfg.subnets || [];
      const subnetRefs = r.list("aws_subnet", subnetIds, "id");
      const sgRefs = r.list("aws_security_group", cfg.sg_ids, "id");
      const roleRef = cfg.iam_role_id ? r.ref("aws_iam_role", cfg.iam_role_id, "arn") : null;

      // ECS Cluster
      blocks.push(block("aws_ecs_cluster", name, name, [
        attr("name", `${cfg.name || n.data?.label}-cluster`),
      ]));

      // Task Definition
      const containerDef = JSON.stringify([{
        name: cfg.name || n.data?.label || "app",
        image: cfg.image || "nginx:latest",
        cpu: parseInt(cfg.cpu, 10) || 256,
        memory: parseInt(cfg.memory, 10) || 512,
        essential: true,
        portMappings: cfg.container_port ? [{
          containerPort: parseInt(cfg.container_port, 10),
          protocol: "tcp",
        }] : [],
      }]);

      blocks.push(block("aws_ecs_task_definition", name, name, [
        attr("family", cfg.name || n.data?.label),
        attr("network_mode", "awsvpc"),
        listAttr("requires_compatibilities", [cfg.launch_type || "FARGATE"]),
        attr("cpu", cfg.cpu),
        attr("memory", cfg.memory),
        roleRef ? rawAttr("task_role_arn", roleRef) : null,
        roleRef ? rawAttr("execution_role_arn", roleRef) : null,
        "",
        `  container_definitions = jsonencode(${containerDef})`,
      ]));

      // Service
      blocks.push(block("aws_ecs_service", name, name, [
        attr("name", cfg.name || n.data?.label),
        rawAttr("cluster", `aws_ecs_cluster.${name}.id`),
        rawAttr("task_definition", `aws_ecs_task_definition.${name}.arn`),
        numAttr("desired_count", cfg.desired_count),
        attr("launch_type", cfg.launch_type || "FARGATE"),
        "",
        innerBlock("network_configuration", [
          subnetRefs.length > 0 ? refListAttr("subnets", subnetRefs, 2) : null,
          sgRefs.length > 0 ? refListAttr("security_groups", sgRefs, 2) : null,
        ]),
      ]));
    });
    return blocks;
  },

  // ─── ElastiCache ─────────────────────────────────────────────────────────
  ElastiCache(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);
      const subnetIds = cfg.subnets || [];
      const subnetRefs = r.list("aws_subnet", subnetIds, "id");
      const sgRefs = r.list("aws_security_group", cfg.sg_ids, "id");

      // Subnet Group
      blocks.push(block("aws_elasticache_subnet_group", name, name, [
        attr("name", `${cfg.name || n.data?.label}-subnet-group`),
        subnetRefs.length > 0 ? refListAttr("subnet_ids", subnetRefs) : comment("WARNING: no valid subnets"),
      ]));

      blocks.push(block("aws_elasticache_cluster", name, name, [
        attr("cluster_id", cfg.name || n.data?.label),
        attr("engine", cfg.engine),
        cfg.engine_version ? attr("engine_version", cfg.engine_version) : null,
        attr("node_type", cfg.node_type),
        numAttr("num_cache_nodes", cfg.num_cache_nodes),
        rawAttr("subnet_group_name", `aws_elasticache_subnet_group.${name}.name`),
        sgRefs.length > 0 ? refListAttr("security_group_ids", sgRefs) : null,
        boolAttr("az_mode", cfg.engine === "memcached" && parseInt(cfg.num_cache_nodes, 10) > 1 ? "cross-az" : null),
        cfg.at_rest_encryption === "true" ? rawAttr("at_rest_encryption_enabled", "true") : null,
        cfg.in_transit_encryption === "true" ? rawAttr("transit_encryption_enabled", "true") : null,
        cfg.auth_token ? attr("auth_token", cfg.auth_token) : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));
    });
    return blocks;
  },

  // ─── S3 ──────────────────────────────────────────────────────────────────
  S3(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];

      blocks.push(block("aws_s3_bucket", name, name, [
        attr("bucket", cfg.bucket_name),
        cfg.force_destroy === "true" ? rawAttr("force_destroy", "true") : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));

      if (cfg.versioning === "Enabled") {
        blocks.push(block("aws_s3_bucket_versioning", name, name, [
          rawAttr("bucket", `aws_s3_bucket.${name}.id`),
          innerBlock("versioning_configuration", [
            attr("status", "Enabled", 2),
          ]),
        ]));
      }

      if (cfg.encryption && cfg.encryption !== "None") {
        const algo = cfg.encryption.includes("KMS") ? "aws:kms" : "AES256";
        blocks.push(block("aws_s3_bucket_server_side_encryption_configuration", name, name, [
          rawAttr("bucket", `aws_s3_bucket.${name}.id`),
          innerBlock("rule", [
            innerBlock("apply_server_side_encryption_by_default", [
              attr("sse_algorithm", algo, 3),
            ], 2),
          ]),
        ]));
      }

      if (cfg.block_public_access === "true") {
        blocks.push(block("aws_s3_bucket_public_access_block", name, name, [
          rawAttr("bucket", `aws_s3_bucket.${name}.id`),
          rawAttr("block_public_acls", "true"),
          rawAttr("block_public_policy", "true"),
          rawAttr("ignore_public_acls", "true"),
          rawAttr("restrict_public_buckets", "true"),
        ]));
      }
    });
    return blocks;
  },

  // ─── Lambda ──────────────────────────────────────────────────────────────
  Lambda(nodes, names, ctx, warnings) {
    return nodes.map((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);
      const roleRef = cfg.iam_role_id ? r.ref("aws_iam_role", cfg.iam_role_id, "arn") : null;
      const sgRefs = r.list("aws_security_group", cfg.sg_ids, "id");
      const subnetRefs = cfg.subnetId ? r.list("aws_subnet", [cfg.subnetId], "id") : [];

      const envVars = cfg.environment_vars
        ? cfg.environment_vars.split(",").reduce((acc, pair) => {
            const [k, v] = pair.split("=").map((s) => s.trim());
            if (k) acc[k] = v || "";
            return acc;
          }, {})
        : null;

      return block("aws_lambda_function", name, name, [
        attr("function_name", cfg.name || n.data?.label),
        attr("runtime", cfg.runtime),
        attr("handler", cfg.handler),
        roleRef ? rawAttr("role", roleRef) : comment("WARNING: missing IAM role"),
        numAttr("memory_size", cfg.memory_size),
        numAttr("timeout", cfg.timeout),
        attr("filename", "lambda.zip"),
        "",
        cfg.vpc_enabled === "true" ? innerBlock("vpc_config", [
          subnetRefs.length > 0 ? refListAttr("subnet_ids", subnetRefs, 2) : null,
          sgRefs.length > 0 ? refListAttr("security_group_ids", sgRefs, 2) : null,
        ]) : null,
        envVars && Object.keys(envVars).length > 0 ? innerBlock("environment", [
          `    variables = {`,
          ...Object.entries(envVars).map(([k, v]) => `      ${k} = "${v}"`),
          `    }`,
        ]) : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]);
    });
  },

  // ─── DynamoDB ────────────────────────────────────────────────────────────
  DynamoDB(nodes, names, ctx, warnings) {
    return nodes.map((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];

      const attrs = [
        innerBlock("attribute", [
          attr("name", cfg.hash_key, 2),
          attr("type", cfg.hash_key_type, 2),
        ]),
      ];
      if (cfg.range_key?.trim()) {
        attrs.push(innerBlock("attribute", [
          attr("name", cfg.range_key, 2),
          attr("type", cfg.range_key_type, 2),
        ]));
      }

      return block("aws_dynamodb_table", name, name, [
        attr("name", cfg.table_name),
        attr("billing_mode", cfg.billing_mode),
        attr("hash_key", cfg.hash_key),
        cfg.range_key?.trim() ? attr("range_key", cfg.range_key) : null,
        "",
        ...attrs,
        "",
        cfg.point_in_time_recovery === "true" ? innerBlock("point_in_time_recovery", [
          rawAttr("enabled", "true", 2),
        ]) : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]);
    });
  },

  // ─── SQS ─────────────────────────────────────────────────────────────────
  SQS(nodes, names, ctx, warnings) {
    return nodes.map((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      return block("aws_sqs_queue", name, name, [
        attr("name", cfg.queue_name),
        cfg.fifo === "true" ? rawAttr("fifo_queue", "true") : null,
        cfg.fifo === "true" ? rawAttr("content_based_deduplication", "true") : null,
        numAttr("visibility_timeout_seconds", cfg.visibility_timeout),
        numAttr("message_retention_seconds", cfg.message_retention),
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]);
    });
  },

  // ─── SNS ─────────────────────────────────────────────────────────────────
  SNS(nodes, names, ctx, warnings) {
    return nodes.map((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      return block("aws_sns_topic", name, name, [
        attr("name", cfg.topic_name),
        cfg.fifo === "true" ? rawAttr("fifo_topic", "true") : null,
        cfg.fifo === "true" ? rawAttr("content_based_deduplication", "true") : null,
        cfg.encryption === "true" ? attr("kms_master_key_id", "alias/aws/sns") : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]);
    });
  },

  // ─── EventBridge ─────────────────────────────────────────────────────────
  EventBridge(nodes, names, ctx, warnings) {
    return nodes.map((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      return block("aws_cloudwatch_event_bus", name, name, [
        attr("name", cfg.bus_name),
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]);
    });
  },

  // ─── Secrets Manager ─────────────────────────────────────────────────────
  SecretsManager(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];

      blocks.push(block("aws_secretsmanager_secret", name, name, [
        attr("name", cfg.secret_name),
        cfg.kms_key?.trim() ? attr("kms_key_id", cfg.kms_key) : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));

      if (cfg.rotation_enabled === "true") {
        blocks.push(comment(`Rotation: every ${cfg.rotation_days || 30} days — add aws_secretsmanager_secret_rotation with a Lambda rotation function`));
      }
    });
    return blocks;
  },

  // ─── API Gateway ─────────────────────────────────────────────────────────
  APIGateway(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];

      const protocolType = cfg.api_type === "REST" ? "REST"
        : cfg.api_type === "WebSocket" ? "WEBSOCKET" : "HTTP";

      if (protocolType === "REST") {
        blocks.push(block("aws_api_gateway_rest_api", name, name, [
          attr("name", cfg.api_name),
          attr("description", cfg.description || `${cfg.api_name} REST API`),
          "",
          mapBlock("tags", [
            attr("Name", cfg.name || n.data?.label, 2),
          ]),
        ]));

        blocks.push(block("aws_api_gateway_deployment", name, name, [
          rawAttr("rest_api_id", `aws_api_gateway_rest_api.${name}.id`),
          attr("stage_name", cfg.stage_name),
        ]));
      } else {
        blocks.push(block("aws_apigatewayv2_api", name, name, [
          attr("name", cfg.api_name),
          attr("protocol_type", protocolType),
          cfg.cors_enabled === "true" ? innerBlock("cors_configuration", [
            `    allow_origins = ["*"]`,
            `    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]`,
            `    allow_headers = ["*"]`,
          ]) : null,
          "",
          mapBlock("tags", [
            attr("Name", cfg.name || n.data?.label, 2),
          ]),
        ]));

        blocks.push(block("aws_apigatewayv2_stage", name, name, [
          rawAttr("api_id", `aws_apigatewayv2_api.${name}.id`),
          attr("name", cfg.stage_name),
          rawAttr("auto_deploy", "true"),
          cfg.throttling_rate || cfg.throttling_burst ? innerBlock("default_route_settings", [
            cfg.throttling_rate ? numAttr("throttling_rate_limit", cfg.throttling_rate, 2) : null,
            cfg.throttling_burst ? numAttr("throttling_burst_limit", cfg.throttling_burst, 2) : null,
          ]) : null,
        ]));
      }
    });
    return blocks;
  },

  // ─── ECR ─────────────────────────────────────────────────────────────────
  ECR(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];

      blocks.push(block("aws_ecr_repository", name, name, [
        attr("name", cfg.repository_name),
        attr("image_tag_mutability", cfg.image_tag_mutability || "MUTABLE"),
        "",
        cfg.scan_on_push === "true" ? innerBlock("image_scanning_configuration", [
          rawAttr("scan_on_push", "true", 2),
        ]) : null,
        cfg.encryption_type === "KMS" ? innerBlock("encryption_configuration", [
          attr("encryption_type", "KMS", 2),
        ]) : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));

      if (cfg.lifecycle_policy && cfg.lifecycle_policy !== "none") {
        const policyMap = {
          keep_last_10: { rulePriority: 1, description: "Keep last 10 images", selection: { tagStatus: "tagged", tagPrefixList: ["v"], countType: "imageCountMoreThan", countNumber: 10 }, action: { type: "expire" } },
          keep_last_30: { rulePriority: 1, description: "Keep last 30 images", selection: { tagStatus: "tagged", tagPrefixList: ["v"], countType: "imageCountMoreThan", countNumber: 30 }, action: { type: "expire" } },
          expire_untagged_7d: { rulePriority: 1, description: "Expire untagged after 7 days", selection: { tagStatus: "untagged", countType: "sinceImagePushed", countUnit: "days", countNumber: 7 }, action: { type: "expire" } },
        };
        const policy = policyMap[cfg.lifecycle_policy];
        if (policy) {
          blocks.push(block("aws_ecr_lifecycle_policy", name, name, [
            rawAttr("repository", `aws_ecr_repository.${name}.name`),
            `  policy = jsonencode({ rules = [${JSON.stringify(policy)}] })`,
          ]));
        }
      }
    });
    return blocks;
  },

  // ─── Route 53 ────────────────────────────────────────────────────────────
  Route53(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);

      const zoneBody = [
        attr("name", cfg.hosted_zone_name),
      ];

      if (cfg.zone_type === "private") {
        const vpcs = ctx.vpcs || [];
        if (vpcs.length > 0) {
          const vpcRef = r.ref("aws_vpc", vpcs[0].id, "id");
          if (vpcRef) {
            zoneBody.push(innerBlock("vpc", [
              rawAttr("vpc_id", vpcRef, 2),
            ]));
          }
        }
      }

      zoneBody.push("");
      zoneBody.push(mapBlock("tags", [
        attr("Name", cfg.name || n.data?.label, 2),
      ]));

      blocks.push(block("aws_route53_zone", name, name, zoneBody));

      if (cfg.record_type) {
        const recordName = `${name}_record`;
        if (cfg.record_type === "ALIAS") {
          const targets = ctx.trafficNeighbors(n.id);
          const target = targets[0];
          if (target) {
            const targetType = target.data?.resourceType;
            let aliasTarget = null;
            if (targetType === "LoadBalancer") {
              const lbName = r.name(target.id);
              if (lbName) {
                aliasTarget = {
                  name: `aws_lb.${lbName}.dns_name`,
                  zone_id: `aws_lb.${lbName}.zone_id`,
                };
              }
            } else if (targetType === "APIGateway") {
              const apigwName = r.name(target.id);
              if (apigwName) {
                aliasTarget = {
                  name: `aws_apigatewayv2_api.${apigwName}.api_endpoint`,
                  zone_id: `"Z2FDTNDATAQYW2"`,
                };
              }
            }
            if (aliasTarget) {
              blocks.push(block("aws_route53_record", recordName, recordName, [
                rawAttr("zone_id", `aws_route53_zone.${name}.zone_id`),
                attr("name", cfg.hosted_zone_name),
                attr("type", "A"),
                "",
                innerBlock("alias", [
                  rawAttr("name", aliasTarget.name, 2),
                  rawAttr("zone_id", aliasTarget.zone_id, 2),
                  rawAttr("evaluate_target_health", "true", 2),
                ]),
              ]));
            }
          }
        } else {
          blocks.push(block("aws_route53_record", recordName, recordName, [
            rawAttr("zone_id", `aws_route53_zone.${name}.zone_id`),
            attr("name", cfg.hosted_zone_name),
            attr("type", cfg.record_type),
            numAttr("ttl", cfg.ttl || "300"),
            `  records = ["PLACEHOLDER_VALUE"]  # Update with actual record value`,
          ]));
        }
      }
    });
    return blocks;
  },

  // ─── Kinesis ─────────────────────────────────────────────────────────────
  Kinesis(nodes, names, ctx, warnings) {
    return nodes.map((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      return block("aws_kinesis_stream", name, name, [
        attr("name", cfg.stream_name),
        cfg.stream_mode === "PROVISIONED" ? numAttr("shard_count", cfg.shard_count) : null,
        "",
        innerBlock("stream_mode_details", [
          attr("stream_mode", cfg.stream_mode, 2),
        ]),
        cfg.retention_hours && cfg.retention_hours !== "24"
          ? numAttr("retention_period", cfg.retention_hours)
          : null,
        cfg.encryption === "KMS" ? innerBlock("encryption", [
          attr("encryption_type", "KMS", 2),
          attr("key_id", "alias/aws/kinesis", 2),
        ]) : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]);
    });
  },

  // ─── ACM ────────────────────────────────────────────────────────────────────

  ACM(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];

      const sanList = (cfg.subject_alternative_names || "")
        .split(",").map((s) => s.trim()).filter(Boolean);

      blocks.push(block("aws_acm_certificate", name, name, [
        attr("domain_name", cfg.domain_name),
        attr("validation_method", cfg.validation_method || "DNS"),
        sanList.length > 0
          ? `  subject_alternative_names = [${sanList.map((s) => `"${s}"`).join(", ")}]`
          : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));
    });
    return blocks;
  },

  // ─── CloudFront ─────────────────────────────────────────────────────────────

  CloudFront(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);

      // Resolve origin
      let originDomain = cfg.custom_origin || "example.com";
      let originId = cfg.name || "origin";
      if (cfg.origin_type === "S3" && cfg.origin_id) {
        const bucketName = r.name(cfg.origin_id);
        if (bucketName) {
          originDomain = `\${aws_s3_bucket.${bucketName}.bucket_regional_domain_name}`;
          originId = bucketName;
        }
      } else if (cfg.origin_type === "LoadBalancer" && cfg.origin_id) {
        const lbName = r.name(cfg.origin_id);
        if (lbName) {
          originDomain = `\${aws_lb.${lbName}.dns_name}`;
          originId = lbName;
        }
      } else if (cfg.origin_type === "APIGateway" && cfg.origin_id) {
        const apiName = r.name(cfg.origin_id);
        if (apiName) {
          originDomain = `\${aws_apigatewayv2_api.${apiName}.api_endpoint}`;
          originId = apiName;
        }
      }

      // Resolve ACM certificate
      const certRef = cfg.acm_certificate_id ? r.ref("aws_acm_certificate", cfg.acm_certificate_id, "arn") : null;

      blocks.push(block("aws_cloudfront_distribution", name, name, [
        rawAttr("enabled", "true"),
        cfg.price_class ? attr("price_class", cfg.price_class) : null,
        "",
        innerBlock("origin", [
          attr("domain_name", originDomain, 2),
          attr("origin_id", originId, 2),
          cfg.origin_type !== "S3" ? innerBlock("custom_origin_config", [
            rawAttr("http_port", 80, 3),
            rawAttr("https_port", 443, 3),
            attr("origin_protocol_policy", "https-only", 3),
            `      origin_ssl_protocols = ["TLSv1.2"]`,
          ]) : null,
        ]),
        "",
        innerBlock("default_cache_behavior", [
          attr("target_origin_id", originId, 2),
          attr("viewer_protocol_policy", cfg.viewer_protocol_policy || "redirect-to-https", 2),
          `    allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]`,
          `    cached_methods  = ["GET", "HEAD"]`,
          cfg.default_ttl ? numAttr("default_ttl", cfg.default_ttl, 2) : null,
        ]),
        "",
        certRef ? innerBlock("viewer_certificate", [
          rawAttr("acm_certificate_arn", certRef, 2),
          attr("ssl_support_method", "sni-only", 2),
          attr("minimum_protocol_version", "TLSv1.2_2021", 2),
        ]) : innerBlock("viewer_certificate", [
          rawAttr("cloudfront_default_certificate", "true", 2),
        ]),
        "",
        innerBlock("restrictions", [
          innerBlock("geo_restriction", [
            attr("restriction_type", "none", 3),
          ]),
        ]),
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));
    });
    return blocks;
  },

  // ─── WAF ────────────────────────────────────────────────────────────────────

  WAF(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];

      const managedRules = cfg.managed_rules || [];
      const ruleBlocks = managedRules.map((ruleName, i) =>
        innerBlock("rule", [
          attr("name", ruleName, 2),
          numAttr("priority", i + 1, 2),
          innerBlock("override_action", [
            innerBlock("none", []),
          ]),
          innerBlock("statement", [
            innerBlock("managed_rule_group_statement", [
              attr("name", ruleName, 4),
              attr("vendor_name", "AWS", 4),
            ]),
          ]),
          innerBlock("visibility_config", [
            rawAttr("cloudwatch_metrics_enabled", "true", 4),
            attr("metric_name", `${cfg.waf_name || name}-${ruleName}`, 4),
            rawAttr("sampled_requests_enabled", "true", 4),
          ]),
        ])
      );

      // Rate limit rule
      if (cfg.rate_limit) {
        ruleBlocks.push(innerBlock("rule", [
          attr("name", "rate-limit", 2),
          numAttr("priority", managedRules.length + 1, 2),
          innerBlock("action", [
            innerBlock("block", []),
          ]),
          innerBlock("statement", [
            innerBlock("rate_based_statement", [
              numAttr("limit", cfg.rate_limit, 4),
              attr("aggregate_key_type", "IP", 4),
            ]),
          ]),
          innerBlock("visibility_config", [
            rawAttr("cloudwatch_metrics_enabled", "true", 4),
            attr("metric_name", `${cfg.waf_name || name}-rate-limit`, 4),
            rawAttr("sampled_requests_enabled", "true", 4),
          ]),
        ]));
      }

      blocks.push(block("aws_wafv2_web_acl", name, name, [
        attr("name", cfg.waf_name),
        attr("scope", cfg.scope || "REGIONAL"),
        "",
        innerBlock("default_action", [
          innerBlock(cfg.default_action || "allow", []),
        ]),
        "",
        ...ruleBlocks,
        "",
        innerBlock("visibility_config", [
          rawAttr("cloudwatch_metrics_enabled", "true", 2),
          attr("metric_name", cfg.waf_name || name, 2),
          rawAttr("sampled_requests_enabled", "true", 2),
        ]),
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));
    });
    return blocks;
  },

  // ─── ASG ────────────────────────────────────────────────────────────────────

  ASG(nodes, names, ctx, warnings) {
    const blocks = [];
    nodes.forEach((n) => {
      const cfg = n.data?.config || {};
      const name = names[n.id];
      const r = createRefResolver(names, warnings, n.data?.label || name);

      const subnetRefs = r.list("aws_subnet", cfg.subnets, "id");
      const sgRefs = (cfg.sg_ids || []).map((sgId) => names[sgId] ? `aws_security_group.${names[sgId]}.id` : null).filter(Boolean);
      const iamRef = cfg.iam_role_id ? r.ref("aws_iam_instance_profile", cfg.iam_role_id, "name") : null;

      // Launch template
      const ltName = `${name}_lt`;
      blocks.push(block("aws_launch_template", ltName, ltName, [
        attr("name_prefix", `${cfg.name || name}-`),
        attr("image_id", cfg.ami),
        attr("instance_type", cfg.instance_type),
        "",
        iamRef ? innerBlock("iam_instance_profile", [
          rawAttr("name", iamRef, 2),
        ]) : null,
        sgRefs.length > 0 ? innerBlock("network_interfaces", [
          rawAttr("associate_public_ip_address", "false", 2),
          `    security_groups = [${sgRefs.join(", ")}]`,
        ]) : null,
        "",
        mapBlock("tags", [
          attr("Name", cfg.name || n.data?.label, 2),
        ]),
      ]));

      // ASG
      blocks.push(block("aws_autoscaling_group", name, name, [
        attr("name", cfg.name || n.data?.label),
        numAttr("min_size", cfg.min_size || "1"),
        numAttr("max_size", cfg.max_size || "4"),
        numAttr("desired_capacity", cfg.desired_capacity || "2"),
        "",
        subnetRefs.length > 0
          ? `  vpc_zone_identifier = [${subnetRefs.join(", ")}]`
          : null,
        "",
        innerBlock("launch_template", [
          rawAttr("id", `aws_launch_template.${ltName}.id`, 2),
          rawAttr("version", `"$Latest"`, 2),
        ]),
        "",
        cfg.health_check_type ? attr("health_check_type", cfg.health_check_type) : null,
        cfg.health_check_grace_period ? numAttr("health_check_grace_period", cfg.health_check_grace_period) : null,
        "",
        `  tag {
    key                 = "Name"
    value               = "${cfg.name || n.data?.label}"
    propagate_at_launch = true
  }`,
      ]));
    });
    return blocks;
  },
};

// ─── Security Group Generator ────────────────────────────────────────────────

function generateSecurityGroups(ctx, names) {
  const blocks = [];
  const { securityGroups, nodesWithSG, deriveNodeSGs, nodeById } = ctx;
  if (!securityGroups || securityGroups.length === 0) return blocks;

  // Register SG names
  securityGroups.forEach((sg) => {
    if (!names[sg.id]) {
      names[sg.id] = tfName(sg.name || "sg");
      // Deduplicate
      const existing = Object.values(names).filter((v) => v === names[sg.id]);
      if (existing.length > 1) names[sg.id] = `${names[sg.id]}_${existing.length}`;
    }
  });

  // Collect all rules per SG (manual + edge-derived from all assigned nodes)
  const sgRules = {};
  securityGroups.forEach((sg) => {
    sgRules[sg.id] = { inbound: [...(sg.inbound || [])], outbound: [...(sg.outbound || [])] };
  });

  // Add edge-derived rules
  nodesWithSG.forEach((n) => {
    const derived = deriveNodeSGs(n.id);
    derived.forEach(({ sg, edgeDerived }) => {
      if (!sgRules[sg.id]) return;
      edgeDerived.inbound.forEach((r) => {
        sgRules[sg.id].inbound.push({
          port: r.port,
          protocol: r.protocol,
          source: `# from ${r.sourceNodeLabel}`,
          cidr: "0.0.0.0/0", // simplified — in real use, derive from node SG/CIDR
        });
      });
      edgeDerived.outbound.forEach((r) => {
        sgRules[sg.id].outbound.push({
          port: r.port,
          protocol: r.protocol,
          dest: `# to ${r.destNodeLabel}`,
          cidr: "0.0.0.0/0",
        });
      });
    });
  });

  // Find VPC for each SG — from first assigned node's subnet's VPC
  securityGroups.forEach((sg) => {
    const name = names[sg.id];
    const assignedNode = ctx.nodes.find((n) => (n.data?.config?.sg_ids || []).includes(sg.id));
    const subnetId = assignedNode?.data?.config?.subnetId
      || (assignedNode?.data?.config?.subnets || [])[0];
    const subnet = subnetId ? nodeById(subnetId) : null;
    const vpcId = subnet?.data?.config?.vpcId;
    const vpcRef = vpcId ? `aws_vpc.${names[vpcId]}.id` : ctx.vpcs?.[0] ? `aws_vpc.${names[ctx.vpcs[0].id]}.id` : '"MISSING_VPC"';

    const rules = sgRules[sg.id] || { inbound: [], outbound: [] };

    const ingressBlocks = rules.inbound.map((r) => {
      const port = parseInt(r.port, 10);
      return innerBlock("ingress", [
        rawAttr("from_port", isNaN(port) ? 0 : port, 2),
        rawAttr("to_port", isNaN(port) ? 0 : port, 2),
        attr("protocol", r.protocol || "tcp", 2),
        `    cidr_blocks = ["${r.cidr || "0.0.0.0/0"}"]`,
        r.source || r.dest ? `    ${r.source || r.dest}` : null,
      ]);
    });

    const egressBlocks = rules.outbound.map((r) => {
      const port = parseInt(r.port, 10);
      return innerBlock("egress", [
        rawAttr("from_port", isNaN(port) ? 0 : port, 2),
        rawAttr("to_port", isNaN(port) ? 0 : port, 2),
        attr("protocol", r.protocol || "tcp", 2),
        `    cidr_blocks = ["${r.cidr || "0.0.0.0/0"}"]`,
        r.dest || r.source ? `    ${r.dest || r.source}` : null,
      ]);
    });

    // Default egress rule — allow all outbound
    if (egressBlocks.length === 0) {
      egressBlocks.push(innerBlock("egress", [
        rawAttr("from_port", 0, 2),
        rawAttr("to_port", 0, 2),
        attr("protocol", "-1", 2),
        `    cidr_blocks = ["0.0.0.0/0"]`,
      ]));
    }

    blocks.push(block("aws_security_group", name, name, [
      attr("name", sg.name),
      attr("description", sg.description || `Security group ${sg.name}`),
      rawAttr("vpc_id", vpcRef),
      "",
      ...ingressBlocks,
      "",
      ...egressBlocks,
      "",
      mapBlock("tags", [
        attr("Name", sg.name, 2),
      ]),
    ]));
  });

  return blocks;
}

// ─── IAM Role Generator ─────────────────────────────────────────────────────

function generateIAMRoles(ctx, names) {
  const blocks = [];
  const { roles } = ctx;
  if (!roles || roles.length === 0) return blocks;

  roles.forEach((role) => {
    if (!names[role.id]) {
      names[role.id] = tfName(role.name || "role");
    }
    const name = names[role.id];

    // Assume role policy — determine trusted services from assigned nodes
    const assignedNodes = ctx.nodes.filter((n) => n.data?.config?.iam_role_id === role.id);
    const services = new Set();
    assignedNodes.forEach((n) => {
      const rt = n.data?.resourceType;
      if (rt === "EC2" || rt === "ASG") services.add("ec2.amazonaws.com");
      if (rt === "ECS") services.add("ecs-tasks.amazonaws.com");
      if (rt === "Lambda") services.add("lambda.amazonaws.com");
    });
    if (services.size === 0) services.add("ec2.amazonaws.com");

    const assumePolicy = {
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Principal: { Service: [...services] },
        Action: "sts:AssumeRole",
      }],
    };

    blocks.push(block("aws_iam_role", name, name, [
      attr("name", role.name),
      `  assume_role_policy = jsonencode(${JSON.stringify(assumePolicy, null, 2).split("\n").map((l, i) => i === 0 ? l : "  " + l).join("\n")})`,
      "",
      mapBlock("tags", [
        attr("Name", role.name, 2),
      ]),
    ]));

    // Attach managed policies
    (role.policies || []).forEach((policy, i) => {
      const attachName = `${name}_${tfName(policy.name || `policy_${i}`)}`;
      if (policy.arn) {
        blocks.push(block("aws_iam_role_policy_attachment", attachName, attachName, [
          rawAttr("role", `aws_iam_role.${name}.name`),
          attr("policy_arn", policy.arn),
        ]));
      }
    });

    // Instance profile for EC2
    const hasEC2 = assignedNodes.some((n) => n.data?.resourceType === "EC2");
    if (hasEC2) {
      blocks.push(block("aws_iam_instance_profile", name, name, [
        attr("name", `${role.name}-profile`),
        rawAttr("role", `aws_iam_role.${name}.name`),
      ]));
    }
  });

  return blocks;
}

// ─── Generation Order ────────────────────────────────────────────────────────
// Dependency-ordered so Terraform can resolve references top-down.

const GENERATION_ORDER = [
  "VPC",
  "Subnet",
  "IGW",
  "NATGateway",
  "RouteTable",
  "EC2",
  "RDS",
  "LoadBalancer",
  "ECS",
  "ElastiCache",
  "S3",
  "Lambda",
  "DynamoDB",
  "SQS",
  "SNS",
  "EventBridge",
  "SecretsManager",
  "APIGateway",
  "ECR",
  "Route53",
  "Kinesis",
  "ACM",
  "CloudFront",
  "WAF",
  "ASG",
];

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Generate HCL from canvas context.
 *
 * Returns { hcl, warnings, reverse }:
 *   hcl      — the Terraform HCL string
 *   warnings — array of broken-reference warnings (for display in UI)
 *   reverse  — map of tfName → nodeId (for error mapping from terraform validate)
 */
export function generateHCL(ctx, region = "us-east-1") {
  const { names, reverse } = buildNameRegistry(ctx.nodes);
  const warnings = [];
  const output = [];

  // Terraform + provider block
  output.push(`terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${region}"
}
`);

  // Security Groups first — referenced by compute resources
  const sgBlocks = generateSecurityGroups(ctx, names);
  if (sgBlocks.length > 0) {
    output.push(comment("Security Groups"));
    output.push(...sgBlocks);
    output.push("");
  }

  // IAM Roles — referenced by compute resources
  const iamBlocks = generateIAMRoles(ctx, names);
  if (iamBlocks.length > 0) {
    output.push(comment("IAM Roles"));
    output.push(...iamBlocks);
    output.push("");
  }

  // Resources in dependency order
  GENERATION_ORDER.forEach((type) => {
    const resourceNodes = ctx.byResourceType?.[type] || [];
    if (resourceNodes.length === 0) return;
    const gen = generators[type];
    if (!gen) return;

    const typeBlocks = gen(resourceNodes, names, ctx, warnings);
    if (typeBlocks.length > 0) {
      output.push(comment(`${type} Resources`));
      output.push(...typeBlocks);
      output.push("");
    }
  });

  // Clean up multiple blank lines
  const hcl = output.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  return { hcl, warnings, reverse };
}
