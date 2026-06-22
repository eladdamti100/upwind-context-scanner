import { test, expect } from 'vitest';
import { extractFeatures, AssetContext } from './features';
import type { FindingContextObject } from '../types';

// ---- Helper to build a default FindingContextObject -------------------------
function makeCtx(overrides: Partial<{
  fileName: string;
  filePath: string;
  fileExtension: string;
  fileRole: string;
  storageLocation: string;
  detectedType: string;
  maskedValue: string;
  valuePrefix: string;
  valueSuffix: string;
  valueLength: number;
  entropy: number;
  entropyLevel: 'low' | 'medium' | 'high';
  variableName: string;
  lineTextMasked: string;
  previousLinesMasked: string[];
  nextLinesMasked: string[];
  customerVertical: 'saas' | 'fintech' | 'retail' | 'healthcare' | 'general';
}>): FindingContextObject {
  const o = overrides;
  return {
    findingId: 'test-finding-001',
    file: {
      fileName: o.fileName ?? 'config.env',
      filePath: o.filePath ?? '/app',
      fileExtension: o.fileExtension ?? 'env',
      fileRole: o.fileRole ?? 'config',
      storageLocation: o.storageLocation ?? 's3://bucket',
    },
    candidate: {
      detectedType: o.detectedType ?? 'generic-token',
      maskedValue: o.maskedValue ?? 'tok_••••1234',
      valuePrefix: o.valuePrefix ?? 'tok_',
      valueSuffix: o.valueSuffix ?? '1234',
      valueLength: o.valueLength ?? 40,
      entropy: o.entropy ?? 3.5,
      entropyLevel: o.entropyLevel ?? 'medium',
      lineNumber: 10,
      offset: 5,
      variableName: o.variableName ?? 'MY_TOKEN',
    },
    regex: { ruleId: 'rule-1', ruleSource: 'base', regexConfidence: 0.9 },
    localContext: {
      lineTextMasked: o.lineTextMasked ?? 'MY_TOKEN=tok_••••1234',
      previousLinesMasked: o.previousLinesMasked ?? [],
      nextLinesMasked: o.nextLinesMasked ?? [],
    },
    scanMetadata: {
      sensitivityMode: 'balanced',
      customerVertical: o.customerVertical ?? 'general',
      enabledRulePacks: ['base'],
    },
  };
}

const defaultAsset: AssetContext = {
  storageExposure: 'Internal',
  assetCriticality: 'Medium',
  cloudProvider: 'AWS',
};

// ============================================================================
// Fixture A — Production AWS key
// ============================================================================
const ctxA = makeCtx({
  filePath: '/srv/payments/.env.production',
  fileName: '.env.production',
  fileExtension: 'env',
  fileRole: 'production_config',
  variableName: 'AWS_SECRET_ACCESS_KEY',
  valuePrefix: 'AKIA',
  maskedValue: 'AKIA••••5T2Q',
  entropyLevel: 'high',
  lineTextMasked: 'AWS_SECRET_ACCESS_KEY=AKIA••••5T2Q',
  previousLinesMasked: ['# Production payment configuration'],
  nextLinesMasked: [],
  customerVertical: 'fintech',
});
const assetA: AssetContext = {
  storageExposure: 'Public',
  assetCriticality: 'High',
  cloudProvider: 'AWS',
};

test('A: isProdPath is true', () => {
  expect(extractFeatures(ctxA, assetA).isProdPath).toBe(true);
});
test('A: isConfigFile is true (env extension)', () => {
  expect(extractFeatures(ctxA, assetA).isConfigFile).toBe(true);
});
test('A: isConfigFile is true (.env filename prefix)', () => {
  // .env.production starts with .env
  expect(extractFeatures(ctxA, assetA).isConfigFile).toBe(true);
});
test('A: hasSecretVariableName is true', () => {
  expect(extractFeatures(ctxA, assetA).hasSecretVariableName).toBe(true);
});
test('A: hasLivePrefix is true (AKIA prefix)', () => {
  expect(extractFeatures(ctxA, assetA).hasLivePrefix).toBe(true);
});
test('A: isPubliclyAccessible is true (Public exposure)', () => {
  expect(extractFeatures(ctxA, assetA).isPubliclyAccessible).toBe(true);
});
test('A: variableIntent is secret', () => {
  expect(extractFeatures(ctxA, assetA).variableIntent).toBe('secret');
});
test('A: customerVertical is fintech', () => {
  expect(extractFeatures(ctxA, assetA).customerVertical).toBe('fintech');
});
test('A: isDocsPath is false', () => {
  expect(extractFeatures(ctxA, assetA).isDocsPath).toBe(false);
});
test('A: assetCriticality is High', () => {
  expect(extractFeatures(ctxA, assetA).assetCriticality).toBe('High');
});
test('A: storageExposure is Public', () => {
  expect(extractFeatures(ctxA, assetA).storageExposure).toBe('Public');
});
test('A: cloudProvider is AWS', () => {
  expect(extractFeatures(ctxA, assetA).cloudProvider).toBe('AWS');
});
test('A: environmentHint is Production', () => {
  expect(extractFeatures(ctxA, assetA).environmentHint).toBe('Production');
});
test('A: isTestPath is false', () => {
  expect(extractFeatures(ctxA, assetA).isTestPath).toBe(false);
});

// ============================================================================
// Fixture B — README example
// ============================================================================
const ctxB = makeCtx({
  filePath: '/docs/README.md',
  fileName: 'README.md',
  fileExtension: 'md',
  fileRole: 'documentation',
  variableName: 'api_key',
  valuePrefix: 'api_key_',
  maskedValue: 'api_key_••••EXAMPLE',
  entropyLevel: 'low',
  lineTextMasked: 'For example, set your api key here: api_key_••••EXAMPLE',
  previousLinesMasked: [],
  nextLinesMasked: [],
  customerVertical: 'saas',
});

test('B: isDocsPath is true (md extension)', () => {
  expect(extractFeatures(ctxB, defaultAsset).isDocsPath).toBe(true);
});
test('B: looksLikePlaceholder is true (EXAMPLE in maskedValue)', () => {
  expect(extractFeatures(ctxB, defaultAsset).looksLikePlaceholder).toBe(true);
});
test('B: hasExampleLanguage is true', () => {
  expect(extractFeatures(ctxB, defaultAsset).hasExampleLanguage).toBe(true);
});
test('B: hasDocumentationContext is true', () => {
  expect(extractFeatures(ctxB, defaultAsset).hasDocumentationContext).toBe(true);
});
test('B: isConfigFile is false (md extension, no config path)', () => {
  expect(extractFeatures(ctxB, defaultAsset).isConfigFile).toBe(false);
});
test('B: hasLivePrefix is false', () => {
  expect(extractFeatures(ctxB, defaultAsset).hasLivePrefix).toBe(false);
});
test('B: environmentHint is Docs', () => {
  expect(extractFeatures(ctxB, defaultAsset).environmentHint).toBe('Docs');
});
test('B: isTestPath is false', () => {
  expect(extractFeatures(ctxB, defaultAsset).isTestPath).toBe(false);
});

// ============================================================================
// Fixture C — Test fixture
// ============================================================================
const ctxC = makeCtx({
  filePath: '/tests/fixtures.test.ts',
  fileName: 'fixtures.test.ts',
  fileExtension: 'ts',
  fileRole: 'test',
  variableName: 'dummyToken',
  valuePrefix: 'tok_',
  maskedValue: 'tok_••••dummy',
  entropyLevel: 'low',
  lineTextMasked: 'mock token for tests',
  previousLinesMasked: [],
  nextLinesMasked: [],
  customerVertical: 'general',
});

test('C: isTestPath is true (path contains tests/)', () => {
  expect(extractFeatures(ctxC, defaultAsset).isTestPath).toBe(true);
});
test('C: isSourceCodeFile is true (ts extension)', () => {
  expect(extractFeatures(ctxC, defaultAsset).isSourceCodeFile).toBe(true);
});
test('C: looksLikePlaceholder is true (dummy in maskedValue)', () => {
  expect(extractFeatures(ctxC, defaultAsset).looksLikePlaceholder).toBe(true);
});
test('C: hasTestLanguage is true (mock, tests in text)', () => {
  expect(extractFeatures(ctxC, defaultAsset).hasTestLanguage).toBe(true);
});
test('C: variableIntent is example (dummy in variableName)', () => {
  expect(extractFeatures(ctxC, defaultAsset).variableIntent).toBe('example');
});
test('C: isDocsPath is false', () => {
  expect(extractFeatures(ctxC, defaultAsset).isDocsPath).toBe(false);
});
test('C: environmentHint is Test (isTestPath)', () => {
  expect(extractFeatures(ctxC, defaultAsset).environmentHint).toBe('Test');
});

// ============================================================================
// Additional edge-case tests
// ============================================================================

// isTestPath via .test. in filename
test('isTestPath via .test. in path', () => {
  const ctx = makeCtx({ filePath: '/src/utils', fileName: 'utils.test.ts', fileExtension: 'ts' });
  expect(extractFeatures(ctx, defaultAsset).isTestPath).toBe(true);
});

// isTestPath via __tests__ directory
test('isTestPath via __tests__ in path', () => {
  const ctx = makeCtx({ filePath: '/src/__tests__/helpers', fileName: 'foo.ts', fileExtension: 'ts' });
  expect(extractFeatures(ctx, defaultAsset).isTestPath).toBe(true);
});

// isDocsPath via readme in path
test('isDocsPath via readme in path', () => {
  const ctx = makeCtx({ filePath: '/project', fileName: 'readme.txt', fileExtension: 'txt' });
  expect(extractFeatures(ctx, defaultAsset).isDocsPath).toBe(true);
});

// isExamplePath
test('isExamplePath is true when path contains example', () => {
  const ctx = makeCtx({ filePath: '/project/examples/demo', fileName: 'config.env', fileExtension: 'env' });
  expect(extractFeatures(ctx, defaultAsset).isExamplePath).toBe(true);
});

// isConfigFile via yaml
test('isConfigFile is true for yaml extension', () => {
  const ctx = makeCtx({ filePath: '/app', fileName: 'app.yaml', fileExtension: 'yaml' });
  expect(extractFeatures(ctx, defaultAsset).isConfigFile).toBe(true);
});

// isConfigFile via docker-compose in path
test('isConfigFile is true for docker-compose in path', () => {
  const ctx = makeCtx({ filePath: '/project', fileName: 'docker-compose.yml', fileExtension: 'yml' });
  expect(extractFeatures(ctx, defaultAsset).isConfigFile).toBe(true);
});

// isIacFile via tf extension
test('isIacFile is true for tf extension', () => {
  const ctx = makeCtx({ filePath: '/infra', fileName: 'main.tf', fileExtension: 'tf' });
  expect(extractFeatures(ctx, defaultAsset).isIacFile).toBe(true);
});

// isIacFile via k8s yaml
test('isIacFile is true for yaml with k8s in path', () => {
  const ctx = makeCtx({ filePath: '/deploy/k8s', fileName: 'deployment.yaml', fileExtension: 'yaml' });
  expect(extractFeatures(ctx, defaultAsset).isIacFile).toBe(true);
});

// isLogFile
test('isLogFile is true for log extension', () => {
  const ctx = makeCtx({ filePath: '/var/log', fileName: 'app.log', fileExtension: 'log' });
  expect(extractFeatures(ctx, defaultAsset).isLogFile).toBe(true);
});

// isDevPath
test('isDevPath is true for /dev/ path segment', () => {
  const ctx = makeCtx({ filePath: '/app/dev/config', fileName: 'secrets.env', fileExtension: 'env' });
  expect(extractFeatures(ctx, defaultAsset).isDevPath).toBe(true);
});

// hasLivePrefix via 'live' in prefix
test('hasLivePrefix is true when prefix contains live', () => {
  const ctx = makeCtx({ valuePrefix: 'live_sk_' });
  expect(extractFeatures(ctx, defaultAsset).hasLivePrefix).toBe(true);
});

// hasTestPrefix via 'test' in prefix
test('hasTestPrefix is true when prefix contains test', () => {
  const ctx = makeCtx({ valuePrefix: 'test_sk_' });
  expect(extractFeatures(ctx, defaultAsset).hasTestPrefix).toBe(true);
});

// hasTestPrefix via 'sandbox' in prefix
test('hasTestPrefix is true when prefix contains sandbox', () => {
  const ctx = makeCtx({ valuePrefix: 'sandbox_key_' });
  expect(extractFeatures(ctx, defaultAsset).hasTestPrefix).toBe(true);
});

// isKnownTestValue via detectedType
test('isKnownTestValue is true for test-card-number', () => {
  const ctx = makeCtx({ detectedType: 'test-card-number' });
  expect(extractFeatures(ctx, defaultAsset).isKnownTestValue).toBe(true);
});

// isKnownTestValue via 4242 in maskedValue
test('isKnownTestValue is true when maskedValue contains 4242', () => {
  const ctx = makeCtx({ maskedValue: '4242••••4242' });
  expect(extractFeatures(ctx, defaultAsset).isKnownTestValue).toBe(true);
});

// hasPublicVariableName
test('hasPublicVariableName is true for URL variable name', () => {
  const ctx = makeCtx({ variableName: 'API_ENDPOINT_URL' });
  expect(extractFeatures(ctx, defaultAsset).hasPublicVariableName).toBe(true);
});

// variableIntent public
test('variableIntent is public for public variable name (no example/secret)', () => {
  const ctx = makeCtx({ variableName: 'API_HOST' });
  expect(extractFeatures(ctx, defaultAsset).variableIntent).toBe('public');
});

// hasPlaceholderLanguage
test('hasPlaceholderLanguage is true when text contains placeholder', () => {
  const ctx = makeCtx({ lineTextMasked: 'placeholder value here' });
  expect(extractFeatures(ctx, defaultAsset).hasPlaceholderLanguage).toBe(true);
});

// hasSecretLanguage
test('hasSecretLanguage is true when text contains secret', () => {
  const ctx = makeCtx({ lineTextMasked: 'store the secret here' });
  expect(extractFeatures(ctx, defaultAsset).hasSecretLanguage).toBe(true);
});

// hasProductionLanguage
test('hasProductionLanguage is true when text contains production', () => {
  const ctx = makeCtx({ lineTextMasked: 'used in production environment' });
  expect(extractFeatures(ctx, defaultAsset).hasProductionLanguage).toBe(true);
});

// isPubliclyAccessible via Internet-facing
test('isPubliclyAccessible is true for Internet-facing exposure', () => {
  const asset: AssetContext = { storageExposure: 'Internet-facing', assetCriticality: 'High', cloudProvider: 'GCP' };
  const ctx = makeCtx({});
  expect(extractFeatures(ctx, asset).isPubliclyAccessible).toBe(true);
});

// isPubliclyAccessible false for Internal
test('isPubliclyAccessible is false for Internal exposure', () => {
  const asset: AssetContext = { storageExposure: 'Internal', assetCriticality: 'Medium', cloudProvider: 'AWS' };
  const ctx = makeCtx({});
  expect(extractFeatures(ctx, asset).isPubliclyAccessible).toBe(false);
});

// fileRole passthrough
test('fileRole is passed through from ctx.file.fileRole', () => {
  const ctx = makeCtx({ fileRole: 'production_config' });
  expect(extractFeatures(ctx, defaultAsset).fileRole).toBe('production_config');
});

// entropyLevel passthrough
test('entropyLevel is passed through', () => {
  const ctx = makeCtx({ entropyLevel: 'high' });
  expect(extractFeatures(ctx, defaultAsset).entropyLevel).toBe('high');
});

// environmentHint Dev fallback
test('environmentHint falls back to Dev when no specific path match', () => {
  const ctx = makeCtx({ filePath: '/src/services', fileName: 'config.ts', fileExtension: 'ts' });
  expect(extractFeatures(ctx, defaultAsset).environmentHint).toBe('Dev');
});

// looksLikePlaceholder via prefix
test('looksLikePlaceholder is true when prefix contains your_api', () => {
  const ctx = makeCtx({ valuePrefix: 'your_api_key', maskedValue: 'your_api_key••••' });
  expect(extractFeatures(ctx, defaultAsset).looksLikePlaceholder).toBe(true);
});

// hasDocumentationContext via text
test('hasDocumentationContext is true when text mentions readme', () => {
  const ctx = makeCtx({
    filePath: '/project',
    fileName: 'notes.txt',
    fileExtension: 'txt',
    lineTextMasked: 'see the readme for details',
  });
  expect(extractFeatures(ctx, defaultAsset).hasDocumentationContext).toBe(true);
});

// ============================================================================
// environmentHint defaults to 'Dev' for non-docs/test/prod paths
// ============================================================================
test('environmentHint is Dev for a dev/staging path', () => {
  const ctx = makeCtx({ filePath: '/services/dev', fileName: 'app.config' });
  expect(extractFeatures(ctx, defaultAsset).environmentHint).toBe('Dev');
});
test('environmentHint is Dev for an unclassified path', () => {
  const ctx = makeCtx({ filePath: '/app', fileName: 'settings.json', fileExtension: 'json' });
  expect(extractFeatures(ctx, defaultAsset).environmentHint).toBe('Dev');
});
