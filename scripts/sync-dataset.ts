// scripts/sync-dataset.ts
// ============================================================================
// Preparation-time sync: DB/  ->  src/data/evenup/
// ----------------------------------------------------------------------------
// Turns the generated scanner output (DB/, produced by `go run ./cmd/generate`)
// into the committed, frontend-safe snapshot the React UI imports
// (src/data/evenup/). Run this ONCE before the demo — never at runtime.
//
//   go run ./cmd/generate          # writes DB/ (+ customer-data/), both gitignored
//   npm run sync-dataset           # this script: DB/ -> src/data/evenup/
//
// WHY A SCRIPT AND NOT A COPY:
//   The DB schema already matches the frontend RawFinding / RawAsset contract
//   field-for-field (see pkg/store/store.go vs src/data/evenup.ts), so the
//   payload is copied as-is. The value this script adds is a SAFETY GATE:
//     1. It scrubs any raw-secret-shaped key the generator must never emit.
//     2. It asserts every candidate value is masked before it can be written
//        into the committed snapshot.
//   So even if the generator ever regresses, a raw secret cannot reach the UI
//   snapshot — the sync fails loudly instead.
//
// PRIVACY INVARIANT: only masked projections (masked_value + value_prefix /
// value_suffix fragments) and structural/answer-key metadata are written. There
// is no raw_value in the DB output (pkg/fsbuilder.NewFinding masks on input and
// discards the raw body), and the UI never renders masked values or fragments
// (enforced by src/__tests__/masking.test.tsx).
//
// Run:  npm run sync-dataset        (alias for: vite-node scripts/sync-dataset.ts)
// Override the output dir for verification:  SYNC_OUT=/tmp/verify npm run sync-dataset
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB_DIR = join(REPO_ROOT, 'DB');
const OUT_DIR = process.env.SYNC_OUT
  ? resolve(process.cwd(), process.env.SYNC_OUT)
  : join(REPO_ROOT, 'src', 'data', 'evenup');

// ---------------------------------------------------------------------------
// Safety: keys that would carry an unmasked secret. None of these are part of
// the legitimate DB schema — masked_value / value_prefix / value_suffix are the
// only value-derived fields and are intentionally NOT in this list.
// ---------------------------------------------------------------------------
const SECRET_KEY_RE =
  /^(raw_?value|raw|plaintext|plain_?value|secret_?value|full_?value|unmasked.*|decoded_?value|private_?key_?body|pem_?body)$/i;

// A value is "masked" if it carries a mask glyph or is blank — mirrors
// src/lib/mask.ts so the snapshot obeys the same invariant the UI asserts.
const isMasked = (v: string): boolean => /[•*]/.test(v) || v.trim() === '';

let scrubbedKeys = 0;

// Recursively strip any secret-shaped keys. Returns the cleaned value.
function scrub(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(scrub);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k)) {
        scrubbedKeys++;
        continue; // drop the key entirely
      }
      out[k] = scrub(v);
    }
    return out;
  }
  return node;
}

function readJSON(path: string): unknown {
  if (!existsSync(path)) {
    fail(
      `Missing ${rel(path)}.\n` +
        `Generate the dataset first:\n` +
        `  go run ./cmd/generate   (or: npm run generate-dataset)\n` +
        `then re-run:  npm run sync-dataset`,
    );
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`Could not parse ${rel(path)}: ${(e as Error).message}`);
  }
}

function writeJSON(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  // 2-space indent + trailing newline mirrors the Go json.MarshalIndent output.
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

const rel = (p: string) => p.replace(REPO_ROOT + '/', '');

function fail(msg: string): never {
  console.error(`\n  sync-dataset: ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// findings.json — copy + scrub + assert-masked
// ---------------------------------------------------------------------------
interface RawCandidate {
  detected_type?: string;
  masked_value?: string;
  [k: string]: unknown;
}
interface RawFinding {
  finding_id?: string;
  candidate?: RawCandidate;
  local_context?: { line_text_masked?: string };
  [k: string]: unknown;
}

function syncFindings(): number {
  const raw = scrub(readJSON(join(DB_DIR, 'findings.json'))) as RawFinding[];
  if (!Array.isArray(raw)) fail('DB/findings.json is not an array');

  // Assert every emitted value is masked — a hard gate before anything is
  // written into the committed, frontend-safe snapshot.
  const leaks: string[] = [];
  for (const f of raw) {
    const mv = f.candidate?.masked_value ?? '';
    const lt = f.local_context?.line_text_masked ?? '';
    if (!isMasked(mv)) leaks.push(`${f.finding_id ?? '?'}: masked_value="${mv}"`);
    if (lt && !isMasked(lt)) leaks.push(`${f.finding_id ?? '?'}: line_text_masked="${lt}"`);
  }
  if (leaks.length) {
    fail(
      `Refusing to write — ${leaks.length} finding(s) carry an UNMASKED value:\n  ` +
        leaks.slice(0, 5).join('\n  ') +
        (leaks.length > 5 ? `\n  …and ${leaks.length - 5} more` : ''),
    );
  }

  writeJSON(join(OUT_DIR, 'findings.json'), raw);
  return raw.length;
}

// ---------------------------------------------------------------------------
// assets.json — copy + scrub (no value fields, scrubbed for uniformity)
// ---------------------------------------------------------------------------
function syncAssets(): number {
  const raw = scrub(readJSON(join(DB_DIR, 'assets.json')));
  if (!Array.isArray(raw)) fail('DB/assets.json is not an array');
  writeJSON(join(OUT_DIR, 'assets.json'), raw);
  return raw.length;
}

// ---------------------------------------------------------------------------
// manifest.json — answer-key metadata (counts/paths/classifications only; no
// secret values). Copied through the same scrub for consistency. Not imported
// by the UI, but kept in the snapshot for provenance.
// ---------------------------------------------------------------------------
function syncManifest(): number {
  const raw = scrub(readJSON(join(DB_DIR, 'manifest.json'))) as { files?: Record<string, unknown> };
  writeJSON(join(OUT_DIR, 'manifest.json'), raw);
  return raw.files ? Object.keys(raw.files).length : 0;
}

// ---------------------------------------------------------------------------
function main(): void {
  console.log(`sync-dataset: ${rel(DB_DIR)}/  ->  ${rel(OUT_DIR)}/`);
  const findings = syncFindings();
  const assets = syncAssets();
  const files = syncManifest();

  console.log(`  findings.json  ${findings} findings`);
  console.log(`  assets.json    ${assets} assets`);
  console.log(`  manifest.json  ${files} files`);
  console.log(
    scrubbedKeys > 0
      ? `  SAFETY: scrubbed ${scrubbedKeys} raw-secret-shaped key(s) before writing.`
      : `  SAFETY: no raw-secret keys present; all candidate values masked. ✓`,
  );
  console.log('Done. The frontend imports this snapshot from src/data/evenup/.');
}

main();
