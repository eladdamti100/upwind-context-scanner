# Implementation Decisions

Current decisions for the SignalLens MVP. These guide implementation once it begins.

- **LightGBM** is the selected ML model.
- **Regex** is used only for candidate detection (the first detection layer), not for the final decision.
- The smart layer combines **context feature extraction**, **deterministic rules**, and the **LightGBM** model.
- The model receives **masked, structured features only**.
- Full secrets must **never** be logged, stored, or sent to the model.
- Validation can be **mocked** for the MVP.
- Mock data will be created separately (see [mock-data/](../mock-data/)).

## Product feedback addendum — 2026-06-22 (Upwind PM)

Decisions added after PM review (full detail in [docs/superpowers/plans/2026-06-22-signallens-mvp.md](superpowers/plans/2026-06-22-signallens-mvp.md), "Product Feedback Update"):

- **Map = three exposure-location categories:** static (asset node), dynamic (flow/edge between assets), and external-AI (secret sent to OpenAI/Anthropic/etc.). New type `ExposureLocationType = 'asset' | 'flow' | 'external_ai'`; findings can attach to nodes, edges, or external-AI destinations.
- **"Priority" renamed to "Remediation Priority"** (customer-facing). Composed of **Access** + **Exposure** + **Secret-type severity** + **Activity** (actual access/usage). Activity is a **mocked** signal for the MVP (`high|medium|low|unknown`) — not real telemetry. Authenticity (real-vs-FP) stays a separate axis.
- **Suggested rules (MVP-light, mocked):** the system surfaces suggested rules (`SuggestedRule`: id/title/description/reason/scope/affectedFindingsCount/ruleType/status). No rule-authoring engine for now.
- **Finding lifecycle management** replaces the simple feedback concept: `FindingStatus = open | in-review | snoozed | accepted-risk | resolved | false-positive`, plus snooze (until/reason/apply-to-similar). Kept **separate** from ML 👍/👎 feedback.
- **Configuration moves to a Settings screen** (gear icon): sensitivity, customer vertical, rule packs, validation settings. The dashboard stays focused on findings + map.
