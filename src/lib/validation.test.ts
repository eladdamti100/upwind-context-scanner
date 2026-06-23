import { test, expect } from 'vitest';
import {
  VALIDATION_DELAY_MS,
  mockValidate,
  supportsCredentialCheck,
  credentialCheckTarget,
} from './validation';

test('VALIDATION_DELAY_MS is 1500', () => {
  expect(VALIDATION_DELAY_MS).toBe(1500);
});

test('aws-access-key → validated-active', () => {
  expect(mockValidate('aws-access-key')).toBe('validated-active');
});

test('aws-secret-key → validated-active', () => {
  expect(mockValidate('aws-secret-key')).toBe('validated-active');
});

test('stripe-secret-key → validated-active', () => {
  expect(mockValidate('stripe-secret-key')).toBe('validated-active');
});

test('github-token → validated-active', () => {
  expect(mockValidate('github-token')).toBe('validated-active');
});

test('database-password → validated-active', () => {
  expect(mockValidate('database-password')).toBe('validated-active');
});

test('slack-token → validated-inactive', () => {
  expect(mockValidate('slack-token')).toBe('validated-inactive');
});

test('unknown type (generic-token) → validated-inactive', () => {
  expect(mockValidate('generic-token')).toBe('validated-inactive');
});

// ---- supportsCredentialCheck -------------------------------------------------

test.each([
  'aws-access-key-id',
  'aws-secret-access-key',
  'stripe-live-key',
  'github-token',
  'docusign-token',
  'db-connection-string',
  'database-password',
  'jwt',
  'api-key',
])('credential type %s supports a credential check', t => {
  expect(supportsCredentialCheck(t)).toBe(true);
});

test.each([
  'ssn',
  'iban',
  'credit-card-pan',
  'email',
  'phi',
  'npi',
  'passport',
  'drivers-license',
])('non-credential type %s does NOT support a credential check', t => {
  expect(supportsCredentialCheck(t)).toBe(false);
});

test('supportsCredentialCheck handles empty/unknown input', () => {
  expect(supportsCredentialCheck('')).toBe(false);
});

// ---- credentialCheckTarget ---------------------------------------------------

test.each([
  ['aws-access-key-id', 'AWS STS'],
  ['aws-secret-access-key', 'AWS STS'],
  ['stripe-live-key', 'Stripe API'],
  ['github-token', 'GitHub API'],
  ['docusign-token', 'DocuSign API'],
  ['db-connection-string', 'Database connection'],
  ['jwt', 'Provider API'],
])('credentialCheckTarget(%s) → %s', (type, expected) => {
  expect(credentialCheckTarget(type)).toBe(expected);
});
