import { test, expect } from 'vitest';
import { VALIDATION_DELAY_MS, mockValidate } from './validation';

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
