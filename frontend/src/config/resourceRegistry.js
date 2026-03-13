/**
 * Resource Registry — single source of truth for resource identity and display.
 *
 * Each entry defines:
 *   label       — display name in sidebar and canvas
 *   color       — border color in ResourceNode + sidebar hover
 *   category    — groups resources in ResourcePanel sidebar
 *                 "network" | "compute" | "infra"
 *   defaultSize — initial node dimensions on canvas drop
 *
 * To add a new resource:
 *   1. Add entry here
 *   2. Add fields to resourceConfig.js
 *   3. Add rules to trafficRules.js and/or associationRules.js
 *   4. Add byType derivation is automatic via canvasContext.js
 *   5. Add section to ReviewPanel.jsx SummaryTab
 *   6. Add consequence rules to consequenceRules.js if needed
 */

export const RESOURCE_REGISTRY = {
  VPC: {
    label:       "VPC",
    color:       "#4d6bfe",
    category:    "network",
    defaultSize: { width: 300, height: 200 },
  },
  Subnet: {
    label:       "Subnet",
    color:       "#4d9ffe",
    category:    "network",
    defaultSize: { width: 220, height: 140 },
  },
  EC2: {
    label:       "EC2",
    color:       "#8892aa",
    category:    "compute",
    defaultSize: { width: 140, height: 60 },
  },
  RDS: {
    label:       "RDS",
    color:       "#8892aa",
    category:    "compute",
    defaultSize: { width: 140, height: 60 },
  },
  LoadBalancer: {
    label:       "Load Balancer",
    color:       "#8892aa",
    category:    "compute",
    defaultSize: { width: 160, height: 60 },
  },
  IGW: {
    label:       "Internet Gateway",
    color:       "#52c41a",
    category:    "infra",
    defaultSize: { width: 160, height: 60 },
  },
  NATGateway: {
    label:       "NAT Gateway",
    color:       "#fa8c16",
    category:    "infra",
    defaultSize: { width: 160, height: 60 },
  },
  RouteTable: {
    label:       "Route Table",
    color:       "#722ed1",
    category:    "infra",
    defaultSize: { width: 160, height: 60 },
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