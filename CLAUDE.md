# CLAUDE.md

Guidance for future Claude Code sessions working on SignalLens.

## Before implementing

- Always read [docs/product-spec.md](docs/product-spec.md) and [docs/demo-goals.md](docs/demo-goals.md) first.
- Do not start implementing before creating a plan.

## Architecture & priorities

- Keep the architecture **modular** — each pipeline stage (Regex detection, context feature extraction, deterministic rules, LightGBM classification, scoring, UI) should be independent and testable.
- **Never expose or log full secrets.** Only masked, structured values may be stored, logged, or passed to the model.
- Prioritize **hackathon demo stability** over completeness.
- Use **LightGBM** as the selected ML model.
- Use placeholders where design or mock data is not yet available.
