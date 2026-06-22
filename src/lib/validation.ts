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
