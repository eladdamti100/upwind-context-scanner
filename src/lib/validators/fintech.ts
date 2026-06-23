// src/lib/validators/fintech.ts
// Fintech / banking structural validators: PAN (Luhn + BIN range), IBAN
// (ISO 7064 mod-97), ABA routing, SWIFT/BIC, CUSIP, and Bitcoin addresses.
import { Validator, ok, fail, digitsOnly } from './types';
import { luhn, mod97, abaWeighted, base58Check } from './checksums';

// Real major-scheme BIN/IIN prefix ranges. A 16-digit number that passes Luhn
// but begins outside every issued range is almost certainly randomized noise
// (an order id, a sequence) rather than a payment card.
const BIN_RANGES: { name: string; test: (d: string) => boolean }[] = [
  { name: 'Visa', test: (d) => d.startsWith('4') && (d.length === 13 || d.length === 16 || d.length === 19) },
  { name: 'Mastercard', test: (d) => {
      const p2 = +d.slice(0, 2);
      const p4 = +d.slice(0, 4);
      return d.length === 16 && ((p2 >= 51 && p2 <= 55) || (p4 >= 2221 && p4 <= 2720));
    } },
  { name: 'Amex', test: (d) => /^3[47]/.test(d) && d.length === 15 },
  { name: 'Discover', test: (d) => d.length === 16 && (/^6011/.test(d) || /^65/.test(d) || (+d.slice(0, 3) >= 644 && +d.slice(0, 3) <= 649)) },
  { name: 'JCB', test: (d) => d.length === 16 && +d.slice(0, 4) >= 3528 && +d.slice(0, 4) <= 3589 },
  { name: 'Diners', test: (d) => /^3(0[0-5]|[68])/.test(d) && d.length === 14 },
];

function binInRange(d: string): boolean {
  return BIN_RANGES.some((r) => r.test(d));
}

export const validateCreditCard: Validator = (raw) => {
  const d = digitsOnly(raw);
  if (!/^\d{12,19}$/.test(d)) return fail('credit-card', 'not a 12–19 digit sequence');
  if (!luhn(d)) return fail('credit-card', 'fails Luhn checksum');
  if (!binInRange(d)) return fail('credit-card', 'no issuer BIN range matches (randomized identifier)');
  return ok('credit-card', 'passes Luhn and matches an issuer BIN range');
};

// IBAN: country (2) + check digits (2) + BBAN; length validated against the
// per-country registry, then ISO 7064 mod-97 must equal 1.
const IBAN_LENGTHS: Record<string, number> = {
  DE: 22, GB: 22, FR: 27, NL: 18, IL: 23, ES: 24, IT: 27, CH: 21, BE: 16,
  AT: 20, IE: 22, PT: 25, NO: 15, SE: 24, DK: 18, FI: 18, PL: 28, LU: 20,
};

export const validateIBAN: Validator = (raw) => {
  const s = raw.toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return fail('iban', 'malformed IBAN structure');
  const cc = s.slice(0, 2);
  const expected = IBAN_LENGTHS[cc];
  if (expected && s.length !== expected) {
    return fail('iban', `length ${s.length} != ${expected} expected for ${cc}`);
  }
  if (s.slice(2, 4) === '00' || s.slice(2, 4) === '01' || s.slice(2, 4) === '99') {
    return fail('iban', 'invalid check digits');
  }
  if (!mod97(s)) return fail('iban', 'fails ISO 7064 mod-97 check');
  return ok('iban', 'passes mod-97 check');
};

export const validateABA: Validator = (raw) => {
  const d = digitsOnly(raw);
  if (!/^\d{9}$/.test(d)) return fail('aba-routing', 'not a 9-digit routing number');
  // First two digits are the Federal Reserve district (01–12, 21–32, 61–72, 80).
  const lead = +d.slice(0, 2);
  const districtOk =
    (lead >= 1 && lead <= 12) || (lead >= 21 && lead <= 32) || (lead >= 61 && lead <= 72) || lead === 80;
  if (!districtOk) return fail('aba-routing', 'invalid Federal Reserve district prefix');
  if (!abaWeighted(d)) return fail('aba-routing', 'fails ABA weighted checksum');
  return ok('aba-routing', 'passes ABA checksum');
};

// SWIFT/BIC: 4 bank + 2 country + 2 location, optional 3-char branch.
export const validateSWIFT: Validator = (raw) => {
  const s = raw.toUpperCase().trim();
  if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s)) {
    return fail('swift-bic', 'malformed BIC (expect 8 or 11 chars)');
  }
  return ok('swift-bic', 'well-formed BIC');
};

// CUSIP: 9 chars, weighted mod-10 over the first 8 (letters A=10..Z=35,
// position-doubled), check digit must match the 9th.
export const validateCUSIP: Validator = (raw) => {
  const s = raw.toUpperCase().trim();
  if (!/^[0-9A-Z*@#]{9}$/.test(s)) return fail('cusip', 'not a 9-char CUSIP');
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const ch = s[i];
    let v: number;
    if (ch >= '0' && ch <= '9') v = ch.charCodeAt(0) - 48;
    else if (ch >= 'A' && ch <= 'Z') v = ch.charCodeAt(0) - 55 + 10; // A=10
    else v = { '*': 36, '@': 37, '#': 38 }[ch] ?? 0;
    if (i % 2 === 1) v *= 2;
    sum += Math.floor(v / 10) + (v % 10);
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== s.charCodeAt(8) - 48) return fail('cusip', 'fails CUSIP check digit');
  return ok('cusip', 'passes CUSIP check digit');
};

// Bitcoin: legacy Base58Check (1.../3...) or bech32 (bc1...) structural check.
export const validateBTCAddress: Validator = (raw) => {
  const s = raw.trim();
  if (/^(bc1|tb1)[0-9ac-hj-np-z]{11,71}$/.test(s)) return ok('btc-address', 'well-formed bech32 address');
  if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(s)) {
    return base58Check(s)
      ? ok('btc-address', 'valid Base58Check address')
      : fail('btc-address', 'fails Base58Check checksum');
  }
  return fail('btc-address', 'not a recognizable Bitcoin address');
};
