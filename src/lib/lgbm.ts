// ---------------------------------------------------------------------------
// DETERMINISTIC PLACEHOLDER / MOCK — not a real trained model.
// This module defines the SecretClassifier interface and a fully deterministic
// mock adapter (mockLightGBM) that implements the scoring logic below.
// When a real LightGBM model is trained and exported, replace `mockLightGBM`
// with a new implementation of `SecretClassifier` — the interface, the
// `defaultClassifier` export, and all consumers remain unchanged.
// ---------------------------------------------------------------------------

import type { ContextFeatures, LightGBMModelResult } from '../types';

// ---------------------------------------------------------------------------
// Public interface — the swap point for a real model
// ---------------------------------------------------------------------------
export interface SecretClassifier {
  readonly name: string;
  predict(features: ContextFeatures): LightGBMModelResult;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function round2(p: number): number {
  return Math.round(p * 100) / 100;
}

// High-severity detector types that add a positive prior
const HIGH_SEVERITY_TYPES = new Set([
  'aws-access-key',
  'aws-secret-key',
  'pem-private-key',
  'stripe-secret-key',
  'github-token',
  'database-password',
  'slack-token',
  'datadog-api-key',
]);

// Low-severity detector types that add a negative prior
const LOW_SEVERITY_TYPES = new Set([
  'test-card-number',
  'email-address',
]);

// ---------------------------------------------------------------------------
// Scoring model
// ---------------------------------------------------------------------------
function computeProbability(f: ContextFeatures): number {
  let z = -0.2; // bias

  // Variable name and prefix signals
  if (f.hasSecretVariableName) z += 1.4;
  if (f.hasLivePrefix) z += 1.2;

  // Entropy level
  if (f.entropyLevel === 'high') z += 1.0;
  else if (f.entropyLevel === 'medium') z += 0.3;
  else if (f.entropyLevel === 'low') z -= 0.5;

  // Path/file context
  if (f.isProdPath) z += 0.8;
  if (f.isConfigFile) z += 0.4;
  if (f.isPubliclyAccessible) z += 0.6;

  // Language/production signals
  if (f.hasProductionLanguage) z += 0.4;
  if (f.hasSecretLanguage) z += 0.3;

  // Variable intent
  if (f.variableIntent === 'secret') z += 0.6;
  else if (f.variableIntent === 'public') z -= 0.8;
  else if (f.variableIntent === 'example') z -= 1.5;

  // Negative signals
  if (f.looksLikePlaceholder) z -= 2.2;
  if (f.isKnownTestValue) z -= 2.5;
  if (f.isDocsPath) z -= 1.2;
  if (f.isTestPath) z -= 1.0;
  if (f.isExamplePath) z -= 1.0;
  if (f.hasExampleLanguage) z -= 1.0;
  if (f.hasPlaceholderLanguage) z -= 1.2;

  // Type prior
  if (HIGH_SEVERITY_TYPES.has(f.detectedType)) z += 0.5;
  else if (LOW_SEVERITY_TYPES.has(f.detectedType)) z -= 0.6;

  // Structural / semantic signals — value-intrinsic verdicts bridged from the
  // raw-value layer. These mirror the deterministic FP-killer rules so the
  // fallback model and the rules engine agree on structurally impossible /
  // public-by-design / known-test candidates. Guarded against `undefined` so
  // fixtures that predate the signals block are unaffected.
  if (f.structurallyValid === false) z -= 3.0;
  if (f.luhnValid === false) z -= 3.0;
  if (f.formatValidForType === false) z -= 1.5;
  if (f.isPublicByDesign === true) z -= 3.0;
  if (f.isKnownTestVector === true) z -= 2.5;
  if (f.isAlreadyMasked === true) z -= 2.5;
  if (f.isHighEntropySha === true) z -= 2.5;
  if (f.shapeContradictsType === true) z -= 2.5;

  return round2(sigmoid(z));
}

// ---------------------------------------------------------------------------
// Classification label from probability and features
// ---------------------------------------------------------------------------
function classify(
  p: number,
  f: ContextFeatures,
): LightGBMModelResult['modelClassification'] {
  if (p >= 0.85) return 'true_secret';
  if (p >= 0.6) return 'likely_secret';
  if (p >= 0.4) return 'unknown_or_review';

  // p < 0.4 — pick the most specific negative label
  if (f.looksLikePlaceholder) return 'placeholder';
  if (f.isDocsPath || f.hasExampleLanguage) return 'documentation_example';
  if (f.isTestPath || f.isKnownTestValue) return 'test_value';
  if (f.hasPublicVariableName) return 'public_non_secret';
  return 'false_positive';
}

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------
export const mockLightGBM: SecretClassifier = {
  name: 'mock-lightgbm-v0',

  predict(features: ContextFeatures): LightGBMModelResult {
    const secretProbability = computeProbability(features);
    const modelClassification = classify(secretProbability, features);
    return { secretProbability, modelClassification };
  },
};

// ---------------------------------------------------------------------------
// Default classifier — swap `mockLightGBM` for a real model here
// ---------------------------------------------------------------------------
export const defaultClassifier: SecretClassifier = mockLightGBM;

// ===========================================================================
// SLM SEMANTIC LAYER — "DSPM Semantic Guardrail"
// ---------------------------------------------------------------------------
// A swappable, async connector to a local Small Language Model (SLM) served by
// a vLLM- or Ollama-style OpenAI-compatible endpoint inside Upwind's data
// plane. It replaces the deterministic mock as the production classifier while
// keeping the same role in the pipeline: read the MASKED, enriched context and
// emit a secret probability + label + short reason.
//
// PRIVACY INVARIANT: the connector is given only the masked line context and
// the structural/contextual ContextFeatures object — never a raw secret. See
// `buildUserPayload` below: it serialises masked + structural fields only.
//
// The live (synchronous) dashboard pipeline keeps using `mockLightGBM`. This
// async layer is exercised by the offline enrichment script
// (scripts/enrich-slm.ts) so a running endpoint is never required for the demo.
// ===========================================================================

// Canonical SLM taxonomy (the request's 5-label set). Mapped onto the wider
// LightGBMModelResult taxonomy by `toModelClassification` when needed.
export type SlmClassification =
  | 'true_secret'
  | 'placeholder'
  | 'test_value'
  | 'false_positive'
  | 'public_non_secret';

export const SLM_CLASSIFICATIONS: readonly SlmClassification[] = [
  'true_secret',
  'placeholder',
  'test_value',
  'false_positive',
  'public_non_secret',
] as const;

export interface SlmClassifierResult {
  secretProbability: number; // 0..1
  modelClassification: SlmClassification;
  reason: string; // short contextual explanation
  model?: string; // which backend produced it (for provenance / breakdowns)
}

export interface SlmClassifierInput {
  detectedType: string;
  maskedLineContext: string; // masked only — never a raw value
  features: ContextFeatures; // enriched, masked/structural features
}

// The swappable connector contract — the SLM equivalent of `SecretClassifier`,
// async because real inference is a network round-trip.
export interface SemanticClassifier {
  readonly name: string;
  classify(input: SlmClassifierInput): Promise<SlmClassifierResult>;
}

// ---- Prompt construction ---------------------------------------------------
export function buildSystemPrompt(): string {
  return [
    'You are a DSPM Semantic Guardrail for a cloud data-security platform.',
    'You decide whether a regex-detected candidate is a REAL, live secret or a',
    'benign false positive (placeholder, test/example value, public-by-design',
    'identifier, or unrelated string).',
    '',
    'You receive ONLY masked and structural context — never the raw value.',
    'Reason over: the detected type, the masked surrounding line, file/path',
    'context, variable intent, entropy, value-intrinsic structural verdicts',
    '(structurally valid / Luhn valid / public-by-design / known test vector),',
    'global pattern frequency, and semantic anchors (placeholder identities or',
    'structural domain nouns).',
    '',
    'Respond with a SINGLE JSON object and nothing else:',
    '{',
    '  "secretProbability": <float 0.0-1.0>,',
    '  "modelClassification": "true_secret" | "placeholder" | "test_value" | "false_positive" | "public_non_secret",',
    '  "reason": "<one short sentence>"',
    '}',
    '',
    'Guidance: a structurally-invalid value, a failed Luhn check, a public-by-design',
    'identifier, a known test vector, an already-masked value, or a high-frequency',
    'repeated machine ID is almost never a real secret. A high-entropy value under a',
    'secret-like variable name in a production config IS likely a real secret.',
  ].join('\n');
}

// Compact, masked-only payload describing the candidate for the SLM.
export function buildUserPayload(input: SlmClassifierInput): string {
  const f = input.features;
  const payload = {
    detectedType: input.detectedType,
    maskedLineContext: input.maskedLineContext,
    path: {
      environmentHint: f.environmentHint,
      fileRole: f.fileRole,
      isProdPath: f.isProdPath,
      isDocsPath: f.isDocsPath,
      isTestPath: f.isTestPath,
      isConfigFile: f.isConfigFile,
      parentDir: f.parentDir,
      grandparentDir: f.grandparentDir,
      inTestDir: f.inTestDir,
      inFixturesDir: f.inFixturesDir,
      inSamplesDir: f.inSamplesDir,
      inBoilerplateDir: f.inBoilerplateDir,
    },
    value: {
      entropyLevel: f.entropyLevel,
      valueLength: f.valueLength,
      hasLivePrefix: f.hasLivePrefix,
      hasTestPrefix: f.hasTestPrefix,
      looksLikePlaceholder: f.looksLikePlaceholder,
    },
    variable: {
      intent: f.variableIntent,
      hasSecretVariableName: f.hasSecretVariableName,
      hasPublicVariableName: f.hasPublicVariableName,
    },
    structuralSignals: {
      structurallyValid: f.structurallyValid,
      luhnValid: f.luhnValid,
      formatValidForType: f.formatValidForType,
      isPublicByDesign: f.isPublicByDesign,
      isKnownTestVector: f.isKnownTestVector,
      isAlreadyMasked: f.isAlreadyMasked,
      isHighEntropySha: f.isHighEntropySha,
      shapeContradictsType: f.shapeContradictsType,
    },
    frequency: {
      patternFrequency: f.patternFrequency,
      isHighFrequencyPattern: f.isHighFrequencyPattern,
    },
    semanticAnchors: {
      hasPlaceholderIdentity: f.hasPlaceholderIdentity,
      hasStructuralDomainNoun: f.hasStructuralDomainNoun,
    },
    asset: {
      storageExposure: f.storageExposure,
      isPubliclyAccessible: f.isPubliclyAccessible,
      assetCriticality: f.assetCriticality,
      customerVertical: f.customerVertical,
    },
  };
  return `Classify this candidate:\n${JSON.stringify(payload, null, 2)}`;
}

// ---- Response parsing ------------------------------------------------------
// Robustly extract and validate the SLM's JSON. Throws on malformed output so
// the caller can fall back to the deterministic classifier.
export function parseSlmResponse(raw: string): Omit<SlmClassifierResult, 'model'> {
  // Strip ```json fences and locate the first balanced object.
  const fenced = raw.replace(/```(?:json)?/gi, '').trim();
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('SLM response contains no JSON object');
  }
  let obj: unknown;
  try {
    obj = JSON.parse(fenced.slice(start, end + 1));
  } catch {
    throw new Error('SLM response is not valid JSON');
  }
  const o = obj as Record<string, unknown>;
  const p = o.secretProbability;
  const cls = o.modelClassification;
  const reason = o.reason;
  if (typeof p !== 'number' || Number.isNaN(p) || p < 0 || p > 1) {
    throw new Error('SLM secretProbability out of range');
  }
  if (typeof cls !== 'string' || !SLM_CLASSIFICATIONS.includes(cls as SlmClassification)) {
    throw new Error('SLM modelClassification not in taxonomy');
  }
  return {
    secretProbability: round2(p),
    modelClassification: cls as SlmClassification,
    reason: typeof reason === 'string' && reason.length > 0 ? reason : 'No reason provided.',
  };
}

// ---- Deterministic fallback (offline / endpoint-down / parse failure) ------
// Reuses the mock's probability model and maps to the SLM taxonomy + a reason.
function deterministicReason(f: ContextFeatures, p: number): { cls: SlmClassification; reason: string } {
  if (f.isPublicByDesign) return { cls: 'public_non_secret', reason: 'Value is public-by-design (e.g. publishable key / public identifier).' };
  if (f.isKnownTestVector) return { cls: 'test_value', reason: 'Matches a known test/example vector.' };
  if (f.structurallyValid === false || f.luhnValid === false || f.shapeContradictsType)
    return { cls: 'false_positive', reason: 'Fails its format’s structural/checksum validation.' };
  if (f.looksLikePlaceholder || f.hasPlaceholderIdentity)
    return { cls: 'placeholder', reason: 'Value/context looks like a placeholder or illustrative identity.' };
  if (p >= 0.6) return { cls: 'true_secret', reason: 'High-entropy secret-like value in a credential-bearing context.' };
  return { cls: 'false_positive', reason: 'Low secret likelihood given path, intent, and entropy context.' };
}

export const mockSemanticClassifier: SemanticClassifier = {
  name: 'mock-slm-guardrail-v0',
  classify(input: SlmClassifierInput): Promise<SlmClassifierResult> {
    const p = computeProbability(input.features);
    const { cls, reason } = deterministicReason(input.features, p);
    return Promise.resolve({ secretProbability: p, modelClassification: cls, reason, model: 'mock-slm-guardrail-v0' });
  },
};

// ---- Local SLM connector (vLLM / Ollama, OpenAI-compatible) ----------------
export interface LocalSlmConfig {
  endpoint: string; // full chat-completions URL, e.g. http://localhost:8000/v1/chat/completions
  model: string; // e.g. 'qwen2.5-coder:7b'
  apiKey?: string;
  timeoutMs?: number;
}

// Minimal fetch signature so the connector is testable with an injected stub.
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

export function createLocalSlmClassifier(config: LocalSlmConfig, fetchFn?: FetchLike): SemanticClassifier {
  return {
    name: `local-slm:${config.model}`,
    async classify(input: SlmClassifierInput): Promise<SlmClassifierResult> {
      const doFetch = fetchFn ?? (globalThis.fetch as unknown as FetchLike);
      try {
        if (typeof doFetch !== 'function') throw new Error('no fetch available');
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (config.apiKey) headers['authorization'] = `Bearer ${config.apiKey}`;
        const res = await doFetch(config.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: config.model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: buildSystemPrompt() },
              { role: 'user', content: buildUserPayload(input) },
            ],
          }),
        });
        if (!res.ok) throw new Error(`SLM endpoint returned ${res.status}`);
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('SLM response missing message content');
        const parsed = parseSlmResponse(content);
        return { ...parsed, model: config.model };
      } catch {
        // Never crash the pipeline: fall back to the deterministic guardrail.
        const fallback = await mockSemanticClassifier.classify(input);
        return { ...fallback, model: `${config.model}#fallback` };
      }
    },
  };
}

// Read process.env without referencing the bare `process` global, so the browser
// bundle (which has no Node types) still type-checks and never touches process.
function readEnv(): Record<string, string | undefined> {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env ?? {};
}

// Resolve the active semantic classifier from environment configuration. Reads
// env lazily (not at import time) so the browser bundle never touches process.
export function resolveSemanticClassifier(
  env: Record<string, string | undefined> = readEnv(),
  fetchFn?: FetchLike,
): SemanticClassifier {
  const endpoint = env.SLM_ENDPOINT;
  const model = env.SLM_MODEL;
  if (endpoint && model) {
    return createLocalSlmClassifier({ endpoint, model, apiKey: env.SLM_API_KEY }, fetchFn);
  }
  return mockSemanticClassifier;
}

// Safe default for any importer (incl. the app bundle): the deterministic mock.
// The offline script calls `resolveSemanticClassifier(process.env)` to opt into
// a live endpoint when configured.
export const defaultSemanticClassifier: SemanticClassifier = mockSemanticClassifier;
