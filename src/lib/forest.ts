// src/lib/forest.ts
// ---------------------------------------------------------------------------
// A tiny, dependency-free Random-Forest used as the in-process "Semantic
// Guardrail" model. Training and inference are both pure TypeScript:
//   - featurize()      : ContextFeatures -> fixed-order numeric vector
//   - trainForest()    : fits a bagged ensemble of CART trees (offline script)
//   - evaluateForest() : SYNCHRONOUS probability in [0,1] (live pipeline)
// The trained model serialises to a small JSON blob (semantic-model.json) that
// is tracked in the repo — no native addon, no model download, no async.
//
// PRIVACY INVARIANT: only masked/structural ContextFeatures are read here. No
// raw secret value is ever featurized.
// ---------------------------------------------------------------------------
import type { ContextFeatures } from '../types';
import { typeSeverity } from './classify';

// ---- Feature vector (single source of truth for train + inference) ---------
// Order matters: trees store the integer index into this list.
export const FEATURE_ORDER = [
  // path / file
  'isProdPath', 'isDevPath', 'isTestPath', 'isDocsPath', 'isExamplePath',
  'isConfigFile', 'isSourceCodeFile', 'isLogFile', 'isIacFile',
  'environmentHintOrd',
  // value
  'valueLength', 'entropy', 'entropyLevelOrd',
  'hasLivePrefix', 'hasTestPrefix', 'looksLikePlaceholder', 'isKnownTestValue',
  // variable
  'hasSecretVariableName', 'hasPublicVariableName', 'variableIntentOrd',
  // text context
  'hasExampleLanguage', 'hasPlaceholderLanguage', 'hasTestLanguage',
  'hasSecretLanguage', 'hasProductionLanguage', 'hasDocumentationContext',
  // asset
  'storageExposureOrd', 'isPubliclyAccessible', 'assetCriticalityOrd',
  // structural / semantic signals
  'structurallyValid', 'luhnValid', 'formatValidForType', 'isPublicByDesign',
  'isHighEntropySha', 'isAlreadyMasked', 'shapeContradictsType', 'isKnownTestVector',
  // enrichment: hierarchical path
  'inTestDir', 'inFixturesDir', 'inSamplesDir', 'inBoilerplateDir',
  // enrichment: global frequency
  'patternFrequency', 'isHighFrequencyPattern',
  // enrichment: semantic anchors
  'hasPlaceholderIdentity', 'hasStructuralDomainNoun',
  // detected-type prior (0..1)
  'typeSeverityNorm',
] as const;

export type FeatureName = (typeof FEATURE_ORDER)[number];

const b = (v: boolean | undefined): number => (v ? 1 : 0);

const ENTROPY_ORD: Record<string, number> = { low: 0, medium: 1, high: 2 };
const ENV_ORD: Record<string, number> = { Docs: 0, Test: 1, Dev: 2, Production: 3 };
const INTENT_ORD: Record<string, number> = { example: 0, public: 1, secret: 2 };
const EXPOSURE_ORD: Record<string, number> = {
  'Docs-only': 0, 'Private dev/test': 1, Internal: 2, 'Internet-facing': 3, Public: 4,
};
const CRIT_ORD: Record<string, number> = { Low: 0, Medium: 1, High: 2 };

// Map ContextFeatures -> numeric vector in FEATURE_ORDER. Used identically by
// training and inference so the columns can never drift.
export function featurize(f: ContextFeatures): number[] {
  return [
    b(f.isProdPath), b(f.isDevPath), b(f.isTestPath), b(f.isDocsPath), b(f.isExamplePath),
    b(f.isConfigFile), b(f.isSourceCodeFile), b(f.isLogFile), b(f.isIacFile),
    ENV_ORD[f.environmentHint] ?? 2,
    f.valueLength, f.entropy, ENTROPY_ORD[f.entropyLevel] ?? 1,
    b(f.hasLivePrefix), b(f.hasTestPrefix), b(f.looksLikePlaceholder), b(f.isKnownTestValue),
    b(f.hasSecretVariableName), b(f.hasPublicVariableName), INTENT_ORD[f.variableIntent] ?? 2,
    b(f.hasExampleLanguage), b(f.hasPlaceholderLanguage), b(f.hasTestLanguage),
    b(f.hasSecretLanguage), b(f.hasProductionLanguage), b(f.hasDocumentationContext),
    EXPOSURE_ORD[f.storageExposure] ?? 2, b(f.isPubliclyAccessible), CRIT_ORD[f.assetCriticality] ?? 1,
    b(f.structurallyValid), b(f.luhnValid), b(f.formatValidForType), b(f.isPublicByDesign),
    b(f.isHighEntropySha), b(f.isAlreadyMasked), b(f.shapeContradictsType), b(f.isKnownTestVector),
    b(f.inTestDir), b(f.inFixturesDir), b(f.inSamplesDir), b(f.inBoilerplateDir),
    f.patternFrequency ?? 1, b(f.isHighFrequencyPattern),
    b(f.hasPlaceholderIdentity), b(f.hasStructuralDomainNoun),
    typeSeverity(f.detectedType) / 100,
  ];
}

// ---- Serialised model ------------------------------------------------------
export type TreeNode =
  | { leaf: number }
  | { f: number; t: number; l: TreeNode; r: TreeNode };

export interface Forest {
  name: string;
  featureOrder: readonly string[];
  trees: TreeNode[];
  meta?: Record<string, unknown>;
}

// ---- Synchronous inference -------------------------------------------------
function evalTree(node: TreeNode, x: number[]): number {
  let n = node;
  while ('f' in n) n = x[n.f] <= n.t ? n.l : n.r;
  return n.leaf;
}

// Average the per-tree leaf probabilities. Pure + synchronous + sub-µs.
export function evaluateForest(forest: Forest, x: number[]): number {
  if (forest.trees.length === 0) return 0.5;
  let sum = 0;
  for (const tree of forest.trees) sum += evalTree(tree, x);
  return sum / forest.trees.length;
}

export function predictFeatures(forest: Forest, f: ContextFeatures): number {
  return evaluateForest(forest, featurize(f));
}

// ---- Seeded PRNG (reproducible committed model) ----------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Training (CART + bagging) ---------------------------------------------
export interface TrainOptions {
  nTrees?: number;
  maxDepth?: number;
  minLeaf?: number;
  featureSubset?: number; // features considered per split; default sqrt(d)
  seed?: number;
  name?: string;
}

interface Row {
  x: number[];
  y: 0 | 1;
}

function gini(pos: number, n: number): number {
  if (n === 0) return 0;
  const p = pos / n;
  return 1 - p * p - (1 - p) * (1 - p);
}

function buildTree(
  rows: Row[],
  idx: number[],
  depth: number,
  opts: Required<Pick<TrainOptions, 'maxDepth' | 'minLeaf' | 'featureSubset'>>,
  rand: () => number,
  dim: number,
): TreeNode {
  let pos = 0;
  for (const i of idx) pos += rows[i].y;
  const leafVal = idx.length ? pos / idx.length : 0.5;

  if (depth >= opts.maxDepth || idx.length < opts.minLeaf * 2 || pos === 0 || pos === idx.length) {
    return { leaf: leafVal };
  }

  // random feature subset (sampling without replacement)
  const feats: number[] = [];
  const pool = Array.from({ length: dim }, (_, k) => k);
  const k = Math.min(opts.featureSubset, dim);
  for (let s = 0; s < k; s++) {
    const j = s + Math.floor(rand() * (pool.length - s));
    [pool[s], pool[j]] = [pool[j], pool[s]];
    feats.push(pool[s]);
  }

  const parentGini = gini(pos, idx.length);
  let best: { f: number; t: number; gain: number; left: number[]; right: number[] } | null = null;

  for (const f of feats) {
    const vals = Array.from(new Set(idx.map((i) => rows[i].x[f]))).sort((a, c) => a - c);
    for (let v = 0; v < vals.length - 1; v++) {
      const t = (vals[v] + vals[v + 1]) / 2;
      const left: number[] = [];
      const right: number[] = [];
      let lpos = 0;
      let rpos = 0;
      for (const i of idx) {
        if (rows[i].x[f] <= t) {
          left.push(i);
          lpos += rows[i].y;
        } else {
          right.push(i);
          rpos += rows[i].y;
        }
      }
      if (left.length < opts.minLeaf || right.length < opts.minLeaf) continue;
      const wGini =
        (left.length / idx.length) * gini(lpos, left.length) +
        (right.length / idx.length) * gini(rpos, right.length);
      const gain = parentGini - wGini;
      if (!best || gain > best.gain) best = { f, t, gain, left, right };
    }
  }

  if (!best || best.gain <= 1e-9) return { leaf: leafVal };
  return {
    f: best.f,
    t: best.t,
    l: buildTree(rows, best.left, depth + 1, opts, rand, dim),
    r: buildTree(rows, best.right, depth + 1, opts, rand, dim),
  };
}

export function trainForest(rows: Row[], options: TrainOptions = {}): Forest {
  const dim = rows[0]?.x.length ?? FEATURE_ORDER.length;
  const nTrees = options.nTrees ?? 120;
  const opts = {
    maxDepth: options.maxDepth ?? 5,
    minLeaf: options.minLeaf ?? 2,
    featureSubset: options.featureSubset ?? Math.max(1, Math.round(Math.sqrt(dim))),
  };
  const rand = mulberry32(options.seed ?? 1337);
  const trees: TreeNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    // bootstrap sample (with replacement)
    const idx: number[] = [];
    for (let i = 0; i < rows.length; i++) idx.push(Math.floor(rand() * rows.length));
    trees.push(buildTree(rows, idx, 0, opts, rand, dim));
  }
  return {
    name: options.name ?? 'forest-semantic-v1',
    featureOrder: FEATURE_ORDER,
    trees,
    meta: { nTrees, ...opts, dim, samples: rows.length },
  };
}
