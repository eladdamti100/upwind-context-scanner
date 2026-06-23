# In-Process Spatial Semantic Engine

The Semantic Guardrail is a **lightweight, in-process** model — no external server,
no native dependency, no model download. It replaces the earlier Ollama/Phi-3.5
SLM (now legacy) and realigns with `product-spec.md §10` (a lightweight, local,
explainable, tabular model — the "LightGBM" choice).

## Components
- **`src/lib/forest.ts`** — a data-fit **Random Forest**. `featurize()` maps the
  masked `ContextFeatures` to a fixed numeric vector (`FEATURE_ORDER`);
  `evaluateForest()` is a **synchronous**, sub-microsecond tree-walk; `trainForest()`
  fits a bagged CART ensemble with a seeded PRNG (reproducible).
- **`src/lib/semantic-model.json`** — the trained model (≈64 KB, 150 trees), tracked
  in the repo. Regenerate with `npm run train:semantic`.
- **`src/lib/semanticEngine.ts`** — the `SpatialSemanticEngine`:
  `classifyCorpus(inputs): SemanticVerdict[]` scores the **whole corpus at once**.
  1. *base score* — forest probability per finding.
  2. *spatial aggregate* — group by file (and folder); when a file is collectively
     benign (fixtures/docs/test path, or mostly placeholders / high-frequency
     patterns / structurally-invalid values) it earns a `benignPrior`.
  3. *adjust (downward-only)* — `p = base × (1 − λ·benignPrior)`. A benign file
     down-weights all its findings **as a group**; it can only *lower* a score, so
     it can never create a missed secret. Guardrails/suppress in `rules.ts` still
     floor genuine credentials.
- **`scripts/train-semantic.ts`** — pure-TS trainer (no Python). Reuses
  `extractFeatures` + `buildCorpusStats`, fits on `ground_truth.is_secret`, prints
  train + 5-fold-CV recall/precision, writes the model JSON.

## Wiring
`src/data/evenup.ts` extracts features for the whole corpus, runs
`forestSpatialEngine.classifyCorpus(...)` **once at module load (synchronously)**,
and uses each verdict's `secretProbability` as the model term in
`authenticityScore(regex, rules, model)`. The verdict `reason` (incl. spatial
group-downgrade notes) flows into `riskDownReasons` for the UI.

## Privacy
Only masked/structural features + the (non-secret) file path are read. No raw
value is ever featurized, scored, logged, or sent anywhere.

## Measured (345-finding corpus)
- **Speed:** ~2.9 ms for all 345 (≈8 µs/finding) — vs ~11 s/finding for the Ollama SLM.
- **Quality:** end-to-end precision **96.5%**, recall **100%** (0 missed secrets),
  false-positive reduction **95.5%**. Forest 5-fold CV: recall 100% / precision ~92%.

## Legacy
The Ollama connector (`createLocalSlmClassifier`, `resolveSemanticClassifier` in
`src/lib/lgbm.ts`), `scripts/enrich-slm.ts`, and `docs/slm-selection-matrix.md`
remain in the tree but are **no longer wired into the live pipeline**.
