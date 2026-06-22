// Tests for the deterministic mock LightGBM classifier (lgbm.ts).
// Covers interface shape, scoring model, classification labels, bounds, and determinism.

import { test, expect } from 'vitest';
import { mockLightGBM, defaultClassifier } from './lgbm';
import type { ContextFeatures } from '../types';

// ---------------------------------------------------------------------------
// Test fixture helper — sane defaults; all booleans false, safe mid-point values
// ---------------------------------------------------------------------------
function makeFeatures(overrides: Partial<ContextFeatures> = {}): ContextFeatures {
  return {
    isProdPath: false,
    isDevPath: false,
    isTestPath: false,
    isDocsPath: false,
    isExamplePath: false,
    isConfigFile: false,
    isSourceCodeFile: false,
    isLogFile: false,
    isIacFile: false,
    fileRole: 'source',
    environmentHint: 'Dev',
    detectedType: 'generic-token',
    valueLength: 32,
    entropy: 3.5,
    entropyLevel: 'medium',
    hasLivePrefix: false,
    hasTestPrefix: false,
    looksLikePlaceholder: false,
    isKnownTestValue: false,
    hasSecretVariableName: false,
    hasPublicVariableName: false,
    variableIntent: 'secret',
    hasExampleLanguage: false,
    hasPlaceholderLanguage: false,
    hasTestLanguage: false,
    hasSecretLanguage: false,
    hasProductionLanguage: false,
    hasDocumentationContext: false,
    storageExposure: 'Internal',
    isPubliclyAccessible: false,
    assetCriticality: 'Medium',
    cloudProvider: 'aws',
    customerVertical: 'general',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Interface shape
// ---------------------------------------------------------------------------
test('mockLightGBM.name === "mock-lightgbm-v0"', () => {
  expect(mockLightGBM.name).toBe('mock-lightgbm-v0');
});

test('defaultClassifier === mockLightGBM', () => {
  expect(defaultClassifier).toBe(mockLightGBM);
});

// ---------------------------------------------------------------------------
// Strong secret scenario → true_secret
// ---------------------------------------------------------------------------
test('strong secret features → secretProbability > 0.85', () => {
  const result = mockLightGBM.predict(makeFeatures({
    detectedType: 'aws-access-key',
    hasSecretVariableName: true,
    hasLivePrefix: true,
    entropyLevel: 'high',
    isProdPath: true,
    isConfigFile: true,
    isPubliclyAccessible: true,
    variableIntent: 'secret',
  }));
  expect(result.secretProbability).toBeGreaterThan(0.85);
});

test('strong secret features → modelClassification === "true_secret"', () => {
  const result = mockLightGBM.predict(makeFeatures({
    detectedType: 'aws-access-key',
    hasSecretVariableName: true,
    hasLivePrefix: true,
    entropyLevel: 'high',
    isProdPath: true,
    isConfigFile: true,
    isPubliclyAccessible: true,
    variableIntent: 'secret',
  }));
  expect(result.modelClassification).toBe('true_secret');
});

// ---------------------------------------------------------------------------
// Placeholder / docs scenario → low probability + placeholder
// ---------------------------------------------------------------------------
test('placeholder+docs features → secretProbability < 0.3', () => {
  const result = mockLightGBM.predict(makeFeatures({
    looksLikePlaceholder: true,
    isDocsPath: true,
    hasExampleLanguage: true,
    variableIntent: 'example',
    entropyLevel: 'low',
  }));
  expect(result.secretProbability).toBeLessThan(0.3);
});

test('placeholder+docs features → modelClassification === "placeholder"', () => {
  const result = mockLightGBM.predict(makeFeatures({
    looksLikePlaceholder: true,
    isDocsPath: true,
    hasExampleLanguage: true,
    variableIntent: 'example',
    entropyLevel: 'low',
  }));
  expect(result.modelClassification).toBe('placeholder');
});

// ---------------------------------------------------------------------------
// Test value scenario → low probability + test_value or placeholder
// ---------------------------------------------------------------------------
test('test-card-number + isKnownTestValue + isTestPath → low probability (< 0.4)', () => {
  const result = mockLightGBM.predict(makeFeatures({
    detectedType: 'test-card-number',
    isKnownTestValue: true,
    isTestPath: true,
    entropyLevel: 'low',
  }));
  expect(result.secretProbability).toBeLessThan(0.4);
});

test('test-card-number + isKnownTestValue + isTestPath → classification is test_value or placeholder', () => {
  const result = mockLightGBM.predict(makeFeatures({
    detectedType: 'test-card-number',
    isKnownTestValue: true,
    isTestPath: true,
    entropyLevel: 'low',
  }));
  expect(['test_value', 'placeholder']).toContain(result.modelClassification);
});

// ---------------------------------------------------------------------------
// Probability bounds — always in [0, 1]
// ---------------------------------------------------------------------------
test('default features → secretProbability in [0,1]', () => {
  const p = mockLightGBM.predict(makeFeatures()).secretProbability;
  expect(p).toBeGreaterThanOrEqual(0);
  expect(p).toBeLessThanOrEqual(1);
});

test('all-true boolean features → secretProbability in [0,1]', () => {
  const p = mockLightGBM.predict(makeFeatures({
    isProdPath: true, isDevPath: true, isTestPath: true, isDocsPath: true,
    isExamplePath: true, isConfigFile: true, isSourceCodeFile: true,
    isLogFile: true, isIacFile: true, hasLivePrefix: true, hasTestPrefix: true,
    looksLikePlaceholder: true, isKnownTestValue: true, hasSecretVariableName: true,
    hasPublicVariableName: true, hasExampleLanguage: true, hasPlaceholderLanguage: true,
    hasTestLanguage: true, hasSecretLanguage: true, hasProductionLanguage: true,
    hasDocumentationContext: true, isPubliclyAccessible: true,
    entropyLevel: 'high', variableIntent: 'secret',
  })).secretProbability;
  expect(p).toBeGreaterThanOrEqual(0);
  expect(p).toBeLessThanOrEqual(1);
});

test('all-negative boolean features + low entropy → secretProbability in [0,1]', () => {
  const p = mockLightGBM.predict(makeFeatures({
    entropyLevel: 'low',
    variableIntent: 'public',
    detectedType: 'email-address',
  })).secretProbability;
  expect(p).toBeGreaterThanOrEqual(0);
  expect(p).toBeLessThanOrEqual(1);
});

test('high-severity type with no other signals → secretProbability in [0,1]', () => {
  const p = mockLightGBM.predict(makeFeatures({
    detectedType: 'pem-private-key',
  })).secretProbability;
  expect(p).toBeGreaterThanOrEqual(0);
  expect(p).toBeLessThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// Determinism — same input, same output
// ---------------------------------------------------------------------------
test('predict is deterministic: two calls on identical features are deep-equal', () => {
  const features = makeFeatures({
    detectedType: 'github-token',
    hasSecretVariableName: true,
    entropyLevel: 'high',
    isProdPath: true,
  });
  const r1 = mockLightGBM.predict(features);
  const r2 = mockLightGBM.predict(features);
  expect(r1).toEqual(r2);
});

test('predict is deterministic across two separate makeFeatures calls with same overrides', () => {
  const overrides = { detectedType: 'slack-token', isPubliclyAccessible: true, entropyLevel: 'medium' as const };
  const r1 = mockLightGBM.predict(makeFeatures(overrides));
  const r2 = mockLightGBM.predict(makeFeatures(overrides));
  expect(r1).toEqual(r2);
});

// ---------------------------------------------------------------------------
// Type-prior contribution — high-severity types push probability up
// ---------------------------------------------------------------------------
test('stripe-secret-key type prior (+0.5) increases probability vs generic-token', () => {
  const base = mockLightGBM.predict(makeFeatures({ detectedType: 'generic-token' })).secretProbability;
  const withPrior = mockLightGBM.predict(makeFeatures({ detectedType: 'stripe-secret-key' })).secretProbability;
  expect(withPrior).toBeGreaterThan(base);
});

test('test-card-number type prior (-0.6) decreases probability vs generic-token', () => {
  const base = mockLightGBM.predict(makeFeatures({ detectedType: 'generic-token' })).secretProbability;
  const withPrior = mockLightGBM.predict(makeFeatures({ detectedType: 'test-card-number' })).secretProbability;
  expect(withPrior).toBeLessThan(base);
});

// ---------------------------------------------------------------------------
// Classification label boundaries
// ---------------------------------------------------------------------------
test('likely_secret: probability in [0.6, 0.85) → likely_secret', () => {
  // Use github-token (type prior +0.5) + medium entropy + variableIntent:'secret'
  // bias=-0.2 + entropyMedium=+0.3 + variableIntent:secret=+0.6 + typePrior=+0.5 = 1.2 → sigmoid ~0.77
  const result = mockLightGBM.predict(makeFeatures({
    detectedType: 'github-token',
    entropyLevel: 'medium',
    variableIntent: 'secret',
  }));
  expect(result.secretProbability).toBeGreaterThanOrEqual(0.6);
  expect(result.secretProbability).toBeLessThan(0.85);
  expect(result.modelClassification).toBe('likely_secret');
});

test('public_non_secret: variableIntent public + low entropy + hasPublicVariableName → public_non_secret', () => {
  const result = mockLightGBM.predict(makeFeatures({
    variableIntent: 'public',
    entropyLevel: 'low',
    hasPublicVariableName: true,
    detectedType: 'generic-token',
  }));
  // bias=-0.2, entropy low=-0.5, variableIntent public=-0.8, type prior=0 → z=-1.5, p~0.18 < 0.4
  expect(result.secretProbability).toBeLessThan(0.4);
  expect(result.modelClassification).toBe('public_non_secret');
});

test('documentation_example: isDocsPath+hasExampleLanguage without placeholder → documentation_example', () => {
  const result = mockLightGBM.predict(makeFeatures({
    isDocsPath: true,
    hasExampleLanguage: true,
    variableIntent: 'example',
    entropyLevel: 'low',
    looksLikePlaceholder: false,
    isKnownTestValue: false,
  }));
  // bias=-0.2, entropy low=-0.5, variableIntent example=-1.5, isDocsPath=-1.2, hasExampleLanguage=-1.0 → z=-4.4, p~0.012
  expect(result.secretProbability).toBeLessThan(0.4);
  // looksLikePlaceholder is false so should be documentation_example, not placeholder
  expect(result.modelClassification).toBe('documentation_example');
});

test('false_positive: low entropy + public intent, no special flags → false_positive', () => {
  const result = mockLightGBM.predict(makeFeatures({
    entropyLevel: 'low',
    variableIntent: 'public',
    hasPublicVariableName: false,
    looksLikePlaceholder: false,
    isDocsPath: false,
    hasExampleLanguage: false,
    isTestPath: false,
    isKnownTestValue: false,
  }));
  // bias=-0.2, entropy low=-0.5, variableIntent public=-0.8 → z=-1.5, p~0.18 < 0.4
  expect(result.secretProbability).toBeLessThan(0.4);
  expect(result.modelClassification).toBe('false_positive');
});

// ---------------------------------------------------------------------------
// Rounding — secretProbability has at most 2 decimal places
// ---------------------------------------------------------------------------
test('secretProbability is rounded to 2 decimal places', () => {
  const features = makeFeatures({ detectedType: 'aws-secret-key', entropyLevel: 'high' });
  const p = mockLightGBM.predict(features).secretProbability;
  const rounded = Math.round(p * 100) / 100;
  expect(p).toBe(rounded);
});
