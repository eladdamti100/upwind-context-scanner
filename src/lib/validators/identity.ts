// src/lib/validators/identity.ts
// Government / PII structural validators: US SSN (SSA ranges), Israeli national
// ID (mod-10), US EIN (campus prefix), and passport MRZ check digits.
import { Validator, ok, fail, digitsOnly } from './types';
import { mrzCheckDigit } from './checksums';

// US SSN: a regex catches ###-##-#### but the SSA never issues area 000/666/
// 900–999, group 00, or serial 0000.
export const validateSSN: Validator = (raw) => {
  const m = raw.trim().match(/^(\d{3})-?(\d{2})-?(\d{4})$/);
  if (!m) return fail('ssn', 'not a ###-##-#### sequence');
  const area = +m[1];
  const group = +m[2];
  const serial = +m[3];
  if (area === 0 || area === 666 || area >= 900) return fail('ssn', `impossible area number ${m[1]}`);
  if (group === 0) return fail('ssn', 'group number cannot be 00');
  if (serial === 0) return fail('ssn', 'serial number cannot be 0000');
  return ok('ssn', 'within SSA-issuable range');
};

// Israeli national ID (Teudat Zehut): 9 digits, mod-10 weighted (alternating
// 1,2 from the left, digit-summed), total divisible by 10.
export const validateIsraeliID: Validator = (raw) => {
  let d = digitsOnly(raw);
  if (!/^\d{1,9}$/.test(d)) return fail('israeli-id', 'not a numeric ID');
  d = d.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let v = (d.charCodeAt(i) - 48) * ((i % 2) + 1);
    if (v > 9) v -= 9;
    sum += v;
  }
  return sum % 10 === 0
    ? ok('israeli-id', 'passes mod-10 check')
    : fail('israeli-id', 'fails mod-10 check');
};

// US EIN: 9 digits, NN-NNNNNNN, with a valid IRS campus prefix.
const EIN_PREFIXES = new Set([
  '01','02','03','04','05','06','10','11','12','13','14','15','16','20','21','22','23','24','25','26','27',
  '30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','50','51',
  '52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','71','72','73','74',
  '75','76','77','80','81','82','83','84','85','86','87','88','90','91','92','93','94','95','98','99',
]);

export const validateEIN: Validator = (raw) => {
  const d = digitsOnly(raw);
  if (!/^\d{9}$/.test(d)) return fail('ein', 'not a 9-digit EIN');
  if (!EIN_PREFIXES.has(d.slice(0, 2))) return fail('ein', `invalid IRS campus prefix ${d.slice(0, 2)}`);
  return ok('ein', 'valid EIN prefix and format');
};

// Passport MRZ (TD3, 2 lines of 44). Validates the document-number, birth-date,
// expiry-date and composite check digits per ICAO 9303.
export const validatePassportMRZ: Validator = (raw) => {
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length !== 2 || lines[0].length !== 44 || lines[1].length !== 44) {
    return fail('passport-mrz', 'not a 2×44 TD3 machine-readable zone');
  }
  const l2 = lines[1];
  const docNum = l2.slice(0, 9);
  const docCheck = +l2[9];
  const birth = l2.slice(13, 19);
  const birthCheck = +l2[19];
  const expiry = l2.slice(21, 27);
  const expiryCheck = +l2[27];
  if (mrzCheckDigit(docNum) !== docCheck) return fail('passport-mrz', 'document-number check digit mismatch');
  if (mrzCheckDigit(birth) !== birthCheck) return fail('passport-mrz', 'birth-date check digit mismatch');
  if (mrzCheckDigit(expiry) !== expiryCheck) return fail('passport-mrz', 'expiry-date check digit mismatch');
  const composite = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43);
  if (mrzCheckDigit(composite) !== +l2[43]) return fail('passport-mrz', 'composite check digit mismatch');
  return ok('passport-mrz', 'all MRZ check digits valid');
};
