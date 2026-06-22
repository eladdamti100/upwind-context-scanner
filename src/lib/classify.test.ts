import { test, expect } from 'vitest';
import {
  priLabel,
  priStyle,
  categoryStyle,
  envStyle,
  valStyle,
  typeSeverity,
  techOf,
} from './classify';

// ---- priLabel ----------------------------------------------------------------
test('priLabel critical -> Critical', () => {
  expect(priLabel('critical')).toBe('Critical');
});
test('priLabel high -> High', () => {
  expect(priLabel('high')).toBe('High');
});
test('priLabel medium -> Medium', () => {
  expect(priLabel('medium')).toBe('Medium');
});
test('priLabel low -> Low', () => {
  expect(priLabel('low')).toBe('Low');
});
test('priLabel suppressed -> Suppressed', () => {
  expect(priLabel('suppressed')).toBe('Suppressed');
});
test('priLabel info -> Informational', () => {
  expect(priLabel('info')).toBe('Informational');
});

// ---- priStyle ----------------------------------------------------------------
test('priStyle critical fg', () => {
  expect(priStyle('critical').fg).toBe('var(--severity-critical)');
});
test('priStyle critical bg', () => {
  expect(priStyle('critical').bg).toBe('var(--severity-critical-bg)');
});
test('priStyle high fg', () => {
  expect(priStyle('high').fg).toBe('var(--severity-high)');
});
test('priStyle high bg', () => {
  expect(priStyle('high').bg).toBe('var(--severity-high-bg)');
});
test('priStyle medium fg', () => {
  expect(priStyle('medium').fg).toBe('var(--severity-medium)');
});
test('priStyle medium bg', () => {
  expect(priStyle('medium').bg).toBe('var(--severity-medium-bg)');
});
test('priStyle low fg is var(--uw-metal-blue-02)', () => {
  expect(priStyle('low').fg).toBe('var(--uw-metal-blue-02)');
});
test('priStyle low bg is info-bg', () => {
  expect(priStyle('low').bg).toBe('var(--severity-info-bg)');
});
test('priStyle suppressed fg is text-tertiary', () => {
  expect(priStyle('suppressed').fg).toBe('var(--text-tertiary)');
});
test('priStyle suppressed bg is info-bg', () => {
  expect(priStyle('suppressed').bg).toBe('var(--severity-info-bg)');
});
test('priStyle info fg is text-secondary', () => {
  expect(priStyle('info').fg).toBe('var(--text-secondary)');
});
test('priStyle info bg is info-bg', () => {
  expect(priStyle('info').bg).toBe('var(--severity-info-bg)');
});
test('priStyle unknown falls back to info style', () => {
  const info = priStyle('info');
  // @ts-expect-error testing unknown key
  const unknown = priStyle('unknown-key');
  expect(unknown.fg).toBe(info.fg);
  expect(unknown.bg).toBe(info.bg);
});

// ---- categoryStyle -----------------------------------------------------------
const CHIP = 'rgba(148,163,184,0.13)';

test('categoryStyle Secret fg', () => {
  expect(categoryStyle('Secret').fg).toBe('var(--severity-high)');
});
test('categoryStyle Secret bg is CHIP', () => {
  expect(categoryStyle('Secret').bg).toBe(CHIP);
});
test('categoryStyle Fintech fg', () => {
  expect(categoryStyle('Fintech').fg).toBe('var(--uw-royal-purple-03)');
});
test('categoryStyle SaaS fg', () => {
  expect(categoryStyle('SaaS').fg).toBe('var(--uw-metal-blue-02)');
});
test('categoryStyle PII fg', () => {
  expect(categoryStyle('PII').fg).toBe('var(--uw-cyan-03)');
});
test('categoryStyle PCI fg', () => {
  expect(categoryStyle('PCI').fg).toBe('var(--severity-medium)');
});
test('categoryStyle Healthcare fg', () => {
  expect(categoryStyle('Healthcare').fg).toBe('var(--severity-safe)');
});
test('categoryStyle Retail fg', () => {
  expect(categoryStyle('Retail').fg).toBe('var(--uw-amber-02)');
});
test('categoryStyle Retail bg is CHIP', () => {
  expect(categoryStyle('Retail').bg).toBe(CHIP);
});
test('categoryStyle False Positive Pattern fg', () => {
  expect(categoryStyle('False Positive Pattern').fg).toBe('var(--text-tertiary)');
});
test('categoryStyle Documentation Example fg', () => {
  expect(categoryStyle('Documentation Example').fg).toBe('var(--text-tertiary)');
});
test('categoryStyle Test Value fg', () => {
  expect(categoryStyle('Test Value').fg).toBe('var(--text-tertiary)');
});
test('categoryStyle all categories share bg CHIP', () => {
  const cats = ['Secret', 'Fintech', 'SaaS', 'PII', 'PCI', 'Healthcare', 'Retail',
    'False Positive Pattern', 'Documentation Example', 'Test Value'] as const;
  for (const c of cats) {
    expect(categoryStyle(c).bg).toBe(CHIP);
  }
});
test('categoryStyle unknown falls back to Secret style', () => {
  const secret = categoryStyle('Secret');
  // @ts-expect-error testing unknown key
  const unknown = categoryStyle('Unknown-Cat');
  expect(unknown.fg).toBe(secret.fg);
  expect(unknown.bg).toBe(secret.bg);
});

// ---- envStyle ----------------------------------------------------------------
test('envStyle Production fg is severity-high', () => {
  expect(envStyle('Production').fg).toBe('var(--severity-high)');
});
test('envStyle Production bg is CHIP', () => {
  expect(envStyle('Production').bg).toBe(CHIP);
});
test('envStyle Dev fg', () => {
  expect(envStyle('Dev').fg).toBe('var(--uw-metal-blue-02)');
});
test('envStyle Test fg', () => {
  expect(envStyle('Test').fg).toBe('var(--text-tertiary)');
});
test('envStyle Docs fg', () => {
  expect(envStyle('Docs').fg).toBe('var(--uw-royal-purple-03)');
});
test('envStyle all share bg CHIP', () => {
  const envs = ['Production', 'Dev', 'Test', 'Docs'] as const;
  for (const e of envs) {
    expect(envStyle(e).bg).toBe(CHIP);
  }
});
test('envStyle unknown falls back to Test style', () => {
  const test_ = envStyle('Test');
  // @ts-expect-error testing unknown key
  const unknown = envStyle('Staging');
  expect(unknown.fg).toBe(test_.fg);
  expect(unknown.bg).toBe(test_.bg);
});

// ---- valStyle ----------------------------------------------------------------
test('valStyle not-validated canValidate is true', () => {
  expect(valStyle('not-validated').canValidate).toBe(true);
});
test('valStyle not-validated label', () => {
  expect(valStyle('not-validated').label).toBe('Not validated');
});
test('valStyle not-validated fg', () => {
  expect(valStyle('not-validated').fg).toBe('var(--text-tertiary)');
});
test('valStyle not-validated bg', () => {
  expect(valStyle('not-validated').bg).toBe('var(--severity-info-bg)');
});
test('valStyle validated-active canValidate is false', () => {
  expect(valStyle('validated-active').canValidate).toBe(false);
});
test('valStyle validated-active label', () => {
  expect(valStyle('validated-active').label).toBe('Validated active');
});
test('valStyle validated-active fg is critical', () => {
  expect(valStyle('validated-active').fg).toBe('var(--severity-critical)');
});
test('valStyle validated-active bg is critical-bg', () => {
  expect(valStyle('validated-active').bg).toBe('var(--severity-critical-bg)');
});
test('valStyle validated-inactive label', () => {
  expect(valStyle('validated-inactive').label).toBe('Validated inactive');
});
test('valStyle validated-inactive canValidate is false', () => {
  expect(valStyle('validated-inactive').canValidate).toBe(false);
});
test('valStyle validated-inactive fg is safe', () => {
  expect(valStyle('validated-inactive').fg).toBe('var(--severity-safe)');
});
test('valStyle validated-inactive bg is safe-bg', () => {
  expect(valStyle('validated-inactive').bg).toBe('var(--severity-safe-bg)');
});
test('valStyle validation-failed label', () => {
  expect(valStyle('validation-failed').label).toBe('Validation failed');
});
test('valStyle validation-failed canValidate is true', () => {
  expect(valStyle('validation-failed').canValidate).toBe(true);
});
test('valStyle validation-permission-required label', () => {
  expect(valStyle('validation-permission-required').label).toBe('Permission required');
});
test('valStyle validation-permission-required canValidate is false', () => {
  expect(valStyle('validation-permission-required').canValidate).toBe(false);
});
test('valStyle validation-unsupported label', () => {
  expect(valStyle('validation-unsupported').label).toBe('Unsupported');
});
test('valStyle validation-unsupported canValidate is false', () => {
  expect(valStyle('validation-unsupported').canValidate).toBe(false);
});
test('valStyle unknown falls back to not-validated style', () => {
  const nv = valStyle('not-validated');
  // @ts-expect-error testing unknown key
  const unknown = valStyle('some-unknown-status');
  expect(unknown.label).toBe(nv.label);
  expect(unknown.fg).toBe(nv.fg);
  expect(unknown.bg).toBe(nv.bg);
  expect(unknown.canValidate).toBe(nv.canValidate);
});

// ---- typeSeverity ------------------------------------------------------------
test('typeSeverity pem-private-key is 100', () => {
  expect(typeSeverity('pem-private-key')).toBe(100);
});
test('typeSeverity aws-secret-key is 95', () => {
  expect(typeSeverity('aws-secret-key')).toBe(95);
});
test('typeSeverity aws-access-key is 95', () => {
  expect(typeSeverity('aws-access-key')).toBe(95);
});
test('typeSeverity database-password is 90', () => {
  expect(typeSeverity('database-password')).toBe(90);
});
test('typeSeverity pem-private-key > email-address', () => {
  expect(typeSeverity('pem-private-key')).toBeGreaterThan(typeSeverity('email-address'));
});
test('typeSeverity unknown-xyz returns 60', () => {
  expect(typeSeverity('unknown-xyz')).toBe(60);
});
test('typeSeverity test-card-number is 30', () => {
  expect(typeSeverity('test-card-number')).toBe(30);
});
test('typeSeverity email-address is 20', () => {
  expect(typeSeverity('email-address')).toBe(20);
});
test('typeSeverity generic-token is 60', () => {
  expect(typeSeverity('generic-token')).toBe(60);
});
test('typeSeverity generic-api-key is 65', () => {
  expect(typeSeverity('generic-api-key')).toBe(65);
});

// ---- techOf ------------------------------------------------------------------
test('techOf aws-access-key -> AWS', () => {
  expect(techOf('aws-access-key')).toBe('AWS');
});
test('techOf aws-secret-key -> AWS', () => {
  expect(techOf('aws-secret-key')).toBe('AWS');
});
test('techOf stripe-secret-key -> Stripe', () => {
  expect(techOf('stripe-secret-key')).toBe('Stripe');
});
test('techOf github-token -> GitHub', () => {
  expect(techOf('github-token')).toBe('GitHub');
});
test('techOf slack-token -> Slack', () => {
  expect(techOf('slack-token')).toBe('Slack');
});
test('techOf datadog-api-key -> Datadog', () => {
  expect(techOf('datadog-api-key')).toBe('Datadog');
});
test('techOf unknown -> Generic', () => {
  expect(techOf('whatever')).toBe('Generic');
});
test('techOf pem-private-key -> Generic (not in map)', () => {
  expect(techOf('pem-private-key')).toBe('Generic');
});
