// ============================================================================
// SignalLens domain model
// ----------------------------------------------------------------------------
// Pure type definitions for the context-aware sensitive-data classification
// pipeline + UI. No runtime logic lives here except small enum-like constants
// that need a single source of truth (verticals).
//
// INVARIANT: only MASKED secret values ever appear in these structures
// (`maskedValue`, `*Masked`). Full secrets are never stored, logged, or modeled.
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
