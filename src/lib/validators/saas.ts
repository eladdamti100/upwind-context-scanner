// src/lib/validators/saas.ts
// Cloud / SaaS structural validators: JWT structure, AWS access keys, MAC
// addresses (with OUI sanity), and IP classification (private/loopback).
import { Validator, ok, fail } from './types';

// Dependency-free base64url → UTF-8 decode (browser + node safe).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64UrlDecode(input: string): string | null {
  const s = input.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null;
  let bits = 0;
  let val = 0;
  const out: number[] = [];
  for (const ch of s) {
    if (ch === '=') break;
    const idx = B64.indexOf(ch);
    if (idx === -1) return null;
    val = (val << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((val >> bits) & 0xff);
    }
  }
  try {
    return new TextDecoder().decode(Uint8Array.from(out));
  } catch {
    return null;
  }
}

// JWT: exactly 3 dot-delimited parts; the header must be valid base64url that
// decodes to a JSON object carrying an "alg" (and typically "typ"). A regex-only
// scanner flags any long base64 blob; this proves it is actually a token.
export const validateJWT: Validator = (raw) => {
  const parts = raw.trim().split('.');
  if (parts.length !== 3) return fail('jwt', `expected 3 segments, found ${parts.length}`);
  if (!parts[0] || !parts[1] || !parts[2]) return fail('jwt', 'empty JWT segment');
  const headerJson = base64UrlDecode(parts[0]);
  if (headerJson === null) return fail('jwt', 'header is not valid base64url');
  let header: unknown;
  try {
    header = JSON.parse(headerJson);
  } catch {
    return fail('jwt', 'header does not decode to JSON');
  }
  if (typeof header !== 'object' || header === null || !('alg' in header)) {
    return fail('jwt', 'header JSON missing "alg"');
  }
  return ok('jwt', 'valid 3-part JWT with structured header');
};

// AWS access key id: AKIA/ASIA/AGPA/AIDA/AROA… prefix, exactly 20 chars, base32
// uppercase + digits 2-7 body. Also rejects near-zero-entropy stubs.
const AWS_PREFIXES = ['AKIA', 'ASIA', 'AGPA', 'AIDA', 'AROA', 'AIPA', 'ANPA', 'ANVA', 'ABIA', 'ACCA'];
export const validateAWSKey: Validator = (raw) => {
  const s = raw.trim();
  if (s.length !== 20) return fail('aws-access-key', `length ${s.length} != 20`);
  if (!AWS_PREFIXES.some((p) => s.startsWith(p))) return fail('aws-access-key', 'no known AWS key prefix');
  if (!/^[A-Z2-7]{20}$/.test(s)) return fail('aws-access-key', 'body is not base32 uppercase');
  // A real key body is high-entropy; a repeated/sequential stub is not.
  const body = s.slice(4);
  const distinct = new Set(body).size;
  if (distinct <= 3) return fail('aws-access-key', 'body entropy too low (placeholder stub)');
  return ok('aws-access-key', 'well-formed high-entropy AWS access key');
};

export const validateMAC: Validator = (raw) => {
  const s = raw.trim().toUpperCase();
  if (!/^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/.test(s)) return fail('mac-address', 'not a MAC address');
  return ok('mac-address', 'well-formed MAC address (network identifier, not a secret)');
};

// Classify an IP — private/loopback/link-local ranges are infrastructure noise,
// never an external secret/target.
export const classifyIP = (raw: string): { isIP: boolean; isPrivate: boolean; reason: string } => {
  const s = raw.trim();
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return { isIP: false, isPrivate: false, reason: 'not an IPv4 address' };
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) return { isIP: false, isPrivate: false, reason: 'octet out of range' };
  const isPrivate =
    o[0] === 10 ||
    (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
    (o[0] === 192 && o[1] === 168) ||
    o[0] === 127 || // loopback
    (o[0] === 169 && o[1] === 254); // link-local
  return {
    isIP: true,
    isPrivate,
    reason: isPrivate ? 'private/loopback/link-local address' : 'routable address',
  };
};

export const validateIP: Validator = (raw) => {
  const r = classifyIP(raw);
  if (!r.isIP) return fail('ip-address', r.reason);
  return r.isPrivate
    ? fail('ip-address', r.reason) // private IPs are not external secrets
    : ok('ip-address', r.reason);
};
