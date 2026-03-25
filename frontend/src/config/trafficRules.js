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
  // ── Compute ─────────────────────────────────────────────────────────────
  EC2:          { allowedSources: ["EC2", "RDS", "LoadBalancer", "Public", "ECS", "Lambda", "APIGateway", "Route53"], allowedTargets: ["EC2", "RDS", "LoadBalancer", "ECS", "ElastiCache", "Kinesis"] },
  RDS:          { allowedSources: ["EC2", "ECS", "Lambda"],                                                           allowedTargets: ["EC2"] },
  LoadBalancer: { allowedSources: ["Public", "EC2", "Route53"],                                                       allowedTargets: ["EC2", "ECS", "Lambda", "ASG"] }, // APIGateway VPC Link deferred
  ECS:          { allowedSources: ["LoadBalancer", "EC2", "Public", "Lambda", "APIGateway"],                          allowedTargets: ["RDS", "EC2", "ElastiCache", "Kinesis"] }, // IAM: SQS/DynamoDB/SNS/EventBridge/S3
  // ── Serverless ───────────────────────────────────────────────────────────
  Lambda:       { allowedSources: ["APIGateway", "LoadBalancer", "Kinesis"],                                          allowedTargets: ["RDS", "ECS", "ElastiCache", "EC2", "Kinesis"] }, // IAM: SQS/DynamoDB/SNS/EventBridge/S3
  APIGateway:   { allowedSources: ["Public", "Route53"],                                                              allowedTargets: ["Lambda", "ECS", "EC2"] },
  // ── Network entry points ─────────────────────────────────────────────────
  Public:       { allowedSources: [],                                                                                  allowedTargets: ["EC2", "LoadBalancer", "ECS", "APIGateway", "Route53"] },
  Route53:      { allowedSources: ["Public"],                                                                          allowedTargets: ["LoadBalancer", "APIGateway", "EC2"] }, // DNS routing — CloudFront added when registered
  // ── Data & Caching ───────────────────────────────────────────────────────
  ElastiCache:  { allowedSources: ["EC2", "ECS", "Lambda"],                                                           allowedTargets: [] },   // cache — receives traffic, never initiates
  Kinesis:      { allowedSources: ["EC2", "ECS", "Lambda"],                                                           allowedTargets: ["Lambda"] }, // producers write, Lambda consumes
  // Infrastructure resources — no traffic edges
  IGW:          null,
  NATGateway:   null,
  RouteTable:   null,
  VPC:          null,
  Subnet:       null,
  // ── Auto Scaling ─────────────────────────────────────────────────────────
  ASG:          { allowedSources: ["LoadBalancer", "Public", "Route53"],                                              allowedTargets: ["RDS", "ElastiCache", "EC2", "Kinesis"] },
  // Global services — accessed via IAM, not network traffic edges
  ACM:            null,
  CloudFront:     null,  // CDN — origin association, not traffic edges
  WAF:            null,  // attached via association
  S3:             null,
  DynamoDB:       null,
  SQS:            null,
  SNS:            null,
  EventBridge:    null,
  SecretsManager: null,
  ECR:            null,  // pulled by ECS/Lambda at deploy time, not network traffic
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