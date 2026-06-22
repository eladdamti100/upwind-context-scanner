import { test, expect, describe } from 'vitest';
import type { ContextFeatures } from '../types';
import { evaluateRules } from './rules';

// ---------------------------------------------------------------------------
// Test fixture helper — sane defaults, override with Partial<ContextFeatures>
// ---------------------------------------------------------------------------
function makeFeatures(overrides: Partial<ContextFeatures> = {}): ContextFeatures {
  const defaults: ContextFeatures = {
    isProdPath: false,
    isDevPath: false,
    isTestPath: false,
    isDocsPath: false,
    isExamplePath: false,
    isConfigFile: false,
    isSourceCodeFile: false,
    isLogFile: false,
    isIacFile: false,
    fileRole: 'unknown',
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
  };
  return { ...defaults, ...overrides };
}

// ---------------------------------------------------------------------------
// 1. Prod public AWS key (fintech) — high severity, critical guardrail
// ---------------------------------------------------------------------------
describe('prod public AWS key (fintech)', () => {
  const features = makeFeatures({
    detectedType: 'aws-access-key',
    isProdPath: true,
    isConfigFile: true,
    hasSecretVariableName: true,
    hasLivePrefix: true,
    entropyLevel: 'high',
    isPubliclyAccessible: true,
    assetCriticality: 'High',
    customerVertical: 'fintech',
  });

  test('score sums to the expected total (12+8+10+4)', () => {
    const result = evaluateRules(features);
    expect(result.score).toBe(34);
  });

  test('triggered ids include prod-config-secret, live-prefix-high-entropy, public-exposure, high-asset-criticality', () => {
    const result = evaluateRules(features);
    const ids = result.triggered.map((r) => r.id);
    expect(ids).toContain('prod-config-secret');
    expect(ids).toContain('live-prefix-high-entropy');
    expect(ids).toContain('public-exposure');
    expect(ids).toContain('high-asset-criticality');
  });

  test('guardrailFloor is critical', () => {
    const result = evaluateRules(features);
    expect(result.guardrailFloor).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// 2. README placeholder (general) — score negative, no guardrail
// ---------------------------------------------------------------------------
describe('README placeholder (general)', () => {
  const features = makeFeatures({
    isDocsPath: true,
    hasExampleLanguage: true,
    looksLikePlaceholder: true,
    // hasProductionLanguage false so docs-path also fires
    hasProductionLanguage: false,
  });

  test('score is negative', () => {
    const result = evaluateRules(features);
    expect(result.score).toBeLessThan(0);
  });

  test('triggered ids include docs-example, placeholder-value, docs-path', () => {
    const result = evaluateRules(features);
    const ids = result.triggered.map((r) => r.id);
    expect(ids).toContain('docs-example');
    expect(ids).toContain('placeholder-value');
    expect(ids).toContain('docs-path');
  });

  test('guardrailFloor is undefined', () => {
    const result = evaluateRules(features);
    expect(result.guardrailFloor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Test card number (fintech) — decrease rules fire, no guardrail
// ---------------------------------------------------------------------------
describe('test card number (fintech)', () => {
  const features = makeFeatures({
    detectedType: 'test-card-number',
    isTestPath: true,
    isKnownTestValue: true,
    customerVertical: 'fintech',
  });

  test('triggered ids include fintech-test-card and test-known-value', () => {
    const result = evaluateRules(features);
    const ids = result.triggered.map((r) => r.id);
    expect(ids).toContain('fintech-test-card');
    expect(ids).toContain('test-known-value');
  });

  test('score is negative', () => {
    const result = evaluateRules(features);
    expect(result.score).toBeLessThan(0);
  });

  test('guardrailFloor is undefined', () => {
    const result = evaluateRules(features);
    expect(result.guardrailFloor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. PEM private key internal (general) — guardrailFloor high
// ---------------------------------------------------------------------------
describe('PEM private key internal (general)', () => {
  const features = makeFeatures({ detectedType: 'pem-private-key' });

  test('guardrailFloor is high', () => {
    const result = evaluateRules(features);
    expect(result.guardrailFloor).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// 5. Vertical isolation — saas-cloud-cred only fires for saas, not general
// ---------------------------------------------------------------------------
describe('vertical isolation — saas-cloud-cred', () => {
  const saasFeatures = makeFeatures({
    detectedType: 'github-token',
    customerVertical: 'saas',
  });
  const generalFeatures = makeFeatures({
    detectedType: 'github-token',
    customerVertical: 'general',
  });

  test('fires saas-cloud-cred when customerVertical is saas', () => {
    const result = evaluateRules(saasFeatures);
    const ids = result.triggered.map((r) => r.id);
    expect(ids).toContain('saas-cloud-cred');
  });

  test('does NOT fire saas-cloud-cred when customerVertical is general', () => {
    const result = evaluateRules(generalFeatures);
    const ids = result.triggered.map((r) => r.id);
    expect(ids).not.toContain('saas-cloud-cred');
  });
});

// ---------------------------------------------------------------------------
// 6. Score math — assert numeric score for a predictable fixture
// ---------------------------------------------------------------------------
describe('score math', () => {
  // Only 'secret-language' (increase, +4) fires
  const features = makeFeatures({ hasSecretLanguage: true });

  test('score equals +4 when only secret-language fires', () => {
    const result = evaluateRules(features);
    expect(result.score).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 7. Triggered shape — each entry carries id, label, direction, weight, rulePack
// ---------------------------------------------------------------------------
describe('triggered entry shape', () => {
  test('each triggered rule has required fields', () => {
    const features = makeFeatures({ hasSecretLanguage: true });
    const result = evaluateRules(features);
    for (const rule of result.triggered) {
      expect(typeof rule.id).toBe('string');
      expect(typeof rule.label).toBe('string');
      expect(['increase', 'decrease']).toContain(rule.direction);
      expect(typeof rule.weight).toBe('number');
      // every rule sets a rulePack, and the predicate must not leak into output
      expect(typeof rule.rulePack).toBe('string');
      expect((rule as Record<string, unknown>).when).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Vertical packs: healthcare and retail (isolation)
// ---------------------------------------------------------------------------
describe('healthcare + retail vertical packs', () => {
  test('healthcare-phi fires only for the healthcare vertical', () => {
    const phi = makeFeatures({ detectedType: 'ssn', customerVertical: 'healthcare' });
    expect(evaluateRules(phi).triggered.map((r) => r.id)).toContain('healthcare-phi');
    const general = makeFeatures({ detectedType: 'ssn', customerVertical: 'general' });
    expect(evaluateRules(general).triggered.map((r) => r.id)).not.toContain('healthcare-phi');
  });
  test('retail-card-data fires only for the retail vertical', () => {
    const card = makeFeatures({ detectedType: 'credit-card', customerVertical: 'retail' });
    expect(evaluateRules(card).triggered.map((r) => r.id)).toContain('retail-card-data');
    const saas = makeFeatures({ detectedType: 'credit-card', customerVertical: 'saas' });
    expect(evaluateRules(saas).triggered.map((r) => r.id)).not.toContain('retail-card-data');
  });
});

// ---------------------------------------------------------------------------
// 8. Critical guardrail beats high (cloud key in prod config + public)
// ---------------------------------------------------------------------------
describe('guardrail floor priority — critical beats high', () => {
  // Both 'cloud-cred-prod-floor' (high) and 'public-critical-floor' (critical) should fire
  const features = makeFeatures({
    detectedType: 'aws-access-key',
    isProdPath: true,
    isConfigFile: true,
    isPubliclyAccessible: true,
  });

  test('guardrailFloor is critical when both high and critical guardrails fire', () => {
    const result = evaluateRules(features);
    expect(result.guardrailFloor).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// 9. Zero score when no rules fire
// ---------------------------------------------------------------------------
describe('no rules fire', () => {
  test('score is 0 and triggered is empty for default features', () => {
    const features = makeFeatures();
    const result = evaluateRules(features);
    expect(result.score).toBe(0);
    expect(result.triggered).toHaveLength(0);
    expect(result.guardrailFloor).toBeUndefined();
  });
});
