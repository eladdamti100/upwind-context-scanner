// src/lib/features.ts
// Pure feature-extraction function. Reads only masked fields, variable names,
// paths, and asset context. Never reconstructs or logs a full secret.
import type { FindingContextObject, ContextFeatures, Exposure, AssetCriticality } from '../types';

export interface AssetContext {
  storageExposure: Exposure;
  assetCriticality: AssetCriticality;
  cloudProvider: string;
}

export function extractFeatures(
  ctx: FindingContextObject,
  asset: AssetContext,
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

  const isKnownTestValue =
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
  };
}
