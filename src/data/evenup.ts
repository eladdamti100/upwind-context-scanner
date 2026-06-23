// ============================================================================
// evenup.ts — adapter that maps the evenup dataset through the SignalLens
// pipeline to produce typed UI records.
//
// INVARIANT: only MASKED values are stored/passed downstream. All raw_value
// fields are absent from the input JSON; masked_value already contains
// glyphs (e.g. "E****", "claims@****************").
// ============================================================================
/// <reference types="vite/client" />

import type {
  Finding,
  ClassificationRow,
  ClassificationDetail,
  MapAsset,
  MapFlowEdge,
  ExternalAiNode,
  Priority,
  Vertical,
  Exposure,
  AccessScope,
  ValidationStatus,
  AssetCriticality,
  FindingContextObject,
  Sensitivity,
} from '../types';
import { extractFeatures, buildCorpusStats } from '../lib/features';
import { evaluateRules } from '../lib/rules';
import { mockLightGBM } from '../lib/lgbm';
import {
  authenticityScore,
  accessScore,
  exposureScore,
  activityScore,
  remediationPriority,
} from '../lib/scoring';
import { typeSeverity } from '../lib/classify';
import { band, priorityRank } from '../lib/priority';

import rawFindings from './evenup/findings.json';
import rawAssets from './evenup/assets.json';

// ---- Raw types ---------------------------------------------------------------

interface RawFinding {
  finding_id: string;
  file: {
    file_name: string;
    file_path: string;
    file_extension: string;
    file_role: string;
    storage_location: string;
  };
  candidate: {
    detected_type: string;
    masked_value: string;
    value_prefix: string;
    value_suffix: string;
    value_length: number;
    entropy: number;
    entropy_level: 'low' | 'medium' | 'high';
    line_number: number;
    variable_name: string;
  };
  regex: {
    rule_id: string;
    rule_source: string;
    regex_confidence: 'high' | 'medium' | 'low';
  };
  signals?: {
    structurally_valid?: boolean;
    luhn_valid?: boolean;
    format_valid_for_type?: boolean;
    is_known_test_value?: boolean;
    is_public_by_design?: boolean;
    is_already_masked?: boolean;
    is_high_entropy_sha?: boolean;
  };
  local_context: {
    line_text_masked: string;
  };
  scan_metadata: {
    sensitivity_mode: string;
    customer_vertical: string;
    enabled_rule_packs: string[];
  };
  ground_truth: {
    label: string;
    classification: string;
    is_secret: boolean;
    is_sensitive: boolean;
    validation: string;
    asset_id: string;
    storage_exposure: string;
    asset_criticality: string;
    is_publicly_accessible: boolean;
  };
}

interface RawAsset {
  asset_id: string;
  client: string;
  type: string;
  storage_exposure: string;
  asset_criticality: string;
  is_publicly_accessible: boolean;
  cloud_provider: string;
  service_context: string;
}

const RAW = rawFindings as unknown as RawFinding[];
const RAW_ASSETS = rawAssets as unknown as RawAsset[];

// ---- Offline SLM predictions (DSPM Semantic Guardrail) ----------------------
// The async SLM layer (src/lib/lgbm.ts) runs offline via scripts/enrich-slm.ts
// and writes DB/slm-predictions.json. The live (synchronous) pipeline reads
// those verdicts here and uses the SLM's secret_probability in place of the
// mock LightGBM probability when a prediction exists for a finding.
//
// DB/ is gitignored generator output, so we load it DEFENSIVELY with
// import.meta.glob: when the file is absent (fresh checkout / CI), the glob
// resolves to an empty map and every finding falls back to the mock — the build
// never breaks and live scoring is unchanged.
interface SlmPredictionRow {
  finding_id: string;
  secret_probability: number;
  model_classification: string;
  reason: string;
  model: string;
}
const slmPredictionModules = import.meta.glob<{ default: SlmPredictionRow[] }>(
  '../../DB/slm-predictions.json',
  { eager: true },
);
const SLM_PREDICTIONS: Record<string, SlmPredictionRow> = (() => {
  const map: Record<string, SlmPredictionRow> = {};
  for (const mod of Object.values(slmPredictionModules)) {
    for (const row of mod.default ?? []) map[row.finding_id] = row;
  }
  return map;
})();

// ---- Mapping helpers ---------------------------------------------------------

const REGEX_NUM: Record<string, number> = { high: 0.95, medium: 0.8, low: 0.6 };
const regexNum = (r: string): number => REGEX_NUM[r] ?? 0.7;

const toVertical = (v: string): Vertical =>
  ({'fintech-legal-hybrid': 'fintech'} as Record<string, Vertical>)[v] ?? 'general';

const toExposure = (raw: string): Exposure =>
  ({
    public: 'Public',
    internet: 'Internet-facing',
    shared: 'Public',
    internal: 'Internal',
  } as Record<string, Exposure>)[raw] ?? 'Internal';

const toAccessScope = (gt: RawFinding['ground_truth']): AccessScope => {
  if (!gt.is_publicly_accessible) {
    return gt.storage_exposure === 'internal' ? 'internal' : 'restricted';
  }
  return ({
    public: 'public',
    shared: 'broad',
    internet: 'broad',
  } as Record<string, AccessScope>)[gt.storage_exposure] ?? 'broad';
};

const toValidation = (raw: string): ValidationStatus =>
  raw.replace(/_/g, '-') as ValidationStatus;

const toCriticality = (raw: string): AssetCriticality =>
  ({
    critical: 'High',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  } as Record<string, AssetCriticality>)[raw] ?? 'Medium';

const toCloud = (provider: string): string =>
  ({
    aws: 'AWS',
    gcp: 'GCP',
    azure: 'Azure',
    github: 'GitHub',
  } as Record<string, string>)[provider] ?? provider.toUpperCase();

const toKind = (type: string): string =>
  ({
    bucket: 'S3 bucket',
    workload: 'Workload',
    repo: 'Repository',
    host: 'Host',
  } as Record<string, string>)[type] ?? 'Asset';

// Canonical kebab-case detected type
const toDetectedType = (
  gt: RawFinding['ground_truth'],
  candidate: RawFinding['candidate'],
): string => {
  if (gt.classification && gt.classification.length > 0) return gt.classification;
  return candidate.detected_type.replace(/_/g, '-');
};

// Human-readable display name for a detected type
const NAME_MAP: Record<string, string> = {
  ssn: 'SSN',
  iban: 'IBAN',
  npi: 'NPI',
  ein: 'EIN',
  jwt: 'JWT',
  'aws-access-key-id': 'AWS Access Key ID',
  'aws-secret-access-key': 'AWS Secret Key',
  'stripe-live-key': 'Stripe Secret Key',
  'credit-card-pan': 'Credit Card (PAN)',
  'db-connection-string': 'Database Connection String',
  'docusign-token': 'DocuSign Token',
  'medical-record-number': 'Medical Record Number',
  'insurance-member-id': 'Insurance Member ID',
  'aba-routing': 'ABA Routing',
  'drivers-license': "Driver's License",
  passport: 'Passport',
  salary: 'Salary',
};

function titleCase(s: string): string {
  return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const toDisplayName = (detectedType: string, rawCandidateType: string): string => {
  const key = detectedType || rawCandidateType.replace(/_/g, '-');
  return NAME_MAP[key] ?? titleCase(key);
};

const toCategory = (detected_type: string, label: string): Finding['category'] => {
  if (['placeholder', 'documentation_example'].includes(label)) return 'Documentation Example';
  if (label === 'false_positive') return 'False Positive Pattern';
  return ({
    phi: 'Healthcare',
    pii: 'PII',
    email: 'PII',
    credit_card: 'PCI',
    financial: 'Fintech',
    payment_secret: 'Fintech',
    api_key: 'Secret',
    cloud_key: 'Secret',
    database_password: 'Secret',
  } as Record<string, Finding['category']>)[detected_type] ?? 'Secret';
};

// ---- Asset lookup -----------------------------------------------------------

const ASSET_MAP: Record<string, RawAsset> = {};
for (const a of RAW_ASSETS) {
  ASSET_MAP[a.asset_id] = a;
}

// ---- Build FINDINGS ---------------------------------------------------------

// Build the masked FindingContextObject (camelCase) from a raw record. Hoisted
// so the full set of contexts can be assembled once before scoring — that lets
// us compute repo-wide pattern frequency (buildCorpusStats) across every
// candidate and thread it back into per-finding feature extraction.
function buildContext(raw: RawFinding): FindingContextObject {
  const { file, candidate, regex, local_context, scan_metadata } = raw;
  return {
    findingId: raw.finding_id,
    file: {
      fileName: file.file_name,
      filePath: file.file_path,
      fileExtension: file.file_extension,
      fileRole: file.file_role,
      storageLocation: file.storage_location,
    },
    candidate: {
      detectedType: candidate.detected_type,
      maskedValue: candidate.masked_value,
      valuePrefix: candidate.value_prefix,
      valueSuffix: candidate.value_suffix,
      valueLength: candidate.value_length,
      entropy: candidate.entropy,
      entropyLevel: candidate.entropy_level,
      lineNumber: candidate.line_number,
      offset: 0,
      variableName: candidate.variable_name,
    },
    regex: {
      ruleId: regex.rule_id,
      ruleSource: regex.rule_source,
      regexConfidence: regexNum(regex.regex_confidence),
    },
    localContext: {
      lineTextMasked: local_context.line_text_masked,
      previousLinesMasked: [],
      nextLinesMasked: [],
    },
    scanMetadata: {
      sensitivityMode: (scan_metadata.sensitivity_mode || 'balanced') as Sensitivity,
      customerVertical: toVertical(scan_metadata.customer_vertical),
      enabledRulePacks: scan_metadata.enabled_rule_packs,
    },
    // Bridge the Go-computed structural verdicts (signals-bridge). These are the
    // authoritative source for the DomainRulesAgent; masked-value heuristics in
    // extractFeatures are only a fallback when a field is absent.
    signals: raw.signals
      ? {
          structurallyValid: raw.signals.structurally_valid ?? true,
          luhnValid: raw.signals.luhn_valid,
          formatValidForType: raw.signals.format_valid_for_type,
          isKnownTestValue: raw.signals.is_known_test_value,
          isPublicByDesign: raw.signals.is_public_by_design,
          isAlreadyMasked: raw.signals.is_already_masked,
          isHighEntropySha: raw.signals.is_high_entropy_sha,
        }
      : undefined,
  };
}

// Assemble every masked context once, then compute the global structural-pattern
// frequency map across the whole corpus. Threaded into extractFeatures below so
// the frequency/pattern features are active on the live dashboard path.
const CONTEXTS: FindingContextObject[] = RAW.map(buildContext);
const CORPUS_STATS = buildCorpusStats(CONTEXTS);

export const FINDINGS: Finding[] = RAW.map((raw, i) => {
  const { file, candidate, regex, scan_metadata, ground_truth: gt } = raw;

  const vertical = toVertical(scan_metadata.customer_vertical);
  const regexConf = regexNum(regex.regex_confidence);
  const detectedType = toDetectedType(gt, candidate);
  const displayName = toDisplayName(detectedType, candidate.detected_type);
  const category = toCategory(candidate.detected_type, gt.label);

  // Look up asset
  const asset = ASSET_MAP[gt.asset_id];
  const assetCtx = {
    storageExposure: toExposure(asset?.storage_exposure ?? gt.storage_exposure),
    assetCriticality: toCriticality(asset?.asset_criticality ?? gt.asset_criticality),
    cloudProvider: toCloud(asset?.cloud_provider ?? 'aws'),
  };

  // Masked context assembled above; reuse it so feature extraction sees the
  // same object that fed the corpus-frequency map.
  const ctx = CONTEXTS[i];

  // Run pipeline
  const features = extractFeatures(ctx, assetCtx, CORPUS_STATS);
  const rules = evaluateRules(features);
  const lgbm = mockLightGBM.predict(features);
  const acc = toAccessScope(gt);
  const exp = toExposure(gt.storage_exposure);

  // Model probability: prefer the offline SLM verdict when one exists for this
  // finding, otherwise fall back to the deterministic mock LightGBM. (With no
  // SLM endpoint configured the offline run uses the same scorer as the mock,
  // so this is a no-op until a real local SLM produces non-mock probabilities.)
  const slmPred = SLM_PREDICTIONS[raw.finding_id];
  const modelProbability = slmPred ? slmPred.secret_probability : lgbm.secretProbability;

  // A fired guardrail means a real, well-formed credential → it is floored and
  // NEVER suppressed (recall guard). Otherwise the DomainRulesAgent's structural
  // hard-suppress applies.
  const guardrailWins = rules.guardrailFloor !== undefined;
  const applySuppress = Boolean(rules.suppress) && !guardrailWins;

  // Authenticity = P(real secret). A definitive structural/public/known-test
  // suppression collapses it toward zero so every downstream consumer — the
  // remediation score, the priority band, AND the exported probability the
  // evaluation thresholds — reflects "this cannot be a real secret".
  let authenticity = authenticityScore(regexConf, rules.score, modelProbability);
  if (applySuppress) authenticity = Math.min(authenticity, 3);
  const remediation = remediationPriority(authenticity, acc, exp, detectedType, 'unknown');

  const bandP = band(remediation);
  let basePriority: Priority;
  if (guardrailWins) {
    basePriority =
      priorityRank(rules.guardrailFloor!) > priorityRank(bandP) ? rules.guardrailFloor! : bandP;
  } else if (applySuppress) {
    basePriority = 'suppressed';
  } else {
    basePriority = bandP;
  }

  const suppressedByAgent = applySuppress && basePriority === 'suppressed';
  const isFalsePositive =
    suppressedByAgent ||
    ['false_positive', 'placeholder', 'documentation_example', 'test_value'].includes(gt.label);

  const file_role = file.file_role;
  const criticality = toCriticality(gt.asset_criticality);

  const explanation = suppressedByAgent
    ? `Suppressed by DomainRulesAgent — ${rules.suppressReason ?? 'failed structural/semantic validation'} (${displayName} in a ${file_role} context).`
    : isFalsePositive
    ? `Likely ${gt.label.replace(/_/g, ' ')}: ${displayName} in a ${file_role} context.`
    : `${displayName} detected in a ${file_role} (${exp} exposure, ${criticality} asset).`;

  return {
    id: i + 1,
    basePriority,
    detectedType,
    maskedValue: candidate.masked_value,
    classification: displayName,
    category,
    customerVertical: vertical,
    risk: remediation,
    validation: toValidation(gt.validation),
    file: file.file_name,
    path: file.file_path,
    asset: gt.asset_id,
    assetKind: toKind(asset?.type ?? 'repo'),
    environment: features.environmentHint,
    cloud: toCloud(asset?.cloud_provider ?? 'aws'),
    owner: 'Unassigned',
    createdAt: 'Current scan',
    line: candidate.line_number,
    offset: 0,
    exposure: exp,
    assetCriticality: criticality,
    accessScope: acc,
    activity: 'unknown',
    scores: {
      regexConfidence: regexConf,
      deterministicRules: rules.score,
      // The model probability actually fed into authenticity — the SLM verdict
      // when present, else the mock LightGBM probability.
      lgbmProbability: modelProbability,
      authenticityScore: authenticity,
      accessScore: accessScore(acc),
      exposureScore: exposureScore(exp),
      secretTypeSeverity: typeSeverity(detectedType),
      activityScore: activityScore('unknown'),
      remediationPriority: remediation,
    },
    riskUpReasons: rules.triggered
      .filter(t => t.direction === 'increase')
      .map(t => t.label),
    // Deterministic decrease rules, plus the SLM's own reason when it judged the
    // candidate to be a non-secret — so any SLM-driven downgrade is explained in
    // the UI alongside the rule-based reasons.
    riskDownReasons: [
      ...rules.triggered.filter(t => t.direction === 'decrease').map(t => t.label),
      ...(slmPred && slmPred.model_classification !== 'true_secret'
        ? [`SLM (${slmPred.model_classification.replace(/_/g, ' ')}): ${slmPred.reason}`]
        : []),
    ],
    explanation,
    isFalsePositive,
    suppressedByAgent,
    suppressReason: suppressedByAgent ? rules.suppressReason : undefined,
  } satisfies Finding;
});

// ---- Build CLASSIFICATIONS --------------------------------------------------

export const CLASSIFICATIONS: ClassificationRow[] = (() => {
  // Group findings by classification (display name)
  const groups: Record<string, Finding[]> = {};
  for (const f of FINDINGS) {
    if (!groups[f.classification]) groups[f.classification] = [];
    groups[f.classification].push(f);
  }

  return Object.entries(groups)
    .map(([name, findings]) => {
      const critical = findings.filter(f => f.basePriority === 'critical').length;
      const fpCount = findings.filter(f => f.isFalsePositive).length;
      const fpReductionPct = Math.round((100 * fpCount) / findings.length);
      const first = findings[0];
      return {
        id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        name,
        category: first.category,
        patterns: 1,
        rulePacks: 'base',
        findings: findings.length,
        critical,
        fpReductionPct,
        createdBy: 'Upwind',
        enabled: true,
      } satisfies ClassificationRow;
    })
    .sort((a, b) => b.findings - a.findings);
})();

// Category-based detail templates. These describe how a category is detected and
// scored in plain, truthful language (no fabricated regex). The per-classification
// risk signals are derived from the real pipeline reasons below and only fall
// back to these template lists when a group produced no reasons.
interface CategoryDetail {
  blurb: string;
  detection: string;
  guardrail: string;
  up: string[];
  down: string[];
}

const CATEGORY_DETAIL_DEFAULT: CategoryDetail = {
  blurb: 'sensitive-data candidates surfaced by the scanner.',
  detection:
    'Matched by the base sensitive-data profile, then scored by the context-aware pipeline (path, variable name, entropy, exposure, asset criticality).',
  guardrail: 'Documentation and test matches are capped at Low unless validated active.',
  up: ['Production or runtime path', 'High-risk exposure'],
  down: ['Documentation or test path', 'Placeholder or example value'],
};

const CATEGORY_DETAIL: Record<string, CategoryDetail> = {
  Secret: {
    blurb: 'credentials and API tokens that grant direct system access if leaked.',
    detection:
      'Matched by the base secret-detection profile, then scored by the context-aware pipeline (path, variable name, entropy, exposure).',
    guardrail:
      'Secrets in production or internet-facing paths are never auto-suppressed; documentation and test matches are capped at Low unless validated active.',
    up: ['Production or runtime path', 'Secret-like variable name', 'High-entropy value', 'Public or internet-facing exposure'],
    down: ['Documentation or test path', 'Placeholder or example language', 'Known sample value'],
  },
  Fintech: {
    blurb: 'payment-provider keys and financial credentials (Stripe, PayPal, Plaid, banking).',
    detection:
      'Matched by the Fintech rule pack and validated for provider key shape, then context-scored.',
    guardrail: 'Live payment keys in production configs are floored to High; sandbox/test keys are downgraded.',
    up: ['Production service configuration', 'Live payment-provider key prefix', 'Internet-facing asset'],
    down: ['Sandbox or test key prefix', 'Example or placeholder value'],
  },
  PCI: {
    blurb: 'cardholder data such as primary account numbers (PAN).',
    detection: 'Matched by card-number patterns and a Luhn/structure check, then context-scored.',
    guardrail: 'Values failing the Luhn/structure check are treated as non-card identifiers and suppressed.',
    up: ['Structurally valid card number', 'Stored in an exported or shared location'],
    down: ['Fails Luhn / structure check', 'Known test card number'],
  },
  Healthcare: {
    blurb: 'protected health information such as medical-record and insurance identifiers.',
    detection: 'Matched by healthcare identifier patterns and format validation, then context-scored.',
    guardrail: 'Identifiers in documentation dictionaries or with invalid formats are suppressed.',
    up: ['Valid identifier format', 'Stored with patient context'],
    down: ['Documentation dictionary or mapping file', 'Invalid format for the claimed type'],
  },
  PII: {
    blurb: 'personally identifiable information such as SSNs, emails, and government IDs.',
    detection: 'Matched by PII patterns and range/format checks, then context-scored.',
    guardrail: 'Out-of-range or placeholder identities are suppressed; synthetic test PII is downgraded.',
    up: ['Valid identifier range/format', 'Real-looking record context'],
    down: ['Placeholder identity (e.g. sample names)', 'Out-of-range or synthetic value'],
  },
  SaaS: {
    blurb: 'SaaS application tokens and integration credentials.',
    detection: 'Matched by SaaS token patterns, then scored by the context-aware pipeline.',
    guardrail: 'Tokens in test or sample paths are capped at Low unless validated active.',
    up: ['Production or runtime path', 'Token-shaped high-entropy value'],
    down: ['Test or sample path', 'Placeholder language'],
  },
  Retail: {
    blurb: 'retail and commerce credentials and customer data.',
    detection: 'Matched by the retail rule pack, then context-scored.',
    guardrail: 'Sample catalog or test data is downgraded.',
    up: ['Production path', 'Customer-data context'],
    down: ['Sample/catalog data', 'Test fixture'],
  },
  'Documentation Example': {
    blurb: 'secret-shaped values that appear inside documentation and examples.',
    detection: 'Identified as documentation/example context by path and surrounding placeholder language.',
    guardrail: 'Capped at Low — surfaced for awareness, not treated as live secrets.',
    up: ['Referenced from a non-doc runtime path'],
    down: ['Documentation or README path', 'Example or placeholder language'],
  },
  'False Positive Pattern': {
    blurb: 'regex matches that are not real secrets (IDs, hashes, structural tokens).',
    detection:
      'Flagged by structural and semantic checks (checksum, public-by-design, known-test) that a regex-only scanner cannot make.',
    guardrail: 'Suppressed by the DomainRules agent when proven non-secret; never blocks triage.',
    up: ['Unexpected production exposure'],
    down: ['Fails structural/semantic validation', 'Public-by-design or known test value'],
  },
  'Test Value': {
    blurb: 'intentional test and sandbox values.',
    detection: 'Identified as test/fixture context by path and known sandbox values.',
    guardrail: 'Downgraded to Low; excluded from critical alerting.',
    up: ['Used outside test scope'],
    down: ['Test or fixture path', 'Known sandbox value'],
  },
};

// topReasons returns the most frequent distinct reasons across a group.
function topReasons(reasons: string[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const r of reasons) freq.set(r, (freq.get(r) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
}

export function classificationDetail(c: ClassificationRow): ClassificationDetail {
  const t = CATEGORY_DETAIL[c.category] ?? CATEGORY_DETAIL_DEFAULT;
  const group = FINDINGS.filter(f => f.classification === c.name);
  // Prefer the real, pipeline-derived per-finding reasons for this classification;
  // fall back to the category template only when the group produced none.
  const up = topReasons(group.flatMap(f => f.riskUpReasons), 4);
  const down = topReasons(group.flatMap(f => f.riskDownReasons), 3);
  return {
    description: `${c.name} — ${t.blurb}`,
    detectionNote: t.detection,
    up: up.length ? up : t.up,
    down: down.length ? down : t.down,
    guardrail: t.guardrail,
  };
}

// ---- Build MAP_ASSETS -------------------------------------------------------

// Layout positions — spread 7 real assets + OpenAI across the canvas
const POSITIONS: { xPct: number; yPct: number }[] = [
  { xPct: 16, yPct: 25 },
  { xPct: 35, yPct: 55 },
  { xPct: 55, yPct: 20 },
  { xPct: 70, yPct: 55 },
  { xPct: 25, yPct: 75 },
  { xPct: 50, yPct: 75 },
  { xPct: 75, yPct: 75 },
];

// Build a map from asset_id → its findings
const findingsByAsset: Record<string, Finding[]> = {};
for (const f of FINDINGS) {
  if (!findingsByAsset[f.asset]) findingsByAsset[f.asset] = [];
  findingsByAsset[f.asset].push(f);
}

export const MAP_ASSETS: Record<string, MapAsset> = (() => {
  const result: Record<string, MapAsset> = {};
  let posIdx = 0;

  for (const rawAsset of RAW_ASSETS) {
    const assetFindings = findingsByAsset[rawAsset.asset_id] ?? [];
    if (assetFindings.length === 0) continue; // skip assets with no findings

    const highestPriority: Priority = assetFindings.reduce<Priority>((best, f) => {
      return priorityRank(f.basePriority) > priorityRank(best) ? f.basePriority : best;
    }, 'suppressed');

    const validatedActive = assetFindings.filter(
      f => f.validation === 'validated-active',
    ).length;
    const validationSummary =
      validatedActive > 0 ? `${validatedActive} validated active` : 'Not validated';

    const exp = toExposure(rawAsset.storage_exposure);
    const environment: MapAsset['environment'] =
      rawAsset.service_context.includes('prod') ||
      ['public', 'internet', 'shared'].includes(rawAsset.storage_exposure)
        ? 'Production'
        : 'Dev';

    const topFindings = assetFindings
      .slice(0, 6)
      .map(f => ({
        detectedType: f.detectedType,
        priority: f.basePriority,
        validation: f.validation
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
      }));

    result[rawAsset.asset_id] = {
      key: rawAsset.asset_id,
      name: rawAsset.asset_id,
      cloud: toCloud(rawAsset.cloud_provider),
      kind: toKind(rawAsset.type),
      exposure: exp,
      environment,
      assetCriticality: toCriticality(rawAsset.asset_criticality),
      highestSeverity: highestPriority,
      validationSummary,
      findings: topFindings,
      position: POSITIONS[posIdx % POSITIONS.length],
      edges: [],
    };
    posIdx++;
  }

  return result;
})();

// ---- MAP_FLOWS and EXTERNAL_AI_NODES ----------------------------------------
// Illustrative supplements — the evenup dataset models static (on-asset) exposures only.

// Pick the first two real asset keys for an illustrative flow
const realAssetKeys = Object.keys(MAP_ASSETS);
const flowFrom = realAssetKeys[0] ?? 'evenup-legal-backups';
const flowTo = realAssetKeys[1] ?? 'evenup-claims-exports';

export const MAP_FLOWS: MapFlowEdge[] = [
  {
    id: 'flow-evenup-1',
    fromKey: flowFrom,
    toKey: flowTo,
    protocol: 'service-to-service',
    findings: [
      {
        detectedType: FINDINGS.find(f => f.asset === flowFrom)?.detectedType ?? 'api-key',
        priority: MAP_ASSETS[flowFrom]?.highestSeverity ?? 'medium',
        validation: 'Not Validated',
        locationType: 'flow',
      },
    ],
  },
  {
    id: 'flow-evenup-ai',
    fromKey: flowFrom,
    toKey: 'openai',
    protocol: 'AI API call',
    findings: [
      {
        detectedType: 'api-key',
        priority: 'high',
        validation: 'Unsupported',
        locationType: 'external_ai',
      },
    ],
  },
];

export const EXTERNAL_AI_NODES: ExternalAiNode[] = [
  {
    key: 'openai',
    provider: 'OpenAI',
    position: { xPct: 88, yPct: 12 },
    findings: [
      {
        detectedType: 'api-key',
        priority: 'high',
        validation: 'Unsupported',
        locationType: 'external_ai',
      },
    ],
  },
];
