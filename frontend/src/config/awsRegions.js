/**
 * AWS regions and their availability zones.
 * Canvas-level config — one region per canvas.
 */
export const AWS_REGIONS = [
  { value: "us-east-1",      label: "US East (N. Virginia)",       azs: ["us-east-1a", "us-east-1b", "us-east-1c", "us-east-1d", "us-east-1e", "us-east-1f"] },
  { value: "us-east-2",      label: "US East (Ohio)",               azs: ["us-east-2a", "us-east-2b", "us-east-2c"] },
  { value: "us-west-1",      label: "US West (N. California)",      azs: ["us-west-1a", "us-west-1b"] },
  { value: "us-west-2",      label: "US West (Oregon)",             azs: ["us-west-2a", "us-west-2b", "us-west-2c", "us-west-2d"] },
  { value: "eu-west-1",      label: "Europe (Ireland)",             azs: ["eu-west-1a", "eu-west-1b", "eu-west-1c"] },
  { value: "eu-west-2",      label: "Europe (London)",              azs: ["eu-west-2a", "eu-west-2b", "eu-west-2c"] },
  { value: "eu-central-1",   label: "Europe (Frankfurt)",           azs: ["eu-central-1a", "eu-central-1b", "eu-central-1c"] },
  { value: "ap-south-1",     label: "Asia Pacific (Mumbai)",        azs: ["ap-south-1a", "ap-south-1b", "ap-south-1c"] },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)",     azs: ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"] },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)",        azs: ["ap-southeast-2a", "ap-southeast-2b", "ap-southeast-2c"] },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)",         azs: ["ap-northeast-1a", "ap-northeast-1b", "ap-northeast-1c", "ap-northeast-1d"] },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul)",         azs: ["ap-northeast-2a", "ap-northeast-2b", "ap-northeast-2c", "ap-northeast-2d"] },
  { value: "sa-east-1",      label: "South America (São Paulo)",    azs: ["sa-east-1a", "sa-east-1b", "sa-east-1c"] },
  { value: "ca-central-1",   label: "Canada (Central)",             azs: ["ca-central-1a", "ca-central-1b", "ca-central-1d"] },
  { value: "me-south-1",     label: "Middle East (Bahrain)",        azs: ["me-south-1a", "me-south-1b", "me-south-1c"] },
  { value: "af-south-1",     label: "Africa (Cape Town)",           azs: ["af-south-1a", "af-south-1b", "af-south-1c"] },
];

export const DEFAULT_REGION = "us-east-1";

export const getAZsForRegion = (regionValue) => {
  const region = AWS_REGIONS.find((r) => r.value === regionValue);
  return region?.azs || [];
};