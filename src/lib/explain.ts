import type { Finding, Priority } from '../types';

// Remediation actions (spec §18). These are recommendations only in the MVP.
const REAL_SECRET_ACTIONS = [
  'Rotate this secret',
  'Remove the secret from the file',
  'Move the secret to a secret manager',
  'Restrict access to the storage asset',
  'Validate whether the credential is active',
  'Mark as false positive',
];
const FALSE_POSITIVE_ACTIONS = [
  'Mark as false positive',
  'Add suppression rule',
  'Review manually',
  'Validate whether the credential is active',
];

const isFp = (f: Finding, p: Priority) => Boolean(f.isFalsePositive) || p === 'suppressed';

export function explanationTitle(f: Finding, p: Priority): string {
  if (f.isFalsePositive) return 'Likely false positive';
  if (p === 'critical') return 'Critical finding';
  if (p === 'high') return 'High-risk finding';
  return 'Finding';
}

export function recommendedActions(f: Finding, p: Priority): string[] {
  return isFp(f, p) ? [...FALSE_POSITIVE_ACTIONS] : [...REAL_SECRET_ACTIONS];
}
