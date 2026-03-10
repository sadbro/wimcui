// Parse CIDR into base IP (as 32-bit int) and prefix length
export function parseCIDR(cidr) {
  const match = cidr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!match) return null;

  const [, a, b, c, d, prefix] = match.map(Number);
  if ([a, b, c, d].some((o) => o > 255)) return null;
  if (prefix < 0 || prefix > 32) return null;

  const ip = (a << 24) | (b << 16) | (c << 8) | d;
  return { ip: ip >>> 0, prefix };
}

// Check if CIDR string is valid
export function isValidCIDR(cidr) {
  return parseCIDR(cidr) !== null;
}

// Check if prefix is within allowed range
export function isValidPrefix(cidr, min = 16, max = 28) {
  const parsed = parseCIDR(cidr);
  if (!parsed) return false;
  return parsed.prefix >= min && parsed.prefix <= max;
}

// Check if childCIDR is fully contained within parentCIDR
export function cidrContains(parentCIDR, childCIDR) {
  const parent = parseCIDR(parentCIDR);
  const child  = parseCIDR(childCIDR);
  if (!parent || !child) return false;
  if (child.prefix < parent.prefix) return false;

  const parentMask = parent.prefix === 0 ? 0 : (~0 << (32 - parent.prefix)) >>> 0;
  const parentNetwork = (parent.ip & parentMask) >>> 0;
  const childNetwork  = (child.ip  & parentMask) >>> 0;

  return parentNetwork === childNetwork;
}

// Check if two CIDRs overlap
export function cidrsOverlap(cidr1, cidr2) {
  const a = parseCIDR(cidr1);
  const b = parseCIDR(cidr2);
  if (!a || !b) return false;

  const maskBits = Math.min(a.prefix, b.prefix);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;

  return ((a.ip & mask) >>> 0) === ((b.ip & mask) >>> 0);
}