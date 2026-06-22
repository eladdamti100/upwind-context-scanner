// ---------------------------------------------------------------------------
// DETERMINISTIC PLACEHOLDER / MOCK — not a real trained model.
// This module defines the SecretClassifier interface and a fully deterministic
// mock adapter (mockLightGBM) that implements the scoring logic below.
// When a real LightGBM model is trained and exported, replace `mockLightGBM`
// with a new implementation of `SecretClassifier` — the interface, the
// `defaultClassifier` export, and all consumers remain unchanged.
// ---------------------------------------------------------------------------

import type { ContextFeatures, LightGBMModelResult } from '../types';

// ---------------------------------------------------------------------------
// Public interface — the swap point for a real model
// ---------------------------------------------------------------------------
export interface SecretClassifier {
  readonly name: string;
  predict(features: ContextFeatures): LightGBMModelResult;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function round2(p: number): number {
  return Math.round(p * 100) / 100;
}

// High-severity detector types that add a positive prior
const HIGH_SEVERITY_TYPES = new Set([
  'aws-access-key',
  'aws-secret-key',
  'pem-private-key',
  'stripe-secret-key',
  'github-token',
  'database-password',
  'slack-token',
  'datadog-api-key',
]);

// Low-severity detector types that add a negative prior
const LOW_SEVERITY_TYPES = new Set([
  'test-card-number',
  'email-address',
]);

// ---------------------------------------------------------------------------
// Scoring model
// ---------------------------------------------------------------------------
function computeProbability(f: ContextFeatures): number {
  let z = -0.2; // bias

  // Variable name and prefix signals
  if (f.hasSecretVariableName) z += 1.4;
  if (f.hasLivePrefix) z += 1.2;

  // Entropy level
  if (f.entropyLevel === 'high') z += 1.0;
  else if (f.entropyLevel === 'medium') z += 0.3;
  else if (f.entropyLevel === 'low') z -= 0.5;

  // Path/file context
  if (f.isProdPath) z += 0.8;
  if (f.isConfigFile) z += 0.4;
  if (f.isPubliclyAccessible) z += 0.6;

  // Language/production signals
  if (f.hasProductionLanguage) z += 0.4;
  if (f.hasSecretLanguage) z += 0.3;

  // Variable intent
  if (f.variableIntent === 'secret') z += 0.6;
  else if (f.variableIntent === 'public') z -= 0.8;
  else if (f.variableIntent === 'example') z -= 1.5;

  // Negative signals
  if (f.looksLikePlaceholder) z -= 2.2;
  if (f.isKnownTestValue) z -= 2.5;
  if (f.isDocsPath) z -= 1.2;
  if (f.isTestPath) z -= 1.0;
  if (f.isExamplePath) z -= 1.0;
  if (f.hasExampleLanguage) z -= 1.0;
  if (f.hasPlaceholderLanguage) z -= 1.2;

  // Type prior
  if (HIGH_SEVERITY_TYPES.has(f.detectedType)) z += 0.5;
  else if (LOW_SEVERITY_TYPES.has(f.detectedType)) z -= 0.6;

  return round2(sigmoid(z));
}

// ---------------------------------------------------------------------------
// Classification label from probability and features
// ---------------------------------------------------------------------------
function classify(
  p: number,
  f: ContextFeatures,
): LightGBMModelResult['modelClassification'] {
  if (p >= 0.85) return 'true_secret';
  if (p >= 0.6) return 'likely_secret';
  if (p >= 0.4) return 'unknown_or_review';

  // p < 0.4 — pick the most specific negative label
  if (f.looksLikePlaceholder) return 'placeholder';
  if (f.isDocsPath || f.hasExampleLanguage) return 'documentation_example';
  if (f.isTestPath || f.isKnownTestValue) return 'test_value';
  if (f.hasPublicVariableName) return 'public_non_secret';
  return 'false_positive';
}

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------
export const mockLightGBM: SecretClassifier = {
  name: 'mock-lightgbm-v0',

  predict(features: ContextFeatures): LightGBMModelResult {
    const secretProbability = computeProbability(features);
    const modelClassification = classify(secretProbability, features);
    return { secretProbability, modelClassification };
  },
};

// ---------------------------------------------------------------------------
// Default classifier — swap `mockLightGBM` for a real model here
// ---------------------------------------------------------------------------
export const defaultClassifier: SecretClassifier = mockLightGBM;
