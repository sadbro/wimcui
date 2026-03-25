/**
 * Resource Registry — single source of truth for resource identity and display.
 *
 * Each entry defines:
 *   label       — display name in sidebar and canvas
 *   color       — border color in ResourceNode + sidebar hover
 *   category    — groups resources in ResourcePanel sidebar
 *                 "network" | "compute" | "infra" | "global"
 *   defaultSize — initial node dimensions on canvas drop
 *
 * To add a new resource:
 *   1. Add entry here
 *   2. Add fields to resourceConfig.js
 *   3. Add rules to trafficRules.js and/or associationRules.js
 *   4. Add byType derivation is automatic via canvasContext.js
 *   5. Add section to ReviewPanel.jsx SummaryTab
 *   6. Add consequence rules to consequenceRules.js if needed
 *
 * Categories:
 *   "network" — VPC-scoped networking (VPC, Subnet)
 *   "compute" — compute and data resources (EC2, RDS, LB)
 *   "infra"   — VPC infrastructure (IGW, NAT, RouteTable)
 *   "global"  — regional/global services not bound to a VPC (S3, IAM, etc.)
 */

export const RESOURCE_REGISTRY = {
  VPC: {
    label:       "VPC",
    color:       "#4d6bfe",
    category:    "network",
    defaultSize: { width: 300, height: 200 },
    sgCapable:   false,
    iamCapable:  false,
  },
  Subnet: {
    label:       "Subnet",
    color:       "#4d9ffe",
    category:    "network",
    defaultSize: { width: 220, height: 140 },
    sgCapable:   false,
    iamCapable:  false,
  },
  EC2: {
    label:       "EC2",
    color:       "#8892aa",
    category:    "compute",
    defaultSize: { width: 140, height: 60 },
    sgCapable:   true,
    iamCapable:  true,
  },
  RDS: {
    label:       "RDS",
    color:       "#8892aa",
    category:    "compute",
    defaultSize: { width: 140, height: 60 },
    sgCapable:   true,
    iamCapable:  false,
  },
  LoadBalancer: {
    label:       "Load Balancer",
    color:       "#8892aa",
    category:    "compute",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   true,  // ALB only — NLB guard in consequenceRules
    iamCapable:  false,
  },
  ECS: {
    label:       "ECS Service",
    color:       "#eb2f96",
    category:    "compute",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   true,
    iamCapable:  true,
  },
  IGW: {
    label:       "Internet Gateway",
    color:       "#52c41a",
    category:    "infra",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
  NATGateway: {
    label:       "NAT Gateway",
    color:       "#fa8c16",
    category:    "infra",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
  RouteTable: {
    label:       "Route Table",
    color:       "#722ed1",
    category:    "infra",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },

  // ─── Global Services ────────────────────────────────────────────────────────
  S3: {
    label:       "S3 Bucket",
    color:       "#13c2c2",
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
  Lambda: {
    label:       "Lambda",
    color:       "#ff9900",
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   true,  // VPC Lambda only — guard in consequenceRules
    iamCapable:  true,
  },
  DynamoDB: {
    label:       "DynamoDB",
    color:       "#4d9ffe",
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
  SQS: {
    label:       "SQS Queue",
    color:       "#ff4d4f",
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
  SNS: {
    label:       "SNS Topic",
    color:       "#eb2f96",
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
  EventBridge: {
    label:       "EventBridge",
    color:       "#fa8c16",
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
  SecretsManager: {
    label:       "Secrets Manager",
    color:       "#722ed1",
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
  APIGateway: {
    label:       "API Gateway",
    color:       "#a0522d",
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },

  // ─── Caching ────────────────────────────────────────────────────────────────
  ElastiCache: {
    label:       "ElastiCache",
    color:       "#c7131f",
    category:    "compute",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   true,
    iamCapable:  false,
  },
  // ─── Container Registry ────────────────────────────────────────────────────
  ECR: {
    label:       "ECR",
    color:       "#d4380d",  // distinct from ECS (#eb2f96) and SNS (#eb2f96)
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
  // ─── DNS & Streaming ────────────────────────────────────────────────────────
  Route53: {
    label:       "Route 53",
    color:       "#8c4fff",
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
  Kinesis: {
    label:       "Kinesis",
    color:       "#e535ab",
    category:    "global",
    defaultSize: { width: 160, height: 60 },
    sgCapable:   false,
    iamCapable:  false,
  },
};

/** All registered resource type keys */
export const RESOURCE_TYPES = Object.keys(RESOURCE_REGISTRY);

/** Filtered views by category */
export const resourcesByCategory = (category) =>
  Object.entries(RESOURCE_REGISTRY)
    .filter(([, def]) => def.category === category)
    .map(([type, def]) => ({ type, ...def }));

/** Quick color lookup — falls back to a neutral border */
export const resourceColor = (type) =>
  RESOURCE_REGISTRY[type]?.color ?? "var(--border)";

/** Quick label lookup — falls back to the raw type string */
export const resourceLabel = (type) =>
  RESOURCE_REGISTRY[type]?.label ?? type;