# Design Reference

Placeholder. The visual design files for SignalLens have not been uploaded yet. This document describes the intended direction so screens can be implemented later.

## Direction

- The intended UI should follow the **Claude Design** output (reference to be added later).
- Exported screenshots will later be placed under [docs/design/](design/).
- The design should support three core surfaces:
  - a **findings dashboard** (prioritized list of findings),
  - a **finding details panel** (per-finding context, explanation, and validation status),
  - a **map view** (sensitive-data findings connected to cloud assets).

## Constraints

- **Secrets must be masked by default** — full secret values are never shown in the UI.
- The UI should prioritize **clear security triage**: the most critical, exposed findings surface first, and every finding is explainable.

Once the actual design files are available, add them under `docs/design/` and update this document with concrete references.
