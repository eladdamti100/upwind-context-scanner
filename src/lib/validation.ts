import type { ValidationStatus } from '../types';

export const VALIDATION_DELAY_MS = 1500;

const ACTIVE_TYPES = new Set([
  'aws-access-key',
  'aws-secret-key',
  'stripe-secret-key',
  'github-token',
  'database-password',
]);

// Mock outcome of *running* a credential check. Only ever yields
// 'validated-active' / 'validated-inactive'; the other ValidationStatus values
// ('not-validated', 'validation-failed', 'validation-unsupported',
// 'validation-permission-required') are pre-run states set on the finding elsewhere.
export function mockValidate(detectedType: string): ValidationStatus {
  return ACTIVE_TYPES.has(detectedType) ? 'validated-active' : 'validated-inactive';
}

// ---------------------------------------------------------------------------
// Credential-check support (UI gating only — does not affect detection/scoring)
// ---------------------------------------------------------------------------

// Detected types that represent a live credential which can be checked against
// an external provider. PII / PCI / healthcare / documentation examples are not
// checkable, so the "Run credential check" action stays disabled for those.
const CHECKABLE_TYPES = new Set([
  'aws-access-key',
  'aws-access-key-id',
  'aws-secret-key',
  'aws-secret-access-key',
  'cloud-key',
  'stripe-secret-key',
  'stripe-live-key',
  'payment-secret',
  'github-token',
  'docusign-token',
  'slack-token',
  'datadog-api-key',
  'database-password',
  'db-connection-string',
  'jwt',
  'api-key',
  'generic-api-key',
]);

// Keyword fallback so credential-like types we haven't enumerated (e.g. a
// classifier-provided label) are still recognised as checkable.
const CREDENTIAL_KEYWORDS = /(key|token|secret|credential|password|connection-string|jwt|\bapi\b)/i;

/** Whether a finding's detected type supports a credential check. */
export function supportsCredentialCheck(detectedType: string): boolean {
  if (!detectedType) return false;
  const t = detectedType.toLowerCase();
  return CHECKABLE_TYPES.has(t) || CREDENTIAL_KEYWORDS.test(t);
}

/** Human-readable external target a credential is checked against. */
export function credentialCheckTarget(detectedType: string): string {
  const t = (detectedType || '').toLowerCase();
  if (t.includes('aws') || t.includes('cloud')) return 'AWS STS';
  if (t.includes('stripe')) return 'Stripe API';
  if (t.includes('github')) return 'GitHub API';
  if (t.includes('docusign')) return 'DocuSign API';
  if (t.includes('slack')) return 'Slack API';
  if (t.includes('datadog')) return 'Datadog API';
  if (t.includes('database') || t.includes('db-') || t.includes('connection-string')) {
    return 'Database connection';
  }
  return 'Provider API';
}
