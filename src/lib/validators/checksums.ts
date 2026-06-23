// src/lib/validators/checksums.ts
// Low-level, dependency-free check-digit math reused across the vertical
// validators. Each function operates on a normalized string and returns a
// boolean (or the computed digit) — no I/O, no logging, no secrets retained.

// ---- Luhn (ISO/IEC 7812, mod-10) -------------------------------------------
// Used for credit-card PANs and (with a prefix) NPIs.
export function luhn(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 2) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// ---- ISO 7064 mod-97-10 (IBAN) ---------------------------------------------
// Rearrange (move first 4 chars to the end), map letters A=10..Z=35, then the
// big-number mod 97 must equal 1. Computed digit-by-digit to avoid BigInt.
export function mod97(iban: string): boolean {
  const s = iban.toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z0-9]+$/.test(s) || s.length < 5) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const piece = code >= 65 ? (code - 55).toString() : ch; // A-Z → 10..35
    for (const c of piece) {
      remainder = (remainder * 10 + (c.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder === 1;
}

// ---- ABA / ACH routing (9-digit weighted mod-10) ---------------------------
export function abaWeighted(d9: string): boolean {
  if (!/^\d{9}$/.test(d9)) return false;
  const d = [...d9].map((c) => c.charCodeAt(0) - 48);
  const sum =
    3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + 1 * (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

// ---- GTIN / UPC / EAN (mod-10 weighted 3×/1×) ------------------------------
// Weights alternate 3 and 1 from the rightmost DATA digit (i.e. excluding the
// trailing check digit). Supports GTIN-8/12/13/14.
export function gtinMod10(digits: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return false;
  const body = digits.slice(0, -1);
  const check = digits.charCodeAt(digits.length - 1) - 48;
  let sum = 0;
  // Rightmost data digit gets weight 3, then alternate.
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += (body.charCodeAt(i) - 48) * w;
  }
  const computed = (10 - (sum % 10)) % 10;
  return computed === check;
}

// ---- NPI (10-digit, Luhn over "80840" + first 9 digits) --------------------
// The US healthcare card-issuer prefix 80840 is prepended before the Luhn check.
export function npiLuhn80840(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  return luhn('80840' + npi);
}

// ---- ICAO 9303 MRZ check digit (weights 7,3,1; '<' = 0) --------------------
export function mrzCheckDigit(field: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const ch = field[i];
    let v: number;
    if (ch >= '0' && ch <= '9') v = ch.charCodeAt(0) - 48;
    else if (ch >= 'A' && ch <= 'Z') v = ch.charCodeAt(0) - 55; // A=10..Z=35
    else v = 0; // '<' filler
    sum += v * weights[i % 3];
  }
  return sum % 10;
}

// ---- Base58Check (Bitcoin legacy addresses) --------------------------------
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(s: string): number[] | null {
  const bytes: number[] = [0];
  for (const ch of s) {
    const value = B58_ALPHABET.indexOf(ch);
    if (value === -1) return null;
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading '1's encode leading zero bytes.
  for (let k = 0; k < s.length && s[k] === '1'; k++) bytes.push(0);
  return bytes.reverse();
}

export function base58Check(addr: string): boolean {
  const decoded = base58Decode(addr);
  if (!decoded || decoded.length < 5) return false;
  const payload = decoded.slice(0, -4);
  const checksum = decoded.slice(-4);
  const hash = sha256(sha256(Uint8Array.from(payload)));
  for (let i = 0; i < 4; i++) {
    if (hash[i] !== checksum[i]) return false;
  }
  return true;
}

// ---- Minimal pure-TS SHA-256 (for Base58Check; browser-safe, no deps) ------
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

export function sha256(msg: Uint8Array): Uint8Array {
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const len = msg.length;
  const bitLen = len * 8;
  const withPad = new Uint8Array((((len + 8) >> 6) + 1) * 64);
  withPad.set(msg);
  withPad[len] = 0x80;
  // 64-bit big-endian length in the final 8 bytes.
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 4, bitLen >>> 0, false);
  dv.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((hv, i) => odv.setUint32(i * 4, hv >>> 0, false));
  return out;
}

// ---- Shannon entropy (bits/char) — distinguishes random keys from words -----
export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const freq: Record<string, number> = {};
  for (const ch of s) freq[ch] = (freq[ch] ?? 0) + 1;
  let h = 0;
  const n = s.length;
  for (const k in freq) {
    const p = freq[k] / n;
    h -= p * Math.log2(p);
  }
  return Math.round(h * 100) / 100;
}
