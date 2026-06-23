// src/lib/validators/index.ts
// The universal validator registry: maps a detected_type to the structural
// validator that proves (or disproves) a candidate of that type. This is the
// reusable, customer-agnostic engine — it runs wherever a raw value exists.
import { Validator, ValidatorVerdict } from './types';
import {
  validateCreditCard,
  validateIBAN,
  validateABA,
  validateSWIFT,
  validateCUSIP,
  validateBTCAddress,
} from './fintech';
import { validateSSN, validateIsraeliID, validateEIN, validatePassportMRZ } from './identity';
import { validateNPI, validateICD10, validateDEA, validateMBI } from './healthcare';
import { validateJWT, validateAWSKey, validateMAC, validateIP } from './saas';
import { validateGTIN, validateVAT } from './retail';

export * from './types';
export * from './checksums';
export {
  validateCreditCard, validateIBAN, validateABA, validateSWIFT, validateCUSIP, validateBTCAddress,
} from './fintech';
export { validateSSN, validateIsraeliID, validateEIN, validatePassportMRZ } from './identity';
export { validateNPI, validateICD10, validateDEA, validateMBI } from './healthcare';
export { validateJWT, validateAWSKey, validateMAC, validateIP, classifyIP } from './saas';
export { validateGTIN, validateVAT } from './retail';

// Keys are canonical kebab-case detected types; aliases cover the underscore /
// vendor-specific names that appear in the corpus and live scans.
export const VALIDATOR_REGISTRY: Record<string, Validator> = {
  // Fintech
  'credit-card': validateCreditCard,
  'credit-card-pan': validateCreditCard,
  'credit-card-number': validateCreditCard,
  'iban': validateIBAN,
  'aba-routing': validateABA,
  'swift-bic': validateSWIFT,
  'cusip': validateCUSIP,
  'btc-address': validateBTCAddress,
  'crypto-wallet': validateBTCAddress,
  // Identity
  'ssn': validateSSN,
  'israeli-id': validateIsraeliID,
  'national-id': validateIsraeliID,
  'ein': validateEIN,
  'tin': validateEIN,
  'passport': validatePassportMRZ,
  'passport-mrz': validatePassportMRZ,
  // Healthcare
  'npi': validateNPI,
  'icd10': validateICD10,
  'icd-10': validateICD10,
  'dea': validateDEA,
  'dea-number': validateDEA,
  'mbi': validateMBI,
  'medicare-beneficiary-id': validateMBI,
  // SaaS / cloud
  'jwt': validateJWT,
  'aws-access-key': validateAWSKey,
  'aws-access-key-id': validateAWSKey,
  'mac-address': validateMAC,
  'ip-address': validateIP,
  // Retail
  'gtin': validateGTIN,
  'upc': validateGTIN,
  'ean': validateGTIN,
  'vat': validateVAT,
};

// Normalize a detected type to the registry key form (kebab-case).
const normalizeType = (t: string): string => t.toLowerCase().replace(/_/g, '-');

// Run the validator for a detected type against a raw value. Returns null when
// no validator applies to that type (the candidate is then judged by the rest
// of the pipeline rather than structurally suppressed).
export function validateValue(detectedType: string, raw: string): ValidatorVerdict | null {
  const validator = VALIDATOR_REGISTRY[normalizeType(detectedType)];
  if (!validator) return null;
  return validator(raw);
}

export function hasValidator(detectedType: string): boolean {
  return normalizeType(detectedType) in VALIDATOR_REGISTRY;
}
