# SLM Selection Matrix — DSPM Semantic Guardrail

Architecture brief for the Small Language Model (SLM) that backs the semantic
layer of the SignalLens classification pipeline (`src/lib/lgbm.ts`,
`SemanticClassifier`). The SLM acts as a **DSPM Semantic Guardrail**: it reads a
masked, structured context record for a regex-detected candidate and returns
`{ secretProbability, modelClassification, reason }`.

## Deployment shape

The model runs **locally inside Upwind's data plane** behind an
OpenAI-compatible chat-completions endpoint (vLLM or Ollama). The connector
(`createLocalSlmClassifier`) POSTs `{model, messages, temperature: 0,
response_format: json_object}` and parses the JSON verdict. No candidate context
leaves the cluster.

**Privacy Invariant.** The model is sent only the masked line context and the
structural/contextual `ContextFeatures` object (`buildUserPayload`). Raw secret
values never reach the prompt, the logs, or the endpoint.

**Resilience.** Endpoint errors, timeouts, or malformed model output fall back to
the deterministic guardrail (`mockSemanticClassifier`), so the pipeline never
crashes and the demo runs fully offline when no endpoint is configured.

## Candidate comparison

Workload profile: short, structured prompts (a few hundred tokens), strict JSON
output, high call volume (one inference per regex candidate), latency-sensitive,
must run on a single modest GPU (or CPU) co-located with the scanner.

| Model | Latency (single GPU) | Hardware footprint | Context accuracy (this workload) | Notes |
|---|---|---|---|---|
| **Qwen-2.5-Coder-7B** | Medium (~7B, fits 16 GB GPU at 4-bit) | Highest of the three | **Best** — code/config-aware; strong at reading env files, IaC, and structural cues | Best reasoning over secret-vs-placeholder in code context; strict JSON adherence is reliable |
| **Phi-3.5-Mini (3.8B)** | **Fastest** — runs well on small GPU / CPU | **Smallest** | Good — solid instruction-following and JSON, weaker on niche code/config idioms | Best latency/footprint tradeoff for high call volume |
| **Llama-3.2 (1B/3B)** | Fast (3B) / fastest (1B) | Small | Adequate (3B); the 1B variant is noticeably weaker on nuanced FP families | Most permissive license; good general fallback, less code-specialised |

### Ranking by dimension

- **Latency:** Phi-3.5-Mini ≈ Llama-3.2-1B > Llama-3.2-3B > Qwen-2.5-Coder-7B
- **Hardware footprint (smallest first):** Llama-3.2-1B < Phi-3.5-Mini ≈ Llama-3.2-3B < Qwen-2.5-Coder-7B
- **Context accuracy (best first):** Qwen-2.5-Coder-7B > Phi-3.5-Mini ≈ Llama-3.2-3B > Llama-3.2-1B

## Recommendation

**Default to Phi-3.5-Mini** for the demo / typical deployment: it gives the best
latency-and-footprint balance at the per-candidate call volume this pipeline
generates, with reliable JSON output. **Offer Qwen-2.5-Coder-7B as the
high-accuracy tier** where a 16 GB-class GPU is available and the extra
code/config reasoning measurably reduces false positives on the hard families
(structurally-valid-but-benign IDs, public-by-design keys, semantic mismatches).
Llama-3.2-3B is the license-friendly fallback. The connector is model-agnostic —
swapping is a config change (`SLM_MODEL`), not a code change.

## Conflict with the documented LightGBM decision

`CLAUDE.md` and `docs/product-spec.md §10` deliberately selected **LightGBM** over
an SLM (explainable, tiny footprint, fast on tabular features, easy to reason
about). This SLM layer is introduced as an **additional/alternative classifier
behind the same swappable interface**, not a wholesale replacement:

- The deterministic tabular model (`mockLightGBM`) remains the **stable,
  synchronous default** that powers the live dashboard and the offline fallback,
  preserving demo stability.
- The SLM adds semantic judgment for the cases tabular features miss, and is
  exercised via the offline enrichment script (`scripts/enrich-slm.ts`) so a
  running endpoint is never a hard demo dependency.
- Its `secretProbability` is interchangeable with the LightGBM probability in the
  `authenticityScore` formula (`src/lib/scoring.ts`), so integration is a
  drop-in substitution and the gated remediation multiplier is unchanged.
