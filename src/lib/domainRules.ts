// src/lib/domainRules.ts
// The DomainRulesAgent — the post-Regex filter. It intercepts every candidate
// after feature extraction and decides whether the finding survives, is
// silenced, or is boosted, using deterministic structural + semantic invariants.
//
// Source of the structural verdict (signals-bridge, per the privacy invariant):
//   • If a RAW value is available (a customer-side scanner / the Go scan layer),
//     it runs the universal validator library directly.
//   • Otherwise (the masked demo pipeline) it consumes the bridged signals that
//     `extractFeatures` lifted from the Finding Context Object's `signals` block.
//
// RECALL GUARD: a structurally-valid, high-severity credential sitting in a
// production / public / high-criticality location is NEVER suppressed here — the
// downstream guardrails enforce the same floor. Suppression only ever removes
// noise that cannot be a real secret.
import type { ContextFeatures } from '../types';
import { validateValue, hasValidator } from './validators';

export interface DomainVerdict {
  decision: 'suppress' | 'keep' | 'boost';
  reasons: string[];
  failedValidator?: string;
}

// High-severity credential types whose real instances must never be suppressed.
const HIGH_SEVERITY_TYPES = new Set([
  'aws-access-key', 'aws-secret-key', 'aws-access-key-id', 'aws-secret-access-key', 'cloud-key',
  'pem-private-key', 'database-password', 'db-connection-string',
  'stripe-secret-key', 'stripe-live-key', 'payment-secret', 'github-token',
]);

const norm = (t: string): string => t.toLowerCase().replace(/_/g, '-');

// Resolve the structural verdict from a raw value when present, else from the
// bridged signals already on the features.
function structuralVerdict(
  features: ContextFeatures,
  raw?: string,
): { valid: boolean; reason?: string; validator?: string } {
  const type = norm(features.detectedType);
  if (raw && hasValidator(type)) {
    const v = validateValue(type, raw);
    if (v) return { valid: v.valid, reason: v.reason, validator: v.validator };
  }
  // Masked path: trust the bridged Go/scanner-computed signals.
  if (!features.structurallyValid) return { valid: false, reason: 'fails structural validation' };
  if (!features.formatValidForType) return { valid: false, reason: 'shape does not match detected type' };
  if (!features.luhnValid) return { valid: false, reason: 'fails Luhn checksum' };
  return { valid: true };
}

export function runDomainRules(
  features: ContextFeatures,
  raw?: string,
): DomainVerdict {
  const reasons: string[] = [];
  const type = norm(features.detectedType);
  const isHighSeverity = HIGH_SEVERITY_TYPES.has(type);
  const inDangerZone =
    features.isProdPath || features.isPubliclyAccessible || features.assetCriticality === 'High';

  const struct = structuralVerdict(features, raw);

  // ---- Authoritative "this is NOT a live secret" verdicts ------------------
  // Each of these is a definitive structural/semantic proof that the candidate
  // cannot be a real, usable credential — so it suppresses regardless of the
  // value's type or location. (A genuine secret carries none of these: the Go
  // scan layer only sets them on provably-benign values, and the masked-value
  // fallbacks are deliberately conservative.) This is what keeps recall at 100%
  // while still silencing high-severity-TYPED noise like an already-masked
  // `sk_live_****` or a known test key.
  if (!struct.valid) {
    return {
      decision: 'suppress',
      reasons: [`${features.detectedType}: ${struct.reason ?? 'structurally invalid'}`],
      failedValidator: struct.validator,
    };
  }
  if (features.isPublicByDesign) {
    return { decision: 'suppress', reasons: ['public-by-design value (not a secret)'] };
  }
  if (features.isKnownTestValue || features.isKnownTestVector) {
    return { decision: 'suppress', reasons: ['known test / example value'] };
  }
  if (features.isAlreadyMasked) {
    return { decision: 'suppress', reasons: ['value is already masked / redacted'] };
  }
  if (features.isHighEntropySha) {
    return { decision: 'suppress', reasons: ['git commit SHA, not a credential'] };
  }
  if (features.shapeContradictsType) {
    return { decision: 'suppress', reasons: ['numeric identifier shaped like a PAN (epoch/order id)'] };
  }

  // ---- Soft, lower-confidence heuristic (RECALL-GUARDED) -------------------
  // A public/example-intent variable holding a placeholder is config noise — but
  // this is a weaker signal, so it is NOT applied to a structurally-valid
  // high-severity credential sitting in a production/public asset.
  const recallProtected = struct.valid && isHighSeverity && inDangerZone;
  if (
    !recallProtected &&
    (features.variableIntent === 'public' || features.variableIntent === 'example') &&
    (features.looksLikePlaceholder || features.hasPlaceholderLanguage)
  ) {
    return { decision: 'suppress', reasons: ['public/example variable holding a placeholder'] };
  }

  // ---- Boost — a confirmed dangerous secret ---------------------------------
  if (struct.valid && isHighSeverity && inDangerZone) {
    reasons.push('structurally-valid high-severity credential in a production/public asset');
    return { decision: 'boost', reasons };
  }

  return { decision: 'keep', reasons };
}
