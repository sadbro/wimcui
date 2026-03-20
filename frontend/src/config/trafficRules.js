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
  EC2:          { allowedSources: ["EC2", "RDS", "LoadBalancer", "Public", "ECS", "Lambda", "APIGateway"], allowedTargets: ["EC2", "RDS", "LoadBalancer", "ECS"] },
  RDS:          { allowedSources: ["EC2", "ECS", "Lambda"],                                               allowedTargets: ["EC2"] },
  LoadBalancer: { allowedSources: ["Public", "EC2", "APIGateway"],                                        allowedTargets: ["EC2", "ECS", "Lambda"] },
  Public:       { allowedSources: [],                                                                      allowedTargets: ["EC2", "LoadBalancer", "ECS", "APIGateway"] },
  ECS:          { allowedSources: ["LoadBalancer", "EC2", "Public", "Lambda", "APIGateway"],               allowedTargets: ["RDS", "EC2"] }, // SQS/DynamoDB via IAM
  Lambda:       { allowedSources: ["APIGateway", "LoadBalancer"],                                          allowedTargets: ["RDS", "ECS"] }, // SQS/DynamoDB via IAM
  APIGateway:   { allowedSources: ["Public"],                                                              allowedTargets: ["Lambda", "ECS", "EC2"] },
  // Infrastructure resources — no traffic edges
  IGW:          null,
  NATGateway:   null,
  RouteTable:   null,
  VPC:          null,
  Subnet:       null,
  // Global services — accessed via IAM, not network traffic edges
  S3:             null,
  DynamoDB:       null,
  SQS:            null,
  SNS:            null,
  EventBridge:    null,
  SecretsManager: null,
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