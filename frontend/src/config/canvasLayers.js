/**
 * Canvas layer definitions.
 *
 * Each layer groups resource types by architectural concern.
 * Used by the canvas filter pills to dim/highlight nodes and edges.
 */

export const LAYERS = {
  all:      { label: "All",      resourceTypes: null, edgeTypes: null },
  network:  { label: "Network",  resourceTypes: ["VPC", "Subnet", "IGW", "NATGateway", "RouteTable", "Route53"], edgeTypes: ["structural", "association"] },
  compute:  { label: "Compute",  resourceTypes: ["EC2", "ECS", "Lambda", "LoadBalancer"], edgeTypes: ["traffic"] },
  data:     { label: "Data",     resourceTypes: ["RDS", "DynamoDB", "ElastiCache", "S3"], edgeTypes: ["traffic"] },
  services: { label: "Services", resourceTypes: ["SQS", "SNS", "EventBridge", "Kinesis", "SecretsManager", "ECR", "APIGateway"], edgeTypes: ["association"] },
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
