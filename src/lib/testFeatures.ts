// src/lib/testFeatures.ts
// Shared test fixture: a ContextFeatures factory with benign defaults. Only
// imported by *.test.ts files (never by the app bundle). Override any field via
// Partial<ContextFeatures>.
import type { ContextFeatures } from '../types';

export function makeFeatures(overrides: Partial<ContextFeatures> = {}): ContextFeatures {
  const defaults: ContextFeatures = {
    isProdPath: false,
    isDevPath: false,
    isTestPath: false,
    isDocsPath: false,
    isExamplePath: false,
    isConfigFile: false,
    isSourceCodeFile: false,
    isLogFile: false,
    isIacFile: false,
    fileRole: 'unknown',
    environmentHint: 'Dev',
    detectedType: 'generic-token',
    valueLength: 32,
    entropy: 3.5,
    entropyLevel: 'medium',
    hasLivePrefix: false,
    hasTestPrefix: false,
    looksLikePlaceholder: false,
    isKnownTestValue: false,
    hasSecretVariableName: false,
    hasPublicVariableName: false,
    variableIntent: 'secret',
    hasExampleLanguage: false,
    hasPlaceholderLanguage: false,
    hasTestLanguage: false,
    hasSecretLanguage: false,
    hasProductionLanguage: false,
    hasDocumentationContext: false,
    storageExposure: 'Internal',
    isPubliclyAccessible: false,
    assetCriticality: 'Medium',
    cloudProvider: 'aws',
    customerVertical: 'general',
    // Structural / semantic signals — benign defaults (well-formed candidate).
    structurallyValid: true,
    luhnValid: true,
    formatValidForType: true,
    isPublicByDesign: false,
    isHighEntropySha: false,
    isAlreadyMasked: false,
    shapeContradictsType: false,
    isKnownTestVector: false,
    // Hierarchical path context.
    parentDir: '',
    grandparentDir: '',
    inTestDir: false,
    inFixturesDir: false,
    inSamplesDir: false,
    inBoilerplateDir: false,
    // Global pattern frequency.
    patternFrequency: 1,
    isHighFrequencyPattern: false,
    // Semantic anchors.
    hasPlaceholderIdentity: false,
    hasStructuralDomainNoun: false,
  };
  return { ...defaults, ...overrides };
}
