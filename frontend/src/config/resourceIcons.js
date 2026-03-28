/**
 * Resource Icons — maps every resource type to its AWS official icon.
 *
 * Zero npm dependencies. All icons fetched from CDN at runtime.
 *
 * Three CDN sources (each used where it has the best icon):
 *
 *   _svc(filename)  →  jsdelivr · aws-icons@3.2.0 · icons/architecture-service/
 *     https://cdn.jsdelivr.net/npm/aws-icons@3.2.0/icons/architecture-service/{filename}
 *     Official AWS service-level icons (Amazon*, AWS*, ElasticLoadBalancing)
 *     ~120 services. Best source for anything that has "Amazon" or "AWS" prefix.
 *
 *   _res(filename)  →  jsdelivr · aws-icons@3.2.0 · icons/resource/
 *     https://cdn.jsdelivr.net/npm/aws-icons@3.2.0/icons/resource/{filename}
 *     Sub-resource / granular icons that don't exist in architecture-service/:
 *     VPC subnets, Internet Gateway, NAT Gateway, Route Table, EBS Volume,
 *     Kinesis sub-streams, Client VPN, etc.
 *
 *   _ice(filename)  →  IcePanel AWS icon set (MIT, mirrors official AWS set)
 *     https://icon.icepanel.io/AWS/svg/{filename}
 *     Services added after aws-icons@3.2.0 (Bedrock, MemoryDB, Q, etc.)
 *     Also covers Cognito (renamed across versions), Service Catalog, IoT sub-services.
 *
 * To add a new resource:
 *   1. Add one entry to RESOURCE_ICONS below.
 *   2. Register the type in resourceRegistry.js.
 *   Nothing else changes.
 *
 * Usage:
 *   const Icon = getResourceIcon("EC2");
 *   if (Icon) return <Icon size={32} />;
 */

import React from "react";

// ─── CDN builder ─────────────────────────────────────────────────────────────

const _mkImg = (url) =>
  function AwsIcon({ size = 32 }) {
    return React.createElement("img", {
      src: url,
      alt: "",
      width: size,
      height: size,
      style: { display: "block", objectFit: "contain" },
    });
  };

/** jsdelivr · aws-icons@3.2.0 · architecture-service/ */
const _svc = (f) =>
  _mkImg(`https://cdn.jsdelivr.net/npm/aws-icons@3.2.0/icons/architecture-service/${f}`);

const _svcg = (f) =>
  _mkImg(`https://cdn.jsdelivr.net/npm/aws-icons@3.2.0/icons/architecture-group/${f}`);

/** jsdelivr · aws-icons@3.2.0 · resource/ (sub-resource granular icons) */
const _res = (f) =>
  _mkImg(`https://cdn.jsdelivr.net/npm/aws-icons@3.2.0/icons/resource/${f}`);

/** IcePanel AWS icon set — newer services not yet in aws-icons@3.2.0 */
const _ice = (f) =>
  _mkImg(`https://icon.icepanel.io/AWS/svg/${f}`);

const _awsSvg = (f) =>
  _mkImg(`https://cdn.jsdelivr.net/npm/aws-svg-icons@latest/icons/${f}`);

// ─── Network ─────────────────────────────────────────────────────────────────
const VPCIcon                = _svcg("VirtualprivatecloudVPC.svg");
const SubnetIcon             = _svcg("Privatesubnet.svg");
const PublicSubnetIcon       = _svcg("Publicsubnet.svg");
const IGWIcon                = _res("AmazonVPCInternetGateway.svg");
const NATGatewayIcon         = _res("AmazonVPCNATGateway.svg");
const RouteTableIcon         = _res("AmazonRoute53RouteTable.svg");
const CloudFrontIcon         = _svc("AmazonCloudFront.svg");
const Route53Icon            = _svc("AmazonRoute53.svg");
const APIGatewayIcon         = _svc("AmazonAPIGateway.svg");
const GlobalAcceleratorIcon  = _svc("AWSGlobalAccelerator.svg");
const DirectConnectIcon      = _svc("AWSDirectConnect.svg");
const TransitGatewayIcon     = _svc("AWSTransitGateway.svg");
const VPNIcon                = _res("AWSClientVPN.svg");
const PrivateLinkIcon        = _svc("AWSPrivateLink.svg");
const NetworkFirewallIcon    = _svc("AWSNetworkFirewall.svg");

// ─── Compute ─────────────────────────────────────────────────────────────────
const EC2Icon                = _svc("AmazonEC2.svg");
const ECSIcon                = _svc("AmazonElasticContainerService.svg");
const EKSIcon                = _svc("AmazonEKS.svg");
const LambdaIcon             = _svc("AWSLambda.svg");
const FargateIcon            = _svc("AWSFargate.svg");
const BatchIcon              = _svc("AWSBatch.svg");
const LightsailIcon          = _svc("AmazonLightsail.svg");
const AppRunnerIcon          = _svc("AWSAppRunner.svg");
const ElasticBeanstalkIcon   = _svc("AWSElasticBeanstalk.svg");
const OutpostsIcon           = _svc("AWSOutposts.svg");
const ASGIcon                = _svc("AmazonEC2AutoScaling.svg");

// ─── Load Balancing ──────────────────────────────────────────────────────────
const LoadBalancerIcon       = _svc("ElasticLoadBalancing.svg");

// ─── Containers ──────────────────────────────────────────────────────────────
const ECRIcon                = _svc("AmazonElasticContainerRegistry.svg");

// ─── Storage ─────────────────────────────────────────────────────────────────
const S3Icon                 = _svc("AmazonSimpleStorageService.svg");
const EBSIcon                = _res("AmazonEBSVolume.svg");        // no standalone in _svc
const EFSIcon                = _svc("AmazonEFS.svg");
const FSxIcon                = _svc("AmazonFSx.svg");
const S3GlacierIcon          = _svc("AmazonS3Glacier.svg");
const BackupIcon             = _svc("AWSBackup.svg");
const StorageGatewayIcon     = _svc("AWSStorageGateway.svg");

// ─── Database ────────────────────────────────────────────────────────────────
const RDSIcon                = _svc("AmazonRDS.svg");
const DynamoDBIcon           = _svc("AmazonDynamoDB.svg");
const ElastiCacheIcon        = _svc("AmazonElastiCache.svg");
const AuroraIcon             = _svc("AmazonAurora.svg");
const RedshiftIcon           = _svc("AmazonRedshift.svg");
const DocumentDBIcon         = _svc("AmazonDocumentDB.svg");
const KeyspacesIcon          = _ice("Amazon-Keyspaces.svg");       // added after 3.2.0
const NeptuneIcon            = _svc("AmazonNeptune.svg");
const TimestreamIcon         = _svc("AmazonTimestream.svg");
const MemoryDBIcon           = _ice("Amazon-MemoryDB.svg");         // added after 3.2.0

// ─── Messaging & Integration ──────────────────────────────────────────────────
const SQSIcon                = _svc("AmazonSimpleQueueService.svg");
const SNSIcon                = _svc("AmazonSimpleNotificationService.svg");
const EventBridgeIcon        = _svc("AmazonEventBridge.svg");
const SESIcon                = _svc("AmazonSES.svg");
const MQIcon                 = _svc("AmazonMQ.svg");
const MSKIcon                = _svc("AmazonMSK.svg");
const KinesisIcon            = _svc("AmazonKinesis.svg");
const KinesisFirehoseIcon    = _res("AmazonKinesisFirehose.svg");   // sub-service → _res
const KinesisStreamsIcon      = _res("AmazonKinesisDataStreams.svg"); // sub-service → _res
const StepFunctionsIcon      = _svc("AWSStepFunctions.svg");
const AppSyncIcon            = _svc("AWSAppSync.svg");

// ─── Security & Identity ──────────────────────────────────────────────────────
const IAMIcon                = _svc("AWSIAM.svg");
const CognitoIcon            = _svc("AmazonCognito.svg");
const SecretsManagerIcon     = _svc("AWSSecretsManager.svg");
const KMSIcon                = _svc("AWSKMS.svg");
const WAFIcon                = _svc("AWSWAF.svg");
const ShieldIcon             = _svc("AWSShield.svg");
const GuardDutyIcon          = _svc("AmazonGuardDuty.svg");
const MacieIcon              = _svc("AmazonMacie.svg");
const InspectorIcon          = _svc("AmazonInspector.svg");
const SecurityHubIcon        = _svc("AWSSecurityHub.svg");
const DetectiveIcon          = _svc("AmazonDetective.svg");
const ACMIcon                = _svc("AWSCertificateManager.svg");
const SSMIcon                = _svc("AWSSSM.svg");
const VerifiedPermissionsIcon = _ice("Amazon-Verified-Permissions.svg");

// ─── Analytics & Data ────────────────────────────────────────────────────────
const AthenaIcon             = _svc("AmazonAthena.svg");
const GlueIcon               = _svc("AWSGlue.svg");
const EMRIcon                = _svc("AmazonEMR.svg");
const QuickSightIcon         = _svc("AmazonQuickSight.svg");
const DataPipelineIcon       = _svc("AWSDataPipeline.svg");
const LakeFormationIcon      = _svc("AWSLakeFormation.svg");
const OpenSearchIcon         = _svc("AmazonOpenSearch.svg");
const KendraIcon             = _svc("AmazonKendra.svg");
const DataBrewIcon           = _ice("AWS-Glue-DataBrew.svg");
const CleanRoomsIcon         = _ice("AWS-Clean-Rooms.svg");

// ─── ML & AI ─────────────────────────────────────────────────────────────────
const SageMakerIcon          = _svc("AmazonSageMaker.svg");
const BedrockIcon            = _ice("Amazon-Bedrock.svg");          // added after 3.2.0
const RekognitionIcon        = _svc("AmazonRekognition.svg");
const TextractIcon           = _svc("AmazonTextract.svg");
const ComprehendIcon         = _svc("AmazonComprehend.svg");
const TranslateIcon          = _svc("AmazonTranslate.svg");
const LexIcon                = _svc("AmazonLex.svg");
const PollyIcon              = _svc("AmazonPolly.svg");
const Q_BusinessIcon         = _ice("Amazon-Q.svg");

// ─── Developer Tools ─────────────────────────────────────────────────────────
const CodeBuildIcon          = _svc("AWSCodeBuild.svg");
const CodePipelineIcon       = _svc("AWSCodePipeline.svg");
const CodeDeployIcon         = _svc("AWSCodeDeploy.svg");
const CodeCommitIcon         = _svc("AWSCodeCommit.svg");
const CodeArtifactIcon       = _svc("AWSCodeArtifact.svg");
const CloudFormationIcon     = _svc("AWSCloudFormation.svg");
const CDKIcon                = _svc("AWSCloudDevelopmentKit.svg");
const XRayIcon               = _svc("AWSXRay.svg");
const CodeGuruIcon           = _svc("AmazonCodeGuru.svg");

// ─── Management & Monitoring ──────────────────────────────────────────────────
const CloudWatchIcon         = _svc("AmazonCloudWatch.svg");
const CloudTrailIcon         = _svc("AWSCloudTrail.svg");
const ConfigIcon             = _svc("AWSConfig.svg");
const TrustedAdvisorIcon     = _svc("AWSTrustedAdvisor.svg");
const OrganizationsIcon      = _svc("AWSOrganizations.svg");
const ControlTowerIcon       = _svc("AWSControlTower.svg");
const SystemsManagerIcon     = _svc("AWSSystemsManager.svg");
const CostExplorerIcon       = _svc("AWSCostExplorer.svg");
const ServiceCatalogIcon     = _ice("AWS-Service-Catalog.svg");

// ─── IoT ─────────────────────────────────────────────────────────────────────
const IoTCoreIcon            = _svc("AWSIoTCore.svg");
const GreengrassIcon         = _svc("AWSIoTGreengrass.svg");
const IoTSiteWiseIcon        = _ice("AWS-IoT-SiteWise.svg");
const IoTEventsIcon          = _ice("AWS-IoT-Events.svg");

// ─── Migration ───────────────────────────────────────────────────────────────
const MGNIcon                = _ice("AWS-Application-Migration-Service.svg");
const DMSIcon                = _ice("AWS-Database-Migration-Service.svg");
const SCTIcon                = _ice("AWS-Schema-Conversion-Tool.svg");

// ─── Hybrid & Edge ───────────────────────────────────────────────────────────
const WavelengthIcon         = _ice("AWS-Wavelength.svg");
const LocalZonesIcon         = _ice("AWS-Local-Zones.svg");

// =============================================================================
// RESOURCE_ICONS — master map
// Keys must match EXACTLY what is in resourceRegistry.js
// Comments show which CDN and filename each icon uses.
// =============================================================================
export const RESOURCE_ICONS = {

  // ── Network ─────────────────────────────────────────────────────────────
  VPC:                  VPCIcon,              // _svc  AmazonVPC.svg
  Subnet:               SubnetIcon,           // _res  VPCSubnet.svg
  IGW:                  IGWIcon,              // _res  VPCInternetGateway.svg
  NATGateway:           NATGatewayIcon,       // _res  VPCNATGateway.svg
  RouteTable:           RouteTableIcon,       // _res  VPCRouter.svg
  CloudFront:           CloudFrontIcon,       // _svc  AmazonCloudFront.svg
  Route53:              Route53Icon,          // _svc  AmazonRoute53.svg
  APIGateway:           APIGatewayIcon,       // _svc  AmazonAPIGateway.svg
  GlobalAccelerator:    GlobalAcceleratorIcon,// _svc  AWSGlobalAccelerator.svg
  DirectConnect:        DirectConnectIcon,    // _svc  AWSDirectConnect.svg
  TransitGateway:       TransitGatewayIcon,   // _svc  AWSTransitGateway.svg
  VPN:                  VPNIcon,              // _res  AWSClientVPN.svg
  PrivateLink:          PrivateLinkIcon,      // _svc  AWSPrivateLink.svg
  NetworkFirewall:      NetworkFirewallIcon,  // _svc  AWSNetworkFirewall.svg

  // ── Compute ─────────────────────────────────────────────────────────────
  EC2:                  EC2Icon,              // _svc  AmazonEC2.svg
  ECS:                  ECSIcon,              // _svc  AmazonECS.svg
  EKS:                  EKSIcon,              // _svc  AmazonEKS.svg
  Lambda:               LambdaIcon,           // _svc  AWSLambda.svg
  Fargate:              FargateIcon,          // _svc  AWSFargate.svg
  Batch:                BatchIcon,            // _svc  AWSBatch.svg
  Lightsail:            LightsailIcon,        // _svc  AmazonLightsail.svg
  AppRunner:            AppRunnerIcon,        // _svc  AWSAppRunner.svg
  ElasticBeanstalk:     ElasticBeanstalkIcon, // _svc  AWSElasticBeanstalk.svg
  Outposts:             OutpostsIcon,         // _svc  AWSOutposts.svg
  ASG:                  ASGIcon,              // _svc  AmazonEC2AutoScaling.svg

  // ── Load Balancing ───────────────────────────────────────────────────────
  LoadBalancer:         LoadBalancerIcon,     // _svc  ElasticLoadBalancing.svg

  // ── Containers ───────────────────────────────────────────────────────────
  ECR:                  ECRIcon,              // _svc  AmazonECR.svg

  // ── Storage ──────────────────────────────────────────────────────────────
  S3:                   S3Icon,               // _svc  AmazonS3.svg
  EBS:                  EBSIcon,              // _res  AmazonEBSVolume.svg
  EFS:                  EFSIcon,              // _svc  AmazonEFS.svg
  FSx:                  FSxIcon,              // _svc  AmazonFSx.svg
  S3Glacier:            S3GlacierIcon,        // _svc  AmazonS3Glacier.svg
  Backup:               BackupIcon,           // _svc  AWSBackup.svg
  StorageGateway:       StorageGatewayIcon,   // _svc  AWSStorageGateway.svg

  // ── Database ─────────────────────────────────────────────────────────────
  RDS:                  RDSIcon,              // _svc  AmazonRDS.svg
  DynamoDB:             DynamoDBIcon,         // _svc  AmazonDynamoDB.svg
  ElastiCache:          ElastiCacheIcon,      // _svc  AmazonElastiCache.svg
  Aurora:               AuroraIcon,           // _svc  AmazonAurora.svg
  Redshift:             RedshiftIcon,         // _svc  AmazonRedshift.svg
  DocumentDB:           DocumentDBIcon,       // _svc  AmazonDocumentDB.svg
  Keyspaces:            KeyspacesIcon,        // _ice  Amazon-Keyspaces.svg
  Neptune:              NeptuneIcon,          // _svc  AmazonNeptune.svg
  Timestream:           TimestreamIcon,       // _svc  AmazonTimestream.svg
  MemoryDB:             MemoryDBIcon,         // _ice  Amazon-MemoryDB.svg

  // ── Messaging & Integration ───────────────────────────────────────────────
  SQS:                  SQSIcon,              // _svc  AmazonSQS.svg
  SNS:                  SNSIcon,              // _svc  AmazonSNS.svg
  EventBridge:          EventBridgeIcon,      // _svc  AmazonEventBridge.svg
  SES:                  SESIcon,              // _svc  AmazonSES.svg
  MQ:                   MQIcon,               // _svc  AmazonMQ.svg
  MSK:                  MSKIcon,              // _svc  AmazonMSK.svg
  Kinesis:              KinesisIcon,          // _svc  AmazonKinesis.svg
  KinesisFirehose:      KinesisFirehoseIcon,  // _res  AmazonKinesisFirehose.svg
  KinesisStreams:        KinesisStreamsIcon,   // _res  AmazonKinesisDataStreams.svg
  StepFunctions:        StepFunctionsIcon,    // _svc  AWSStepFunctions.svg
  AppSync:              AppSyncIcon,          // _svc  AWSAppSync.svg

  // ── Security & Identity ───────────────────────────────────────────────────
  IAM:                  IAMIcon,              // _svc  AWSIAM.svg
  Cognito:              CognitoIcon,          // _ice  Amazon-Cognito.svg
  SecretsManager:       SecretsManagerIcon,   // _svc  AWSSecretsManager.svg
  KMS:                  KMSIcon,              // _svc  AWSKMS.svg
  WAF:                  WAFIcon,              // _svc  AWSWAF.svg
  Shield:               ShieldIcon,           // _svc  AWSShield.svg
  GuardDuty:            GuardDutyIcon,        // _svc  AmazonGuardDuty.svg
  Macie:                MacieIcon,            // _svc  AmazonMacie.svg
  Inspector:            InspectorIcon,        // _svc  AmazonInspector.svg
  SecurityHub:          SecurityHubIcon,      // _svc  AWSSecurityHub.svg
  Detective:            DetectiveIcon,        // _svc  AmazonDetective.svg
  ACM:                  ACMIcon,              // _svc  AWSACM.svg
  SSM:                  SSMIcon,              // _svc  AWSSSM.svg
  VerifiedPermissions:  VerifiedPermissionsIcon, // _ice Amazon-Verified-Permissions.svg

  // ── Analytics & Data ──────────────────────────────────────────────────────
  Athena:               AthenaIcon,           // _svc  AmazonAthena.svg
  Glue:                 GlueIcon,             // _svc  AWSGlue.svg
  EMR:                  EMRIcon,              // _svc  AmazonEMR.svg
  QuickSight:           QuickSightIcon,       // _svc  AmazonQuickSight.svg
  DataPipeline:         DataPipelineIcon,     // _svc  AWSDataPipeline.svg
  LakeFormation:        LakeFormationIcon,    // _svc  AWSLakeFormation.svg
  OpenSearch:           OpenSearchIcon,       // _svc  AmazonOpenSearch.svg
  Kendra:               KendraIcon,           // _svc  AmazonKendra.svg
  GlueDataBrew:         DataBrewIcon,         // _ice  AWS-Glue-DataBrew.svg
  CleanRooms:           CleanRoomsIcon,       // _ice  AWS-Clean-Rooms.svg

  // ── ML & AI ───────────────────────────────────────────────────────────────
  SageMaker:            SageMakerIcon,        // _svc  AmazonSageMaker.svg
  Bedrock:              BedrockIcon,          // _ice  Amazon-Bedrock.svg
  Rekognition:          RekognitionIcon,      // _svc  AmazonRekognition.svg
  Textract:             TextractIcon,         // _svc  AmazonTextract.svg
  Comprehend:           ComprehendIcon,       // _svc  AmazonComprehend.svg
  Translate:            TranslateIcon,        // _svc  AmazonTranslate.svg
  Lex:                  LexIcon,              // _svc  AmazonLex.svg
  Polly:                PollyIcon,            // _svc  AmazonPolly.svg
  QBusiness:            Q_BusinessIcon,       // _ice  Amazon-Q.svg

  // ── Developer Tools ───────────────────────────────────────────────────────
  CodeBuild:            CodeBuildIcon,        // _svc  AWSCodeBuild.svg
  CodePipeline:         CodePipelineIcon,     // _svc  AWSCodePipeline.svg
  CodeDeploy:           CodeDeployIcon,       // _svc  AWSCodeDeploy.svg
  CodeCommit:           CodeCommitIcon,       // _svc  AWSCodeCommit.svg
  CodeArtifact:         CodeArtifactIcon,     // _svc  AWSCodeArtifact.svg
  CloudFormation:       CloudFormationIcon,   // _svc  AWSCloudFormation.svg
  CDK:                  CDKIcon,              // _svc  AWSCloudDevelopmentKit.svg
  XRay:                 XRayIcon,             // _svc  AWSXRay.svg
  CodeGuru:             CodeGuruIcon,         // _svc  AmazonCodeGuru.svg

  // ── Management & Monitoring ───────────────────────────────────────────────
  CloudWatch:           CloudWatchIcon,       // _svc  AmazonCloudWatch.svg
  CloudTrail:           CloudTrailIcon,       // _svc  AWSCloudTrail.svg
  Config:               ConfigIcon,           // _svc  AWSConfig.svg
  TrustedAdvisor:       TrustedAdvisorIcon,   // _svc  AWSTrustedAdvisor.svg
  Organizations:        OrganizationsIcon,    // _svc  AWSOrganizations.svg
  ControlTower:         ControlTowerIcon,     // _svc  AWSControlTower.svg
  SystemsManager:       SystemsManagerIcon,   // _svc  AWSSystemsManager.svg
  CostExplorer:         CostExplorerIcon,     // _svc  AWSCostExplorer.svg
  ServiceCatalog:       ServiceCatalogIcon,   // _ice  AWS-Service-Catalog.svg

  // ── IoT ───────────────────────────────────────────────────────────────────
  IoTCore:              IoTCoreIcon,          // _svc  AWSIoTCore.svg
  Greengrass:           GreengrassIcon,       // _svc  AWSIoTGreengrass.svg
  IoTSiteWise:          IoTSiteWiseIcon,      // _ice  AWS-IoT-SiteWise.svg
  IoTEvents:            IoTEventsIcon,        // _ice  AWS-IoT-Events.svg

  // ── Migration ─────────────────────────────────────────────────────────────
  MGN:                  MGNIcon,              // _ice  AWS-Application-Migration-Service.svg
  DMS:                  DMSIcon,              // _ice  AWS-Database-Migration-Service.svg
  SCT:                  SCTIcon,              // _ice  AWS-Schema-Conversion-Tool.svg

  // ── Hybrid & Edge ─────────────────────────────────────────────────────────
  Wavelength:           WavelengthIcon,       // _ice  AWS-Wavelength.svg
  LocalZones:           LocalZonesIcon,       // _ice  AWS-Local-Zones.svg
};

/**
 * Returns the icon React component for a resource type, or null if not found.
 *
 * Usage:
 *   const Icon = getResourceIcon("EC2");
 *   if (Icon) return <Icon size={32} />;
 */
export const getResourceIcon = (type) => RESOURCE_ICONS[type] ?? null;