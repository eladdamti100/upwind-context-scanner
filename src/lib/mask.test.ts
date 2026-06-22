import { test, expect } from 'vitest';
import { isMasked, assertMasked } from './mask';

test('isMasked accepts masked values and empty strings', () => {
  expect(isMasked('AKIA••••5T2Q')).toBe(true);
  expect(isMasked('sk_live_••••4f7a')).toBe(true);
  expect(isMasked('api_key_****EXAMPLE')).toBe(true);
  expect(isMasked('')).toBe(true);
  expect(isMasked('   ')).toBe(true);
});

test('isMasked rejects values that look like raw secrets', () => {
  expect(isMasked('AKIAIOSFODNN7EXAMPLE')).toBe(false);
  expect(isMasked('ghp_0123456789abcdef0123456789abcdef')).toBe(false);
});

test('assertMasked returns the value when masked', () => {
  expect(assertMasked('AKIA••••5T2Q')).toBe('AKIA••••5T2Q');
});

test('assertMasked throws on an unmasked value (never handle a full secret)', () => {
  expect(() => assertMasked('AKIAIOSFODNN7EXAMPLE')).toThrow();
});
