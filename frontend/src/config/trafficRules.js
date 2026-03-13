/**
 * Traffic Rules — defines which resource types can be connected with traffic edges,
 * and in which direction.
 *
 * To add rules for a new resource:
 *   - Add an entry keyed by resource type
 *   - null means the resource does not participate in traffic edges at all
 *   - allowedSources: types that may initiate a traffic edge TO this resource
 *   - allowedTargets: types this resource may initiate a traffic edge TO
 *
 * validateTrafficConnection() is the single call site for all traffic edge validation.
 * As SG inference, VPC peering, and cross-AZ checks are added, they slot in here
 * without touching any other file.
 */

export const trafficRules = {
  EC2:          { allowedSources: ["EC2", "RDS", "LoadBalancer", "Public"], allowedTargets: ["EC2", "RDS", "LoadBalancer"] },
  RDS:          { allowedSources: ["EC2"],                                  allowedTargets: ["EC2"] },
  LoadBalancer: { allowedSources: ["Public", "EC2"],                        allowedTargets: ["EC2"] },
  Public:       { allowedSources: [],                                       allowedTargets: ["EC2", "LoadBalancer"] },
  // Infrastructure resources — no traffic edges
  IGW:          null,
  NATGateway:   null,
  RouteTable:   null,
  VPC:          null,
  Subnet:       null,
};

/**
 * Returns null if the traffic connection is allowed, or an error string if blocked.
 * This is the single validation entry point for traffic edges in InfraCanvas.
 */
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