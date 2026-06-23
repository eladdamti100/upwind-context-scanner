// src/lib/validators/retail.ts
// E-commerce / retail structural validators: GTIN/UPC/EAN barcodes (mod-10
// weighted) and localized VAT registration numbers.
import { Validator, ok, fail, digitsOnly } from './types';
import { gtinMod10 } from './checksums';

// GTIN/UPC/EAN: a mod-10-valid 8/12/13/14-digit barcode is frequently mistaken
// for a credit card by length-only regex. A passing check digit proves it's a
// trade item number, not a PAN.
export const validateGTIN: Validator = (raw) => {
  const d = digitsOnly(raw);
  if (!/^\d{8}$|^\d{12,14}$/.test(d)) return fail('gtin', 'not an 8/12/13/14-digit barcode');
  return gtinMod10(d)
    ? ok('gtin', 'passes GTIN mod-10 check (barcode, not a card)')
    : fail('gtin', 'fails GTIN mod-10 check');
};

// VAT registration: per-country structural/length rules (EU + UK common forms).
const VAT_RULES: { cc: string; re: RegExp }[] = [
  { cc: 'GB', re: /^GB(\d{9}|\d{12}|(GD|HA)\d{3})$/ },
  { cc: 'DE', re: /^DE\d{9}$/ },
  { cc: 'FR', re: /^FR[A-Z0-9]{2}\d{9}$/ },
  { cc: 'NL', re: /^NL\d{9}B\d{2}$/ },
  { cc: 'IT', re: /^IT\d{11}$/ },
  { cc: 'ES', re: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/ },
  { cc: 'IE', re: /^IE\d{7}[A-W][A-IW]?$/ },
  { cc: 'BE', re: /^BE0\d{9}$/ },
  { cc: 'PL', re: /^PL\d{10}$/ },
  { cc: 'SE', re: /^SE\d{12}$/ },
];

export const validateVAT: Validator = (raw) => {
  const s = raw.toUpperCase().replace(/[\s-]/g, '');
  const cc = s.slice(0, 2);
  const rule = VAT_RULES.find((r) => r.cc === cc);
  if (!rule) return fail('vat', `unsupported or missing country prefix ${cc}`);
  return rule.re.test(s)
    ? ok('vat', `well-formed ${cc} VAT number`)
    : fail('vat', `does not match ${cc} VAT structure`);
};
