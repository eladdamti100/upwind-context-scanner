import { test, expect } from 'vitest';
import { explanationTitle, recommendedActions } from './explain';
import type { Finding } from '../types';

test('explanationTitle reflects false-positive vs severity', () => {
  expect(explanationTitle({ isFalsePositive: true } as Finding, 'low')).toBe('Likely false positive');
  expect(explanationTitle({} as Finding, 'critical')).toBe('Critical finding');
  expect(explanationTitle({} as Finding, 'high')).toBe('High-risk finding');
  expect(explanationTitle({} as Finding, 'medium')).toBe('Finding');
});

test('recommendedActions for a real secret leads with rotation', () => {
  const actions = recommendedActions({} as Finding, 'critical');
  expect(actions[0]).toMatch(/Rotate/);
  expect(actions).toContain('Move the secret to a secret manager');
});

test('recommendedActions for a false positive / suppressed leads with triage', () => {
  expect(recommendedActions({ isFalsePositive: true } as Finding, 'low')[0]).toMatch(/false positive/i);
  // suppressed findings are treated as false-positive-like for actions
  expect(recommendedActions({} as Finding, 'suppressed')[0]).toMatch(/false positive/i);
});
