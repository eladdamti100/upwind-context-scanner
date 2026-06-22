// scoring.ts — pure scoring functions for SignalLens
// No React/side effects. All inputs are typed, no full secrets.

import type { AccessScope, ActivitySignal, Exposure, Finding } from '../types';
import { typeSeverity } from './classify';

// ---- accessScore ------------------------------------------------------------
export const accessScore = (a: AccessScope): number => {
  switch (a) {
    case 'public':     return 100;
    case 'broad':      return 80;
    case 'internal':   return 50;
    case 'restricted': return 20;
    default:           return 50;
  }
};

// ---- exposureScore ----------------------------------------------------------
export const exposureScore = (e: Exposure): number => {
  switch (e) {
    case 'Public':           return 100;
    case 'Internet-facing':  return 90;
    case 'Internal':         return 65;
    case 'Private dev/test': return 30;
    case 'Docs-only':        return 10;
    default:                 return 50;
  }
};

// ---- activityScore ----------------------------------------------------------
export const activityScore = (s: ActivitySignal): number => {
  switch (s) {
    case 'high':    return 100;
    case 'medium':  return 60;
    case 'low':     return 25;
    case 'unknown': return 40;
    default:        return 40;
  }
};

// ---- authenticityScore ------------------------------------------------------
const normDet = (det: number) => Math.max(0, Math.min(1, 0.5 + det / 50));

export const authenticityScore = (regex: number, det: number, lgbm: number): number =>
  Math.round(100 * (0.25 * regex + 0.35 * normDet(det) + 0.40 * lgbm));

// ---- remediationPriority ----------------------------------------------------
// Gated by authenticity so false positives rank low.
export const remediationPriority = (
  authenticity: number,
  a: AccessScope,
  e: Exposure,
  detectedType: string,
  activity: ActivitySignal,
): number =>
  Math.round(
    (authenticity / 100) *
      (0.30 * accessScore(a) +
        0.30 * exposureScore(e) +
        0.25 * typeSeverity(detectedType) +
        0.15 * activityScore(activity)),
  );

// ---- buildBreakdown ---------------------------------------------------------
export function buildBreakdown(
  f: Finding,
): { label: string; value: string; width: string; color: string }[] {
  const s = f.scores;
  const det = s.deterministicRules;
  const absDetWidth = Math.min(100, Math.abs(det) * 2.2);

  return [
    {
      label: 'Regex confidence',
      value: s.regexConfidence.toFixed(2),
      width: `${Math.round(s.regexConfidence * 100)}%`,
      color: 'var(--uw-blue-03)',
    },
    {
      label: 'Deterministic rules',
      value: det >= 0 ? `+${det}` : `${det}`,
      width: `${Math.round(absDetWidth)}%`,
      color: det < 0 ? 'var(--severity-safe)' : 'var(--severity-high)',
    },
    {
      label: 'LightGBM probability',
      value: s.lgbmProbability.toFixed(2),
      width: `${Math.round(s.lgbmProbability * 100)}%`,
      color: 'var(--uw-royal-purple-02)',
    },
    {
      label: 'Authenticity score',
      value: String(s.authenticityScore),
      width: `${s.authenticityScore}%`,
      color: 'var(--text-primary)',
    },
    {
      label: 'Remediation priority',
      value: String(s.remediationPriority),
      width: `${s.remediationPriority}%`,
      color: 'var(--text-primary)',
    },
  ];
}
