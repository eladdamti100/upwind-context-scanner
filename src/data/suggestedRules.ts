// suggestedRules.ts — static suggested rules for the SignalLens demo.
import type { SuggestedRule } from '../types';

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
