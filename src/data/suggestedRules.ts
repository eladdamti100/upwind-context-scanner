// suggestedRules.ts — suggested rules for the SignalLens demo.
// The affected-finding counts are DERIVED from the current scan (FINDINGS) so a
// suggestion never claims more findings than the corpus actually contains.
import type { Finding, SuggestedRule } from '../types';
import { FINDINGS } from './evenup';

const countWhere = (pred: (f: Finding) => boolean): number => FINDINGS.filter(pred).length;

// Placeholder/example tokens detected inside documentation.
const docPlaceholders = countWhere(f => f.category === 'Documentation Example');
// Live payment-provider secrets that landed in production configuration.
const paymentInProd = countWhere(f => f.category === 'Fintech' && f.environment === 'Production');
// Secret-shaped values sitting in test fixtures / spec files.
const testFixtures = countWhere(
  f =>
    f.isFalsePositive === true &&
    (f.environment === 'Test' ||
      /\/(tests?|spec|fixtures?)\//.test(f.path) ||
      /_test\.|\.spec\./.test(f.file)),
);

export const SUGGESTED_RULES: SuggestedRule[] = [
  {
    id: 'sr-1',
    title: 'Suppress placeholder tokens in documentation',
    description: 'Automatically downgrade API-key-shaped values found in docs/README files with example or placeholder language.',
    reason: 'Recurring placeholder tokens detected in documentation paths in the current scan.',
    scope: 'Documentation paths',
    affectedFindingsCount: docPlaceholders,
    ruleType: 'customer-specific',
    status: 'suggested',
  },
  {
    id: 'sr-2',
    title: 'Raise severity for payment secrets in production configs',
    description: 'Increase priority for Stripe/PayPal/Plaid keys detected in production service configuration.',
    reason: 'High-impact fintech secrets observed in production configuration files.',
    scope: 'Fintech rule pack',
    affectedFindingsCount: paymentInProd,
    ruleType: 'vertical-specific',
    status: 'suggested',
  },
  {
    id: 'sr-3',
    title: 'Treat test-fixture secrets as low risk',
    description: 'Downgrade secrets located in test fixtures and spec files that match known sandbox values.',
    reason: 'Test and fixture example tokens consistently dismissed by reviewers.',
    scope: 'Test paths',
    affectedFindingsCount: testFixtures,
    ruleType: 'customer-specific',
    status: 'suggested',
  },
];
