import type { Finding, Sensitivity, Priority } from '../types';

// Sensitivity does not change a finding's underlying scores — it shifts the
// effective priority band used for display and alerting (spec §14).
export function effPriority(f: Finding, s: Sensitivity): Priority {
  if (s === 'strict') return f.basePriority === 'suppressed' ? 'low' : f.basePriority;
  if (s === 'flexible') return f.basePriority === 'low' ? 'suppressed' : f.basePriority;
  return f.basePriority;
}

// Map a 0..100 risk score to a severity band.
export const band = (r: number): Priority =>
  r >= 90 ? 'critical' : r >= 70 ? 'high' : r >= 40 ? 'medium' : r >= 20 ? 'low' : 'suppressed';

// Numeric ordering for sorting by severity.
export const priorityRank = (p: Priority): number =>
  (({ critical: 5, high: 4, medium: 3, low: 2, info: 1, suppressed: 0 }) as Record<string, number>)[p] ?? 0;
