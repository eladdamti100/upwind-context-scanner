import { describe, test, expect } from 'vitest';
import { runDomainRules } from './domainRules';
import { makeFeatures } from './testFeatures';

describe('DomainRulesAgent — suppression of impossible / benign candidates', () => {
  test('structurally invalid value is suppressed (masked path)', () => {
    const v = runDomainRules(makeFeatures({ detectedType: 'credit-card', structurallyValid: false }));
    expect(v.decision).toBe('suppress');
    expect(v.reasons[0]).toMatch(/structural/i);
  });

  test('Luhn-failing card is suppressed', () => {
    const v = runDomainRules(makeFeatures({ detectedType: 'credit-card', luhnValid: false }));
    expect(v.decision).toBe('suppress');
  });

  test('public-by-design value is suppressed', () => {
    const v = runDomainRules(makeFeatures({ detectedType: 'stripe-publishable', isPublicByDesign: true }));
    expect(v.decision).toBe('suppress');
  });

  test('known test value / curated vector is suppressed', () => {
    expect(runDomainRules(makeFeatures({ isKnownTestValue: true })).decision).toBe('suppress');
    expect(runDomainRules(makeFeatures({ isKnownTestVector: true })).decision).toBe('suppress');
  });

  test('creative invariants: already-masked, commit SHA, shape contradiction', () => {
    expect(runDomainRules(makeFeatures({ isAlreadyMasked: true })).decision).toBe('suppress');
    expect(runDomainRules(makeFeatures({ isHighEntropySha: true })).decision).toBe('suppress');
    expect(runDomainRules(makeFeatures({ detectedType: 'credit-card', shapeContradictsType: true })).decision).toBe('suppress');
  });

  test('public-intent variable holding a placeholder is suppressed', () => {
    const v = runDomainRules(makeFeatures({ variableIntent: 'public', looksLikePlaceholder: true }));
    expect(v.decision).toBe('suppress');
  });
});

describe('DomainRulesAgent — recall guard (never silence a real secret)', () => {
  test('valid high-severity credential in prod resists the SOFT placeholder heuristic', () => {
    // The weak public/example-placeholder rule must not suppress a real AWS key.
    const v = runDomainRules(
      makeFeatures({
        detectedType: 'aws-access-key',
        structurallyValid: true,
        isProdPath: true,
        isPubliclyAccessible: true,
        assetCriticality: 'High',
        variableIntent: 'public',
        looksLikePlaceholder: true, // adversarial soft signal — ignored by the recall guard
      }),
    );
    expect(v.decision).toBe('boost');
  });

  test('valid high-severity credential in prod boosts', () => {
    const v = runDomainRules(
      makeFeatures({ detectedType: 'pem-private-key', isProdPath: true, assetCriticality: 'High' }),
    );
    expect(v.decision).toBe('boost');
  });

  test('AUTHORITATIVE not-a-secret signals suppress even a high-severity type', () => {
    // An already-masked sk_live_**** under payment_secret is provably not live.
    const v = runDomainRules(
      makeFeatures({
        detectedType: 'payment-secret',
        isProdPath: true,
        assetCriticality: 'High',
        isAlreadyMasked: true,
      }),
    );
    expect(v.decision).toBe('suppress');
  });
});

describe('DomainRulesAgent — live raw-value path', () => {
  test('runs the validator library when a raw value is supplied', () => {
    // Luhn-invalid raw card → suppress, regardless of (stale) signals.
    const v = runDomainRules(
      makeFeatures({ detectedType: 'credit-card', structurallyValid: true }),
      '4242424242424241',
    );
    expect(v.decision).toBe('suppress');
    expect(v.failedValidator).toBe('credit-card');
  });

  test('valid raw secret with no danger-zone context is kept', () => {
    const v = runDomainRules(makeFeatures({ detectedType: 'generic-token' }));
    expect(v.decision).toBe('keep');
  });
});
