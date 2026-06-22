import { test, expect } from 'vitest';
import { rankFilter, sortRows, type Filter } from './query';
import type { Finding, RiskScoreBreakdown } from '../types';

// --- test-only fixtures (NOT the real mock dataset) -------------------------
const scores: RiskScoreBreakdown = {
  regexConfidence: 0.9, deterministicRules: 0, lgbmProbability: 0.5,
  authenticityScore: 50, exposureScore: 50,
  accessScore: 50, secretTypeSeverity: 50, activityScore: 50, remediationPriority: 50,
};
function makeFinding(o: Partial<Finding> = {}): Finding {
  return {
    id: 1, basePriority: 'medium', detectedType: 'generic-token', maskedValue: 'tok_••••1',
    classification: 'Generic Token', category: 'Secret', customerVertical: 'general',
    risk: 50, validation: 'not-validated', file: 'a.env', path: '/app/a.env', asset: 'asset-1',
    assetKind: 'Service', environment: 'Production', cloud: 'AWS', owner: 'Maya Rosen',
    createdAt: 'Jun 1, 2026', line: 1, offset: 1, exposure: 'Internal', assetCriticality: 'Medium',
    accessScope: 'internal', activity: 'unknown',
    scores: { ...scores }, riskUpReasons: [], riskDownReasons: [], explanation: '',
    ...o,
  };
}
const NO_FILTERS: Filter[] = [];

test('search matches detectedType, owner, and path (case-insensitive)', () => {
  const f = makeFinding({ detectedType: 'stripe-secret-key', owner: 'Daniel Cohen', path: '/payment/x.yaml' });
  expect(rankFilter(f, NO_FILTERS, 'STRIPE', 'balanced')).toBe(true);
  expect(rankFilter(f, NO_FILTERS, 'daniel', 'balanced')).toBe(true);
  expect(rankFilter(f, NO_FILTERS, 'payment', 'balanced')).toBe(true);
  expect(rankFilter(f, NO_FILTERS, 'nomatch', 'balanced')).toBe(false);
});

test('priority filter honors effective priority under sensitivity', () => {
  const low = makeFinding({ basePriority: 'low' });
  // balanced: stays low
  expect(rankFilter(low, [{ key: 'priority', val: 'low', label: '' }], '', 'balanced')).toBe(true);
  // flexible: low -> suppressed, so a 'low' filter no longer matches
  expect(rankFilter(low, [{ key: 'priority', val: 'low', label: '' }], '', 'flexible')).toBe(false);
  expect(rankFilter(low, [{ key: 'priority', val: 'suppressed', label: '' }], '', 'flexible')).toBe(true);
});

test('attribute filters (env, cloud, validation, exposure) match exactly', () => {
  const f = makeFinding({ environment: 'Dev', cloud: 'GCP', validation: 'validated-active', exposure: 'Public' });
  expect(rankFilter(f, [{ key: 'env', val: 'Dev', label: '' }], '', 'balanced')).toBe(true);
  expect(rankFilter(f, [{ key: 'env', val: 'Production', label: '' }], '', 'balanced')).toBe(false);
  expect(rankFilter(f, [{ key: 'cloud', val: 'GCP', label: '' }], '', 'balanced')).toBe(true);
  expect(rankFilter(f, [{ key: 'validation', val: 'validated-active', label: '' }], '', 'balanced')).toBe(true);
  expect(rankFilter(f, [{ key: 'exposure', val: 'Public', label: '' }], '', 'balanced')).toBe(true);
});

test('multiple filters are combined with AND', () => {
  const f = makeFinding({ environment: 'Production', cloud: 'AWS' });
  const filters: Filter[] = [
    { key: 'env', val: 'Production', label: '' },
    { key: 'cloud', val: 'GCP', label: '' },
  ];
  expect(rankFilter(f, filters, '', 'balanced')).toBe(false);
});

test('sortRows by risk desc puts the highest risk first', () => {
  const rows = [makeFinding({ id: 1, risk: 20 }), makeFinding({ id: 2, risk: 96 }), makeFinding({ id: 3, risk: 58 })];
  const sorted = sortRows(rows, 'risk', 'desc', 'balanced');
  expect(sorted.map((r) => r.id)).toEqual([2, 3, 1]);
});

test('sortRows by priority desc orders by effective severity', () => {
  const rows = [
    makeFinding({ id: 1, basePriority: 'low' }),
    makeFinding({ id: 2, basePriority: 'critical' }),
    makeFinding({ id: 3, basePriority: 'medium' }),
  ];
  const sorted = sortRows(rows, 'priority', 'desc', 'balanced');
  expect(sorted.map((r) => r.id)).toEqual([2, 3, 1]);
});

test('sortRows does not mutate the input array', () => {
  const rows = [makeFinding({ id: 1, risk: 10 }), makeFinding({ id: 2, risk: 90 })];
  const before = rows.map((r) => r.id);
  sortRows(rows, 'risk', 'desc', 'balanced');
  expect(rows.map((r) => r.id)).toEqual(before);
});
