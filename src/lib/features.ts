// src/lib/features.ts
// Pure feature-extraction function. Reads only masked fields, variable names,
// paths, and asset context. Never reconstructs or logs a full secret.
import type { FindingContextObject, ContextFeatures, Exposure, AssetCriticality } from '../types';

export interface AssetContext {
  storageExposure: Exposure;
  assetCriticality: AssetCriticality;
  cloudProvider: string;
}

// ---------------------------------------------------------------------------
// Global pattern frequency (corpus-level)
// ---------------------------------------------------------------------------
// A repo-wide count of how often each structural fingerprint repeats. Built once
// over all findings and threaded into extractFeatures. Fingerprint uses only
// masked/structural fields (type + prefix shape + length bucket) — never a raw
// value. High repetition universally signals benign system IDs/traces.
export type CorpusStats = Record<string, number>;

// Threshold above which a repeated structural shape is treated as benign noise.
const HIGH_FREQUENCY_THRESHOLD = 5;

export function patternFingerprint(ctx: FindingContextObject): string {
  const type = ctx.candidate.detectedType;
  // Collapse the prefix to a coarse shape so near-identical machine IDs collide:
  // letters→a, digits→9, everything else preserved.
  const prefixShape = ctx.candidate.valuePrefix
    .toLowerCase()
    .replace(/[a-z]/g, 'a')
    .replace(/[0-9]/g, '9');
  // Bucket the length into bands of 8 so minor variation still collides.
  const lenBucket = Math.floor(ctx.candidate.valueLength / 8);
  return `${type}|${prefixShape}|${lenBucket}`;
}

export function buildCorpusStats(findings: FindingContextObject[]): CorpusStats {
  const stats: CorpusStats = {};
  for (const f of findings) {
    const key = patternFingerprint(f);
    stats[key] = (stats[key] ?? 0) + 1;
  }
  return stats;
}

export function extractFeatures(
  ctx: FindingContextObject,
  asset: AssetContext,
  corpusStats?: CorpusStats,
): ContextFeatures {
  // ---- Derived base strings --------------------------------------------------
  const path = (ctx.file.filePath + '/' + ctx.file.fileName).toLowerCase();
  const ext = ctx.file.fileExtension.toLowerCase();
  const name = ctx.candidate.variableName;
  const prefix = ctx.candidate.valuePrefix.toLowerCase();
  const masked = ctx.candidate.maskedValue.toLowerCase();
  const text = [
    ctx.localContext.lineTextMasked,
    ...ctx.localContext.previousLinesMasked,
    ...ctx.localContext.nextLinesMasked,
  ]
    .join(' ')
    .toLowerCase();

  // ---- Path features ---------------------------------------------------------
  const isTestPath =
    /(^|\/)(tests?|__tests__|spec)(\/|$)/.test(path) ||
    /\.(test|spec)\./.test(path);

  const isDocsPath =
    /(^|\/)docs?(\/|$)/.test(path) ||
    ext === 'md' ||
    /readme|contributing|changelog|contact/.test(path);

  const isExamplePath = /example|sample|fixture/.test(path);

  const isProdPath = /(prod|production)/.test(path);

  const isDevPath = /(^|\/)(dev|develop|development|staging)(\/|$)/.test(path);

  const isConfigFile =
    ['env', 'yaml', 'yml', 'json', 'toml', 'ini', 'conf', 'config', 'properties'].includes(ext) ||
    ctx.file.fileName.toLowerCase().startsWith('.env') ||
    /config|configmap|compose/.test(path);

  const isSourceCodeFile = [
    'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'java', 'rb', 'php', 'cs', 'cpp', 'c', 'rs',
  ].includes(ext);

  const isLogFile = ext === 'log';

  const isIacFile =
    ['tf', 'tfstate'].includes(ext) ||
    /docker-compose|dockerfile/.test(path) ||
    ((ext === 'yaml' || ext === 'yml') && /(k8s|infra|kubernetes|helm)/.test(path));

  const fileRole = ctx.file.fileRole;

  // Docs/Test/Prod are positively detected; everything else (incl. dev/staging
  // and unclassified paths) defaults to 'Dev' since Environment has no 'unknown'.
  const environmentHint: ContextFeatures['environmentHint'] = isDocsPath
    ? 'Docs'
    : isTestPath
    ? 'Test'
    : isProdPath
    ? 'Production'
    : 'Dev';

  // ---- Value features --------------------------------------------------------
  const detectedType = ctx.candidate.detectedType;
  const valueLength = ctx.candidate.valueLength;
  const entropy = ctx.candidate.entropy;
  const entropyLevel = ctx.candidate.entropyLevel;

  const hasLivePrefix = prefix.includes('live') || /^akia/.test(prefix);

  const hasTestPrefix = prefix.includes('test') || prefix.includes('sandbox');

  const looksLikePlaceholder =
    /(example|sample|dummy|placeholder|your[_ -]?api|replace[_ -]?me|changeme|fake|mock|xxxx)/.test(
      masked + ' ' + prefix,
    );

  const isKnownTestValueHeuristic =
    ctx.candidate.detectedType === 'test-card-number' ||
    /(4111|4242|5555|test|example)/.test(masked);

  // ---- Variable features -----------------------------------------------------
  const hasSecretVariableName =
    /(secret|token|key|password|passwd|pwd|credential|private|apikey|api_key|access_key)/i.test(name);

  const hasPublicVariableName = /(public|url|endpoint|host|uri)/i.test(name);

  const variableIntent: ContextFeatures['variableIntent'] = /(example|sample|test|dummy)/i.test(
    name,
  )
    ? 'example'
    : hasSecretVariableName
    ? 'secret'
    : hasPublicVariableName
    ? 'public'
    : 'secret';

  // ---- Text-context features -------------------------------------------------
  const hasExampleLanguage = /example|e\.g\.|for instance|sample/.test(text);

  const hasPlaceholderLanguage =
    /placeholder|replace this|your[_ ]?api|todo|fill in|changeme/.test(text);

  const hasTestLanguage = /test|fixture|mock|sandbox/.test(text);

  const hasSecretLanguage =
    /secret|credential|api key|private key|token|password/.test(text);

  const hasProductionLanguage = /production|prod|live|deploy/.test(text);

  const hasDocumentationContext =
    isDocsPath || /documentation|readme|guide|how to/.test(text);

  // ---- Asset features --------------------------------------------------------
  const storageExposure = asset.storageExposure;
  const isPubliclyAccessible =
    asset.storageExposure === 'Public' || asset.storageExposure === 'Internet-facing';
  const assetCriticality = asset.assetCriticality;
  const cloudProvider = asset.cloudProvider;
  const customerVertical = ctx.scanMetadata.customerVertical;

  // ---- Structural / semantic signals (signals-bridge) ------------------------
  // Prefer the verdicts computed on the RAW value upstream (the Go scan layer or
  // a customer-side scanner); fall back to masked-value heuristics when absent.
  const sig = ctx.signals;

  const isKnownTestValue = sig?.isKnownTestValue ?? isKnownTestValueHeuristic;

  const structurallyValid = sig?.structurallyValid ?? true;
  const luhnValid = sig?.luhnValid ?? true;
  const formatValidForType = sig?.formatValidForType ?? structurallyValid;

  const isPublicByDesignHeuristic =
    /^pk_live|^pk_test/.test(prefix) ||
    (hasPublicVariableName && !hasSecretVariableName && /https?:/.test(masked));
  const isPublicByDesign = sig?.isPublicByDesign ?? isPublicByDesignHeuristic;

  // Creative semantic invariant #2 — already masked/redacted in the source.
  const isAlreadyMasked =
    sig?.isAlreadyMasked ??
    /redacted|<[^>]+>|\bx{6,}\b/i.test(ctx.localContext.lineTextMasked);

  // Creative semantic invariant #1 — a 40/64-char hex git object id under a
  // token/key variable is a VCS hash, not a credential.
  const looksHex = /^[0-9a-f]+$/i.test(prefix);
  const isHighEntropySha =
    sig?.isHighEntropySha ??
    ((valueLength === 40 || valueLength === 64) &&
      looksHex &&
      /(sha|commit|revision|rev|digest|hash)/i.test(name + ' ' + text));

  // Creative semantic invariant #4 — a 17–19 digit value (epoch nanos) or a
  // structurally-invalid card-shaped number is a numeric id, not a PAN.
  const cardLike = /credit[-_]?card|card|pan/i.test(detectedType);
  // A genuine PAN is always Luhn-valid; only flag a card-shaped value that FAILS
  // Luhn and is outside real card lengths (e.g. 17–19-digit epoch nanos / order
  // ids). Requiring !luhnValid guarantees a real 19-digit card is never flagged.
  const shapeContradictsType = cardLike && !luhnValid && valueLength >= 17;

  // Creative semantic invariant #5 — curated, UNAMBIGUOUS test/example markers.
  // The authoritative `is_known_test_value` signal drives this; the prefix list
  // is a conservative fallback limited to tokens a real secret never uses (AWS
  // doc key, explicit *_test API-key prefixes) so it can never suppress a real
  // PAN/IBAN that merely shares leading digits.
  const KNOWN_VECTOR_PREFIXES = ['akiaios', 'sk_test', 'pk_test'];
  const isKnownTestVector =
    isKnownTestValue ||
    KNOWN_VECTOR_PREFIXES.some((p) => prefix.startsWith(p) || masked.startsWith(p));

  // ---- Hierarchical path context ---------------------------------------------
  // Inspect the candidate's immediate parent and grandparent directory names so
  // a file sitting directly inside tests/ fixtures/ samples/ boilerplate/ is
  // recognised even when the full path string doesn't otherwise look benign.
  const segments = path.split('/').filter(Boolean);
  const parentDir = segments.length >= 2 ? segments[segments.length - 2] : '';
  const grandparentDir = segments.length >= 3 ? segments[segments.length - 3] : '';
  const dirMatches = (re: RegExp) => re.test(parentDir) || re.test(grandparentDir);
  const inTestDir = dirMatches(/^(tests?|__tests__|spec|specs)$/);
  const inFixturesDir = dirMatches(/^(fixtures?|mocks?|stubs?|testdata)$/);
  const inSamplesDir = dirMatches(/^(samples?|examples?|demos?)$/);
  const inBoilerplateDir = dirMatches(/^(boilerplate|templates?|scaffold|skeleton|seed|seeds)$/);

  // ---- Global pattern frequency ----------------------------------------------
  const patternFrequency = corpusStats?.[patternFingerprint(ctx)] ?? 1;
  const isHighFrequencyPattern = patternFrequency >= HIGH_FREQUENCY_THRESHOLD;

  // ---- Semantic anchor flags (masked context only) ---------------------------
  // Placeholder identities and structural domain nouns near the match strongly
  // hint at illustrative/schema data rather than a live credential.
  const hasPlaceholderIdentity =
    /(john\s+doe|jane\s+doe|israel\s+israeli|foo\s+bar|acme|lorem\s+ipsum|test\s+user|example\s+user)/.test(
      text,
    );
  const hasStructuralDomainNoun =
    /(executed_at|created_at|updated_at|deleted_at|patient_name|patient_id|lookup_dictionary|dictionary|schema|column_name|table_name|order_id|transaction_id|trace_id|request_id|account_id)/.test(
      text + ' ' + name.toLowerCase(),
    );

  return {
    isProdPath,
    isDevPath,
    isTestPath,
    isDocsPath,
    isExamplePath,
    isConfigFile,
    isSourceCodeFile,
    isLogFile,
    isIacFile,
    fileRole,
    environmentHint,
    detectedType,
    valueLength,
    entropy,
    entropyLevel,
    hasLivePrefix,
    hasTestPrefix,
    looksLikePlaceholder,
    isKnownTestValue,
    hasSecretVariableName,
    hasPublicVariableName,
    variableIntent,
    hasExampleLanguage,
    hasPlaceholderLanguage,
    hasTestLanguage,
    hasSecretLanguage,
    hasProductionLanguage,
    hasDocumentationContext,
    storageExposure,
    isPubliclyAccessible,
    assetCriticality,
    cloudProvider,
    customerVertical,
    structurallyValid,
    luhnValid,
    formatValidForType,
    isPublicByDesign,
    isHighEntropySha,
    isAlreadyMasked,
    shapeContradictsType,
    isKnownTestVector,
    parentDir,
    grandparentDir,
    inTestDir,
    inFixturesDir,
    inSamplesDir,
    inBoilerplateDir,
    patternFrequency,
    isHighFrequencyPattern,
    hasPlaceholderIdentity,
    hasStructuralDomainNoun,
  };
}
