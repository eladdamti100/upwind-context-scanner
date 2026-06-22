import { test, expect } from 'vitest';
import type { Finding, RiskScoreBreakdown } from '../types';
import {
  accessScore,
  exposureScore,
  activityScore,
  authenticityScore,
  remediationPriority,
  buildBreakdown,
} from './scoring';

// ---- accessScore ------------------------------------------------------------
test('accessScore public === 100', () => {
  expect(accessScore('public')).toBe(100);
});

test('accessScore ordering: restricted < internal < broad < public', () => {
  expect(accessScore('restricted')).toBeLessThan(accessScore('internal'));
  expect(accessScore('internal')).toBeLessThan(accessScore('broad'));
  expect(accessScore('broad')).toBeLessThan(accessScore('public'));
});

// ---- exposureScore ----------------------------------------------------------
test('exposureScore Public === 100', () => {
  expect(exposureScore('Public')).toBe(100);
});

test('exposureScore Internal < Internet-facing', () => {
  expect(exposureScore('Internal')).toBeLessThan(exposureScore('Internet-facing'));
});

// ---- activityScore ----------------------------------------------------------
test('activityScore high > activityScore low', () => {
  expect(activityScore('high')).toBeGreaterThan(activityScore('low'));
});

// ---- authenticityScore ------------------------------------------------------
test('authenticityScore(0.98, 24, 0.96) >= 90', () => {
  expect(authenticityScore(0.98, 24, 0.96)).toBeGreaterThanOrEqual(90);
});

// ---- remediationPriority ----------------------------------------------------
test('remediationPriority: full-auth public AWS key > full-auth internal AWS key', () => {
  const publicScore = remediationPriority(100, 'public', 'Public', 'aws-access-key', 'high');
  const internalScore = remediationPriority(100, 'internal', 'Internal', 'aws-access-key', 'high');
  expect(publicScore).toBeGreaterThan(internalScore);
});

test('remediationPriority: authenticity gating — low auth < high auth (same other params)', () => {
  const low = remediationPriority(20, 'public', 'Public', 'aws-access-key', 'high');
  const high = remediationPriority(95, 'public', 'Public', 'aws-access-key', 'high');
  expect(low).toBeLessThan(high);
});

test('remediationPriority result is within [0, 100]', () => {
  const result = remediationPriority(95, 'public', 'Public', 'aws-access-key', 'high');
  expect(result).toBeGreaterThanOrEqual(0);
  expect(result).toBeLessThanOrEqual(100);

  const zero = remediationPriority(0, 'restricted', 'Docs-only', 'email-address', 'low');
  expect(zero).toBeGreaterThanOrEqual(0);
  expect(zero).toBeLessThanOrEqual(100);
});

// ---- buildBreakdown ---------------------------------------------------------
function makeTestFinding(): Finding {
  const scores: RiskScoreBreakdown = {
    regexConfidence: 0.9,
    deterministicRules: 10,
    lgbmProbability: 0.85,
    authenticityScore: 75,
    accessScore: 80,
    exposureScore: 90,
    secretTypeSeverity: 95,
    activityScore: 60,
    remediationPriority: 70,
  };
  return {
    id: 1,
    basePriority: 'high',
    detectedType: 'aws-access-key',
    maskedValue: 'AKIA••••••••1234',
    classification: 'AWS Access Key',
    category: 'Secret',
    customerVertical: 'saas',
    risk: 75,
    validation: 'not-validated',
    file: '.env',
    path: '/prod/.env',
    asset: 'prod-bucket',
    assetKind: 'S3 Bucket',
    environment: 'Production',
    cloud: 'AWS',
    owner: 'Test User',
    createdAt: 'Jun 1, 2026',
    line: 10,
    offset: 0,
    exposure: 'Public',
    assetCriticality: 'High',
    accessScope: 'public',
    activity: 'high',
    scores,
    riskUpReasons: [],
    riskDownReasons: [],
    explanation: '',
  };
}

test('buildBreakdown returns 5 bars', () => {
  const bars = buildBreakdown(makeTestFinding());
  expect(bars).toHaveLength(5);
});

test('buildBreakdown includes "Authenticity score" and "Remediation priority" labels', () => {
  const bars = buildBreakdown(makeTestFinding());
  const labels = bars.map((b) => b.label);
  expect(labels).toContain('Authenticity score');
  expect(labels).toContain('Remediation priority');
});

test('buildBreakdown bars each have label, value, width, color', () => {
  const bars = buildBreakdown(makeTestFinding());
  for (const bar of bars) {
    expect(typeof bar.label).toBe('string');
    expect(typeof bar.value).toBe('string');
    expect(typeof bar.width).toBe('string');
    expect(typeof bar.color).toBe('string');
    expect(bar.width).toMatch(/%$/);
  }
});
