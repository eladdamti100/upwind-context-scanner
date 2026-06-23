// ============================================================================
// SignalLens domain model
// ----------------------------------------------------------------------------
// Pure type definitions for the context-aware sensitive-data classification
// pipeline + UI. No runtime logic lives here except small enum-like constants
// that need a single source of truth (verticals).
//
// INVARIANT: only MASKED secret values ever appear in these structures
// (`maskedValue`, `*Masked`). Full secrets are never stored, logged, or passed
// to the model.
// ============================================================================

// ---- Customer verticals -----------------------------------------------------
// Single source of truth for the supported verticals. The union is derived
// from the runtime tuple so types, filters, and dropdowns can never drift.
export const VERTICALS = ['saas', 'fintech', 'retail', 'healthcare', 'general'] as const;
export type Vertical = (typeof VERTICALS)[number];
export const VERTICAL_LABELS: Record<Vertical, string> = {
  saas: 'SaaS',
  fintech: 'Fintech',
  retail: 'Retail',
  healthcare: 'Healthcare',
  general: 'General / Default',
};

// ---- Core enumerations -------------------------------------------------------
export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'suppressed' | 'info';
export type Sensitivity = 'strict' | 'balanced' | 'flexible';
export type Exposure = 'Public' | 'Internet-facing' | 'Internal' | 'Private dev/test' | 'Docs-only';
export type Environment = 'Production' | 'Dev' | 'Test' | 'Docs';
export type AssetCriticality = 'High' | 'Medium' | 'Low';

export type Category =
  | 'Secret' | 'Fintech' | 'SaaS' | 'PII' | 'PCI' | 'Healthcare' | 'Retail'
  | 'False Positive Pattern' | 'Documentation Example' | 'Test Value';

export type AccessScope = 'public' | 'broad' | 'internal' | 'restricted';
export type ActivitySignal = 'high' | 'medium' | 'low' | 'unknown';

// Spec §13 — kebab-case so they map cleanly to CSS/UI keys.
export type ValidationStatus =
  | 'not-validated' | 'validated-active' | 'validated-inactive'
  | 'validation-failed' | 'validation-unsupported' | 'validation-permission-required';

// ---- Pipeline stage outputs --------------------------------------------------

// Spec §11 — the components combined into the final scores.
export interface RiskScoreBreakdown {
  // authenticity axis (is it a real secret?)
  regexConfidence: number;    // 0..1
  deterministicRules: number; // signed delta
  lgbmProbability: number;    // 0..1
  authenticityScore: number;  // 0..100
  // remediation-priority axis (what to fix first?)
  accessScore: number;        // 0..100
  exposureScore: number;      // 0..100
  secretTypeSeverity: number; // 0..100
  activityScore: number;      // 0..100
  remediationPriority: number;// 0..100  (customer-facing "Remediation Priority")
}

// Spec §9 — deterministic rules run in parallel to the model. Rule packs and
// guardrails may be vertical-specific.
export interface DeterministicRuleResult {
  score: number; // signed delta
  triggered: {
    id: string;
    label: string;
    direction: 'increase' | 'decrease';
    weight: number;
    rulePack?: string; // e.g. 'base', 'fintech', 'healthcare'
  }[];
  guardrailFloor?: Priority; // e.g. private key can never be lower than High
  // Hard-suppression set by the DomainRulesAgent when a candidate is structurally
  // impossible, public-by-design, a known test value, or trips a semantic
  // invariant. Honored only when no guardrailFloor outranks it (recall guard).
  suppress?: boolean;
  suppressReason?: string;
}

// Spec §10 — the model receives MASKED, structured features only.
export interface LightGBMModelResult {
  secretProbability: number; // 0..1
  modelClassification?:
    | 'true_secret' | 'likely_secret' | 'false_positive' | 'placeholder'
    | 'documentation_example' | 'test_value' | 'public_non_secret' | 'unknown_or_review';
}

// ---- Finding context object (spec §7) ---------------------------------------
// The masked, normalized object handed from the Regex layer to the smart layer.
export interface FindingContextObject {
  findingId: string;
  file: {
    fileName: string;
    filePath: string;
    fileExtension: string;
    fileRole: string;
    storageLocation: string;
  };
  candidate: {
    detectedType: string;
    maskedValue: string;
    valuePrefix: string;
    valueSuffix: string;
    valueLength: number;
    entropy: number;
    entropyLevel: 'low' | 'medium' | 'high';
    lineNumber: number;
    offset: number;
    variableName: string;
  };
  regex: { ruleId: string; ruleSource: string; regexConfidence: number };
  localContext: { lineTextMasked: string; previousLinesMasked: string[]; nextLinesMasked: string[] };
  scanMetadata: {
    sensitivityMode: Sensitivity;
    customerVertical: Vertical;
    enabledRulePacks: string[];
  };
  // Value-intrinsic structural verdicts computed where the raw value exists (the
  // Go scan/generation layer or a customer-side scanner) and bridged here as
  // booleans — the raw value itself never reaches this object. See spec §8/§23.
  signals?: StructuralSignals;
}

// Structural / semantic verdicts produced by the validator library on the raw
// value (pre-masking). The DomainRulesAgent consumes these when no raw value is
// available downstream (e.g. the masked demo pipeline).
export interface StructuralSignals {
  structurallyValid: boolean;   // passes its format's checksum/range (Luhn, mod-97, SSN range, …)
  luhnValid?: boolean;          // Luhn result specifically (cards); undefined when N/A
  formatValidForType?: boolean; // value's shape matches its claimed detected_type
  isKnownTestValue?: boolean;   // well-known inert test/example constant
  isPublicByDesign?: boolean;   // meant to be public (pk_live_, AWS account id, public URL)
  isAlreadyMasked?: boolean;    // value already contains mask glyphs / REDACTED
  isHighEntropySha?: boolean;   // 40/64-char hex VCS object id, not a credential
  validator?: string;           // name of the validator that produced the verdict
}

// ---- Context features (spec §8) ---------------------------------------------
// Extracted, model-ready features. `customerVertical` is a model input (spec §10).
export interface ContextFeatures {
  isProdPath: boolean;
  isDevPath: boolean;
  isTestPath: boolean;
  isDocsPath: boolean;
  isExamplePath: boolean;
  isConfigFile: boolean;
  isSourceCodeFile: boolean;
  isLogFile: boolean;
  isIacFile: boolean;
  fileRole: string;
  environmentHint: Environment;
  detectedType: string;
  valueLength: number;
  entropy: number;
  entropyLevel: 'low' | 'medium' | 'high';
  hasLivePrefix: boolean;
  hasTestPrefix: boolean;
  looksLikePlaceholder: boolean;
  isKnownTestValue: boolean;
  hasSecretVariableName: boolean;
  hasPublicVariableName: boolean;
  variableIntent: 'secret' | 'public' | 'example';
  hasExampleLanguage: boolean;
  hasPlaceholderLanguage: boolean;
  hasTestLanguage: boolean;
  hasSecretLanguage: boolean;
  hasProductionLanguage: boolean;
  hasDocumentationContext: boolean;
  storageExposure: Exposure;
  isPubliclyAccessible: boolean;
  assetCriticality: AssetCriticality;
  cloudProvider: string;
  customerVertical: Vertical;
  // ---- Structural / semantic signals (bridged from StructuralSignals) --------
  structurallyValid: boolean;   // false ⇒ value fails its own format's checksum/range
  luhnValid: boolean;           // Luhn verdict (true when N/A so it never suppresses non-cards)
  formatValidForType: boolean;  // value shape matches claimed detected_type
  isPublicByDesign: boolean;    // public-by-design value (never a secret)
  // ---- Creative semantic invariants -----------------------------------------
  isHighEntropySha: boolean;    // git commit SHA masquerading as a token
  isAlreadyMasked: boolean;     // value already redacted/masked
  shapeContradictsType: boolean;// numeric id (epoch/order) matched as a PAN but failing Luhn+BIN
  isKnownTestVector: boolean;   // matches a curated universally-known test constant
  // ---- Enriched SLM-context features (spec §8 — enriched) --------------------
  // OPTIONAL so existing ContextFeatures fixtures stay valid: populated by
  // extractFeatures and consumed by the SLM semantic layer (lgbm.ts). All are
  // masked/structural — never derived from a raw secret.
  //
  // Hierarchical path context: parent / grandparent directory segment names
  // (lowercased; '' when absent) and boolean tags for benign-by-layout dir kinds.
  parentDir?: string;
  grandparentDir?: string;
  inTestDir?: boolean;           // sits directly inside a tests/__tests__/spec dir
  inFixturesDir?: boolean;       // …a fixtures/mocks dir
  inSamplesDir?: boolean;        // …a samples/examples dir
  inBoilerplateDir?: boolean;    // …a boilerplate/template/scaffold dir
  // Global pattern frequency: how many candidates across the whole repo share
  // this structural fingerprint. High repetition signals benign system IDs/traces.
  patternFrequency?: number;     // >= 1 (1 = unique; defaults to 1 when no corpus)
  isHighFrequencyPattern?: boolean;
  // Semantic anchor flags: neighboring placeholder identities ("John Doe",
  // "Israel Israeli") or structural domain nouns ("executed_at", "patient_name",
  // "lookup_dictionary") — strong hints the match is illustrative / schema.
  hasPlaceholderIdentity?: boolean;
  hasStructuralDomainNoun?: boolean;
}

// ---- Finding (denormalized record the UI renders) ---------------------------
export interface Finding {
  id: number;
  basePriority: Priority; // effective priority derived per-sensitivity
  detectedType: string; // 'aws-access-key'
  maskedValue: string; // MASKED only — never a full secret
  classification: string; // 'AWS Access Key'
  category: Category;
  customerVertical: Vertical;
  risk: number; // 0..100 display risk
  validation: ValidationStatus;
  file: string;
  path: string;
  asset: string;
  assetKind: string;
  environment: Environment;
  cloud: string;
  owner: string;
  createdAt: string;
  line: number;
  offset: number;
  exposure: Exposure;
  assetCriticality: AssetCriticality;
  accessScope: AccessScope;
  activity: ActivitySignal;
  scores: RiskScoreBreakdown;
  isFalsePositive?: boolean;
  // Set when the DomainRulesAgent hard-suppressed this candidate (structural /
  // semantic proof it is not a live secret). `suppressReason` is the named cause.
  suppressedByAgent?: boolean;
  suppressReason?: string;
  riskUpReasons: string[];
  riskDownReasons: string[];
  explanation: string;
  // Optional richer context for hero findings / future live pipeline:
  context?: FindingContextObject;
  features?: ContextFeatures;
}

// ---- Classifications (spec §6 / §17) ----------------------------------------
export interface ClassificationRow {
  id: string;
  name: string;
  category: Category;
  patterns: number;
  rulePacks: string;
  findings: number;
  critical: number;
  fpReductionPct: number;
  createdBy: string;
  enabled: boolean;
}
export interface ClassificationDetail {
  description: string;
  pattern: string;
  up: string[];
  down: string[];
  guardrail: string;
}

// ---- Finding lifecycle / triage (spec §18) ----------------------------------
export type FindingStatus = 'open' | 'in-review' | 'snoozed' | 'accepted-risk' | 'resolved' | 'false-positive';
export interface SnoozeInfo { until: string; reason: string; applyToSimilar: boolean; }

// ---- Map / exposure topology (spec §16) -------------------------------------
export interface MapAsset {
  key: string;
  name: string;
  cloud: string;
  kind: string;
  exposure: string;
  environment: Environment;
  assetCriticality: AssetCriticality;
  highestSeverity: Priority;
  validationSummary: string;
  findings: { detectedType: string; priority: Priority; validation: string }[];
  position: { xPct: number; yPct: number };
  edges: string[];
}

// ---- Suggested rules --------------------------------------------------------
export interface SuggestedRule {
  id: string;
  title: string;
  description: string;
  reason: string;
  scope: string;
  affectedFindingsCount: number;
  ruleType: 'default' | 'vertical-specific' | 'customer-specific';
  status: 'suggested' | 'approved' | 'dismissed';
}

// ---- Exposure map extensions ------------------------------------------------
export type ExposureLocationType = 'asset' | 'flow' | 'external_ai';

export interface MapFindingRef {
  detectedType: string;
  priority: Priority;
  validation: string;
  locationType: ExposureLocationType;
}

export interface MapFlowEdge {
  id: string;
  fromKey: string;
  toKey: string;
  protocol?: string;
  findings: MapFindingRef[];
}

export interface ExternalAiNode {
  key: string;
  provider: string;
  position: { xPct: number; yPct: number };
  findings: MapFindingRef[];
}
