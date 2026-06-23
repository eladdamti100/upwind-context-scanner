import { describe, test, expect } from 'vitest';
import {
  validateCreditCard, validateIBAN, validateABA, validateSWIFT, validateCUSIP, validateBTCAddress,
  validateSSN, validateIsraeliID, validateEIN, validatePassportMRZ,
  validateNPI, validateICD10, validateDEA, validateMBI,
  validateJWT, validateAWSKey, validateMAC, validateIP, classifyIP,
  validateGTIN, validateVAT,
  validateValue, hasValidator,
} from './index';
import { luhn, mod97, abaWeighted, gtinMod10, npiLuhn80840 } from './checksums';

// ---- Fintech ----------------------------------------------------------------
describe('credit card (Luhn + BIN)', () => {
  test('valid Visa / MC / Amex pass', () => {
    expect(validateCreditCard('4242424242424242').valid).toBe(true);
    expect(validateCreditCard('5555 5555 5555 4444').valid).toBe(true);
    expect(validateCreditCard('378282246310005').valid).toBe(true);
  });
  test('Luhn-invalid card fails', () => {
    expect(validateCreditCard('4242424242424241').valid).toBe(false);
  });
  test('Luhn-valid but no issuer BIN range fails (order-id noise)', () => {
    // all-zeros passes Luhn but matches no real issuer prefix
    const v = validateCreditCard('0000000000000000');
    expect(luhn('0000000000000000')).toBe(true);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/BIN/);
  });
});

describe('IBAN (ISO 7064 mod-97)', () => {
  test('valid IBANs pass', () => {
    expect(validateIBAN('DE89370400440532013000').valid).toBe(true);
    expect(validateIBAN('GB82WEST12345698765432').valid).toBe(true);
  });
  test('00 check digits fail', () => {
    expect(validateIBAN('DE00370400440532013000').valid).toBe(false);
  });
  test('mutated digit fails mod-97', () => {
    expect(validateIBAN('DE89370400440532013001').valid).toBe(false);
  });
});

describe('ABA routing', () => {
  test('valid routing numbers pass', () => {
    expect(validateABA('021000021').valid).toBe(true);
    expect(abaWeighted('011401533')).toBe(true);
  });
  test('bad checksum fails', () => {
    expect(validateABA('021000020').valid).toBe(false);
  });
});

describe('SWIFT / CUSIP / BTC', () => {
  test('SWIFT BIC', () => {
    expect(validateSWIFT('DEUTDEFF').valid).toBe(true);
    expect(validateSWIFT('DEUTDEFF500').valid).toBe(true);
    expect(validateSWIFT('SHORT').valid).toBe(false);
  });
  test('CUSIP check digit', () => {
    expect(validateCUSIP('037833100').valid).toBe(true); // Apple Inc.
    expect(validateCUSIP('037833101').valid).toBe(false);
  });
  test('BTC Base58Check (exercises SHA-256)', () => {
    expect(validateBTCAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').valid).toBe(true);
    expect(validateBTCAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb').valid).toBe(false);
  });
});

// ---- Identity ---------------------------------------------------------------
describe('SSN (SSA ranges)', () => {
  test('valid SSN', () => {
    expect(validateSSN('123-45-6789').valid).toBe(true);
    expect(validateSSN('123456789').valid).toBe(true);
  });
  test('impossible ranges fail', () => {
    expect(validateSSN('000-45-6789').valid).toBe(false);
    expect(validateSSN('666-45-6789').valid).toBe(false);
    expect(validateSSN('900-45-6789').valid).toBe(false);
    expect(validateSSN('123-00-6789').valid).toBe(false);
    expect(validateSSN('123-45-0000').valid).toBe(false);
  });
});

describe('Israeli ID / EIN / MRZ', () => {
  test('Israeli ID mod-10', () => {
    expect(validateIsraeliID('123456782').valid).toBe(true);
    expect(validateIsraeliID('123456783').valid).toBe(false);
  });
  test('EIN prefix', () => {
    expect(validateEIN('12-3456789').valid).toBe(true);
    expect(validateEIN('001234567').valid).toBe(false);
  });
  test('passport MRZ structural reject', () => {
    expect(validatePassportMRZ('not an mrz').valid).toBe(false);
  });
});

// ---- Healthcare -------------------------------------------------------------
describe('NPI / ICD-10 / DEA / MBI', () => {
  test('NPI 80840 Luhn', () => {
    expect(validateNPI('1234567893').valid).toBe(true);
    expect(validateNPI('1234567890').valid).toBe(false);
    expect(npiLuhn80840('1234567893')).toBe(true);
  });
  test('ICD-10 structure', () => {
    expect(validateICD10('E11.9').valid).toBe(true);
    expect(validateICD10('A00').valid).toBe(true);
    expect(validateICD10('11.9').valid).toBe(false);
  });
  test('DEA checksum', () => {
    expect(validateDEA('BX1234563').valid).toBe(true);
    expect(validateDEA('BX1234560').valid).toBe(false);
  });
  test('MBI structure', () => {
    expect(validateMBI('1EG4TE5MK73').valid).toBe(true);
    expect(validateMBI('1SG4TE5MK73').valid).toBe(false); // S not allowed in A position
  });
});

// ---- SaaS / cloud -----------------------------------------------------------
describe('JWT / AWS / MAC / IP', () => {
  const JWT =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  test('valid JWT passes, malformed fails', () => {
    expect(validateJWT(JWT).valid).toBe(true);
    expect(validateJWT('eyJhbGci.eyJzdWIi').valid).toBe(false); // 2 segments
    expect(validateJWT('abc.def.ghi').valid).toBe(false); // header not JSON
  });
  test('AWS key format', () => {
    // AWS doc example is structurally valid (a separate invariant flags it as known-test)
    expect(validateAWSKey('AKIAIOSFODNN7EXAMPLE').valid).toBe(true);
    expect(validateAWSKey('AKIAAAAAAAAAAAAAAAAA').valid).toBe(false); // low entropy stub
    expect(validateAWSKey('AKIA123').valid).toBe(false); // wrong length
  });
  test('MAC + IP classification', () => {
    expect(validateMAC('00:1A:2B:3C:4D:5E').valid).toBe(true);
    expect(classifyIP('10.0.0.5').isPrivate).toBe(true);
    expect(classifyIP('127.0.0.1').isPrivate).toBe(true);
    expect(validateIP('8.8.8.8').valid).toBe(true);
    expect(validateIP('192.168.1.1').valid).toBe(false);
  });
});

// ---- Retail -----------------------------------------------------------------
describe('GTIN / VAT', () => {
  test('GTIN mod-10', () => {
    expect(validateGTIN('036000291452').valid).toBe(true);
    expect(validateGTIN('036000291453').valid).toBe(false);
    expect(gtinMod10('036000291452')).toBe(true);
  });
  test('VAT structural', () => {
    expect(validateVAT('DE123456789').valid).toBe(true);
    expect(validateVAT('DE12345').valid).toBe(false);
    expect(validateVAT('XX123').valid).toBe(false);
  });
});

// ---- Registry ---------------------------------------------------------------
describe('validateValue registry', () => {
  test('routes by detected type (kebab + underscore aliases)', () => {
    expect(validateValue('credit-card-pan', '4242424242424242')?.valid).toBe(true);
    expect(validateValue('aws_access_key_id', 'AKIAAAAAAAAAAAAAAAAA')?.valid).toBe(false);
    expect(validateValue('ssn', '000-12-3456')?.valid).toBe(false);
  });
  test('returns null for unknown type', () => {
    expect(validateValue('github-token', 'ghp_xxx')).toBeNull();
    expect(hasValidator('github-token')).toBe(false);
    expect(hasValidator('iban')).toBe(true);
  });
});

// ---- Low-level checksum sanity ----------------------------------------------
describe('checksum primitives', () => {
  test('luhn / mod97', () => {
    expect(luhn('4242424242424242')).toBe(true);
    expect(luhn('4242424242424241')).toBe(false);
    expect(mod97('DE89370400440532013000')).toBe(true);
  });
});
