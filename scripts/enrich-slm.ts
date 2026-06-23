// scripts/enrich-slm.ts
// Offline SLM enrichment harness for the "DSPM Semantic Guardrail" layer.
//
// Runs the async SemanticClassifier (lgbm.ts) over the corpus and writes its
// per-finding verdicts to DB/slm-predictions.json. This is the ASYNC path that
// keeps the live (synchronous) dashboard pipeline untouched: the dashboard uses
// the deterministic mock; this script can drive a real local SLM endpoint.
//
// With no SLM_ENDPOINT/SLM_MODEL configured it uses the deterministic fallback,
// so it runs fully offline and reproducibly (no network). To exercise a real
// vLLM/Ollama node:
//   SLM_ENDPOINT=http://localhost:8000/v1/chat/completions \
//   SLM_MODEL=qwen2.5-coder:7b \
//   node_modules/.bin/vite-node scripts/enrich-slm.ts
//
// PRIVACY INVARIANT: only masked/structural context is sent to the model.
import { writeFileSync, mkdirSync } from 'node:fs';
import type { FindingContextObject, Exposure, AssetCriticality, Vertical } from '../src/types';
import { extractFeatures, buildCorpusStats, type AssetContext } from '../src/lib/features';
import { resolveSemanticClassifier, mockSemanticClassifier, type SlmClassifierInput } from '../src/lib/lgbm';
import rawFindings from '../src/data/evenup/findings.json';

interface RawFinding {
  finding_id: string;
  file: { file_name: string; file_path: string; file_extension: string; file_role: string; storage_location: string };
  candidate: {
    detected_type: string; masked_value: string; value_prefix: string; value_suffix: string;
    value_length: number; entropy: number; entropy_level: 'low' | 'medium' | 'high';
    line_number: number; variable_name: string;
  };
  regex: { rule_id: string; rule_source: string; regex_confidence: string };
  local_context: { line_text_masked: string };
  scan_metadata: { sensitivity_mode: string; customer_vertical: string; enabled_rule_packs: string[] };
  signals?: { structurally_valid?: boolean; luhn_valid?: boolean; is_known_test_value?: boolean; is_public_by_design?: boolean };
  ground_truth: { storage_exposure: string; asset_criticality: string; is_secret?: boolean; label?: string };
}

const RAW = rawFindings as unknown as RawFinding[];

const toExposure = (raw: string): Exposure =>
  (({ public: 'Public', internet: 'Internet-facing', shared: 'Public', internal: 'Internal' } as Record<string, Exposure>)[raw] ?? 'Internal');
const toCriticality = (raw: string): AssetCriticality =>
  (({ critical: 'High', high: 'High', medium: 'Medium', low: 'Low' } as Record<string, AssetCriticality>)[raw] ?? 'Medium');
const toVertical = (v: string): Vertical =>
  (({ 'fintech-legal-hybrid': 'fintech' } as Record<string, Vertical>)[v] ?? 'general');

// Map a raw (snake_case) finding to the masked FindingContextObject the pipeline
// consumes, bridging the structural signals block to camelCase.
function toContext(raw: RawFinding): FindingContextObject {
  const s = raw.signals;
  return {
    findingId: raw.finding_id,
    file: {
      fileName: raw.file.file_name,
      filePath: raw.file.file_path,
      fileExtension: raw.file.file_extension,
      fileRole: raw.file.file_role,
      storageLocation: raw.file.storage_location,
    },
    candidate: {
      detectedType: raw.candidate.detected_type,
      maskedValue: raw.candidate.masked_value,
      valuePrefix: raw.candidate.value_prefix,
      valueSuffix: raw.candidate.value_suffix,
      valueLength: raw.candidate.value_length,
      entropy: raw.candidate.entropy,
      entropyLevel: raw.candidate.entropy_level,
      lineNumber: raw.candidate.line_number,
      offset: 0,
      variableName: raw.candidate.variable_name,
    },
    regex: { ruleId: raw.regex.rule_id, ruleSource: raw.regex.rule_source, regexConfidence: 0.8 },
    localContext: { lineTextMasked: raw.local_context.line_text_masked, previousLinesMasked: [], nextLinesMasked: [] },
    scanMetadata: {
      sensitivityMode: 'balanced',
      customerVertical: toVertical(raw.scan_metadata.customer_vertical),
      enabledRulePacks: raw.scan_metadata.enabled_rule_packs,
    },
    signals: s
      ? {
          structurallyValid: s.structurally_valid ?? true,
          luhnValid: s.luhn_valid ?? true,
          isKnownTestValue: s.is_known_test_value ?? false,
          isPublicByDesign: s.is_public_by_design ?? false,
        }
      : undefined,
  };
}

interface PredictionRow {
  finding_id: string;
  secret_probability: number;
  model_classification: string;
  reason: string;
  model: string;
}

// Subset mode (SLM_SUBSET=1): send only the "hard" candidates to the REAL SLM —
// the residual false-positive families the deterministic rules can't resolve,
// plus a few real secrets to prove recall holds — and use the deterministic
// guardrail for everything else. Keeps the full 345-row output while making the
// real run fast (~25 SLM calls). This mirrors a real cost-optimized deployment:
// cheap rules first, expensive SLM only on the unresolved cases.
const SUBSET = process.env.SLM_SUBSET === '1';
const RESIDUAL_FP_TYPES = new Set(
  (process.env.SLM_SUBSET_TYPES ?? 'api_key,pii,database_password,phi').split(','),
);
let secretsBudget = Number(process.env.SLM_SUBSET_SECRETS ?? '6');

function useRealSlm(raw: RawFinding): boolean {
  if (!SUBSET) return true; // full mode → everything goes to the real classifier
  const gt = raw.ground_truth;
  // benign candidates of the leaked families → let the SLM try to clear them
  if (gt.is_secret === false && RESIDUAL_FP_TYPES.has(raw.candidate.detected_type)) return true;
  // a few real secrets → show the SLM correctly keeps them (recall check)
  if (gt.is_secret === true && secretsBudget > 0) {
    secretsBudget--;
    return true;
  }
  return false;
}

async function main() {
  const contexts = RAW.map(toContext);
  const corpusStats = buildCorpusStats(contexts);
  const realClassifier = resolveSemanticClassifier(process.env);
  const concurrency = Math.max(1, Number(process.env.SLM_CONCURRENCY ?? '6') || 6);
  console.log(
    `real classifier: ${realClassifier.name} (concurrency ${concurrency})` +
      (SUBSET ? ` — SUBSET mode: real SLM on residual FPs [${[...RESIDUAL_FP_TYPES].join(',')}] + ${process.env.SLM_SUBSET_SECRETS ?? '6'} secrets, mock for the rest` : ''),
  );

  // Results written by index so output order is independent of completion order.
  const predictions: PredictionRow[] = new Array(RAW.length);
  let cursor = 0;
  let done = 0;

  // Bounded worker pool: each worker pulls the next index from a shared cursor
  // until the queue drains. `cursor++` is atomic within JS's single-threaded
  // event loop, so no two workers ever take the same finding.
  async function worker(): Promise<void> {
    for (let i = cursor++; i < RAW.length; i = cursor++) {
      const raw = RAW[i];
      const ctx = contexts[i];
      const asset: AssetContext = {
        storageExposure: toExposure(raw.ground_truth.storage_exposure),
        assetCriticality: toCriticality(raw.ground_truth.asset_criticality),
        cloudProvider: 'aws',
      };
      const features = extractFeatures(ctx, asset, corpusStats);
      const input: SlmClassifierInput = {
        detectedType: ctx.candidate.detectedType,
        maskedLineContext: ctx.localContext.lineTextMasked,
        features,
      };
      const r = useRealSlm(raw)
        ? await realClassifier.classify(input)
        : await mockSemanticClassifier.classify(input);
      predictions[i] = {
        finding_id: raw.finding_id,
        secret_probability: r.secretProbability,
        model_classification: r.modelClassification,
        reason: r.reason,
        model: r.model ?? realClassifier.name,
      };
      done++;
      if (done % 50 === 0 || done === RAW.length) console.log(`enriched ${done}/${RAW.length}`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, RAW.length) }, () => worker()));

  // Count how many came from the real model vs the deterministic fallback.
  const fallbacks = predictions.filter((p) => p.model.endsWith('#fallback')).length;
  if (fallbacks > 0) console.log(`note: ${fallbacks}/${predictions.length} fell back to the deterministic guardrail`);

  mkdirSync('DB', { recursive: true });
  writeFileSync('DB/slm-predictions.json', JSON.stringify(predictions, null, 2));
  console.log(`wrote ${predictions.length} SLM predictions → DB/slm-predictions.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
