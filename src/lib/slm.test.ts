// Tests for the SLM semantic layer ("DSPM Semantic Guardrail") in lgbm.ts.
// Covers prompt/payload construction, response parsing, the deterministic
// fallback, the local connector with an INJECTED fetch stub (no real network),
// and environment-based classifier resolution.

import { test, expect, describe } from 'vitest';
import {
  buildSystemPrompt,
  buildUserPayload,
  parseSlmResponse,
  mockSemanticClassifier,
  createLocalSlmClassifier,
  resolveSemanticClassifier,
  SLM_CLASSIFICATIONS,
  type SlmClassifierInput,
  type FetchLike,
} from './lgbm';
import { makeFeatures } from './testFeatures';

function makeInput(overrides: Partial<SlmClassifierInput> = {}): SlmClassifierInput {
  return {
    detectedType: 'aws-access-key',
    maskedLineContext: 'AWS_SECRET_ACCESS_KEY=AKIA••••5T2Q',
    features: makeFeatures(),
    ...overrides,
  };
}

// Build a fetch stub that returns an OpenAI-compatible chat-completion whose
// message content is `content`. `ok`/`status` are configurable.
function fetchReturning(content: string, ok = true, status = 200): FetchLike {
  return async () => ({
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  });
}

// ---------------------------------------------------------------------------
// Prompt + payload
// ---------------------------------------------------------------------------
describe('prompt construction', () => {
  test('system prompt frames the model as a DSPM Semantic Guardrail emitting JSON', () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/DSPM Semantic Guardrail/);
    expect(p).toMatch(/secretProbability/);
    expect(p).toMatch(/modelClassification/);
    expect(p).toMatch(/reason/);
  });

  test('user payload includes masked line context and structural signals, never a raw value', () => {
    const payload = buildUserPayload(
      makeInput({ maskedLineContext: 'token=tok_••••1234' }),
    );
    expect(payload).toMatch(/tok_••••1234/);
    expect(payload).toMatch(/structuralSignals/);
    expect(payload).toMatch(/semanticAnchors/);
    // The payload is built only from masked/structural fields — assert it is JSON.
    expect(() => JSON.parse(payload.slice(payload.indexOf('{')))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------
describe('parseSlmResponse', () => {
  test('parses a clean JSON object', () => {
    const r = parseSlmResponse(
      '{"secretProbability":0.91,"modelClassification":"true_secret","reason":"live key"}',
    );
    expect(r.secretProbability).toBe(0.91);
    expect(r.modelClassification).toBe('true_secret');
    expect(r.reason).toBe('live key');
  });

  test('parses JSON wrapped in ```json code fences and surrounding prose', () => {
    const raw = 'Here is my verdict:\n```json\n{"secretProbability":0.1,"modelClassification":"placeholder","reason":"example"}\n```';
    const r = parseSlmResponse(raw);
    expect(r.modelClassification).toBe('placeholder');
    expect(r.secretProbability).toBe(0.1);
  });

  test('throws on non-JSON output', () => {
    expect(() => parseSlmResponse('I cannot answer that.')).toThrow();
  });

  test('throws on out-of-range probability', () => {
    expect(() =>
      parseSlmResponse('{"secretProbability":1.7,"modelClassification":"true_secret","reason":"x"}'),
    ).toThrow();
  });

  test('throws on a classification outside the taxonomy', () => {
    expect(() =>
      parseSlmResponse('{"secretProbability":0.5,"modelClassification":"definitely_a_secret","reason":"x"}'),
    ).toThrow();
  });

  test('every taxonomy label round-trips', () => {
    for (const cls of SLM_CLASSIFICATIONS) {
      const r = parseSlmResponse(`{"secretProbability":0.5,"modelClassification":"${cls}","reason":"x"}`);
      expect(r.modelClassification).toBe(cls);
    }
  });
});

// ---------------------------------------------------------------------------
// Deterministic fallback
// ---------------------------------------------------------------------------
describe('mockSemanticClassifier (fallback)', () => {
  test('returns a valid, in-range result for a strong secret', async () => {
    const r = await mockSemanticClassifier.classify(
      makeInput({
        features: makeFeatures({
          detectedType: 'aws-access-key',
          hasSecretVariableName: true,
          hasLivePrefix: true,
          entropyLevel: 'high',
          isProdPath: true,
          isConfigFile: true,
        }),
      }),
    );
    expect(r.secretProbability).toBeGreaterThanOrEqual(0);
    expect(r.secretProbability).toBeLessThanOrEqual(1);
    expect(SLM_CLASSIFICATIONS).toContain(r.modelClassification);
    expect(typeof r.reason).toBe('string');
  });

  test('classifies a public-by-design value as public_non_secret', async () => {
    const r = await mockSemanticClassifier.classify(
      makeInput({ features: makeFeatures({ isPublicByDesign: true }) }),
    );
    expect(r.modelClassification).toBe('public_non_secret');
  });

  test('classifies a Luhn-failing card-shaped value as false_positive', async () => {
    const r = await mockSemanticClassifier.classify(
      makeInput({ features: makeFeatures({ luhnValid: false, detectedType: 'credit-card-pan' }) }),
    );
    expect(r.modelClassification).toBe('false_positive');
  });
});

// ---------------------------------------------------------------------------
// Local SLM connector — injected fetch stub, no network
// ---------------------------------------------------------------------------
describe('createLocalSlmClassifier', () => {
  const config = { endpoint: 'http://localhost:8000/v1/chat/completions', model: 'qwen2.5-coder:7b' };

  test('parses a valid endpoint response and tags it with the model', async () => {
    const clf = createLocalSlmClassifier(
      config,
      fetchReturning('{"secretProbability":0.88,"modelClassification":"true_secret","reason":"live"}'),
    );
    const r = await clf.classify(makeInput());
    expect(r.secretProbability).toBe(0.88);
    expect(r.modelClassification).toBe('true_secret');
    expect(r.model).toBe('qwen2.5-coder:7b');
    expect(clf.name).toBe('local-slm:qwen2.5-coder:7b');
  });

  test('falls back to the deterministic guardrail on a non-OK response', async () => {
    const clf = createLocalSlmClassifier(config, fetchReturning('', false, 503));
    const r = await clf.classify(makeInput({ features: makeFeatures({ isPublicByDesign: true }) }));
    expect(r.model).toBe('qwen2.5-coder:7b#fallback');
    expect(r.modelClassification).toBe('public_non_secret');
  });

  test('falls back on malformed model output', async () => {
    const clf = createLocalSlmClassifier(config, fetchReturning('not json at all'));
    const r = await clf.classify(makeInput());
    expect(r.model).toBe('qwen2.5-coder:7b#fallback');
    expect(SLM_CLASSIFICATIONS).toContain(r.modelClassification);
  });

  test('falls back when the transport throws', async () => {
    const throwing: FetchLike = async () => {
      throw new Error('connection refused');
    };
    const clf = createLocalSlmClassifier(config, throwing);
    const r = await clf.classify(makeInput());
    expect(r.model).toBe('qwen2.5-coder:7b#fallback');
  });
});

// ---------------------------------------------------------------------------
// Environment-based resolution
// ---------------------------------------------------------------------------
describe('resolveSemanticClassifier', () => {
  test('returns the mock when no endpoint is configured', () => {
    expect(resolveSemanticClassifier({})).toBe(mockSemanticClassifier);
  });

  test('returns a local connector when SLM_ENDPOINT and SLM_MODEL are set', () => {
    const clf = resolveSemanticClassifier({
      SLM_ENDPOINT: 'http://localhost:11434/v1/chat/completions',
      SLM_MODEL: 'phi3.5',
    });
    expect(clf.name).toBe('local-slm:phi3.5');
  });
});
