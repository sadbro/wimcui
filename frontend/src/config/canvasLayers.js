/**
 * Canvas layer definitions.
 *
 * Each layer groups resource types by architectural concern.
 * Used by the canvas filter pills to dim/highlight nodes and edges.
 */

export const LAYERS = {
  all:      { label: "All",      resourceTypes: null, edgeTypes: null },
  network:  { label: "Network",  resourceTypes: ["VPC", "Subnet", "IGW", "NATGateway", "RouteTable", "Route53"], edgeTypes: ["structural", "association"] },
  compute:  { label: "Compute",  resourceTypes: ["EC2", "ECS", "Lambda", "LoadBalancer", "ASG", "EKSCluster", "EKSNodeGroup"], edgeTypes: ["traffic"] },
  data:     { label: "Data",     resourceTypes: ["RDS", "DynamoDB", "ElastiCache", "S3"], edgeTypes: ["traffic"] },
  services: { label: "Services", resourceTypes: ["SQS", "SNS", "EventBridge", "Kinesis", "SecretsManager", "ECR", "APIGateway", "ACM", "CloudFront", "WAF", "Cognito", "StepFunctions"], edgeTypes: ["association"] },
};

export const LAYER_ORDER = ["all", "network", "compute", "data", "services"];

const typeToLayer = {};
for (const [key, layer] of Object.entries(LAYERS)) {
  if (layer.resourceTypes) {
    for (const rt of layer.resourceTypes) {
      typeToLayer[rt] = key;
    }
  }
}

/** Get which layer a resource type belongs to. */
export function getNodeLayer(resourceType) {
  return typeToLayer[resourceType] || null;
}

/** Check if a node belongs to the active layer. */
export function isNodeInLayer(node, layerKey) {
  if (layerKey === "all") return true;
  const rt = node.data?.resourceType;
  return getNodeLayer(rt) === layerKey;
}

/**
 * Get edge opacity for the active layer.
 *   - "all" → 1
 *   - both endpoints in layer → 1
 *   - one endpoint in layer → 0.3  (boundary edge)
 *   - neither endpoint in layer → 0.08
 */
export function getEdgeOpacity(edge, nodeById, layerKey) {
  if (layerKey === "all") return 1;

  const sourceNode = nodeById(edge.source);
  const targetNode = nodeById(edge.target);
  const sourceIn = sourceNode ? isNodeInLayer(sourceNode, layerKey) : false;
  const targetIn = targetNode ? isNodeInLayer(targetNode, layerKey) : false;

  if (sourceIn && targetIn) return 1;
  if (sourceIn || targetIn) return 0.3;
  return 0.08;
}

// ─── Security Overlay ────────────────────────────────────────────────────────

import { RESOURCE_REGISTRY } from "./resourceRegistry.js";

/** Whether a node's resource type supports security groups. */
export function isSgCapable(node) {
  const rt = node?.data?.resourceType;
  return !!RESOURCE_REGISTRY[rt]?.sgCapable;
}

/** Whether a node has at least one SG assigned. */
export function hasSGAssigned(node) {
  return (node?.data?.config?.sg_ids || []).length > 0;
}

/**
 * Security overlay node style.
 * Returns { opacity, boxShadow, borderColor } overrides, or null if overlay is off.
 */
export function getSecurityNodeStyle(node, securityGroups) {
  const capable = isSgCapable(node);
  if (!capable) return { opacity: 0.15, boxShadow: "none", borderColor: null };

  const sgIds = node?.data?.config?.sg_ids || [];
  if (sgIds.length === 0) {
    // Exposed — no SGs assigned
    return { opacity: 1, boxShadow: "0 0 0 2px #ff4d4f88, 0 0 8px #ff4d4f44", borderColor: "#ff4d4f" };
  }

  // Has SGs — glow with primary SG color
  const primarySg = securityGroups.find((sg) => sg.id === sgIds[0]);
  const color = primarySg?.color || "#52c41a";
  return { opacity: 1, boxShadow: `0 0 0 2px ${color}88, 0 0 8px ${color}44`, borderColor: color };
}

/**
 * Edge opacity during security overlay.
 * Traffic edges stay full, others dim heavily.
 */
export function getSecurityEdgeOpacity(edgeType) {
  return edgeType === "traffic" ? 1 : 0.08;
}
