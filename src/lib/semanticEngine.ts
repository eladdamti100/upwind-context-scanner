// src/lib/semanticEngine.ts
// ---------------------------------------------------------------------------
// The in-process "Spatial Semantic Guardrail" — replaces the heavy Ollama SLM.
// It scores the WHOLE corpus at once (synchronously, <1ms/finding) in two
// stages:
//   1. base score   — a data-fit Random Forest over masked ContextFeatures.
//   2. spatial pass  — aggregate findings by file (and folder); when a file is
//      collectively benign (a fixtures/docs file full of placeholders, high-
//      frequency patterns, or structurally-invalid values) DOWN-weight every
//      finding in it as a group. Downward-only ⇒ it can never create a missed
//      secret (recall-safe); guardrails/suppress in rules.ts still floor creds.
//
// PRIVACY INVARIANT: consumes only masked/structural features + the (non-secret)
// file path. No raw value is ever read.
// ---------------------------------------------------------------------------
import type { ContextFeatures } from '../types';
import type { SlmClassification } from './lgbm';
import { evaluateForest, featurize, type Forest } from './forest';
import modelJson from './semantic-model.json';

const MODEL = modelJson as unknown as Forest;

export interface SemanticEngineInput {
  findingId: string;
  detectedType: string;
  filePath: string; // for spatial grouping — not a secret
  maskedLineContext: string;
  features: ContextFeatures;
}

export interface SemanticVerdict {
  findingId: string;
  secretProbability: number; // spatially-adjusted, 0..1
  baseProbability: number; // pre-spatial model score
  modelClassification: SlmClassification;
  reason: string;
  spatial?: { fileBenignPrior: number; groupSize: number; downgraded: boolean };
}

export interface SpatialSemanticEngine {
  readonly name: string;
  classifyCorpus(inputs: SemanticEngineInput[]): SemanticVerdict[];
}

// How aggressively a collectively-benign file pulls its findings down.
const LAMBDA = 0.6;

const benignPath = (f: ContextFeatures): boolean =>
  Boolean(f.inFixturesDir || f.inSamplesDir || f.inTestDir || f.inBoilerplateDir) ||
  f.isDocsPath || f.isExamplePath || f.isTestPath;

const looksBenignValue = (f: ContextFeatures): boolean =>
  Boolean(f.hasPlaceholderIdentity) || f.looksLikePlaceholder ||
  Boolean(f.isHighFrequencyPattern) || f.isKnownTestVector || f.isKnownTestValue ||
  f.structurallyValid === false;

interface GroupAgg {
  n: number;
  fracBenignPath: number;
  fracBenignValue: number;
}

function aggregate(items: SemanticEngineInput[]): GroupAgg {
  const n = items.length;
  let bp = 0;
  let bv = 0;
  for (const it of items) {
    if (benignPath(it.features)) bp++;
    if (looksBenignValue(it.features)) bv++;
  }
  return { n, fracBenignPath: bp / n, fracBenignValue: bv / n };
}

// Per-group benign prior in [0,1], scaled by how much evidence the group has
// (a single finding carries no spatial signal; ~5+ findings is full confidence).
function benignPrior(agg: GroupAgg): number {
  const groupConfidence = Math.min(1, (agg.n - 1) / 4);
  const raw = 0.5 * agg.fracBenignPath + 0.5 * agg.fracBenignValue;
  return raw * groupConfidence;
}

function labelFor(p: number, f: ContextFeatures): SlmClassification {
  if (p >= 0.5) return 'true_secret';
  if (f.isPublicByDesign) return 'public_non_secret';
  if (f.isKnownTestVector || f.isKnownTestValue) return 'test_value';
  if (f.looksLikePlaceholder || f.hasPlaceholderIdentity) return 'placeholder';
  return 'false_positive';
}

function dirOf(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  return parts.slice(0, -1).join('/') || filePath;
}

export const forestSpatialEngine: SpatialSemanticEngine = {
  name: `forest-spatial:${MODEL.name ?? 'v1'}`,

  classifyCorpus(inputs: SemanticEngineInput[]): SemanticVerdict[] {
    // ---- pass 1: base model score ----
    const base = inputs.map((it) => evaluateForest(MODEL, featurize(it.features)));

    // ---- pass 2: spatial aggregates by file and by directory ----
    const byFile = new Map<string, SemanticEngineInput[]>();
    const byDir = new Map<string, SemanticEngineInput[]>();
    for (const it of inputs) {
      (byFile.get(it.filePath) ?? byFile.set(it.filePath, []).get(it.filePath)!).push(it);
      const d = dirOf(it.filePath);
      (byDir.get(d) ?? byDir.set(d, []).get(d)!).push(it);
    }
    const filePrior = new Map<string, number>();
    for (const [k, items] of byFile) filePrior.set(k, benignPrior(aggregate(items)));
    const dirPrior = new Map<string, number>();
    for (const [k, items] of byDir) dirPrior.set(k, benignPrior(aggregate(items)));

    // ---- pass 3: downward-only spatial adjustment ----
    return inputs.map((it, i) => {
      const fPrior = filePrior.get(it.filePath) ?? 0;
      const dPrior = (dirPrior.get(dirOf(it.filePath)) ?? 0) * 0.7; // folder weighted lower
      const prior = Math.max(fPrior, dPrior);
      const fileGroup = byFile.get(it.filePath)!.length;

      const multiplier = 1 - LAMBDA * prior; // in [0.4, 1] — only reduces
      const p = Math.round(base[i] * multiplier * 100) / 100;
      const downgraded = prior > 0.15 && multiplier < 0.95;
      const cls = labelFor(p, it.features);

      const parts: string[] = [];
      if (downgraded) {
        parts.push(
          `File "${dirOf(it.filePath).split('/').pop() || it.filePath}" is collectively benign ` +
            `(${fileGroup} findings, ${(prior * 100).toFixed(0)}% benign signal) → group-downgraded`,
        );
      }
      if (cls === 'true_secret') {
        parts.push('High model score on a credential-bearing context.');
      } else if (it.features.isPublicByDesign) {
        parts.push('Public-by-design value (never a secret).');
      } else if (it.features.structurallyValid === false || it.features.luhnValid === false) {
        parts.push('Fails its format’s structural/checksum validation.');
      } else if (it.features.isKnownTestVector || it.features.looksLikePlaceholder) {
        parts.push('Known test/example or placeholder value.');
      } else if (!downgraded) {
        parts.push('Low model score given path, intent, and entropy context.');
      }

      return {
        findingId: it.findingId,
        secretProbability: p,
        baseProbability: Math.round(base[i] * 100) / 100,
        modelClassification: cls,
        reason: parts.join(' '),
        spatial: { fileBenignPrior: Math.round(prior * 100) / 100, groupSize: fileGroup, downgraded },
      };
    });
  },
};
