import type { ContextFeatures, DeterministicRuleResult, Priority, Vertical } from '../types';
import { runDomainRules } from './domainRules';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------
interface Rule {
  id: string;
  label: string;
  direction: 'increase' | 'decrease';
  weight: number;
  rulePack: string;
  when: (f: ContextFeatures) => boolean;
}

interface Guardrail {
  id: string;
  floor: Priority;
  when: (f: ContextFeatures) => boolean;
}

// ---------------------------------------------------------------------------
// Base rules (rulePack 'base')
// ---------------------------------------------------------------------------
const BASE_RULES: Rule[] = [
  {
    id: 'prod-config-secret',
    label: 'Production config under a secret-like variable name',
    direction: 'increase',
    weight: 12,
    rulePack: 'base',
    when: (f) => f.isProdPath && f.isConfigFile && f.hasSecretVariableName,
  },
  {
    id: 'live-prefix-high-entropy',
    label: 'Live-credential prefix with high entropy',
    direction: 'increase',
    weight: 8,
    rulePack: 'base',
    when: (f) => f.hasLivePrefix && f.entropyLevel === 'high',
  },
  {
    id: 'secret-language',
    label: 'Secret-indicating language nearby',
    direction: 'increase',
    weight: 4,
    rulePack: 'base',
    when: (f) => f.hasSecretLanguage,
  },
  {
    id: 'public-exposure',
    label: 'Located in a publicly accessible asset',
    direction: 'increase',
    weight: 10,
    rulePack: 'base',
    when: (f) => f.isPubliclyAccessible,
  },
  {
    id: 'high-asset-criticality',
    label: 'High-criticality asset',
    direction: 'increase',
    weight: 4,
    rulePack: 'base',
    when: (f) => f.assetCriticality === 'High',
  },
  {
    id: 'docs-example',
    label: 'Documentation example context',
    direction: 'decrease',
    weight: 18,
    rulePack: 'base',
    when: (f) => f.isDocsPath && f.hasExampleLanguage,
  },
  {
    id: 'test-known-value',
    label: 'Known test value in a test path',
    direction: 'decrease',
    weight: 20,
    rulePack: 'base',
    when: (f) => f.isTestPath && f.isKnownTestValue,
  },
  {
    id: 'placeholder-value',
    label: 'Placeholder-like value',
    direction: 'decrease',
    weight: 16,
    rulePack: 'base',
    when: (f) => f.looksLikePlaceholder,
  },
  {
    id: 'docs-path',
    label: 'Documentation path',
    direction: 'decrease',
    weight: 8,
    rulePack: 'base',
    when: (f) => f.isDocsPath && !f.hasProductionLanguage,
  },
  {
    id: 'public-variable-name',
    label: 'Public-intent variable name',
    direction: 'decrease',
    weight: 6,
    rulePack: 'base',
    when: (f) => f.hasPublicVariableName && !f.hasSecretVariableName,
  },
  // ---- DomainRulesAgent structural / semantic suppressors (FP killers) ------
  {
    id: 'structural-invalid',
    label: 'Fails its format’s checksum / range (structurally impossible)',
    direction: 'decrease',
    weight: 40,
    rulePack: 'base',
    when: (f) => !f.structurallyValid || !f.formatValidForType || !f.luhnValid,
  },
  {
    id: 'public-by-design',
    label: 'Public-by-design value (never a secret)',
    direction: 'decrease',
    weight: 30,
    rulePack: 'base',
    when: (f) => f.isPublicByDesign,
  },
  {
    id: 'known-example-value',
    label: 'Known test / example / curated vector',
    direction: 'decrease',
    weight: 26,
    rulePack: 'base',
    when: (f) => f.isKnownTestValue || f.isKnownTestVector,
  },
  {
    id: 'already-masked',
    label: 'Value is already masked / redacted in source',
    direction: 'decrease',
    weight: 30,
    rulePack: 'base',
    when: (f) => f.isAlreadyMasked,
  },
  {
    id: 'commit-sha-not-token',
    label: 'Git commit SHA masquerading as a token',
    direction: 'decrease',
    weight: 28,
    rulePack: 'base',
    when: (f) => f.isHighEntropySha,
  },
  {
    id: 'shape-contradicts-type',
    label: 'Numeric identifier shaped like a PAN (epoch / order id)',
    direction: 'decrease',
    weight: 28,
    rulePack: 'base',
    when: (f) => f.shapeContradictsType,
  },
  {
    id: 'fixture-sample-template-path',
    label: 'Located in a fixtures / samples / templates / boilerplate directory',
    direction: 'decrease',
    weight: 16,
    rulePack: 'base',
    when: (f) => Boolean(f.inFixturesDir || f.inSamplesDir || f.inBoilerplateDir),
  },
  {
    id: 'placeholder-identity-context',
    label: 'Surrounded by placeholder identities (e.g. John Doe / Acme)',
    direction: 'decrease',
    weight: 10,
    rulePack: 'base',
    when: (f) => Boolean(f.hasPlaceholderIdentity),
  },
];

// ---------------------------------------------------------------------------
// Vertical rules
// ---------------------------------------------------------------------------
const VERTICAL_RULES: Record<Vertical, Rule[]> = {
  saas: [
    {
      id: 'saas-cloud-cred',
      label: 'Cloud/CI credential (SaaS)',
      direction: 'increase',
      weight: 6,
      rulePack: 'saas',
      when: (f) =>
        ['aws-access-key', 'aws-secret-key', 'github-token', 'datadog-api-key', 'slack-token'].includes(
          f.detectedType
        ),
    },
  ],
  fintech: [
    {
      id: 'fintech-live-payment-key',
      label: 'Live payment-provider key (Fintech)',
      direction: 'increase',
      weight: 10,
      rulePack: 'fintech',
      when: (f) =>
        ['stripe-secret-key', 'paypal-token', 'plaid-secret'].includes(f.detectedType) &&
        f.hasLivePrefix,
    },
    {
      id: 'fintech-test-card',
      label: 'Known test card number (Fintech)',
      direction: 'decrease',
      weight: 16,
      rulePack: 'fintech',
      when: (f) => f.detectedType === 'test-card-number',
    },
  ],
  healthcare: [
    {
      id: 'healthcare-phi',
      label: 'Protected health identifier (Healthcare)',
      direction: 'increase',
      weight: 10,
      rulePack: 'healthcare',
      when: (f) => ['ssn', 'mrn', 'npi', 'patient-id'].includes(f.detectedType),
    },
  ],
  retail: [
    {
      id: 'retail-card-data',
      label: 'Payment card data (Retail)',
      direction: 'increase',
      weight: 8,
      rulePack: 'retail',
      when: (f) => ['credit-card', 'credit-card-number'].includes(f.detectedType),
    },
  ],
  general: [],
};

// ---------------------------------------------------------------------------
// Guardrails
// ---------------------------------------------------------------------------
// Guardrails are gated on `structurallyValid` so a structurally-impossible
// value wearing a high-severity type (e.g. a low-entropy AKIA stub) can never be
// force-floored — only a real, well-formed credential gets the floor.
const GUARDRAILS: Guardrail[] = [
  {
    id: 'private-key-floor',
    floor: 'high',
    when: (f) => f.detectedType === 'pem-private-key' && f.structurallyValid,
  },
  {
    id: 'cloud-cred-prod-floor',
    floor: 'high',
    when: (f) =>
      ['aws-access-key', 'aws-secret-key', 'cloud-key'].includes(f.detectedType) &&
      f.isProdPath &&
      f.isConfigFile &&
      f.structurallyValid,
  },
  {
    id: 'public-critical-floor',
    floor: 'critical',
    when: (f) =>
      f.isPubliclyAccessible &&
      f.structurallyValid &&
      ['aws-access-key', 'aws-secret-key', 'pem-private-key', 'database-password'].includes(
        f.detectedType
      ),
  },
];

// ---------------------------------------------------------------------------
// Priority ranking for guardrail floor comparison
// ---------------------------------------------------------------------------
const PRIORITY_RANK: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  suppressed: 0,
  info: 0,
};

// ---------------------------------------------------------------------------
// evaluateRules — pure function
// ---------------------------------------------------------------------------
export function evaluateRules(features: ContextFeatures): DeterministicRuleResult {
  // Collect applicable rules: base + vertical
  const applicableRules: Rule[] = [
    ...BASE_RULES,
    ...(VERTICAL_RULES[features.customerVertical] ?? []),
  ];

  // Evaluate each rule
  const triggered = applicableRules
    .filter((rule) => rule.when(features))
    .map(({ id, label, direction, weight, rulePack }) => ({
      id,
      label,
      direction,
      weight,
      rulePack,
    }));

  // Compute score: sum of (+weight for increase, -weight for decrease)
  const score = triggered.reduce(
    (acc, rule) => acc + (rule.direction === 'increase' ? rule.weight : -rule.weight),
    0
  );

  // Compute guardrailFloor: highest-ranked floor among fired guardrails
  let guardrailFloor: Priority | undefined = undefined;
  for (const guardrail of GUARDRAILS) {
    if (guardrail.when(features)) {
      if (
        guardrailFloor === undefined ||
        PRIORITY_RANK[guardrail.floor] > PRIORITY_RANK[guardrailFloor]
      ) {
        guardrailFloor = guardrail.floor;
      }
    }
  }

  // DomainRulesAgent verdict — the post-regex structural/semantic filter. Its
  // hard-suppress decision is surfaced here; the orchestrator honors it only
  // when no guardrailFloor outranks it (recall guard).
  const domain = runDomainRules(features);
  const suppress = domain.decision === 'suppress';
  const suppressReason = suppress ? domain.reasons[0] : undefined;

  return { score, triggered, guardrailFloor, suppress, suppressReason };
}
