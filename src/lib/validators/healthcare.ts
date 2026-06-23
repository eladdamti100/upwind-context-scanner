// src/lib/validators/healthcare.ts
// Healthcare structural validators: NPI (Luhn+80840), ICD-10-CM code shape,
// DEA registration number checksum, and Medicare Beneficiary Identifier (MBI).
import { Validator, ok, fail, digitsOnly } from './types';
import { npiLuhn80840 } from './checksums';

export const validateNPI: Validator = (raw) => {
  const d = digitsOnly(raw);
  if (!/^\d{10}$/.test(d)) return fail('npi', 'not a 10-digit NPI');
  return npiLuhn80840(d)
    ? ok('npi', 'passes 80840 Luhn check')
    : fail('npi', 'fails 80840 Luhn check');
};

// ICD-10-CM: Letter, 2 digits, optional dot + up to 4 more alphanumerics.
// (First letter excludes U for most CM codes; we accept A–Z to stay general.)
export const validateICD10: Validator = (raw) => {
  const s = raw.trim().toUpperCase();
  return /^[A-TV-Z]\d[0-9A-Z](\.[0-9A-Z]{1,4})?$/.test(s)
    ? ok('icd10', 'well-formed ICD-10-CM code')
    : fail('icd10', 'does not match ICD-10-CM structure');
};

// DEA: 2 letters + 7 digits. Registrant letter constrains the first char;
// checksum: (d1+d3+d5) + 2*(d2+d4+d6) ≡ d7 (mod 10).
export const validateDEA: Validator = (raw) => {
  const s = raw.trim().toUpperCase();
  const m = s.match(/^([A-Z])([A-Z])(\d{7})$/);
  if (!m) return fail('dea', 'not a DEA number (2 letters + 7 digits)');
  if (!/[ABFGMPRX]/.test(m[1])) return fail('dea', `invalid registrant type letter ${m[1]}`);
  const d = m[3];
  const sum =
    (d.charCodeAt(0) - 48 + (d.charCodeAt(2) - 48) + (d.charCodeAt(4) - 48)) +
    2 * (d.charCodeAt(1) - 48 + (d.charCodeAt(3) - 48) + (d.charCodeAt(5) - 48));
  return sum % 10 === d.charCodeAt(6) - 48
    ? ok('dea', 'passes DEA checksum')
    : fail('dea', 'fails DEA checksum');
};

// Medicare Beneficiary Identifier: 11 chars, fixed C/A class pattern, no S/L/O/
// I/B/Z to avoid ambiguity. Format: C A AN N A AN N A A N N (positionally).
export const validateMBI: Validator = (raw) => {
  const s = raw.replace(/-/g, '').trim().toUpperCase();
  // C=non-zero digit 1-9, A=letter excl SLOIBZ, N=digit, AN=letter-or-digit.
  const C = '[1-9]';
  const A = '[A-HJ-NP-RT-Y]';
  const N = '[0-9]';
  const AN = `(?:${A}|${N})`;
  const re = new RegExp(`^${C}${A}${AN}${N}${A}${AN}${N}${A}${A}${N}${N}$`);
  return re.test(s) ? ok('mbi', 'well-formed MBI') : fail('mbi', 'does not match MBI structure');
};
