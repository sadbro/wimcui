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
};

export const hasConfig = (type) => !!resourceFields[type];

export const getRequiredParents = (type) => {
  const fields = resourceFields[type] || [];
  return fields
    .filter((f) => f.type === "parent-select")
    .map((f) => f.parentType);
};

// Per-resource traffic connection rules
export const trafficRules = {
  EC2:          { allowedSources: ["EC2", "RDS", "LoadBalancer", "Public"], allowedTargets: ["EC2", "RDS", "LoadBalancer"] },
  RDS:          { allowedSources: ["EC2"],                                  allowedTargets: ["EC2"] },
  LoadBalancer: { allowedSources: ["Public", "EC2"],                        allowedTargets: ["EC2"] }, // Public->NLB blocked at connect time
  Public:       { allowedSources: [],                                       allowedTargets: ["EC2", "LoadBalancer"] },
  // Infrastructure resources — no traffic edges allowed
  IGW:          null,
  NATGateway:   null,
  RouteTable:   null,
  VPC:          null,
  Subnet:       null,
};

// Association rules — which resource pairs can be linked with an association edge
export const associationRules = {
  RouteTable: { allowedTargets: ["Subnet", "IGW", "NATGateway"] },
  Subnet:     { allowedTargets: ["RouteTable"] },
};

export const validateAssociationConnection = (sourceType, targetType) => {
  const rules = associationRules[sourceType];
  if (!rules) return `\${sourceType} does not support association connections`;
  if (!rules.allowedTargets.includes(targetType))
    return `\${sourceType} cannot be associated with \${targetType}`;
  return null;
};

// Returns null if allowed, or an error string if blocked
export const validateTrafficConnection = (sourceType, targetType) => {
  const sourceRules = trafficRules[sourceType];
  const targetRules = trafficRules[targetType];

  if (!sourceRules || !targetRules)
    return `${sourceType} does not support traffic connections`;

  if (!sourceRules.allowedTargets.includes(targetType))
    return `${sourceType} cannot connect to ${targetType}`;

  if (!targetRules.allowedSources.includes(sourceType))
    return `${targetType} cannot receive traffic from ${sourceType}`;

  return null;
};