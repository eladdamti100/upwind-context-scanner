// Tests for the in-process Spatial Semantic Engine (semanticEngine.ts):
// synchronous corpus scoring, the downward-only spatial invariant, singleton
// no-op, and group down-weighting of a collectively-benign file.
import { test, expect, describe } from 'vitest';
import { forestSpatialEngine, type SemanticEngineInput } from './semanticEngine';
import { makeFeatures } from './testFeatures';
import type { ContextFeatures } from '../types';

function input(id: string, filePath: string, overrides: Partial<ContextFeatures> = {}): SemanticEngineInput {
  return {
    findingId: id,
    detectedType: overrides.detectedType ?? 'generic-token',
    filePath,
    maskedLineContext: 'x=••••',
    features: makeFeatures(overrides),
  };
}

describe('forestSpatialEngine.classifyCorpus', () => {
  test('is synchronous and returns one verdict per input', () => {
    const out = forestSpatialEngine.classifyCorpus([
      input('a', '/src/app/config.ts'),
      input('b', '/src/app/other.ts'),
    ]);
    expect(Array.isArray(out)).toBe(true); // sync — not a Promise
    expect(out.map((v) => v.findingId).sort()).toEqual(['a', 'b']);
    for (const v of out) {
      expect(v.secretProbability).toBeGreaterThanOrEqual(0);
      expect(v.secretProbability).toBeLessThanOrEqual(1);
    }
  });

  test('downward-only invariant: spatial never raises a finding above its base score', () => {
    const benign = Array.from({ length: 8 }, (_, i) =>
      input(`f${i}`, '/repo/tests/fixtures/data.ts', {
        inFixturesDir: true,
        looksLikePlaceholder: true,
        hasPlaceholderIdentity: true,
        isHighFrequencyPattern: true,
      }),
    );
    for (const v of forestSpatialEngine.classifyCorpus(benign)) {
      expect(v.secretProbability).toBeLessThanOrEqual(v.baseProbability + 1e-9);
    }
  });

  test('a single finding is unchanged by spatial (no group evidence)', () => {
    const [v] = forestSpatialEngine.classifyCorpus([
      input('solo', '/srv/prod/.env', { hasSecretVariableName: true, entropyLevel: 'high', isProdPath: true }),
    ]);
    expect(v.secretProbability).toBe(v.baseProbability);
    expect(v.spatial?.downgraded).toBe(false);
    expect(v.spatial?.groupSize).toBe(1);
  });

  test('a collectively-benign file group-downgrades its members', () => {
    const features = {
      inFixturesDir: true,
      looksLikePlaceholder: true,
      hasPlaceholderIdentity: true,
      isHighFrequencyPattern: true,
      hasSecretVariableName: true, // secret-shaped, but in a benign file cluster
      entropyLevel: 'high' as const,
    };
    // same finding alone vs. inside a large benign file
    const [solo] = forestSpatialEngine.classifyCorpus([input('x', '/repo/fixtures/seed.ts', features)]);
    const group = forestSpatialEngine.classifyCorpus(
      Array.from({ length: 8 }, (_, i) => input(`g${i}`, '/repo/fixtures/seed.ts', features)),
    );
    const member = group[0];
    expect(member.spatial!.fileBenignPrior).toBeGreaterThan(0.15);
    expect(member.spatial!.downgraded).toBe(true);
    // grouped score is no higher than the same finding scored alone
    expect(member.secretProbability).toBeLessThanOrEqual(solo.secretProbability);
  });
});
