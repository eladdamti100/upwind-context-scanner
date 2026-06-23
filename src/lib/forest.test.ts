// Tests for the pure-TS Random Forest (forest.ts): training, sync inference,
// featurization, and JSON serialisation round-trip.
import { test, expect, describe } from 'vitest';
import { trainForest, evaluateForest, featurize, FEATURE_ORDER, type Forest } from './forest';
import { makeFeatures } from './testFeatures';

describe('featurize', () => {
  test('produces a vector matching FEATURE_ORDER length', () => {
    expect(featurize(makeFeatures()).length).toBe(FEATURE_ORDER.length);
  });
  test('all entries are finite numbers', () => {
    for (const v of featurize(makeFeatures({ entropyLevel: 'high', isProdPath: true }))) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('trainForest + evaluateForest', () => {
  // Synthetic separable problem: class depends purely on feature index 0.
  function makeRows() {
    const rows: { x: number[]; y: 0 | 1 }[] = [];
    for (let i = 0; i < 80; i++) {
      const pos = i % 2 === 0;
      const x = new Array(FEATURE_ORDER.length).fill(0);
      x[0] = pos ? 1 : 0;
      rows.push({ x, y: pos ? 1 : 0 });
    }
    return rows;
  }

  test('learns a separable signal (pos vs neg separated by 0.5)', () => {
    const forest = trainForest(makeRows(), { seed: 7, nTrees: 40, maxDepth: 3 });
    const posX = new Array(FEATURE_ORDER.length).fill(0);
    posX[0] = 1;
    const negX = new Array(FEATURE_ORDER.length).fill(0);
    expect(evaluateForest(forest, posX)).toBeGreaterThan(0.5);
    expect(evaluateForest(forest, negX)).toBeLessThan(0.5);
  });

  test('probabilities are always within [0,1]', () => {
    const forest = trainForest(makeRows(), { seed: 7, nTrees: 20 });
    for (const r of makeRows()) {
      const p = evaluateForest(forest, r.x);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  test('is deterministic for a fixed seed', () => {
    const a = trainForest(makeRows(), { seed: 42, nTrees: 30 });
    const b = trainForest(makeRows(), { seed: 42, nTrees: 30 });
    const x = makeRows()[0].x;
    expect(evaluateForest(a, x)).toBe(evaluateForest(b, x));
  });

  test('survives a JSON serialisation round-trip', () => {
    const forest = trainForest(makeRows(), { seed: 7, nTrees: 20 });
    const restored = JSON.parse(JSON.stringify(forest)) as Forest;
    const x = makeRows()[0].x;
    expect(evaluateForest(restored, x)).toBe(evaluateForest(forest, x));
  });
});
