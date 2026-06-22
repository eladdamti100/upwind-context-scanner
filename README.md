# SignalLens

**Context-aware sensitive data classification for cloud files.**

SignalLens is a classification layer for a Cloud Scanner. It keeps Regex as the candidate-detection layer and adds a context-aware smart layer — context feature extraction, deterministic rules, and a lightweight local LightGBM model — to decide whether each finding is a real secret, a false positive, or a borderline finding that needs review.

- **Purpose:** context-aware sensitive data classification for cloud files.
- **MVP goal:** reduce false positives without missing real secrets.
- **Current status:** documentation and planning phase.

See [docs/product-spec.md](docs/product-spec.md) and [docs/demo-goals.md](docs/demo-goals.md) for details.
