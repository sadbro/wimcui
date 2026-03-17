import { getAZsForRegion } from "./awsRegions";
import { isValidCIDR, isValidPrefix, cidrContains, cidrsOverlap } from "./cidrUtils";

// Base fields shared by all resources
const baseFields = [
  { key: "name", label: "Name", type: "text", placeholder: "my-resource", required: true },
  { key: "description", label: "Description", type: "text", placeholder: "...", required: false },
];

const subnetParent = {
  key: "subnetId",
  label: "Subnet",
  type: "parent-select",
  parentType: "Subnet",
  required: true,
};

const ENGINE_VERSIONS = {
  mysql:                ["8.0", "5.7", "5.6"],
  postgres:             ["15.3", "14.8", "13.11", "12.15"],
  "aurora-mysql":       ["8.0.mysql_aurora.3.04.0", "5.7.mysql_aurora.2.11.3"],
  "aurora-postgresql":  ["15.3", "14.8", "13.11"],
  mariadb:              ["10.11", "10.6", "10.5"],
};

export const resourceFields = {
  EC2: [
    subnetParent,
    {
      key: "iam_role_id",
      label: "IAM Role",
      type: "iam-role-select",
    },
    {
      key: "sg_ids",
      label: "Security Groups",
      type: "sg-select",
    },
    {
      key: "instance_type",
      label: "Instance Type",
      type: "select",
      options: ["t2.micro", "t2.small", "t2.medium", "t3.micro", "t3.small", "t3.medium", "t3.large"],
      required: true,
    },
    {
      key: "ami",
      label: "AMI ID",
      type: "text",
      placeholder: "ami-0c55b159cbfafe1f0",
      required: true,
      validate: (value) => {
        if (!/^ami-[a-f0-9]{8,17}$/.test(value)) return "Invalid AMI ID format (e.g. ami-0c55b159cbfafe1f0)";
        return null;
      },
    },
    { key: "key_name",   label: "Key Pair Name", type: "text",   placeholder: "my-keypair", required: false },
    { key: "monitoring", label: "Monitoring",    type: "select", options: ["false", "true"],  required: false },
    ...baseFields,
  ],

  RDS: [
    subnetParent,
    {
      key: "sg_ids",
      label: "Security Groups",
      type: "sg-select",
    },
    {
      key: "engine",
      label: "Engine",
      type: "select",
      options: ["mysql", "postgres", "aurora-mysql", "aurora-postgresql", "mariadb"],
      required: true,
    },
    {
      key: "engine_version",
      label: "Engine Version",
      type: "dependent-select",
      dependsOn: "engine",
      optionsMap: ENGINE_VERSIONS,
      required: true,
    },
    {
      key: "instance_class",
      label: "Instance Class",
      type: "select",
      options: ["db.t3.micro", "db.t3.small", "db.t3.medium", "db.r5.large", "db.r5.xlarge"],
      required: true,
    },
    {
      key: "allocated_storage",
      label: "Allocated Storage (GB)",
      type: "text",
      placeholder: "20",
      required: true,
      validate: (value) => {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 20 || n > 65536) return "Storage must be between 20 and 65536 GB";
        return null;
      },
    },
    { key: "username", label: "Master Username", type: "text",     placeholder: "admin",   required: true },
    { key: "password", label: "Master Password", type: "password", placeholder: "••••••••", required: true },
    {
      key: "multi_az",
      label: "Multi-AZ",
      type: "select",
      options: ["false", "true"],
      required: false,
    },
    ...baseFields,
  ],

  LoadBalancer: [
    {
      key: "load_balancer_type",
      label: "Load Balancer Type",
      type: "select",
      options: ["application", "network"],
      required: true,
    },
    {
      key: "sg_ids",
      label: "Security Groups",
      type: "sg-select",
      visibleWhen: (form) => form.load_balancer_type !== "network",
    },
    {
      key: "internal",
      label: "Scheme",
      type: "select",
      options: ["false", "true"],
      optionLabels: { "false": "Internet-facing", "true": "Internal" },
      required: true,
    },
    {
      key: "subnets",
      label: "Subnets",
      type: "multi-select",
      parentType: "Subnet",
      required: true,
      minItems: 2,
    },
    // ─── Target Group ───────────────────────────────────────────
    {
      key: "tg_port",
      label: "Target Group Port",
      type: "text",
      placeholder: "80",
      required: true,
    },
    {
      key: "tg_protocol",
      label: "Target Group Protocol",
      type: "select",
      getOptions: (canvasNodes, form) =>
        form.load_balancer_type === "network"
          ? ["TCP", "UDP", "TLS", "TCP_UDP"]
          : ["HTTP", "HTTPS"],
      required: true,
    },
    {
      key: "health_check_path",
      label: "Health Check Path",
      type: "text",
      placeholder: "/health",
      visibleWhen: (form) => form.load_balancer_type === "application",
    },
    {
      key: "health_check_protocol",
      label: "Health Check Protocol",
      type: "select",
      getOptions: (canvasNodes, form) =>
        form.load_balancer_type === "network"
          ? ["TCP", "HTTP", "HTTPS"]
          : ["HTTP", "HTTPS"],
    },
    // ─── Listener ───────────────────────────────────────────────
    {
      key: "listener_port",
      label: "Listener Port",
      type: "text",
      placeholder: "80",
      required: true,
    },
    {
      key: "listener_protocol",
      label: "Listener Protocol",
      type: "select",
      getOptions: (canvasNodes, form) =>
        form.load_balancer_type === "network"
          ? ["TCP", "UDP", "TLS", "TCP_UDP"]
          : ["HTTP", "HTTPS"],
      required: true,
    },
    ...baseFields,
  ],

  IGW: [
    {
      key: "vpcId",
      label: "VPC",
      type: "parent-select",
      parentType: "VPC",
      required: true,
      validate: (value, form, canvasNodes, editingNodeId) => {
        const existing = canvasNodes.find(
          (n) => n.data?.resourceType === "IGW" &&
                 n.data?.config?.vpcId === value &&
                 n.id !== editingNodeId
        );
        if (existing) return "A VPC can only have one Internet Gateway";
        return null;
      },
    },
    ...baseFields,
  ],

  NATGateway: [
    {
      key: "subnetId",
      label: "Subnet",
      type: "parent-select",
      parentType: "Subnet",
      required: true,
      validate: (value, form, canvasNodes) => {
        const subnet = canvasNodes.find((n) => n.id === value);
        if (subnet && subnet.data?.config?.visibility !== "Public")
          return "NAT Gateway must be placed in a Public subnet";
        return null;
      },
    },
    {
      key: "connectivity_type",
      label: "Connectivity Type",
      type: "select",
      options: ["public", "private"],
      required: true,
    },
    {
      key: "allocate_eip",
      label: "Allocate Elastic IP",
      type: "select",
      options: ["true", "false"],
      required: false,
    },
    ...baseFields,
  ],

  RouteTable: [
    {
      key: "vpcId",
      label: "VPC",
      type: "parent-select",
      parentType: "VPC",
      required: true,
    },
    {
      key: "routes",
      label: "Routes",
      type: "route-list",
      required: false,
    },
    ...baseFields,
  ],

  VPC: [
    {
      key: "cidr",
      label: "CIDR Block",
      type: "text",
      placeholder: "10.0.0.0/16",
      required: true,
      validate: (value) => {
        if (!isValidCIDR(value)) return "Invalid CIDR format (e.g. 10.0.0.0/16)";
        if (!isValidPrefix(value, 16, 28)) return "VPC prefix must be between /16 and /28";
        return null;
      },
    },
    ...baseFields,
  ],

  Subnet: [
    {
      key: "vpcId",
      label: "VPC",
      type: "parent-select",
      parentType: "VPC",
      required: true,
    },
    {
      key: "cidr",
      label: "CIDR Block",
      type: "text",
      placeholder: "10.0.1.0/24",
      required: true,
      validate: (value, formValues, canvasNodes, editingNodeId) => {
        if (!isValidCIDR(value)) return "Invalid CIDR format (e.g. 10.0.1.0/24)";
        if (!isValidPrefix(value, 16, 28)) return "Subnet prefix must be between /16 and /28";

        const parentVpc = canvasNodes.find((n) => n.id === formValues.vpcId);
        const vpcCIDR = parentVpc?.data?.config?.cidr;
        if (vpcCIDR) {
          if (!cidrContains(vpcCIDR, value))
            return `CIDR must be within VPC range (${vpcCIDR})`;
        }

        const siblingSubnets = canvasNodes.filter(
          (n) =>
            n.data?.resourceType === "Subnet" &&
            n.data?.config?.vpcId === formValues.vpcId &&
            n.data?.config?.cidr &&
            n.id !== editingNodeId
        );

        for (const sibling of siblingSubnets) {
          if (cidrsOverlap(value, sibling.data.config.cidr)) {
            return `Overlaps with existing subnet ${sibling.data.label} (${sibling.data.config.cidr})`;
          }
        }

        return null;
      },
    },
    {
      key: "visibility",
      label: "Visibility",
      type: "select",
      options: ["Public", "Private"],
      required: true,
    },
    {
      key: "availability_zone",
      label: "Availability Zone",
      type: "select",
      getOptions: (canvasNodes, formValues, region) => getAZsForRegion(region || "us-east-1"),
      required: true,
    },
    ...baseFields,
  ],

  // ─── Global Services ─────────────────────────────────────────────────────

  S3: [
    {
      key: "bucket_name",
      label: "Bucket Name",
      type: "text",
      placeholder: "my-unique-bucket-name",
      required: true,
      validate: (value) => {
        if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value))
          return "Bucket name must be 3–63 lowercase chars, digits, hyphens, or dots";
        if (/\.\./.test(value))
          return "Bucket name cannot contain consecutive dots";
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value))
          return "Bucket name must not be formatted as an IP address";
        return null;
      },
    },
    {
      key: "versioning",
      label: "Versioning",
      type: "select",
      options: ["Disabled", "Enabled"],
      required: true,
    },
    {
      key: "encryption",
      label: "Server-Side Encryption",
      type: "select",
      options: ["None", "SSE-S3 (AES-256)", "SSE-KMS"],
      required: true,
    },
    {
      key: "acl",
      label: "Canned ACL",
      type: "select",
      options: [
        "private",
        "public-read",
        "public-read-write",
        "authenticated-read",
      ],
      required: true,
    },
    {
      key: "block_public_access",
      label: "Block All Public Access",
      type: "select",
      options: ["true", "false"],
      optionLabels: { true: "Enabled (recommended)", false: "Disabled" },
      required: true,
    },
    {
      key: "force_destroy",
      label: "Force Destroy",
      type: "select",
      options: ["false", "true"],
      optionLabels: {
        false: "false — safe, bucket must be empty to delete",
        true:  "true — deletes all objects on terraform destroy",
      },
      required: false,
    },
    {
      key: "lifecycle_rule",
      label: "Lifecycle Rule (description)",
      type: "text",
      placeholder: "e.g. expire objects after 90 days",
      required: false,
    },
    ...baseFields,
  ],

  // ─── ECS ─────────────────────────────────────────────────────────────────
  ECS: [
    subnetParent,
    {
      key: "iam_role_id",
      label: "Task IAM Role",
      type: "iam-role-select",
    },
    {
      key: "launch_type",
      label: "Launch Type",
      type: "select",
      options: ["FARGATE", "EC2"],
      required: true,
    },
    {
      key: "cpu",
      label: "CPU Units",
      type: "select",
      options: ["256", "512", "1024", "2048", "4096"],
      optionLabels: {
        "256":  "256 (.25 vCPU)",
        "512":  "512 (.5 vCPU)",
        "1024": "1024 (1 vCPU)",
        "2048": "2048 (2 vCPU)",
        "4096": "4096 (4 vCPU)",
      },
      required: true,
    },
    {
      key: "memory",
      label: "Memory (MB)",
      type: "select",
      options: ["512", "1024", "2048", "4096", "8192"],
      required: true,
    },
    {
      key: "image",
      label: "Container Image",
      type: "text",
      placeholder: "nginx:latest or 123456789.dkr.ecr.us-east-1.amazonaws.com/app:v1",
      required: true,
    },
    {
      key: "desired_count",
      label: "Desired Count",
      type: "text",
      placeholder: "1",
      required: true,
      validate: (value) => {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0) return "Desired count must be a non-negative integer";
        return null;
      },
    },
    {
      key: "container_port",
      label: "Container Port",
      type: "text",
      placeholder: "80",
      required: false,
    },
    ...baseFields,
  ],

  // ─── Lambda ───────────────────────────────────────────────────────────────
  Lambda: [
    {
      key: "iam_role_id",
      label: "Execution Role",
      type: "iam-role-select",
    },
    {
      key: "runtime",
      label: "Runtime",
      type: "select",
      options: [
        "nodejs20.x", "nodejs18.x",
        "python3.12", "python3.11", "python3.10",
        "java21", "java17",
        "dotnet8",
        "go1.x",
        "provided.al2023",
      ],
      required: true,
    },
    {
      key: "handler",
      label: "Handler",
      type: "text",
      placeholder: "index.handler",
      required: true,
    },
    {
      key: "memory_size",
      label: "Memory (MB)",
      type: "select",
      options: ["128", "256", "512", "1024", "2048", "3008"],
      required: true,
    },
    {
      key: "timeout",
      label: "Timeout (seconds)",
      type: "text",
      placeholder: "30",
      required: true,
      validate: (value) => {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1 || n > 900) return "Timeout must be between 1 and 900 seconds";
        return null;
      },
    },
    {
      key: "vpc_enabled",
      label: "VPC Config",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "No VPC (default)", true: "Deploy inside VPC" },
      required: false,
    },
    {
      key: "subnetId",
      label: "Subnet (if VPC enabled)",
      type: "parent-select",
      parentType: "Subnet",
      required: false,
      visibleWhen: (form) => form.vpc_enabled === "true",
    },
    {
      key: "environment_vars",
      label: "Environment Variables",
      type: "text",
      placeholder: "KEY=value,KEY2=value2",
      required: false,
    },
    ...baseFields,
  ],

  // ─── DynamoDB ─────────────────────────────────────────────────────────────
  DynamoDB: [
    {
      key: "table_name",
      label: "Table Name",
      type: "text",
      placeholder: "my-table",
      required: true,
      validate: (value) => {
        if (!/^[a-zA-Z0-9._-]{3,255}$/.test(value))
          return "Table name must be 3–255 chars: letters, numbers, underscores, hyphens, dots";
        return null;
      },
    },
    {
      key: "billing_mode",
      label: "Billing Mode",
      type: "select",
      options: ["PAY_PER_REQUEST", "PROVISIONED"],
      optionLabels: {
        PAY_PER_REQUEST: "On-demand (PAY_PER_REQUEST)",
        PROVISIONED:     "Provisioned capacity",
      },
      required: true,
    },
    {
      key: "hash_key",
      label: "Partition Key (PK) name",
      type: "text",
      placeholder: "id",
      required: true,
    },
    {
      key: "hash_key_type",
      label: "Partition Key type",
      type: "select",
      options: ["S", "N", "B"],
      optionLabels: { S: "S — String", N: "N — Number", B: "B — Binary" },
      required: true,
    },
    {
      key: "range_key",
      label: "Sort Key (SK) name — optional",
      type: "text",
      placeholder: "createdAt",
      required: false,
    },
    {
      key: "range_key_type",
      label: "Sort Key type",
      type: "select",
      options: ["S", "N", "B"],
      optionLabels: { S: "S — String", N: "N — Number", B: "B — Binary" },
      visibleWhen: (form) => !!form.range_key?.trim(),
      required: false,
    },
    {
      key: "point_in_time_recovery",
      label: "Point-in-Time Recovery",
      type: "select",
      options: ["false", "true"],
      optionLabels: { true: "Enabled (recommended)", false: "Disabled" },
      required: false,
    },
    ...baseFields,
  ],

  // ─── SQS ─────────────────────────────────────────────────────────────────
  SQS: [
    {
      key: "queue_name",
      label: "Queue Name",
      type: "text",
      placeholder: "my-queue",
      required: true,
      validate: (value) => {
        if (!/^[a-zA-Z0-9_-]{1,80}$/.test(value))
          return "Queue name must be 1–80 chars: letters, numbers, underscores, hyphens";
        return null;
      },
    },
    {
      key: "fifo",
      label: "Queue Type",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Standard queue", true: "FIFO queue (append .fifo to name)" },
      required: true,
    },
    {
      key: "visibility_timeout",
      label: "Visibility Timeout (seconds)",
      type: "text",
      placeholder: "30",
      required: false,
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0 || n > 43200) return "Visibility timeout must be 0–43200 seconds";
        return null;
      },
    },
    {
      key: "message_retention",
      label: "Message Retention (seconds)",
      type: "select",
      options: ["60", "300", "3600", "86400", "345600", "1209600"],
      optionLabels: {
        "60":      "1 minute",
        "300":     "5 minutes",
        "3600":    "1 hour",
        "86400":   "1 day",
        "345600":  "4 days (default)",
        "1209600": "14 days (max)",
      },
      required: false,
    },
    {
      key: "dlq_enabled",
      label: "Dead Letter Queue",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "No DLQ", true: "Enable DLQ (define separately)" },
      required: false,
    },
    ...baseFields,
  ],
};

export const hasConfig = (type) => !!resourceFields[type];

export const getRequiredParents = (type) => {
  const fields = resourceFields[type] || [];
  return fields
    .filter((f) => f.type === "parent-select")
    .map((f) => f.parentType);
};

// ─── Connection rules are now in dedicated files ─────────────────────────────
// Re-exported here for backwards compatibility during migration.
export { trafficRules, validateTrafficConnection } from "./trafficRules";
export { associationRules, validateAssociationConnection } from "./associationRules";