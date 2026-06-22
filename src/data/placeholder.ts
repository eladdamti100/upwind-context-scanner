// ============================================================================
// TEMPORARY DEMO SEED DATA — replace when the real mock dataset lands.
// ----------------------------------------------------------------------------
// - All secret values are MASKED only (never a full secret).
// - Small, isolated, and shaped to the domain types so it can be swapped out
//   by pointing the app at the real `data/` modules later.
// - Covers the demo narrative: real critical secrets + clear false positives.
// ============================================================================
import type { Finding, ClassificationRow, ClassificationDetail, MapAsset, MapFlowEdge, ExternalAiNode, SuggestedRule } from '../types';

export const FINDINGS: Finding[] = [
  {
    id: 1, basePriority: 'critical', detectedType: 'aws-access-key', maskedValue: 'AKIA••••••••5T2Q',
    classification: 'AWS Access Key', category: 'Secret', customerVertical: 'fintech',
    risk: 96, validation: 'validated-active', file: '.env.production', path: '/srv/payments/.env.production',
    asset: 'customer-prod-bucket', assetKind: 'S3 bucket', environment: 'Production', cloud: 'AWS',
    owner: 'Maya Rosen', createdAt: 'Jun 3, 2026', line: 42, offset: 8, exposure: 'Public',
    assetCriticality: 'High', accessScope: 'public', activity: 'high',
    scores: { regexConfidence: 0.98, deterministicRules: 24, lgbmProbability: 0.96, authenticityScore: 97,
      accessScore: 100, exposureScore: 100, secretTypeSeverity: 95, activityScore: 100, remediationPriority: 96 },
    riskUpReasons: ['Production file path', 'Secret-like variable name (AWS_SECRET_ACCESS_KEY)',
      'High entropy value', 'Storage asset publicly accessible', 'Validated active credential'],
    riskDownReasons: [],
    explanation: 'Critical finding: AWS Access Key in a production configuration file. High entropy, secret-like variable name, production path, and a publicly accessible storage asset.',
  },
  {
    id: 2, basePriority: 'high', detectedType: 'stripe-secret-key', maskedValue: 'sk_live_••••4f7a',
    classification: 'Stripe Secret Key', category: 'Fintech', customerVertical: 'fintech',
    risk: 84, validation: 'not-validated', file: 'payment.config.yaml', path: '/payment-service/config/payment.config.yaml',
    asset: 'payment-service', assetKind: 'Service', environment: 'Production', cloud: 'AWS',
    owner: 'Daniel Cohen', createdAt: 'Jun 4, 2026', line: 18, offset: 14, exposure: 'Internet-facing',
    assetCriticality: 'High', accessScope: 'broad', activity: 'medium',
    scores: { regexConfidence: 0.95, deterministicRules: 16, lgbmProbability: 0.91, authenticityScore: 88,
      accessScore: 80, exposureScore: 90, secretTypeSeverity: 85, activityScore: 60, remediationPriority: 78 },
    riskUpReasons: ['Live Stripe key prefix (sk_live_)', 'Production service config', 'Internet-facing workload'],
    riskDownReasons: [],
    explanation: 'High-risk: a live Stripe secret key in a production payment service config on an internet-facing workload.',
  },
  {
    id: 3, basePriority: 'high', detectedType: 'github-token', maskedValue: 'ghp_••••••9kQ2',
    classification: 'GitHub Token', category: 'Secret', customerVertical: 'saas',
    risk: 81, validation: 'validated-active', file: 'deploy.yml', path: '/.github/workflows/deploy.yml',
    asset: 'checkout-api', assetKind: 'Repository', environment: 'Production', cloud: 'GCP',
    owner: 'Ava Klein', createdAt: 'Jun 5, 2026', line: 27, offset: 21, exposure: 'Internal',
    assetCriticality: 'Medium', accessScope: 'internal', activity: 'high',
    scores: { regexConfidence: 0.97, deterministicRules: 14, lgbmProbability: 0.89, authenticityScore: 90,
      accessScore: 50, exposureScore: 65, secretTypeSeverity: 80, activityScore: 100, remediationPriority: 70 },
    riskUpReasons: ['Valid GitHub PAT prefix (ghp_)', 'Committed to a CI/CD workflow', 'Validated active token'],
    riskDownReasons: [],
    explanation: 'High-risk: an active GitHub token in a CI/CD workflow file, validated active with repository scope.',
  },
  {
    id: 4, basePriority: 'high', detectedType: 'database-password', maskedValue: '••••••••••••',
    classification: 'Database Password', category: 'Secret', customerVertical: 'general',
    risk: 74, validation: 'not-validated', file: 'docker-compose.yml', path: '/infra/docker-compose.yml',
    asset: 'azure-storage-acct', assetKind: 'Service', environment: 'Dev', cloud: 'Azure',
    owner: 'Daniel Cohen', createdAt: 'Jun 5, 2026', line: 19, offset: 16, exposure: 'Internal',
    assetCriticality: 'Medium', accessScope: 'internal', activity: 'low',
    scores: { regexConfidence: 0.80, deterministicRules: 10, lgbmProbability: 0.78, authenticityScore: 76,
      accessScore: 50, exposureScore: 65, secretTypeSeverity: 90, activityScore: 25, remediationPriority: 56 },
    riskUpReasons: ['Secret-like variable (POSTGRES_PASSWORD)', 'High entropy value'],
    riskDownReasons: ['Development compose file'],
    explanation: 'High-risk: a database password in a docker-compose file. Naming and entropy indicate a real credential, scoped to dev.',
  },
  {
    id: 5, basePriority: 'low', detectedType: 'generic-api-key', maskedValue: 'api_key_••••EXAMPLE',
    classification: 'Generic API Key', category: 'False Positive Pattern', customerVertical: 'general',
    risk: 28, validation: 'not-validated', file: 'README.md', path: '/docs/README.md',
    asset: 'docs-site', assetKind: 'Repository', environment: 'Docs', cloud: 'GCP',
    owner: 'Ava Klein', createdAt: 'Jun 6, 2026', line: 112, offset: 4, exposure: 'Docs-only',
    assetCriticality: 'Low', accessScope: 'restricted', activity: 'unknown', isFalsePositive: true,
    scores: { regexConfidence: 0.71, deterministicRules: -30, lgbmProbability: 0.12, authenticityScore: 24,
      accessScore: 20, exposureScore: 10, secretTypeSeverity: 65, activityScore: 40, remediationPriority: 8 },
    riskUpReasons: ['Matches a generic API key pattern'],
    riskDownReasons: ['Located in a documentation path', 'Surrounding text describes it as an example',
      'Placeholder-like value (EXAMPLE)'],
    explanation: 'Likely false positive: an API-key-looking value in README documentation, described as an example with a placeholder-like value.',
  },
  {
    id: 6, basePriority: 'suppressed', detectedType: 'test-card-number', maskedValue: '4111 •••• •••• 1111',
    classification: 'Test Card Number', category: 'PCI', customerVertical: 'fintech',
    risk: 12, validation: 'validation-unsupported', file: 'checkout.spec.ts', path: '/tests/checkout.spec.ts',
    asset: 'checkout-api', assetKind: 'Repository', environment: 'Test', cloud: 'GCP',
    owner: 'Liam Park', createdAt: 'Jun 6, 2026', line: 88, offset: 18, exposure: 'Internal',
    assetCriticality: 'Low', accessScope: 'restricted', activity: 'unknown', isFalsePositive: true,
    scores: { regexConfidence: 0.86, deterministicRules: -34, lgbmProbability: 0.08, authenticityScore: 18,
      accessScore: 20, exposureScore: 65, secretTypeSeverity: 30, activityScore: 40, remediationPriority: 7 },
    riskUpReasons: ['Matches a PCI card pattern'],
    riskDownReasons: ['Known test card number (4111…1111)', 'Located in a test spec'],
    explanation: 'Suppressed / test value: a well-known sandbox test card number in a test spec — not real cardholder data.',
  },
];

export const CLASSIFICATIONS: ClassificationRow[] = [
  { id: 'aws-access-key', name: 'AWS Access Key', category: 'Secret', patterns: 1, rulePacks: 'Cloud', findings: 790, critical: 24, fpReductionPct: 62, createdBy: 'Upwind', enabled: true },
  { id: 'stripe-secret-key', name: 'Stripe Secret Key', category: 'Fintech', patterns: 1, rulePacks: 'Fintech', findings: 12, critical: 4, fpReductionPct: 74, createdBy: 'Upwind', enabled: true },
  { id: 'github-token', name: 'GitHub Token', category: 'Secret', patterns: 2, rulePacks: 'SCM', findings: 54, critical: 6, fpReductionPct: 66, createdBy: 'Upwind', enabled: true },
  { id: 'database-password', name: 'Database Password', category: 'Secret', patterns: 4, rulePacks: 'Generic', findings: 233, critical: 12, fpReductionPct: 40, createdBy: 'Upwind', enabled: true },
  { id: 'placeholder-key', name: 'Placeholder API Key', category: 'False Positive Pattern', patterns: 1, rulePacks: 'Guardrails', findings: 4310, critical: 0, fpReductionPct: 98, createdBy: 'Upwind', enabled: true },
];

export function classificationDetail(c: ClassificationRow): ClassificationDetail {
  return {
    description: `${c.name} is a ${c.category.toLowerCase()} classification. Regex detects candidate matches; the context layer scores each one using path, variable name, entropy, exposure, asset criticality, and a LightGBM model to decide whether it is real, borderline, or a false positive.`,
    pattern: `/${c.id.replace(/-/g, '[-_]?')}[a-z0-9/+]{16,}/`,
    up: ['Production or runtime path', 'Secret-like variable name', 'High entropy value', 'Public or internet-facing exposure'],
    down: ['Documentation or test path', 'Example / placeholder language', 'Known sample value'],
    guardrail: 'Findings in documentation or test paths are capped at Low unless validated active.',
  };
}

export const MAP_ASSETS: Record<string, MapAsset> = {
  'customer-prod-bucket': {
    key: 'customer-prod-bucket', name: 'customer-prod-bucket', cloud: 'AWS', kind: 'S3 bucket',
    exposure: 'Public / Broad access', environment: 'Production', assetCriticality: 'High',
    highestSeverity: 'critical', validationSummary: '1 validated active',
    findings: [{ detectedType: 'aws-access-key', priority: 'critical', validation: 'Validated active' }],
    position: { xPct: 16, yPct: 60 }, edges: ['payment-service'],
  },
  'payment-service': {
    key: 'payment-service', name: 'payment-service', cloud: 'AWS', kind: 'Service',
    exposure: 'Internet-facing', environment: 'Production', assetCriticality: 'High',
    highestSeverity: 'high', validationSummary: '0 validated',
    findings: [{ detectedType: 'stripe-secret-key', priority: 'high', validation: 'Not validated' }],
    position: { xPct: 30, yPct: 8 }, edges: ['customer-prod-bucket'],
  },
  'checkout-api': {
    key: 'checkout-api', name: 'checkout-api', cloud: 'GCP', kind: 'Repository',
    exposure: 'Internal', environment: 'Production', assetCriticality: 'Medium',
    highestSeverity: 'high', validationSummary: '1 validated active',
    findings: [
      { detectedType: 'github-token', priority: 'high', validation: 'Validated active' },
      { detectedType: 'test-card-number', priority: 'suppressed', validation: 'Unsupported' },
    ],
    position: { xPct: 74, yPct: 40 }, edges: [],
  },
  'azure-storage-acct': {
    key: 'azure-storage-acct', name: 'azure-storage-acct', cloud: 'Azure', kind: 'Storage account',
    exposure: 'Internal', environment: 'Dev', assetCriticality: 'Medium',
    highestSeverity: 'high', validationSummary: 'Not validated',
    findings: [{ detectedType: 'database-password', priority: 'high', validation: 'Not validated' }],
    position: { xPct: 52, yPct: 46 }, edges: [],
  },
};

export const MAP_FLOWS: MapFlowEdge[] = [
  {
    id: 'flow-1',
    fromKey: 'payment-service',
    toKey: 'customer-prod-bucket',
    protocol: 'service-to-service',
    findings: [{ detectedType: 'stripe-secret-key', priority: 'high', validation: 'Not validated', locationType: 'flow' }],
  },
  {
    id: 'flow-ai',
    fromKey: 'checkout-api',
    toKey: 'openai',
    protocol: 'AI API call',
    findings: [{ detectedType: 'api-key', priority: 'high', validation: 'Unsupported', locationType: 'external_ai' }],
  },
];

export const EXTERNAL_AI_NODES: ExternalAiNode[] = [
  {
    key: 'openai',
    provider: 'OpenAI',
    position: { xPct: 88, yPct: 12 },
    findings: [{ detectedType: 'api-key', priority: 'high', validation: 'Unsupported', locationType: 'external_ai' }],
  },
];

export const SUGGESTED_RULES: SuggestedRule[] = [
  {
    id: 'sr-1',
    title: 'Suppress placeholder tokens in documentation',
    description: 'Automatically downgrade API-key-shaped values found in docs/README files with example or placeholder language.',
    reason: '4,310 findings matched a placeholder pattern in documentation paths over the last 30 days.',
    scope: 'Documentation paths',
    affectedFindingsCount: 4310,
    ruleType: 'customer-specific',
    status: 'suggested',
  },
  {
    id: 'sr-2',
    title: 'Raise severity for payment secrets in production configs',
    description: 'Increase priority for Stripe/PayPal/Plaid keys detected in production service configuration.',
    reason: 'Recurring high-impact fintech secrets observed in production config files.',
    scope: 'Fintech rule pack',
    affectedFindingsCount: 12,
    ruleType: 'vertical-specific',
    status: 'suggested',
  },
  {
    id: 'sr-3',
    title: 'Treat test-fixture secrets as low risk',
    description: 'Downgrade secrets located in test fixtures and spec files that match known sandbox values.',
    reason: '1,902 documentation/test example tokens were consistently dismissed by reviewers.',
    scope: 'Test paths',
    affectedFindingsCount: 1902,
    ruleType: 'customer-specific',
    status: 'suggested',
  },
];
