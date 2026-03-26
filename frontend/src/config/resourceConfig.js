import { getAZsForRegion } from "./awsRegions";
import { isValidCIDR, isValidPrefix, cidrContains, cidrsOverlap } from "./cidrUtils";

// Base fields shared by all resources
const baseFields = [
  { key: "display_name", label: "Display Name", type: "text", placeholder: "My Resource", required: false },
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
    {
      key: "subnets",
      label: "Subnets",
      type: "multi-select",
      parentType: "Subnet",
      required: true,
      minItems: 2,
      description: "Select subnets in at least 2 AZs — required for DB Subnet Group",
    },
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
    {
      key: "storage_encrypted",
      label: "Storage Encryption",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Disabled (not recommended for production)", true: "Enabled" },
      required: true,
    },
    {
      key: "kms_key_id",
      label: "KMS Key ID (optional)",
      type: "text",
      placeholder: "alias/aws/rds or key ARN",
      required: false,
      visibleWhen: (form) => form.storage_encrypted === "true",
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
    {
      key: "subnets",
      label: "Subnets",
      type: "multi-select",
      parentType: "Subnet",
      required: true,
      minItems: 1,
      description: "Select subnets across multiple AZs for fault tolerance",
    },
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

  // ─── SNS ──────────────────────────────────────────────────────────────────
  SNS: [
    {
      key: "topic_name",
      label: "Topic Name",
      type: "text",
      placeholder: "my-topic",
      required: true,
      validate: (value) => {
        if (!/^[a-zA-Z0-9_-]{1,256}$/.test(value))
          return "Topic name must be 1–256 chars: letters, numbers, underscores, hyphens";
        return null;
      },
    },
    {
      key: "fifo",
      label: "Topic Type",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Standard topic", true: "FIFO topic (append .fifo to name)" },
      required: true,
    },
    {
      key: "encryption",
      label: "Server-Side Encryption",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Disabled", true: "Enabled (SSE-KMS)" },
      required: false,
    },
    {
      key: "subscription_protocol",
      label: "Default Subscription Protocol",
      type: "select",
      options: ["sqs", "lambda", "email", "http", "https"],
      required: false,
    },
    ...baseFields,
  ],

  // ─── EventBridge ──────────────────────────────────────────────────────────
  EventBridge: [
    {
      key: "bus_name",
      label: "Event Bus Name",
      type: "text",
      placeholder: "my-event-bus",
      required: true,
      validate: (value) => {
        if (!/^[a-zA-Z0-9_.-]{1,256}$/.test(value))
          return "Bus name must be 1–256 chars: letters, numbers, underscores, hyphens, dots";
        if (value === "default")
          return "Cannot name a custom bus 'default' — that is the AWS default bus";
        return null;
      },
    },
    {
      key: "archive_enabled",
      label: "Event Archive",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "No archive", true: "Archive events (for replay)" },
      required: false,
    },
    {
      key: "archive_retention",
      label: "Archive Retention (days, 0 = forever)",
      type: "text",
      placeholder: "0",
      required: false,
      visibleWhen: (form) => form.archive_enabled === "true",
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0) return "Retention must be 0 (forever) or positive days";
        return null;
      },
    },
    ...baseFields,
  ],

  // ─── Secrets Manager ──────────────────────────────────────────────────────
  SecretsManager: [
    {
      key: "secret_name",
      label: "Secret Name",
      type: "text",
      placeholder: "prod/db/password",
      required: true,
      validate: (value) => {
        if (!/^[a-zA-Z0-9/_+=.@-]{1,512}$/.test(value))
          return "Secret name must be 1–512 chars: letters, numbers, /_+=.@-";
        return null;
      },
    },
    {
      key: "rotation_enabled",
      label: "Automatic Rotation",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Disabled", true: "Enabled" },
      required: false,
    },
    {
      key: "rotation_days",
      label: "Rotation Interval (days)",
      type: "text",
      placeholder: "30",
      required: false,
      visibleWhen: (form) => form.rotation_enabled === "true",
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1 || n > 365) return "Rotation interval must be 1–365 days";
        return null;
      },
    },
    {
      key: "kms_key",
      label: "KMS Key ID (optional)",
      type: "text",
      placeholder: "alias/my-key or key ARN",
      required: false,
    },
    ...baseFields,
  ],

  // ─── API Gateway ──────────────────────────────────────────────────────────
  APIGateway: [
    {
      key: "api_name",
      label: "API Name",
      type: "text",
      placeholder: "my-api",
      required: true,
      validate: (value) => {
        if (!value?.trim()) return "API name is required";
        if (value.length > 128) return "API name must be 128 chars or fewer";
        return null;
      },
    },
    {
      key: "api_type",
      label: "API Type",
      type: "select",
      options: ["REST", "HTTP", "WebSocket"],
      optionLabels: {
        REST:      "REST — full features, usage plans, caching",
        HTTP:      "HTTP — low latency, lower cost, simpler",
        WebSocket: "WebSocket — real-time bidirectional",
      },
      required: true,
    },
    {
      key: "stage_name",
      label: "Stage Name",
      type: "text",
      placeholder: "prod",
      required: true,
      validate: (value) => {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value))
          return "Stage name must be 1–128 chars: letters, numbers, underscores, hyphens";
        return null;
      },
    },
    {
      key: "throttling_rate",
      label: "Throttle Rate (req/sec)",
      type: "text",
      placeholder: "1000",
      required: false,
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1) return "Throttle rate must be a positive integer";
        return null;
      },
    },
    {
      key: "throttling_burst",
      label: "Throttle Burst",
      type: "text",
      placeholder: "2000",
      required: false,
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1) return "Burst limit must be a positive integer";
        return null;
      },
    },
    {
      key: "cors_enabled",
      label: "CORS",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Disabled", true: "Enabled" },
      required: false,
    },
    {
      key: "logging_enabled",
      label: "Access Logging",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Disabled", true: "Enabled (CloudWatch)" },
      required: false,
    },
    ...baseFields,
  ],

  // ─── ElastiCache ──────────────────────────────────────────────────────────
  ElastiCache: [
    {
      key: "subnets",
      label: "Subnets",
      type: "multi-select",
      parentType: "Subnet",
      required: true,
      minItems: 2,
      description: "Select subnets in at least 2 AZs — required for subnet group",
    },
    {
      key: "sg_ids",
      label: "Security Groups",
      type: "sg-select",
    },
    {
      key: "engine",
      label: "Engine",
      type: "select",
      options: ["redis", "memcached"],
      optionLabels: {
        redis:      "Redis — persistent, pub/sub, Lua scripting",
        memcached:  "Memcached — simple, multi-threaded, no persistence",
      },
      required: true,
    },
    {
      key: "engine_version",
      label: "Engine Version",
      type: "text",
      placeholder: "7.0",
      required: false,
    },
    {
      key: "node_type",
      label: "Node Type",
      type: "select",
      options: ["cache.t3.micro", "cache.t3.small", "cache.t3.medium",
                "cache.r6g.large", "cache.r6g.xlarge", "cache.r6g.2xlarge"],
      required: true,
    },
    {
      key: "num_cache_nodes",
      label: "Number of Nodes",
      type: "text",
      placeholder: "1",
      required: true,
      validate: (value) => {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1) return "Must be at least 1 node";
        return null;
      },
    },
    {
      key: "multi_az",
      label: "Multi-AZ",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Disabled", true: "Enabled (Redis only)" },
      required: false,
    },
    {
      key: "at_rest_encryption",
      label: "Encryption at Rest",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Disabled", true: "Enabled" },
      required: false,
    },
    {
      key: "in_transit_encryption",
      label: "Encryption in Transit (TLS)",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Disabled", true: "Enabled" },
      required: false,
    },
    {
      key: "auth_token",
      label: "Redis AUTH Token",
      type: "text",
      placeholder: "min 16 chars, no spaces",
      required: false,
      visibleWhen: (form) => form.engine === "redis" && form.in_transit_encryption === "true",
      validate: (value) => {
        if (!value) return null;
        if (value.length < 16) return "AUTH token must be at least 16 characters";
        if (/\s/.test(value)) return "AUTH token cannot contain spaces";
        return null;
      },
      description: "Redis AUTH password — required when in-transit encryption is enabled in production",
    },
    ...baseFields,
  ],

  // ─── ECR ──────────────────────────────────────────────────────────────────
  ECR: [
    {
      key: "repository_name",
      label: "Repository Name",
      type: "text",
      placeholder: "my-app/api",
      required: true,
      validate: (value) => {
        if (!/^[a-z0-9._/-]{2,256}$/.test(value))
          return "Repository name must be 2–256 lowercase chars: letters, numbers, ., _, -, /";
        return null;
      },
    },
    {
      key: "image_tag_mutability",
      label: "Image Tag Mutability",
      type: "select",
      options: ["MUTABLE", "IMMUTABLE"],
      optionLabels: {
        MUTABLE:   "Mutable — tags can be overwritten (not recommended for prod)",
        IMMUTABLE: "Immutable — tags are locked, forces unique versioning",
      },
      required: true,
    },
    {
      key: "scan_on_push",
      label: "Scan on Push",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Disabled", true: "Enabled — scans for CVEs on push" },
      required: false,
    },
    {
      key: "encryption_type",
      label: "Encryption Type",
      type: "select",
      options: ["AES256", "KMS"],
      optionLabels: {
        AES256: "AES-256 — AWS managed key",
        KMS:    "KMS — customer managed key",
      },
      required: false,
    },
    {
      key: "lifecycle_policy",
      label: "Lifecycle Policy",
      type: "select",
      options: ["none", "keep_last_10", "keep_last_30", "expire_untagged_7d"],
      optionLabels: {
        none:              "None — images accumulate indefinitely",
        keep_last_10:      "Keep last 10 tagged images",
        keep_last_30:      "Keep last 30 tagged images",
        expire_untagged_7d: "Expire untagged images after 7 days",
      },
      required: false,
    },
    ...baseFields,
  ],

  // ─── Route53 ──────────────────────────────────────────────────────────────
  Route53: [
    {
      key: "hosted_zone_name",
      label: "Hosted Zone Name",
      type: "text",
      placeholder: "example.com",
      required: true,
      validate: (value) => {
        if (!value?.trim()) return "Hosted zone name is required";
        if (!/^([a-z0-9-]+\.)+[a-z]{2,}\.?$/.test(value.toLowerCase()))
          return "Must be a valid domain name (e.g. example.com)";
        return null;
      },
    },
    {
      key: "zone_type",
      label: "Zone Type",
      type: "select",
      options: ["public", "private"],
      optionLabels: {
        public:  "Public — resolves from the internet",
        private: "Private — resolves only within VPC",
      },
      required: true,
    },
    {
      key: "record_type",
      label: "Primary Record Type",
      type: "select",
      options: ["A", "CNAME", "ALIAS", "AAAA"],
      required: false,
    },
    {
      key: "routing_policy",
      label: "Routing Policy",
      type: "select",
      options: ["simple", "weighted", "latency", "failover", "geolocation"],
      required: false,
    },
    {
      key: "ttl",
      label: "TTL (seconds)",
      type: "text",
      placeholder: "300",
      required: false,
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0) return "TTL must be a non-negative integer";
        return null;
      },
    },
    {
      key: "health_check_enabled",
      label: "Health Check",
      type: "select",
      options: ["false", "true"],
      optionLabels: { false: "Disabled", true: "Enabled" },
      required: false,
    },
    ...baseFields,
  ],

  // ─── Kinesis ──────────────────────────────────────────────────────────────
  Kinesis: [
    {
      key: "stream_name",
      label: "Stream Name",
      type: "text",
      placeholder: "my-data-stream",
      required: true,
      validate: (value) => {
        if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(value))
          return "Stream name must be 1–128 chars: letters, numbers, _, ., -";
        return null;
      },
    },
    {
      key: "stream_mode",
      label: "Capacity Mode",
      type: "select",
      options: ["PROVISIONED", "ON_DEMAND"],
      optionLabels: {
        PROVISIONED: "Provisioned — fixed shard count, predictable cost",
        ON_DEMAND:   "On-Demand — auto-scales, pay per throughput",
      },
      required: true,
    },
    {
      key: "shard_count",
      label: "Shard Count (Provisioned only)",
      type: "text",
      placeholder: "1",
      required: false,
      visibleWhen: (form) => form.stream_mode === "PROVISIONED",
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1) return "Must have at least 1 shard";
        return null;
      },
    },
    {
      key: "retention_hours",
      label: "Retention Period (hours)",
      type: "select",
      options: ["24", "48", "72", "168", "720", "8760"],
      optionLabels: {
        "24":   "24 hours (default, minimum)",
        "48":   "48 hours",
        "72":   "72 hours",
        "168":  "7 days",
        "720":  "30 days",
        "8760": "365 days (maximum)",
      },
      required: false,
    },
    {
      key: "encryption",
      label: "Server-Side Encryption",
      type: "select",
      options: ["NONE", "KMS"],
      optionLabels: {
        NONE: "None",
        KMS:  "KMS — encrypts data at rest",
      },
      required: false,
    },
    ...baseFields,
  ],

  // ─── ACM ────────────────────────────────────────────────────────────────────
  ACM: [
    {
      key: "domain_name",
      label: "Domain Name",
      type: "text",
      placeholder: "example.com or *.example.com",
      required: true,
      validate: (value) => {
        if (!value?.trim()) return "Domain name is required";
        if (!/^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(value))
          return "Enter a valid domain (e.g., example.com or *.example.com)";
        return null;
      },
    },
    {
      key: "validation_method",
      label: "Validation Method",
      type: "select",
      options: ["DNS", "EMAIL"],
      optionLabels: {
        DNS:   "DNS — recommended, auto-renews",
        EMAIL: "Email — manual renewal",
      },
      required: true,
    },
    {
      key: "subject_alternative_names",
      label: "Subject Alternative Names (comma-separated)",
      type: "text",
      placeholder: "www.example.com, api.example.com",
      required: false,
    },
    ...baseFields,
  ],

  // ─── CloudFront ─────────────────────────────────────────────────────────────
  CloudFront: [
    {
      key: "origin_type",
      label: "Origin Type",
      type: "select",
      options: ["S3", "LoadBalancer", "APIGateway", "custom"],
      optionLabels: {
        S3:            "S3 Bucket",
        LoadBalancer:  "Application Load Balancer",
        APIGateway:    "API Gateway",
        custom:        "Custom Origin (URL)",
      },
      required: true,
    },
    {
      key: "origin_id",
      label: "Origin Resource",
      type: "dependent-select",
      dependsOn: "origin_type",
      parentTypeMap: { S3: "S3", LoadBalancer: "LoadBalancer", APIGateway: "APIGateway" },
      required: false,
      visibleWhen: (form) => form.origin_type && form.origin_type !== "custom",
    },
    {
      key: "custom_origin",
      label: "Custom Origin Domain",
      type: "text",
      placeholder: "api.example.com",
      required: false,
      visibleWhen: (form) => form.origin_type === "custom",
    },
    {
      key: "acm_certificate_id",
      label: "ACM Certificate",
      type: "dependent-select",
      dependsOn: null,
      parentType: "ACM",
      required: false,
    },
    {
      key: "price_class",
      label: "Price Class",
      type: "select",
      options: ["PriceClass_All", "PriceClass_200", "PriceClass_100"],
      optionLabels: {
        PriceClass_All: "All edge locations (global)",
        PriceClass_200: "US, Canada, Europe, Asia, Middle East, Africa",
        PriceClass_100: "US, Canada, Europe only (cheapest)",
      },
      required: false,
    },
    {
      key: "default_ttl",
      label: "Default TTL (seconds)",
      type: "text",
      placeholder: "86400",
      required: false,
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0) return "TTL must be a non-negative integer";
        return null;
      },
    },
    {
      key: "viewer_protocol_policy",
      label: "Viewer Protocol",
      type: "select",
      options: ["redirect-to-https", "allow-all", "https-only"],
      optionLabels: {
        "redirect-to-https": "Redirect HTTP to HTTPS (recommended)",
        "allow-all":         "Allow HTTP and HTTPS",
        "https-only":        "HTTPS only",
      },
      required: false,
    },
    ...baseFields,
  ],

  // ─── WAF ────────────────────────────────────────────────────────────────────
  WAF: [
    {
      key: "waf_name",
      label: "Web ACL Name",
      type: "text",
      placeholder: "my-web-acl",
      required: true,
      validate: (value) => {
        if (!value?.trim()) return "Web ACL name is required";
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value))
          return "Name must be 1–128 chars: letters, numbers, underscores, hyphens";
        return null;
      },
    },
    {
      key: "scope",
      label: "Scope",
      type: "select",
      options: ["REGIONAL", "CLOUDFRONT"],
      optionLabels: {
        REGIONAL:   "Regional — ALB, API Gateway",
        CLOUDFRONT: "CloudFront — must be in us-east-1",
      },
      required: true,
    },
    {
      key: "managed_rules",
      label: "Managed Rule Groups",
      type: "multi-select",
      options: [
        "AWSManagedRulesCommonRuleSet",
        "AWSManagedRulesSQLiRuleSet",
        "AWSManagedRulesKnownBadInputsRuleSet",
        "AWSManagedRulesAmazonIpReputationList",
        "AWSManagedRulesBotControlRuleSet",
      ],
      required: false,
    },
    {
      key: "rate_limit",
      label: "Rate Limit (requests per 5 min)",
      type: "text",
      placeholder: "2000",
      required: false,
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 100) return "Rate limit must be at least 100";
        return null;
      },
    },
    {
      key: "default_action",
      label: "Default Action",
      type: "select",
      options: ["allow", "block"],
      optionLabels: {
        allow: "Allow — block only matched rules",
        block: "Block — allow only matched rules",
      },
      required: true,
    },
    ...baseFields,
  ],

  // ─── ASG ────────────────────────────────────────────────────────────────────
  ASG: [
    {
      key: "subnets",
      label: "Subnets",
      type: "multi-select",
      parentType: "Subnet",
    },
    {
      key: "ami",
      label: "AMI ID",
      type: "text",
      placeholder: "ami-0c55b159cbfafe1f0",
      required: true,
      validate: (value) => {
        if (!value?.trim()) return "AMI is required";
        if (!/^ami-[a-f0-9]{8,17}$/.test(value)) return "Invalid AMI format (e.g. ami-0c55b159...)";
        return null;
      },
    },
    {
      key: "instance_type",
      label: "Instance Type",
      type: "text",
      placeholder: "t3.micro",
      required: true,
    },
    {
      key: "min_size",
      label: "Min Instances",
      type: "text",
      placeholder: "1",
      required: true,
      validate: (value) => {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0) return "Min size must be 0 or greater";
        return null;
      },
    },
    {
      key: "max_size",
      label: "Max Instances",
      type: "text",
      placeholder: "4",
      required: true,
      validate: (value) => {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1) return "Max size must be at least 1";
        return null;
      },
    },
    {
      key: "desired_capacity",
      label: "Desired Capacity",
      type: "text",
      placeholder: "2",
      required: true,
      validate: (value) => {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0) return "Desired capacity must be 0 or greater";
        return null;
      },
    },
    {
      key: "health_check_type",
      label: "Health Check Type",
      type: "select",
      options: ["EC2", "ELB"],
      optionLabels: {
        EC2: "EC2 — instance status checks",
        ELB: "ELB — load balancer health checks (recommended with ALB)",
      },
      required: false,
    },
    {
      key: "health_check_grace_period",
      label: "Health Check Grace Period (seconds)",
      type: "text",
      placeholder: "300",
      required: false,
    },
    {
      key: "sg_ids",
      label: "Security Groups",
      type: "sg-select",
    },
    {
      key: "iam_role_id",
      label: "IAM Role",
      type: "iam-role-select",
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