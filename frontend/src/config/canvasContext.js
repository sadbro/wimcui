/**
 * Builds a derived context object from raw canvas nodes and edges.
 * This is the single source of truth passed to all consequence rules and validation checks.
 */
export function buildContext(nodes, edges, roles = []) {
  const byType = (type) => nodes.filter((n) => n.data?.resourceType === type);
  const nodeById = (id) => nodes.find((n) => n.id === id);

  const vpcs        = byType("VPC");
  const subnets     = byType("Subnet");
  const ec2         = byType("EC2");
  const rds         = byType("RDS");
  const lbs         = byType("LoadBalancer");
  const igws        = byType("IGW");
  const nats        = byType("NATGateway");
  const rts         = byType("RouteTable");
  const publics     = byType("Public");

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

  return {
    // Raw
    nodes, edges,
    // By type
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
    // IAM
    roles,
    roleById,
    rolePolicies,
    ec2WithRole,
    ec2WithoutRole,
    unassignedRoles,
  };
}