import { RESOURCE_TYPES } from "./resourceRegistry";

/**
 * Builds a derived context object from raw canvas nodes and edges.
 * This is the single source of truth passed to all consequence rules and validation checks.
 *
 * byResourceType is auto-derived from RESOURCE_REGISTRY — no manual additions needed
 * when new resource types are added to the registry.
 */
export function buildContext(nodes, edges, roles = [], securityGroups = []) {
  const byType = (type) => nodes.filter((n) => n.data?.resourceType === type);
  const nodeById = (id) => nodes.find((n) => n.id === id);

  // Auto-derived from registry — adding a new type to resourceRegistry.js
  // automatically makes it available here as byResourceType["NewType"]
  const byResourceType = RESOURCE_TYPES.reduce((acc, t) => {
    acc[t] = byType(t);
    return acc;
  }, {});

  // Named aliases for convenience and backwards compatibility
  const vpcs    = byResourceType["VPC"];
  const subnets = byResourceType["Subnet"];
  const ec2     = byResourceType["EC2"];
  const rds     = byResourceType["RDS"];
  const lbs     = byResourceType["LoadBalancer"];
  const igws    = byResourceType["IGW"];
  const nats    = byResourceType["NATGateway"];
  const rts     = byResourceType["RouteTable"];
  const publics = byType("Public"); // Public is not in registry (deprecated node type)

  // IAM helpers
  const roleById     = (id) => roles.find((r) => r.id === id);
  const rolePolicies = (roleId) => roleById(roleId)?.policies || [];
  const ec2WithRole    = () => ec2.filter((n) => n.data?.config?.iam_role_id);
  const ec2WithoutRole = () => ec2.filter((n) => {
    const roleId = n.data?.config?.iam_role_id;
    if (!roleId) return true;        // no role set
    return !roleById(roleId);        // role ID set but role doesn't exist — dangling
  });
  const assignedRoleIds = new Set(ec2.map((n) => n.data?.config?.iam_role_id).filter(Boolean));
  const unassignedRoles = roles.filter((r) => !assignedRoleIds.has(r.id));

  const structuralEdges  = edges.filter((e) => e.type === "structural");
  const assocEdges       = edges.filter((e) => e.type === "association");
  const trafficEdges     = edges.filter((e) => e.type === "traffic");

  // Subnets grouped by VPC id
  const subnetsByVpc = subnets.reduce((acc, s) => {
    const vpcId = s.data?.config?.vpcId;
    if (!vpcId) return acc;
    if (!acc[vpcId]) acc[vpcId] = [];
    acc[vpcId].push(s);
    return acc;
  }, {});

  // Public subnets
  const publicSubnets  = subnets.filter((s) => s.data?.config?.visibility === "Public");
  const privateSubnets = subnets.filter((s) => s.data?.config?.visibility === "Private");

  // RT associations — map subnetId -> routeTable and routeTableId -> subnets
  const rtBySubnet = {};
  const subnetsByRt = {};
  // Only RT<->Subnet assoc edges — exclude route edges (RT->IGW/NAT)
  assocEdges.filter((e) => !e.id.startsWith("e_route_")).forEach((e) => {
    const src = nodeById(e.source);
    const tgt = nodeById(e.target);
    const rt     = [src, tgt].find((n) => n?.data?.resourceType === "RouteTable");
    const subnet = [src, tgt].find((n) => n?.data?.resourceType === "Subnet");
    if (rt && subnet) {
      rtBySubnet[subnet.id] = rt;
      if (!subnetsByRt[rt.id]) subnetsByRt[rt.id] = [];
      subnetsByRt[rt.id].push(subnet);
    }
  });

  // Traffic edge helpers
  const trafficNeighbors = (nodeId) =>
    trafficEdges
      .filter((e) => e.source === nodeId || e.target === nodeId)
      .map((e) => nodeById(e.source === nodeId ? e.target : e.source));

  const hasTrafficEdge = (nodeId) =>
    trafficEdges.some((e) => e.source === nodeId || e.target === nodeId);

  const hasAnyEdge = (nodeId) =>
    edges.some((e) => e.source === nodeId || e.target === nodeId);

  // Routes helpers
  const routesForRt = (rt) => rt.data?.config?.routes || [];

  const rtRoutesTo = (rt, targetId) =>
    routesForRt(rt).some((r) => r.target === targetId);

  const anyRtRoutesTo = (targetId) =>
    rts.some((rt) => rtRoutesTo(rt, targetId));

  // SG helpers
  const sgById = (id) => securityGroups.find((s) => s.id === id);

  // Nodes that have at least one SG assigned (sg_ids non-empty)
  const sgCapableNodes = [...ec2, ...rds, ...lbs];
  const nodesWithSG    = sgCapableNodes.filter((n) => (n.data?.config?.sg_ids || []).length > 0);
  const nodesWithoutSG = sgCapableNodes.filter((n) => (n.data?.config?.sg_ids || []).length === 0);

  /**
   * Derives the full security group definition for a node.
   *
   * Returns an array of { sg, edgeDerived: { inbound, outbound }, manual: { inbound, outbound } }
   * — one entry per assigned SG.
   *
   * edgeDerived: rules computed from traffic edges touching the node (read-only, regenerated live)
   * manual: rules stored on the SG object itself (user-defined in SGManager)
   *
   * Edge-derived rules resolve sourceNodeId/destNodeId to node labels for display.
   * At HCL generation time both sets are merged into the aws_security_group block.
   */
  const deriveNodeSGs = (nodeId) => {
    const node = nodeById(nodeId);
    if (!node) return [];
    const assignedIds = node.data?.config?.sg_ids || [];
    if (assignedIds.length === 0) return [];

    // Collect edge-derived rules — resolved to node labels for display
    const edgeInbound  = [];
    const edgeOutbound = [];

    trafficEdges.forEach((e) => {
      if (e.target === nodeId) {
        (e.data?.ingress || []).forEach((r) => {
          const srcNode = nodeById(e.source);
          edgeInbound.push({
            port:       r.port,
            protocol:   r.protocol,
            sourceNodeId:    e.source,
            sourceNodeLabel: srcNode?.data?.label || e.source,
          });
        });
      }
      if (e.source === nodeId) {
        (e.data?.egress || []).filter((r) => r.port?.trim()).forEach((r) => {
          const tgtNode = nodeById(e.target);
          edgeOutbound.push({
            port:          r.port,
            protocol:      r.protocol,
            destNodeId:    e.target,
            destNodeLabel: tgtNode?.data?.label || e.target,
          });
        });
      }
    });

    // Primary SG (index 0) absorbs edge-derived rules
    // Additional SGs carry only their manual rules
    return assignedIds.map((sgId, idx) => {
      const sg = sgById(sgId);
      if (!sg) return null;
      return {
        sg,
        edgeDerived: idx === 0
          ? { inbound: edgeInbound, outbound: edgeOutbound }
          : { inbound: [],          outbound: [] },
        manual: {
          inbound:  sg.inbound  || [],
          outbound: sg.outbound || [],
        },
      };
    }).filter(Boolean);
  };

  return {
    // Raw
    nodes, edges,
    // Auto-derived map — byResourceType["EC2"], byResourceType["S3"] etc.
    byResourceType,
    // Named aliases — backwards compatible
    vpcs, subnets, ec2, rds, lbs, igws, nats, rts, publics,
    // Edge sets
    structuralEdges, assocEdges, trafficEdges,
    // Derived maps
    subnetsByVpc, publicSubnets, privateSubnets,
    rtBySubnet, subnetsByRt,
    // Helpers
    nodeById,
    trafficNeighbors,
    hasTrafficEdge,
    hasAnyEdge,
    routesForRt,
    rtRoutesTo,
    anyRtRoutesTo,
    // Security Groups
    securityGroups,
    sgById,
    nodesWithSG,
    nodesWithoutSG,
    deriveNodeSGs,
    // IAM
    roles,
    roleById,
    rolePolicies,
    ec2WithRole,
    ec2WithoutRole,
    unassignedRoles,
  };
}