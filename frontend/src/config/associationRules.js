/**
 * Association Rules — defines which resource types can be connected with association edges.
 *
 * Association edges represent non-traffic relationships:
 *   RouteTable ↔ Subnet  (assoc label)
 *   RouteTable → IGW     (route label, e_route_* prefix)
 *   RouteTable → NAT     (route label, e_route_* prefix)
 *
 * This file is intentionally stable — association rules are structurally simple
 * and unlikely to grow in complexity. New resources that support associations
 * add one entry here.
 */

export const associationRules = {
  RouteTable:     { allowedTargets: ["Subnet", "IGW", "NATGateway"] },
  Subnet:         { allowedTargets: ["RouteTable"] },
  SecretsManager: { allowedTargets: ["RDS", "ECS", "Lambda", "EC2"] }, // credentials association
  ACM:            { allowedTargets: ["LoadBalancer", "CloudFront"] },  // certificate attachment
  CloudFront:     { allowedTargets: ["S3", "LoadBalancer", "APIGateway"] }, // origin association
  WAF:            { allowedTargets: ["LoadBalancer", "CloudFront", "APIGateway"] }, // web ACL attachment
};

/**
 * Returns null if the association is allowed, or an error string if blocked.
 */
export const validateAssociationConnection = (sourceType, targetType) => {
  const rules = associationRules[sourceType];
  if (!rules) return `${sourceType} does not support association connections`;
  if (!rules.allowedTargets.includes(targetType))
    return `${sourceType} cannot be associated with ${targetType}`;
  return null;
};