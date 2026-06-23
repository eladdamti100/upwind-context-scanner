// classify.ts — pure style/label/severity helpers for SignalLens
// No React imports, no side effects.

import type { Priority, Category, Environment, ValidationStatus } from '../types';

// ---- Shared constant ---------------------------------------------------------
const CHIP = 'rgba(148,163,184,0.13)';

// ---- priStyle ----------------------------------------------------------------
const PRI_STYLE: Record<Priority, { fg: string; bg: string }> = {
  critical:   { fg: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
  high:       { fg: 'var(--severity-high)',      bg: 'var(--severity-high-bg)' },
  medium:     { fg: 'var(--severity-medium)',    bg: 'var(--severity-medium-bg)' },
  low:        { fg: 'var(--uw-metal-blue-02)',   bg: 'var(--severity-info-bg)' },
  suppressed: { fg: 'var(--text-tertiary)',      bg: 'var(--severity-info-bg)' },
  info:       { fg: 'var(--text-secondary)',     bg: 'var(--severity-info-bg)' },
};

export function priStyle(p: Priority): { fg: string; bg: string } {
  return PRI_STYLE[p] ?? PRI_STYLE.info;
}

// ---- priLabel ----------------------------------------------------------------
const PRI_LABEL: Record<Priority, string> = {
  critical:   'Critical',
  high:       'High',
  medium:     'Medium',
  low:        'Low',
  suppressed: 'Suppressed',
  info:       'Informational',
};

export function priLabel(p: Priority): string {
  return PRI_LABEL[p] ?? PRI_LABEL.info;
}

// ---- categoryStyle -----------------------------------------------------------
const CAT_STYLE: Record<Category, { fg: string; bg: string }> = {
  'Secret':                 { fg: 'var(--severity-high)',          bg: CHIP },
  'Fintech':                { fg: 'var(--uw-royal-purple-03)',     bg: CHIP },
  'SaaS':                   { fg: 'var(--uw-metal-blue-02)',       bg: CHIP },
  'PII':                    { fg: 'var(--uw-cyan-03)',             bg: CHIP },
  'PCI':                    { fg: 'var(--severity-medium)',        bg: CHIP },
  'Healthcare':             { fg: 'var(--severity-safe)',          bg: CHIP },
  'Retail':                 { fg: 'var(--uw-amber-02)',            bg: CHIP },
  'False Positive Pattern': { fg: 'var(--text-tertiary)',          bg: CHIP },
  'Documentation Example':  { fg: 'var(--text-tertiary)',          bg: CHIP },
  'Test Value':             { fg: 'var(--text-tertiary)',          bg: CHIP },
};

export function categoryStyle(c: Category): { fg: string; bg: string } {
  return CAT_STYLE[c] ?? CAT_STYLE['Secret'];
}

// ---- envStyle ----------------------------------------------------------------
const ENV_STYLE: Record<Environment, { fg: string; bg: string }> = {
  Production: { fg: 'var(--severity-high)',      bg: CHIP },
  Dev:        { fg: 'var(--uw-metal-blue-02)',   bg: CHIP },
  Test:       { fg: 'var(--text-tertiary)',      bg: CHIP },
  Docs:       { fg: 'var(--uw-royal-purple-03)', bg: CHIP },
};

export function envStyle(e: Environment): { fg: string; bg: string } {
  return ENV_STYLE[e] ?? ENV_STYLE.Test;
}

// ---- valStyle ----------------------------------------------------------------
interface ValStyle {
  label: string;
  fg: string;
  bg: string;
  canValidate: boolean;
}

const VAL_STYLE: Record<ValidationStatus, ValStyle> = {
  'not-validated':                  { label: 'Not checked',       fg: 'var(--text-tertiary)',     bg: 'var(--severity-info-bg)',     canValidate: true  },
  'validated-active':               { label: 'Active credential', fg: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)', canValidate: false },
  'validated-inactive':             { label: 'Inactive',          fg: 'var(--severity-safe)',     bg: 'var(--severity-safe-bg)',     canValidate: false },
  'validation-failed':              { label: 'Check failed',      fg: 'var(--severity-medium)',   bg: 'var(--severity-medium-bg)',   canValidate: true  },
  'validation-permission-required': { label: 'Needs permission',  fg: 'var(--severity-medium)',   bg: 'var(--severity-medium-bg)',   canValidate: false },
  'validation-unsupported':         { label: 'Unsupported',       fg: 'var(--text-tertiary)',     bg: 'var(--severity-info-bg)',     canValidate: false },
};

export function valStyle(v: ValidationStatus): ValStyle {
  return VAL_STYLE[v] ?? VAL_STYLE['not-validated'];
}

// ---- typeSeverity ------------------------------------------------------------
const TYPE_SEVERITY: Record<string, number> = {
  'pem-private-key':        100,
  'aws-secret-key':          95,
  'aws-access-key':          95,
  'cloud-key':               95,
  'aws-access-key-id':       95,
  'aws-secret-access-key':   95,
  'database-password':       90,
  'db-connection-string':    90,
  'stripe-secret-key':       85,
  'stripe-live-key':         85,
  'payment-secret':          85,
  'ssn':                     85,
  'phi':                     80,
  'credit-card-pan':         80,
  'credit-card':             80,
  'medical-record-number':   80,
  'npi':                     80,
  'github-token':             80,
  'iban':                    75,
  'docusign-token':          75,
  'passport':                75,
  'slack-token':             70,
  'datadog-api-key':         70,
  'insurance-member-id':     70,
  'aba-routing':             70,
  'drivers-license':         70,
  'financial':               70,
  'jwt':                     65,
  'generic-api-key':         65,
  'api-key':                 65,
  'ein':                     65,
  'generic-token':           60,
  'pii':                     55,
  'salary':                  40,
  'test-card-number':        30,
  'email-address':           20,
  'email':                   20,
};

export function typeSeverity(detectedType: string): number {
  return TYPE_SEVERITY[detectedType] ?? 60;
}

// ---- techOf ------------------------------------------------------------------
const TECH_MAP: Record<string, string> = {
  'aws-access-key':    'AWS',
  'aws-secret-key':    'AWS',
  'stripe-secret-key': 'Stripe',
  'github-token':      'GitHub',
  'slack-token':       'Slack',
  'datadog-api-key':   'Datadog',
};

export function techOf(detectedType: string): string {
  return TECH_MAP[detectedType] ?? 'Generic';
}
