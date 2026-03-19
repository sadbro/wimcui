/**
 * Resource Icons — maps each resource type to its react-aws-icons component.
 *
 * Install: npm install react-aws-icons
 * Usage:   const IconComponent = getResourceIcon(type);
 *          <IconComponent size={32} />
 *
 * All paths verified from react-aws-icons docs:
 *   logo/    — service-level AWS icons
 *   compute/ — VPC sub-resources (Subnet, IGW, NAT, RouteTable)
 *
 * Icons render with hardcoded AWS brand colors — no filter needed.
 * Works on both light and dark themes out of the box.
 *
 * To add a new resource: one entry here, nothing else changes.
 */

import VPCIcon          from "react-aws-icons/dist/aws/logo/VPC";
import SubnetIcon       from "react-aws-icons/dist/aws/compute/VPCSubnet";
import EC2Icon          from "react-aws-icons/dist/aws/logo/EC2";
import RDSIcon          from "react-aws-icons/dist/aws/logo/RDS";
import ELBIcon          from "react-aws-icons/dist/aws/logo/ELB";
import ECSIcon          from "react-aws-icons/dist/aws/logo/ECS";
import IGWIcon          from "react-aws-icons/dist/aws/compute/InternetGateway";
import NATIcon          from "react-aws-icons/dist/aws/compute/NATGateway";
import RouteTableIcon   from "react-aws-icons/dist/aws/compute/RouteTable";
import S3Icon           from "react-aws-icons/dist/aws/logo/S3";
import LambdaIcon       from "react-aws-icons/dist/aws/logo/Lambda";
import DynamoDBIcon     from "react-aws-icons/dist/aws/logo/DynamoDB";
import SQSIcon          from "react-aws-icons/dist/aws/logo/SQS";
import SNSIcon          from "react-aws-icons/dist/aws/logo/SNS";

// aws-icons CDN for resources not in react-aws-icons (too new)
// Pinned to 3.2.0 — same version as rest of project
// Uses React.createElement to avoid JSX in a .js file
import React from "react";
const _CDN = "https://cdn.jsdelivr.net/npm/aws-icons@3.2.0/icons/architecture-service";
const _mkImg = (url) => function AwsImgIcon({ size = 32 }) {
  return React.createElement("img", {
    src: url, alt: "",
    width: size, height: size,
    style: { display: "block", objectFit: "contain" },
  });
};
const EventBridgeIcon    = _mkImg(`${_CDN}/AmazonEventBridge.svg`);
const SecretsManagerIcon = _mkImg(`${_CDN}/AWSSecretsManager.svg`);

export const RESOURCE_ICONS = {
  // ─── Network ──────────────────────────────────────────────────────────────
  VPC:          VPCIcon,
  Subnet:       SubnetIcon,
  // ─── Compute & Data ───────────────────────────────────────────────────────
  EC2:          EC2Icon,
  RDS:          RDSIcon,
  LoadBalancer: ELBIcon,
  ECS:          ECSIcon,
  // ─── Infrastructure ───────────────────────────────────────────────────────
  IGW:          IGWIcon,
  NATGateway:   NATIcon,
  RouteTable:   RouteTableIcon,
  // ─── Global Services ──────────────────────────────────────────────────────
  S3:           S3Icon,
  Lambda:       LambdaIcon,
  DynamoDB:     DynamoDBIcon,
  SQS:          SQSIcon,
  SNS:          SNSIcon,
  EventBridge:    EventBridgeIcon,    // aws-icons CDN — AmazonEventBridge.svg ✓
  SecretsManager: SecretsManagerIcon, // aws-icons CDN — AWSSecretsManager.svg ✓
};

/**
 * Returns the icon React component for a resource type, or null if not found.
 * Usage: const Icon = getResourceIcon(type); if (Icon) <Icon size={32} />
 */
export const getResourceIcon = (type) => RESOURCE_ICONS[type] ?? null;