/**
 * IAM Policy catalog — grouped by category.
 * These are the selectable policies when defining a Role.
 */
export const IAM_POLICY_GROUPS = [
  {
    group: "Compute",
    policies: [
      { key: "AmazonSSMManagedInstanceCore",          label: "SSM Managed Instance Core" },
      { key: "AWSLambdaBasicExecutionRole",            label: "Lambda Basic Execution" },
      { key: "AWSLambdaVPCAccessExecutionPolicy",      label: "Lambda VPC Access" },
      { key: "AmazonECSTaskExecutionRolePolicy",       label: "ECS Task Execution" },
      { key: "AmazonEKSWorkerNodePolicy",              label: "EKS Worker Node" },
      { key: "AmazonEKS_CNI_Policy",                  label: "EKS CNI" },
      { key: "AmazonEC2ContainerRegistryReadOnly",     label: "ECR Read Only" },
      { key: "AmazonEKSClusterPolicy",                 label: "EKS Cluster" },
    ],
  },
  {
    group: "Storage",
    policies: [
      { key: "AmazonS3ReadOnlyAccess",                label: "S3 Read Only" },
      { key: "AmazonS3FullAccess",                    label: "S3 Full Access" },
      { key: "AmazonDynamoDBReadOnlyAccess",          label: "DynamoDB Read Only" },
      { key: "AmazonDynamoDBFullAccess",              label: "DynamoDB Full Access" },
    ],
  },
  {
    group: "Observability",
    policies: [
      { key: "CloudWatchAgentServerPolicy",           label: "CloudWatch Agent" },
      { key: "CloudWatchLogsFullAccess",              label: "CloudWatch Logs Full" },
      { key: "CloudWatchFullAccess",                  label: "CloudWatch Full" },
      { key: "AmazonRDSEnhancedMonitoringRole",       label: "RDS Enhanced Monitoring" },
    ],
  },
  {
    group: "Secrets",
    policies: [
      { key: "SecretsManagerReadWrite",               label: "Secrets Manager Read/Write" },
    ],
  },
  {
    group: "Messaging",
    policies: [
      { key: "AmazonSQSFullAccess",                   label: "SQS Full Access" },
      { key: "AmazonMSKFullAccess",                   label: "MSK Full Access" },
      { key: "AmazonMSKReadOnlyAccess",               label: "MSK Read Only" },
      { key: "AmazonMSKConnectFullAccess",            label: "MSK Connect Full" },
    ],
  },
  {
    group: "Analytics",
    policies: [
      { key: "AmazonAthenaFullAccess",                label: "Athena Full Access" },
      { key: "AmazonEMRRole",                         label: "EMR Service Role" },
      { key: "AmazonEMREC2DefaultRole",               label: "EMR EC2 Default" },
      { key: "GlueConsoleFullAccess",                 label: "Glue Full Access" },
    ],
  },
];

// Flat map for quick label lookup by policy key
export const IAM_POLICY_LABELS = IAM_POLICY_GROUPS
  .flatMap((g) => g.policies)
  .reduce((acc, p) => ({ ...acc, [p.key]: p.label }), {});

// Managed policy ARNs for HCL generation
export const IAM_POLICY_ARNS = {
  AmazonSSMManagedInstanceCore:         "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
  AWSLambdaBasicExecutionRole:          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  AWSLambdaVPCAccessExecutionPolicy:    "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionPolicy",
  AmazonECSTaskExecutionRolePolicy:     "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
  AmazonEKSWorkerNodePolicy:            "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
  AmazonEKS_CNI_Policy:                 "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
  AmazonEC2ContainerRegistryReadOnly:   "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
  AmazonEKSClusterPolicy:               "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
  AmazonS3ReadOnlyAccess:               "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess",
  AmazonS3FullAccess:                   "arn:aws:iam::aws:policy/AmazonS3FullAccess",
  AmazonDynamoDBReadOnlyAccess:         "arn:aws:iam::aws:policy/AmazonDynamoDBReadOnlyAccess",
  AmazonDynamoDBFullAccess:             "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
  CloudWatchAgentServerPolicy:          "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
  CloudWatchLogsFullAccess:             "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess",
  CloudWatchFullAccess:                 "arn:aws:iam::aws:policy/CloudWatchFullAccess",
  AmazonRDSEnhancedMonitoringRole:      "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole",
  SecretsManagerReadWrite:              "arn:aws:iam::aws:policy/SecretsManagerReadWrite",
  AmazonSQSFullAccess:                  "arn:aws:iam::aws:policy/AmazonSQSFullAccess",
  AmazonMSKFullAccess:                  "arn:aws:iam::aws:policy/AmazonMSKFullAccess",
  AmazonMSKReadOnlyAccess:              "arn:aws:iam::aws:policy/AmazonMSKReadOnlyAccess",
  AmazonMSKConnectFullAccess:           "arn:aws:iam::aws:policy/AmazonMSKConnectFullAccess",
  AmazonAthenaFullAccess:               "arn:aws:iam::aws:policy/AmazonAthenaFullAccess",
  AmazonEMRRole:                        "arn:aws:iam::aws:policy/service-role/AmazonEMRRole",
  AmazonEMREC2DefaultRole:              "arn:aws:iam::aws:policy/service-role/AmazonEMREC2DefaultRole",
  GlueConsoleFullAccess:                "arn:aws:iam::aws:policy/AWSGlueConsoleFullAccess",
};

// Nodes that support IAM role assignment
export const IAM_CAPABLE_TYPES = ["EC2", "ECS", "EKS", "Lambda"];

// Default color palette for new roles
export const ROLE_COLOR_PALETTE = [
  "#60a5fa", // blue
  "#34d399", // green
  "#f87171", // red
  "#fb923c", // orange
  "#a78bfa", // purple
  "#facc15", // yellow
  "#38bdf8", // sky
  "#4ade80", // lime
  "#f472b6", // pink
  "#94a3b8", // slate
];