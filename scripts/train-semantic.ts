// scripts/train-semantic.ts
// Pure-TS offline trainer for the in-process Semantic Guardrail (Random Forest).
// Reads the 345 labeled findings, rebuilds masked context features (reusing the
// SAME extractFeatures + buildCorpusStats as the live pipeline), fits a forest
// on ground_truth.is_secret, and writes a tiny tracked model to
// src/lib/semantic-model.json. Reports train + 5-fold CV recall/precision and
// feature usage. Run: npm run train:semantic
import { writeFileSync } from 'node:fs';
import type { FindingContextObject, Exposure, AssetCriticality, Vertical } from '../src/types';
import { extractFeatures, buildCorpusStats, type AssetContext } from '../src/lib/features';
import { trainForest, featurize, evaluateForest, FEATURE_ORDER, type Forest, type TreeNode } from '../src/lib/forest';
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
  signals?: {
    structurally_valid?: boolean; luhn_valid?: boolean; format_valid_for_type?: boolean;
    is_known_test_value?: boolean; is_public_by_design?: boolean; is_already_masked?: boolean; is_high_entropy_sha?: boolean;
  };
  ground_truth: { storage_exposure: string; asset_criticality: string; is_secret?: boolean };
}

const RAW = rawFindings as unknown as RawFinding[];

const toExposure = (r: string): Exposure =>
  (({ public: 'Public', internet: 'Internet-facing', shared: 'Public', internal: 'Internal' } as Record<string, Exposure>)[r] ?? 'Internal');
const toCriticality = (r: string): AssetCriticality =>
  (({ critical: 'High', high: 'High', medium: 'Medium', low: 'Low' } as Record<string, AssetCriticality>)[r] ?? 'Medium');
const toVertical = (v: string): Vertical =>
  (({ 'fintech-legal-hybrid': 'fintech' } as Record<string, Vertical>)[v] ?? 'general');

function toContext(raw: RawFinding): FindingContextObject {
  const s = raw.signals;
  return {
    findingId: raw.finding_id,
    file: {
      fileName: raw.file.file_name, filePath: raw.file.file_path, fileExtension: raw.file.file_extension,
      fileRole: raw.file.file_role, storageLocation: raw.file.storage_location,
    },
    candidate: {
      detectedType: raw.candidate.detected_type, maskedValue: raw.candidate.masked_value,
      valuePrefix: raw.candidate.value_prefix, valueSuffix: raw.candidate.value_suffix,
      valueLength: raw.candidate.value_length, entropy: raw.candidate.entropy,
      entropyLevel: raw.candidate.entropy_level, lineNumber: raw.candidate.line_number,
      offset: 0, variableName: raw.candidate.variable_name,
    },
    regex: { ruleId: raw.regex.rule_id, ruleSource: raw.regex.rule_source, regexConfidence: 0.8 },
    localContext: { lineTextMasked: raw.local_context.line_text_masked, previousLinesMasked: [], nextLinesMasked: [] },
    scanMetadata: {
      sensitivityMode: 'balanced', customerVertical: toVertical(raw.scan_metadata.customer_vertical),
      enabledRulePacks: raw.scan_metadata.enabled_rule_packs,
    },
    signals: s
      ? {
          structurallyValid: s.structurally_valid ?? true, luhnValid: s.luhn_valid,
          formatValidForType: s.format_valid_for_type, isKnownTestValue: s.is_known_test_value,
          isPublicByDesign: s.is_public_by_design, isAlreadyMasked: s.is_already_masked,
          isHighEntropySha: s.is_high_entropy_sha,
        }
      : undefined,
  };
}

function countFeatureUsage(trees: TreeNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const walk = (n: TreeNode) => {
    if ('f' in n) {
      const name = FEATURE_ORDER[n.f];
      counts[name] = (counts[name] ?? 0) + 1;
      walk(n.l);
      walk(n.r);
    }
  };
  trees.forEach(walk);
  return counts;
}

// Report precision at the threshold that keeps recall = 1.0 (no missed secrets).
function metricsRecallFirst(probs: number[], y: number[]): { threshold: number; precision: number; recall: number } {
  // lowest probability among positives → threshold that catches all of them
  const posProbs = probs.filter((_, i) => y[i] === 1);
  const threshold = Math.max(0, Math.min(...posProbs) - 1e-9);
  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < probs.length; i++) {
    const pred = probs[i] > threshold ? 1 : 0;
    if (pred === 1 && y[i] === 1) tp++;
    else if (pred === 1 && y[i] === 0) fp++;
    else if (pred === 0 && y[i] === 1) fn++;
  }
  return { threshold, precision: tp / (tp + fp || 1), recall: tp / (tp + fn || 1) };
}

function main() {
  const contexts = RAW.map(toContext);
  const corpusStats = buildCorpusStats(contexts);
  const rows = contexts.map((ctx, i) => {
    const raw = RAW[i];
    const asset: AssetContext = {
      storageExposure: toExposure(raw.ground_truth.storage_exposure),
      assetCriticality: toCriticality(raw.ground_truth.asset_criticality),
      cloudProvider: 'aws',
    };
    const features = extractFeatures(ctx, asset, corpusStats);
    return { x: featurize(features), y: (raw.ground_truth.is_secret ? 1 : 0) as 0 | 1 };
  });

  const pos = rows.filter((r) => r.y === 1).length;
  console.log(`training on ${rows.length} findings (${pos} secrets / ${rows.length - pos} benign), ${FEATURE_ORDER.length} features`);

  // ---- Full-data model (the committed artifact) ----
  const forest = trainForest(rows, { seed: 1337, nTrees: 150, maxDepth: 6, minLeaf: 2 });
  const probs = rows.map((r) => evaluateForest(forest, r.x));
  const y = rows.map((r) => r.y);
  const train = metricsRecallFirst(probs, y);
  console.log(
    `train (recall-first threshold ${train.threshold.toFixed(3)}): recall ${(train.recall * 100).toFixed(1)}%, precision ${(train.precision * 100).toFixed(1)}%`,
  );

  // ---- 5-fold CV (honesty check on generalization) ----
  const k = 5;
  const cvProbs = new Array<number>(rows.length).fill(0);
  for (let fold = 0; fold < k; fold++) {
    const test = rows.map((_, i) => i).filter((i) => i % k === fold);
    const trainIdx = rows.map((_, i) => i).filter((i) => i % k !== fold);
    const f = trainForest(trainIdx.map((i) => rows[i]), { seed: 1337 + fold, nTrees: 120, maxDepth: 6, minLeaf: 2 });
    for (const i of test) cvProbs[i] = evaluateForest(f, rows[i].x);
  }
  const cv = metricsRecallFirst(cvProbs, y);
  console.log(
    `5-fold CV (recall-first threshold ${cv.threshold.toFixed(3)}): recall ${(cv.recall * 100).toFixed(1)}%, precision ${(cv.precision * 100).toFixed(1)}%`,
  );

  // ---- Feature usage (rough importance) ----
  const usage = Object.entries(countFeatureUsage(forest.trees)).sort((a, c) => c[1] - a[1]).slice(0, 12);
  console.log('top split features:', usage.map(([n, c]) => `${n}:${c}`).join(', '));

  const out: Forest = forest;
  writeFileSync('src/lib/semantic-model.json', JSON.stringify(out));
  const bytes = JSON.stringify(out).length;
  console.log(`wrote src/lib/semantic-model.json (${(bytes / 1024).toFixed(1)} KB, ${forest.trees.length} trees)`);
}

main();
