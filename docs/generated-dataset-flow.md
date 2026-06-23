# Generated dataset flow

SignalLens has **two** dataset locations that serve different purposes. This doc
explains how the generated scanner output becomes the frontend-safe snapshot the
UI reads from, and how to use that flow for the demo.

```text
customer-data/      generated realistic customer file tree   (local, gitignored)
DB/                 generated scanner / database output       (local, gitignored)
src/data/evenup/    frontend-safe committed snapshot          (committed, the UI reads this)
```

- `customer-data/` and `DB/` are **local generated artifacts**. They are
  reproducible from fixed seeds and are **gitignored** — never committed.
- `src/data/evenup/` is the **committed, frontend-safe snapshot**. The React app
  imports it directly (static import via `src/data/evenup.ts`). The UI never
  reads `DB/` or `customer-data/` at runtime.
- The UI **never renders secret values** — not raw, masked, prefixes, suffixes,
  or any secret-looking fragment. The generator masks values on input and
  discards the raw body; the sync step re-asserts masking; and
  `src/__tests__/masking.test.tsx` is a CI backstop that fails if any fragment
  reaches the DOM.

## One-time preparation (before the demo)

```bash
go run ./cmd/generate     # or: npm run generate-dataset
                          #   writes customer-data/ and DB/ (both gitignored)
npm run sync-dataset      # transforms DB/ -> src/data/evenup/ (with a safety gate)
npm run typecheck
npm test -- --run
npm run build
```

Shortcut for the first two steps:

```bash
npm run refresh-dataset   # = generate-dataset && sync-dataset
```

Then commit only the frontend-safe snapshot:

```bash
git add src/data/evenup
git commit -m "Refresh evenup snapshot from generated DB"
```

`customer-data/` and `DB/` stay out of git (see `.gitignore`).

## During the demo

1. Show `customer-data/` — the realistic generated customer file tree.
2. Show `DB/` — the generated scanner/database output (findings, assets,
   manifest, training set, `scanner.db`).
3. Open the frontend UI.
4. Explain: the UI reads from `src/data/evenup/`, which is the **frontend-safe
   snapshot synced from `DB/`**. The same data story flows from the generated
   scanner output into the dashboard — without the UI ever touching the raw
   generated folders or rendering a secret value.

You do **not** need to run the generator live during the demo. Arrive with
`customer-data/` and `DB/` already prepared and the snapshot already synced.

## What `npm run sync-dataset` does

`scripts/sync-dataset.ts` (run via `vite-node`, the same runner the other repo
scripts use — no extra dependency) reads:

```text
DB/findings.json  ->  src/data/evenup/findings.json
DB/assets.json    ->  src/data/evenup/assets.json
DB/manifest.json  ->  src/data/evenup/manifest.json
```

The DB output schema already matches the frontend `RawFinding` / `RawAsset`
contract field-for-field (`pkg/store/store.go` vs `src/data/evenup.ts`), so the
payload is **copied as-is** — no shape transform is needed. The script's job is
the **safety gate**:

1. **Scrub** — recursively drops any raw-secret-shaped key
   (`raw_value`, `plaintext`, `unmasked*`, …). None exist in the DB output today;
   this guards against a future generator regression.
2. **Assert masked** — every `candidate.masked_value` and
   `local_context.line_text_masked` must be masked (contain `*`/`•` or be blank).
   If any unmasked value is found, the sync **fails loudly** and writes nothing.

To verify the sync without overwriting the committed snapshot, point it at a
throwaway directory:

```bash
SYNC_OUT=/tmp/evenup-verify npm run sync-dataset
```

## Notes

- `masked_value` and `value_prefix` are consumed by the scoring pipeline
  (`src/lib/features.ts`), so they remain in the snapshot — but are never
  rendered. They are not stripped, because doing so would change scoring.
- `manifest.json` is provenance/answer-key metadata (counts, paths,
  classifications). It contains no secret values and is not imported by the UI.
- The sync changes only `src/data/evenup/`. It does not touch scoring, rules,
  the model, remediation priority, the credential-check flow, or UI layout.
