import type { ContextFeatures, DeterministicRuleResult, Priority, Vertical } from '../types';

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
const GUARDRAILS: Guardrail[] = [
  {
    id: 'private-key-floor',
    floor: 'high',
    when: (f) => f.detectedType === 'pem-private-key',
  },
  {
    id: 'cloud-cred-prod-floor',
    floor: 'high',
    when: (f) =>
      ['aws-access-key', 'aws-secret-key', 'cloud-key'].includes(f.detectedType) &&
      f.isProdPath &&
      f.isConfigFile,
  },
  {
    id: 'public-critical-floor',
    floor: 'critical',
    when: (f) =>
      f.isPubliclyAccessible &&
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

  return { score, triggered, guardrailFloor };
}
