# SignalLens MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a faithful React/Vite port of the imported Claude Design screen (`Sensitive Data Classification.dc.html`) as the SignalLens MVP — a context-aware sensitive-data classification UI driven by typed mock data, with a modular, unit-tested pure-logic "smart layer" behind it.

**Architecture:** Single-page Vite + React + TypeScript app, dark-theme only, no backend. The design's `DCLogic` `state`/`setState` becomes a React `useReducer` store; its `renderVals()` derivations become selectors over `data/` + `lib/`. Business logic lives in pure, tested `lib/` modules (the seam where the real Regex→features→rules→LightGBM pipeline plugs in later); components are props-driven and contain no business logic.

**Tech Stack:** Vite, React 18, TypeScript, Vitest, @testing-library/react, jsdom. Styling via copied Upwind design-system token CSS (no CSS framework). Inline-style fidelity to the design.

## Global Constraints

- **Product name in UI = "SignalLens"** (spec/README override the design's "SignalGuard"). Verbatim everywhere a brand name appears.
- **Never expose/log/store/pass full secrets.** Only `maskedValue` strings (e.g. `AKIA••••5T2Q`) may be rendered, logged, or passed to any logic. No code path reconstructs a full secret. (CLAUDE.md)
- **Source of truth = `docs/product-spec.md` + `docs/demo-goals.md`.** Where the design conflicts, the spec wins (conflicts already resolved: name → SignalLens; keep design's 4 summary cards).
- **Dark theme only** — `document.documentElement.dataset.theme = 'dark'` forced on mount; no light toggle.
- **Modular & testable** — each pipeline stage is an independent, unit-tested `lib/` module (CLAUDE.md).
- **Demo stability first** — every task leaves the app runnable; core Findings demo (Tasks 1–17) precedes Map.
- **Tab/page labels keep the design wording** ("Exposed Sensitive Data", "Data classifications", "Exposure map").
- **Design source data** is read from the imported Claude Design project (DesignSync `get_file` on project `ba183dc7-17b8-4a51-8463-e430e96130ea`): the `.dc.html` `DCLogic` script (12 findings, 14 classifications, 8 map assets, style maps) and `_ds/upwind-design-system-…/tokens/*.css` + fonts.

---

## Product Feedback Update — 2026-06-22 (Upwind PM)

This section **supersedes/extends** the affected parts of the original tasks below. Nothing here is implemented yet; it updates direction only. All MVP constraints still hold (masked-only secrets, LightGBM interface, Regex = candidate-detection only, demo-stable, **no final mock data** — minimal isolated placeholders only). Status of work so far: Tasks 1–7 (scaffold, theme, types, classify, features, rules, lgbm) are already built; the changes below mostly land in the **not-yet-built** scoring/state/UI tasks, plus additive extensions to the committed `types.ts`.

### PF-1 · Map: three exposure-location categories
The map must distinguish **where** a secret is exposed:
- **A. Static exposed secret** — on a specific asset node (bucket, repo, config/deployment file, cloud asset). Findings attach to **asset nodes** (today's model).
- **B. Dynamic exposed secret** — observed moving between assets (API calls, runtime traffic, token in request/response). Findings attach to **edges/flows** between assets, not just nodes.
- **C. Secret sent to an external AI service** — payload sent to OpenAI/Anthropic/other LLM provider. Represented as **external-AI nodes / AI-risk edges**, visually separate from normal asset exposure.

New/changed types (add in the scoring/map step; additive to `types.ts`):
```ts
export type ExposureLocationType = 'asset' | 'flow' | 'external_ai';
export interface MapFindingRef { detectedType: string; priority: Priority; validation: string; locationType: ExposureLocationType; }
export interface MapFlowEdge { id: string; fromKey: string; toKey: string; protocol?: string; findings: MapFindingRef[]; } // dynamic
export interface ExternalAiNode { key: string; provider: string; /* OpenAI | Anthropic | … */ position: { xPct: number; yPct: number }; findings: MapFindingRef[]; }
// MapAsset.findings become MapFindingRef[] with locationType 'asset'.
```
The map legend/filters gain an exposure-location dimension (static / dynamic / external-AI). Demo data: 1–2 illustrative flow edges and 1 external-AI node (placeholder, clearly isolated).

### PF-2 · Rename "Priority" → **Remediation Priority** (recommended)
**Recommendation: "Remediation Priority"** — it tells the customer *what to fix first*, action-oriented, and reads well next to the separate **Authenticity** score (is-it-real). (Considered: Exposure Priority — too close to the "Exposure map" label; Risk Priority/Exposure Risk — overlap with the existing Risk score; Action Priority — vaguer.) UI shows the column/label as **"Remediation priority"**.

It is composed of four inputs (authenticity stays a *separate* real-vs-FP axis; low-authenticity/FP findings are downranked or suppressed via sensitivity):
- **Access** — who can access the secret/asset (`AccessScope`)
- **Exposure** — how externally exposed it is (existing `exposureScore`)
- **Secret type severity** — how dangerous the type is (existing `typeSeverity`)
- **Activity / actual access** — how much it's accessed in practice — **mocked** for MVP as `ActivitySignal`

```ts
export type AccessScope = 'public' | 'broad' | 'internal' | 'restricted';
export type ActivitySignal = 'high' | 'medium' | 'low' | 'unknown'; // MOCKED input — not real telemetry
export interface RemediationPriorityBreakdown {
  accessScore: number;       // 0..100 from AccessScope
  exposureScore: number;     // 0..100 (existing)
  secretTypeSeverity: number;// 0..100 (existing typeSeverity)
  activityScore: number;     // 0..100 from ActivitySignal (high≈100, medium≈60, low≈25, unknown≈40)
  remediationPriority: number; // 0..100 final, customer-facing
}
// Proposed MVP formula (tunable): remediationPriority =
//   round(0.30*access + 0.30*exposure + 0.25*secretTypeSeverity + 0.15*activity)
```
`Finding` gains `accessScope: AccessScope` and `activity: ActivitySignal`; `RiskScoreBreakdown.priorityScore` is renamed/aliased to `remediationPriority` (keep authenticity fields as-is). **Do not** build real runtime telemetry — `activity` is a mockable per-finding signal.

### PF-3 · Suggested rules (MVP-light, mocked)
A product flow where the system *suggests* rules from repeated findings/patterns (e.g. "Suppress similar placeholder tokens in docs", "Increase severity for payment secrets in prod configs", "Treat test-fixture secrets as low risk for this customer"). **MVP = mocked suggestions surfaced in the UI; do NOT build a rule-authoring engine** unless explicitly approved.
```ts
export interface SuggestedRule {
  id: string; title: string; description: string; reason: string; scope: string;
  affectedFindingsCount: number;
  ruleType: 'default' | 'vertical-specific' | 'customer-specific';
  status: 'suggested' | 'approved' | 'dismissed';
}
```
UI: a "Suggested rules" surface (panel in Settings or a small section near Classifications) listing mocked suggestions with Approve / Dismiss (state-only, toast feedback).

### PF-4 · Finding lifecycle management (replaces the simple "feedback" concept)
Triage workflow, **separate from ML feedback** (the 👍/👎 model-signal stays as its own thing). Findings gain a lifecycle status + snooze:
```ts
export type FindingStatus = 'open' | 'in-review' | 'snoozed' | 'accepted-risk' | 'resolved' | 'false-positive';
export interface SnoozeInfo { until: string; reason: string; applyToSimilar: boolean; }
// Finding gains: status: FindingStatus; snooze?: SnoozeInfo;
```
UI: the former `FeedbackModal` becomes a **lifecycle/triage** control (status dropdown + a Snooze dialog: duration → `until` date, reason, optional apply-to-similar). ML feedback is kept distinct.

### PF-5 · Move configurability into a Settings screen
Config leaves the main dashboard; add a **settings entry point (gear icon)** opening a Settings screen/modal. The dashboard stays focused on **findings + map**. Settings contains:
- **Scanner sensitivity** — Strict / Balanced / Flexible (moved out of the findings toolbar)
- **Customer vertical** — SaaS / Fintech / Retail / Healthcare / General-Default
- **Rule packs** — default / vertical-specific / customer-specific (toggles)
- **Validation settings** — mocked validation; enabled/disabled placeholder

Sensitivity + vertical still drive the mocked pipeline (via `lib/priority` + rule packs), but the **controls live in Settings**, not the toolbar.

### Revised implementation order (deltas only)
1. Foundation order unchanged through Step 7 (done).
2. **Scoring step (Step 8 / Task 7):** implement the new **Remediation Priority** composite (access + exposure + secret-type + mocked activity) and rename `priorityScore` → `remediationPriority`; add `AccessScope`/`ActivitySignal` to `types.ts` + `Finding`.
3. **State/types:** extend the reducer + `types.ts` for `FindingStatus`/`SnoozeInfo`, settings state (sensitivity, vertical, rule packs, validation), and `SuggestedRule[]` (mocked).
4. **UI phase:** add a **Settings screen/modal task** (sensitivity + vertical + rule packs + validation) and move the sensitivity control there (Task 15 toolbar keeps search/filters only). Findings table column "Priority" → "Remediation priority".
5. **Lifecycle replaces feedback (Task 20):** status + snooze triage; keep ML feedback separate.
6. **Map (Task 22):** extend to the three exposure-location categories (asset / flow / external-AI) with the new map types + legend/filter dimension.
7. **Suggested rules (new task):** mocked suggestions surface — lower priority, after the core findings + map demo is stable.

These add two new tasks (see **Task 24 · Settings screen** and **Task 25 · Suggested rules (mocked)** below) and modify Tasks 7, 11, 15, 20, 22. Build order still prioritizes a stable core demo before the additive surfaces.

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, index.html, .gitignore
public/fonts/Upwind_Sans_{Regular,Medium,Bold}.otf
src/
  main.tsx                 mount + force dark theme
  App.tsx                  shell + tab routing, wires store + views
  types.ts                 domain model
  theme/{colors,typography,spacing,fonts,dark,base}.css
  data/{findings,classifications,mapAssets,index}.ts
  lib/{classify,priority,scoring,query,validation,explain,mask}.ts (+ .test.ts each)
  state/{store,actions}.ts
  components/
    shell/{TopBar,PageHeader,Tabs}.tsx
    common/{Icon,Toast,Popover,Avatar,SeverityBadge}.tsx
    findings/{FindingsView,SummaryCards,FilterToolbar,SensitivityControl,
              FindingsTable,TableToolbar,Pagination,DetailDrawer,RiskPopover,
              ValidationModal,FeedbackModal}.tsx
    findings/cells/{PriorityCell,SecretTypeCell,ClassificationCell,RiskCell,
              ValidationCell,FileCell,EnvCell,OwnerCell,FeedbackCell,ActionsCell,TextCell}.tsx
    classifications/{ClassificationsView,ClassTable,ClassDrawer}.tsx
    map/{MapView,ExposureMap,AssetPanel}.tsx
  __tests__/smoke.test.tsx
```

Each `lib/` file = one responsibility, pure functions, no React import. Components import from `lib/`, `data/`, `types`, never inline business rules.

---

## Task 1: Scaffold project

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`

**Interfaces:**
- Produces: a booting Vite app; `npm run dev`, `npm run build`, `npm test` all work.

- [ ] **Step 1: Scaffold + deps**

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Configure Vitest** — create `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
});
```

Create `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom';
```
Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Minimal App + forced dark theme** — replace `src/App.tsx` and `src/main.tsx`

`src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
document.documentElement.dataset.theme = 'dark';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```
`src/App.tsx`:
```tsx
export default function App() {
  return <div data-testid="app-root">SignalLens</div>;
}
```

- [ ] **Step 4: Verify boot**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + React + TS + Vitest"
```

---

## Task 2: Theme (Upwind tokens, fonts, dark, base)

**Files:**
- Create: `src/theme/{colors,typography,spacing,fonts,dark,base}.css`, `public/fonts/Upwind_Sans_{Regular,Medium,Bold}.otf`
- Modify: `src/main.tsx` (import theme entry)

**Interfaces:**
- Produces: CSS custom properties (`--bg-secondary`, `--surface`, `--text-primary`, `--severity-*`, `--uw-*`, `--font-default-family`, `--font-mono-family`, `--space-*`, `--shadow-sm`, `--menu-shadow`, `--action-primary`) available globally in dark theme.

- [ ] **Step 1: Pull design-system assets** — using DesignSync `get_file` on project `ba183dc7-17b8-4a51-8463-e430e96130ea`, copy verbatim into `src/theme/`:
  - `_ds/upwind-design-system-…/tokens/colors.css` → `colors.css`
  - `…/tokens/typography.css` → `typography.css`
  - `…/tokens/spacing.css` → `spacing.css`
  - `…/tokens/fonts.css` → `fonts.css` (rewrite `@font-face` `src:` URLs to `/fonts/Upwind_Sans_*.otf`)
  - the 3 `.otf` files → `public/fonts/`

- [ ] **Step 2: Dark overrides + base** — create `src/theme/dark.css` with the `html[data-theme="dark"]{…}` variable block copied verbatim from the `.dc.html` `<helmet><style>`; create `src/theme/base.css` with the resets, scrollbar styles, and `@keyframes uwspin/uwfade/uwslide` from the same block, plus:
```css
html, body { margin: 0; height: 100%; background: var(--bg-secondary); }
* { box-sizing: border-box; }
body { font-family: var(--font-default-family); color: var(--text-primary); font-size: 14px; }
```

- [ ] **Step 3: Theme entry** — create `src/theme/index.css` importing the six files in order (colors, typography, spacing, fonts, dark, base); import it at top of `src/main.tsx`.

- [ ] **Step 4: Verify** — temporarily set `App` to `<div style={{color:'var(--severity-critical)'}}>SignalLens</div>`; run `npm run dev`; confirm dark background + Upwind font + coral text render. Revert the temp style.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Upwind design tokens, fonts, dark theme"
```

---

## Task 3: Domain types

**Files:**
- Create: `src/types.ts`

**Interfaces:**
- Produces: all types in §4 of the design spec — `Priority`, `Sensitivity`, `Exposure`, `Environment`, `AssetCriticality`, `Category`, `ValidationStatus`, `FindingContextObject`, `ContextFeatures`, `DeterministicRuleResult`, `LightGBMModelResult`, `RiskScoreBreakdown`, `Finding`, `ClassificationRow`, `ClassificationDetail`, `MapAsset`.

- [ ] **Step 1: Write the types** — create `src/types.ts` with the full type set:

```ts
export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'suppressed' | 'info';
export type Sensitivity = 'strict' | 'balanced' | 'flexible';
export type Exposure = 'Public' | 'Internet-facing' | 'Internal' | 'Private dev/test' | 'Docs-only';
export type Environment = 'Production' | 'Dev' | 'Test' | 'Docs';
export type AssetCriticality = 'High' | 'Medium' | 'Low';
export type Category =
  | 'Secret' | 'Fintech' | 'SaaS' | 'PII' | 'PCI' | 'Healthcare'
  | 'False Positive Pattern' | 'Documentation Example' | 'Test Value';
export type ValidationStatus =
  | 'not-validated' | 'validated-active' | 'validated-inactive'
  | 'validation-failed' | 'validation-unsupported' | 'validation-permission-required';

export interface RiskScoreBreakdown {
  regexConfidence: number;       // 0..1
  deterministicRules: number;    // signed delta (design `det`)
  lgbmProbability: number;       // 0..1
  authenticityScore: number;     // 0..100
  exposureScore: number;         // 0..100
  assetCriticalityScore: number; // 0..100
  priorityScore: number;         // 0..100
}

export interface DeterministicRuleResult {
  score: number;
  triggered: { id: string; label: string; direction: 'increase' | 'decrease'; weight: number }[];
  guardrailFloor?: Priority;
}
export interface LightGBMModelResult {
  secretProbability: number;
  modelClassification?:
    | 'true_secret' | 'likely_secret' | 'false_positive' | 'placeholder'
    | 'documentation_example' | 'test_value' | 'public_non_secret' | 'unknown_or_review';
}

export interface FindingContextObject {
  findingId: string;
  file: { fileName: string; filePath: string; fileExtension: string; fileRole: string; storageLocation: string };
  candidate: { detectedType: string; maskedValue: string; valuePrefix: string; valueSuffix: string;
               valueLength: number; entropy: number; entropyLevel: 'low'|'medium'|'high';
               lineNumber: number; offset: number; variableName: string };
  regex: { ruleId: string; ruleSource: string; regexConfidence: number };
  localContext: { lineTextMasked: string; previousLinesMasked: string[]; nextLinesMasked: string[] };
  scanMetadata: { sensitivityMode: Sensitivity; customerVertical: string; enabledRulePacks: string[] };
}
export interface ContextFeatures {
  isProdPath: boolean; isDevPath: boolean; isTestPath: boolean; isDocsPath: boolean; isExamplePath: boolean;
  isConfigFile: boolean; isSourceCodeFile: boolean; isLogFile: boolean; isIacFile: boolean;
  fileRole: string; environmentHint: Environment;
  detectedType: string; valueLength: number; entropy: number; entropyLevel: 'low'|'medium'|'high';
  hasLivePrefix: boolean; hasTestPrefix: boolean; looksLikePlaceholder: boolean; isKnownTestValue: boolean;
  hasSecretVariableName: boolean; hasPublicVariableName: boolean; variableIntent: 'secret'|'public'|'example';
  hasExampleLanguage: boolean; hasPlaceholderLanguage: boolean; hasTestLanguage: boolean;
  hasSecretLanguage: boolean; hasProductionLanguage: boolean; hasDocumentationContext: boolean;
  storageExposure: Exposure; isPubliclyAccessible: boolean; assetCriticality: AssetCriticality; cloudProvider: string;
}

export interface Finding {
  id: number;
  basePriority: Priority;
  detectedType: string;       // 'aws-access-key'
  maskedValue: string;
  classification: string;     // 'AWS Access Key'
  category: Category;
  risk: number;               // 0..100 display
  validation: ValidationStatus;
  file: string; path: string; asset: string; assetKind: string;
  environment: Environment; cloud: string; owner: string; createdAt: string;
  line: number; offset: number;
  exposure: Exposure; assetCriticality: AssetCriticality;
  scores: RiskScoreBreakdown;
  isFalsePositive?: boolean;
  riskUpReasons: string[];
  riskDownReasons: string[];
  explanation: string;
  context?: FindingContextObject;
  features?: ContextFeatures;
}

export interface ClassificationRow {
  id: string; name: string; category: Category; patterns: number; rulePacks: string;
  findings: number; critical: number; fpReductionPct: number; createdBy: string; enabled: boolean;
}
export interface ClassificationDetail { description: string; pattern: string; up: string[]; down: string[]; guardrail: string; }

export interface MapAsset {
  key: string; name: string; cloud: string; kind: string;
  exposure: string; environment: Environment; assetCriticality: AssetCriticality;
  highestSeverity: Priority; validationSummary: string;
  findings: { detectedType: string; priority: Priority; validation: string }[];
  position: { xPct: number; yPct: number }; edges: string[];
}
```

- [ ] **Step 2: Verify** — Run: `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add SignalLens domain types"`

---

## Task 4: Mock data port

**Files:**
- Create: `src/data/findings.ts`, `src/data/classifications.ts`, `src/data/mapAssets.ts`, `src/data/index.ts`

**Interfaces:**
- Consumes: types from `src/types.ts`.
- Produces: `export const FINDINGS: Finding[]` (12), `export const CLASSIFICATIONS: ClassificationRow[]` (14), `export function classificationDetail(id: string): ClassificationDetail`, `export const MAP_ASSETS: Record<string, MapAsset>` (8), `export const TOPOLOGY_EDGES: { keys: string[]; d: string }[]`.

- [ ] **Step 1: Port findings** — read the `data()` array (12 records, ids 1–12) and the style/exposure fields from the `.dc.html` `DCLogic` script. Map each design record to a `Finding`, transforming field names: `base`→`basePriority`, `type`→`detectedType`, `masked`→`maskedValue`, `cls`→`classification`, `cat`→`category`, `val`→`validation` (kebab: `not-validated`,`validated-active`,`validated-inactive`,`failed`→`validation-failed`,`permission`→`validation-permission-required`,`unsupported`→`validation-unsupported`), `kind`→`assetKind`, `off`→`offset`, `created`→`createdAt`, `fp`→`isFalsePositive`, `up`→`riskUpReasons`, `down`→`riskDownReasons`, `expl`→`explanation`. Build `scores` from `regex`/`det`/`lgbm`/`auth`/`prio` + computed exposure/assetCriticality scores (see Task 7 `exposureScore`/`assetCriticalityScore`). Example (finding 1, verbatim values):

```ts
import type { Finding } from '../types';
export const FINDINGS: Finding[] = [
  {
    id: 1, basePriority: 'critical', detectedType: 'aws-access-key',
    maskedValue: 'AKIA••••••••••••5T2Q', classification: 'AWS Access Key', category: 'Secret',
    risk: 96, validation: 'validated-active',
    file: '.env.production', path: '/srv/payments/.env.production',
    asset: 'customer-prod-bucket', assetKind: 'S3 bucket',
    environment: 'Production', cloud: 'AWS', owner: 'Maya Rosen', createdAt: 'Jun 3, 2026',
    line: 42, offset: 8, exposure: 'Public', assetCriticality: 'High',
    scores: { regexConfidence: 0.98, deterministicRules: 24, lgbmProbability: 0.96,
              authenticityScore: 97, exposureScore: 95, assetCriticalityScore: 90, priorityScore: 96 },
    riskUpReasons: ['Production file path','Secret-like variable name (AWS_SECRET_ACCESS_KEY)',
      'High entropy value','Storage asset publicly accessible','Validated active credential'],
    riskDownReasons: [],
    explanation: 'Critical finding: AWS Access Key found in a production configuration file. The value has high entropy, appears under a secret-like variable name, is located in a production path, and the storage asset is publicly accessible.',
  },
  // … port findings 2–12 identically from the design `data()` array …
];
```

- [ ] **Step 2: Port classifications** — map the 14-row `classData()` array to `ClassificationRow[]` (`fpr`→`fpReductionPct`, `by`→`createdBy`, add `enabled: true`), and port `classDetail()` (the generic + `aws-access-key` special-case) into `classificationDetail(id)`.

- [ ] **Step 3: Port map assets** — map the 8-entry `mapData()` object to `MAP_ASSETS` (`crit`→`assetCriticality`, `highest`→`highestSeverity` lowercased to `Priority`, `valSummary`→`validationSummary`), add `position` per asset (from the group-box / node placement in the map template) and `edges`. Port the `EDGES` array to `TOPOLOGY_EDGES` (`k`→`keys`, keep `d`).

- [ ] **Step 4: Barrel + verify** — `src/data/index.ts` re-exports all. Run: `npx tsc --noEmit`. Expected: no errors. Add a trivial test `src/data/findings.test.ts`:

```ts
import { FINDINGS } from './findings';
test('12 findings, all masked', () => {
  expect(FINDINGS).toHaveLength(12);
  for (const f of FINDINGS) expect(f.maskedValue).toMatch(/[•*]/); // never a full secret
});
```
Run: `npm test -- findings`. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: port design mock data (findings, classifications, map)"`

---

## Task 5: lib/mask + lib/classify (style/label maps)

**Files:**
- Create: `src/lib/mask.ts`, `src/lib/classify.ts`, `src/lib/classify.test.ts`

**Interfaces:**
- Produces:
  - `mask.ts`: `assertMasked(v: string): string` (throws if value looks like an unmasked secret), `isMasked(v): boolean`.
  - `classify.ts`: `priStyle(p: Priority): {fg:string;bg:string}`, `priLabel(p): string`, `categoryStyle(c: Category): {fg:string;bg:string}`, `envStyle(e: Environment): {fg:string;bg:string}`, `valStyle(v: ValidationStatus): {label:string;fg:string;bg:string;canValidate:boolean}`, `typeSeverity(detectedType: string): number`, `techOf(detectedType): string`.

- [ ] **Step 1: Write failing tests** — `src/lib/classify.test.ts`:

```ts
import { priLabel, valStyle, typeSeverity } from './classify';
import { isMasked } from './mask';

test('priority labels', () => {
  expect(priLabel('critical')).toBe('Critical');
  expect(priLabel('suppressed')).toBe('Suppressed');
});
test('validation style drives Validate button availability', () => {
  expect(valStyle('not-validated').canValidate).toBe(true);
  expect(valStyle('validated-active').canValidate).toBe(false);
  expect(valStyle('validated-active').label).toBe('Validated active');
});
test('type severity ranks private key above email (spec §11)', () => {
  expect(typeSeverity('pem-private-key')).toBeGreaterThan(typeSeverity('email-address'));
});
test('isMasked rejects plausible raw secret', () => {
  expect(isMasked('AKIA••••5T2Q')).toBe(true);
  expect(isMasked('AKIAIOSFODNN7EXAMPLE')).toBe(false);
});
```

- [ ] **Step 2: Run, verify fail** — Run: `npm test -- classify`. Expected: FAIL (modules not found).

- [ ] **Step 3: Implement** — `src/lib/mask.ts`:

```ts
export const isMasked = (v: string): boolean => /[•*]/.test(v) || v.trim() === '';
export function assertMasked(v: string): string {
  if (!isMasked(v)) throw new Error('Refusing to handle unmasked secret value');
  return v;
}
```
`src/lib/classify.ts` — port `pri`, `priLabel`, `catStyle`, `envStyle`, `valStyle` verbatim from the design (CSS-var values unchanged), plus the spec §11 severity ranking and the design `techOf` map:

```ts
import type { Priority, Category, Environment, ValidationStatus } from '../types';
const CHIP = 'rgba(148,163,184,0.13)';
export function priStyle(p: Priority) {
  const m: Record<string,{fg:string;bg:string}> = {
    critical:{fg:'var(--severity-critical)',bg:'var(--severity-critical-bg)'},
    high:{fg:'var(--severity-high)',bg:'var(--severity-high-bg)'},
    medium:{fg:'var(--severity-medium)',bg:'var(--severity-medium-bg)'},
    low:{fg:'var(--uw-metal-blue-02)',bg:'var(--severity-info-bg)'},
    suppressed:{fg:'var(--text-tertiary)',bg:'var(--severity-info-bg)'},
    info:{fg:'var(--text-secondary)',bg:'var(--severity-info-bg)'} };
  return m[p] ?? m.info;
}
export const priLabel = (p: Priority) =>
  ({critical:'Critical',high:'High',medium:'Medium',low:'Low',suppressed:'Suppressed',info:'Informational'} as Record<string,string>)[p] ?? p;
export function categoryStyle(c: Category) { /* port catStyle map, bg: CHIP */ /* … */ return {fg:'var(--severity-high)',bg:CHIP}; }
export function envStyle(e: Environment) { /* port envStyle map */ return {fg:'var(--text-tertiary)',bg:CHIP}; }
export function valStyle(v: ValidationStatus) {
  const m: Record<string,{label:string;fg:string;bg:string;canValidate:boolean}> = {
    'not-validated':{label:'Not validated',fg:'var(--text-tertiary)',bg:'var(--severity-info-bg)',canValidate:true},
    'validated-active':{label:'Validated active',fg:'var(--severity-critical)',bg:'var(--severity-critical-bg)',canValidate:false},
    'validated-inactive':{label:'Validated inactive',fg:'var(--severity-safe)',bg:'var(--severity-safe-bg)',canValidate:false},
    'validation-failed':{label:'Validation failed',fg:'var(--severity-medium)',bg:'var(--severity-medium-bg)',canValidate:true},
    'validation-permission-required':{label:'Permission required',fg:'var(--text-tertiary)',bg:'var(--severity-info-bg)',canValidate:false},
    'validation-unsupported':{label:'Unsupported',fg:'var(--text-tertiary)',bg:'var(--severity-info-bg)',canValidate:false} };
  return m[v] ?? m['not-validated'];
}
const SEVERITY: Record<string,number> = { 'pem-private-key':100,'aws-secret-key':95,'aws-access-key':95,
  'database-password':90,'stripe-secret-key':85,'github-token':80,'slack-token':70,'datadog-api-key':70,
  'generic-api-key':65,'generic-token':60,'test-card-number':30,'email-address':20 };
export const typeSeverity = (t: string) => SEVERITY[t] ?? 60;
export const techOf = (t: string) => (({'aws-access-key':'AWS','aws-secret-key':'AWS','stripe-secret-key':'Stripe',
  'github-token':'GitHub','slack-token':'Slack','datadog-api-key':'Datadog'} as Record<string,string>)[t] ?? 'Generic');
```
(Fill `categoryStyle`/`envStyle` bodies by porting the design's `catStyle`/`envStyle` maps verbatim.)

- [ ] **Step 4: Run, verify pass** — Run: `npm test -- classify`. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: lib/classify + lib/mask with tests"`

---

## Task 6: lib/priority (sensitivity re-ranking + banding)

**Files:**
- Create: `src/lib/priority.ts`, `src/lib/priority.test.ts`

**Interfaces:**
- Consumes: `Finding`, `Sensitivity`, `Priority` from types.
- Produces: `effPriority(f: Finding, s: Sensitivity): Priority`, `band(risk: number): Priority`, `priorityRank(p: Priority): number`.

- [ ] **Step 1: Write failing tests**:

```ts
import { effPriority, band } from './priority';
import type { Finding } from '../types';
const f = (basePriority: Finding['basePriority']) => ({ basePriority } as Finding);
test('balanced returns base priority', () => {
  expect(effPriority(f('low'), 'balanced')).toBe('low');
  expect(effPriority(f('critical'), 'balanced')).toBe('critical');
});
test('strict lifts suppressed to low', () => {
  expect(effPriority(f('suppressed'), 'strict')).toBe('low');
});
test('flexible drops low to suppressed', () => {
  expect(effPriority(f('low'), 'flexible')).toBe('suppressed');
});
test('band maps risk to severity', () => {
  expect(band(96)).toBe('critical'); expect(band(72)).toBe('high');
  expect(band(45)).toBe('medium'); expect(band(22)).toBe('low'); expect(band(10)).toBe('suppressed');
});
```

- [ ] **Step 2: Run, verify fail** — Run: `npm test -- priority`. Expected: FAIL.

- [ ] **Step 3: Implement** (port design `effPriority` + `band` + `prank`):

```ts
import type { Finding, Sensitivity, Priority } from '../types';
export function effPriority(f: Finding, s: Sensitivity): Priority {
  if (s === 'strict')   return f.basePriority === 'suppressed' ? 'low' : f.basePriority;
  if (s === 'flexible') return f.basePriority === 'low' ? 'suppressed' : f.basePriority;
  return f.basePriority;
}
export const band = (r: number): Priority =>
  r >= 90 ? 'critical' : r >= 70 ? 'high' : r >= 40 ? 'medium' : r >= 20 ? 'low' : 'suppressed';
export const priorityRank = (p: Priority): number =>
  ({critical:5,high:4,medium:3,low:2,info:1,suppressed:0} as Record<string,number>)[p] ?? 0;
```

- [ ] **Step 4: Run, verify pass** — Run: `npm test -- priority`. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: lib/priority sensitivity re-ranking + banding"`

---

## Task 7: lib/scoring (authenticity + priority formulas)

> ⚠️ **Updated by Product Feedback PF-2.** Rename `priorityScore` → **`remediationPriority`** and compose it from **access + exposure + secret-type severity + mocked activity** (see `RemediationPriorityBreakdown`), adding `AccessScope` + `ActivitySignal` to `types.ts`/`Finding`. Authenticity stays a separate axis. The formulas below are the original baseline — keep authenticity as-is; replace the priority formula per PF-2.

**Files:**
- Create: `src/lib/scoring.ts`, `src/lib/scoring.test.ts`

**Interfaces:**
- Consumes: `Finding`, `RiskScoreBreakdown`, `Exposure`, `AssetCriticality`; `typeSeverity` from `lib/classify`.
- Produces: `exposureScore(e: Exposure): number`, `assetCriticalityScore(a: AssetCriticality): number`, `authenticityScore(regex:number, det:number, lgbm:number): number`, `priorityScore(auth:number, detectedType:string, e:Exposure, a:AssetCriticality): number`, `buildBreakdown(f: Finding): {label:string;value:string;width:string;color:string}[]`.

- [ ] **Step 1: Write failing tests** (formulas from spec §11):

```ts
import { authenticityScore, exposureScore, priorityScore } from './scoring';
test('exposure score ranking (spec §11)', () => {
  expect(exposureScore('Public')).toBe(100);
  expect(exposureScore('Internal')).toBeLessThan(exposureScore('Internet-facing'));
});
test('authenticity = 25% regex + 35% rules + 40% lgbm', () => {
  // regex .98, det +24 (normalized to 100), lgbm .96 → ~ 25*.98 + 35*1 + 40*.96 = 97.9 → 98
  expect(authenticityScore(0.98, 24, 0.96)).toBeGreaterThanOrEqual(90);
});
test('higher exposure raises priority', () => {
  const a = priorityScore(90, 'aws-access-key', 'Public', 'High');
  const b = priorityScore(90, 'aws-access-key', 'Internal', 'High');
  expect(a).toBeGreaterThan(b);
});
```

- [ ] **Step 2: Run, verify fail** — Run: `npm test -- scoring`. Expected: FAIL.

- [ ] **Step 3: Implement**:

```ts
import type { Finding, Exposure, AssetCriticality } from '../types';
import { typeSeverity } from './classify';
export const exposureScore = (e: Exposure): number =>
  ({'Public':100,'Internet-facing':90,'Internal':65,'Private dev/test':30,'Docs-only':10} as Record<string,number>)[e] ?? 50;
export const assetCriticalityScore = (a: AssetCriticality): number =>
  ({High:90,Medium:55,Low:25} as Record<string,number>)[a] ?? 25;
// det is a signed delta (~ -44..+24); normalize to 0..1 around 0.5
const normDet = (det: number) => Math.max(0, Math.min(1, 0.5 + det / 100));
export const authenticityScore = (regex: number, det: number, lgbm: number): number =>
  Math.round(100 * (0.25 * regex + 0.35 * normDet(det) + 0.40 * lgbm));
export const priorityScore = (auth: number, detectedType: string, e: Exposure, a: AssetCriticality): number =>
  Math.round(0.45 * auth + 0.25 * typeSeverity(detectedType) + 0.20 * exposureScore(e) + 0.10 * assetCriticalityScore(a));
export function buildBreakdown(f: Finding) {
  const s = f.scores;
  return [
    { label:'Regex confidence', value:s.regexConfidence.toFixed(2), width:Math.round(s.regexConfidence*100)+'%', color:'var(--uw-blue-03)' },
    { label:'Deterministic rules', value:(s.deterministicRules>=0?'+':'')+s.deterministicRules, width:Math.min(100,Math.abs(s.deterministicRules)*2.2)+'%', color:s.deterministicRules<0?'var(--severity-safe)':'var(--severity-high)' },
    { label:'LightGBM probability', value:s.lgbmProbability.toFixed(2), width:Math.round(s.lgbmProbability*100)+'%', color:'var(--uw-royal-purple-02)' },
    { label:'Authenticity score', value:String(s.authenticityScore), width:s.authenticityScore+'%', color:'var(--text-primary)' },
    { label:'Priority score', value:String(s.priorityScore), width:s.priorityScore+'%', color:'var(--text-primary)' },
  ];
}
```

- [ ] **Step 4: Run, verify pass** — Run: `npm test -- scoring`. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: lib/scoring authenticity + priority formulas"`

---

## Task 8: lib/query (filter, search, sort)

**Files:**
- Create: `src/lib/query.ts`, `src/lib/query.test.ts`

**Interfaces:**
- Consumes: `Finding`, `Sensitivity`; `effPriority`, `priorityRank` from `lib/priority`.
- Produces: `type Filter = {key:string; val:string; label:string}`, `rankFilter(f: Finding, filters: Filter[], search: string, sensitivity: Sensitivity): boolean`, `sortRows(rows: Finding[], key: string, dir: 'asc'|'desc', sensitivity: Sensitivity): Finding[]`.

- [ ] **Step 1: Write failing tests**:

```ts
import { rankFilter, sortRows } from './query';
import { FINDINGS } from '../data/findings';
test('search matches file/path/type/owner', () => {
  const hits = FINDINGS.filter(f => rankFilter(f, [], 'stripe', 'balanced'));
  expect(hits.some(f => f.detectedType.includes('stripe'))).toBe(true);
});
test('priority filter honors sensitivity', () => {
  const filters = [{key:'priority',val:'critical',label:''}];
  const hits = FINDINGS.filter(f => rankFilter(f, filters, '', 'balanced'));
  expect(hits.every(f => f.basePriority === 'critical')).toBe(true);
});
test('sort by risk desc puts highest first', () => {
  const sorted = sortRows(FINDINGS, 'risk', 'desc', 'balanced');
  expect(sorted[0].risk).toBe(96);
});
```

- [ ] **Step 2: Run, verify fail** — Run: `npm test -- query`. Expected: FAIL.

- [ ] **Step 3: Implement** — port the design `rankFilter` + `sortRows` (keys: `risk`, `priority` via `priorityRank(effPriority)`, `created`→id, `line`, `off`), matching on `priority`/`env`/`cloud`/`validation`/`exposure` filter keys and the lowercase substring search over `type+cls+file+path+asset+owner+cloud`.

- [ ] **Step 4: Run, verify pass** — Run: `npm test -- query`. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: lib/query filter + search + sort"`

---

## Task 9: lib/validation (mock validation outcomes)

**Files:**
- Create: `src/lib/validation.ts`, `src/lib/validation.test.ts`

**Interfaces:**
- Produces: `mockValidate(detectedType: string): ValidationStatus`, `VALIDATION_DELAY_MS = 1500`.

- [ ] **Step 1: Write failing tests**:

```ts
import { mockValidate } from './validation';
test('aws/stripe/github validate active; slack inactive', () => {
  expect(mockValidate('aws-access-key')).toBe('validated-active');
  expect(mockValidate('slack-token')).toBe('validated-inactive');
});
```

- [ ] **Step 2: Run, verify fail** — Run: `npm test -- validation`. Expected: FAIL.

- [ ] **Step 3: Implement** — port design `valResult` to kebab `ValidationStatus`; export `VALIDATION_DELAY_MS = 1500`:

```ts
import type { ValidationStatus } from '../types';
export const VALIDATION_DELAY_MS = 1500;
export const mockValidate = (t: string): ValidationStatus =>
  (({'aws-access-key':'validated-active','aws-secret-key':'validated-active','stripe-secret-key':'validated-active',
     'github-token':'validated-active','slack-token':'validated-inactive','database-password':'validated-active'}
    as Record<string,ValidationStatus>)[t]) ?? 'validated-inactive';
```

- [ ] **Step 4: Run, verify pass** — Run: `npm test -- validation`. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: lib/validation mock outcomes"`

---

## Task 10: lib/explain (explanation + action helpers)

**Files:**
- Create: `src/lib/explain.ts`, `src/lib/explain.test.ts`

**Interfaces:**
- Consumes: `Finding`, `Priority`.
- Produces: `explanationTitle(f: Finding, p: Priority): string`, `recommendedActions(f: Finding, p: Priority): string[]`.

- [ ] **Step 1: Write failing tests**:

```ts
import { explanationTitle, recommendedActions } from './explain';
import type { Finding } from '../types';
test('FP titled likely false positive; real secret gets rotate action', () => {
  expect(explanationTitle({isFalsePositive:true} as Finding,'low')).toBe('Likely false positive');
  expect(explanationTitle({} as Finding,'critical')).toBe('Critical finding');
  expect(recommendedActions({} as Finding,'critical')[0]).toMatch(/Rotate/);
  expect(recommendedActions({isFalsePositive:true} as Finding,'suppressed')[0]).toMatch(/false positive/i);
});
```

- [ ] **Step 2: Run, verify fail** — Run: `npm test -- explain`. Expected: FAIL.

- [ ] **Step 3: Implement** — port the drawer's title/action logic from the design (`isFp` action set vs real-secret action set; title from priority).

- [ ] **Step 4: Run, verify pass** — Run: `npm test -- explain`. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: lib/explain titles + recommended actions"`

---

## Task 11: state store (useReducer)

**Files:**
- Create: `src/state/store.ts`, `src/state/actions.ts`, `src/state/store.test.ts`

**Interfaces:**
- Produces: `initialState`, `reducer(state, action)`, `type AppState`, `type Action`. State fields mirror the design: `tab`, `sensitivity`, `search`, `filters`, `rpp`, `sortKey`, `sortDir`, `cols` (id/label/vis array), `selectedId`, `riskId`, `valModalId`, `validatingId`, `validations: Record<number,ValidationStatus>`, `feedback: Record<number,'up'|'down'>`, `fbId`, `toast`, `mapKey`, `classId`, `classSearch`, `menu`, `classEnabled`.

- [ ] **Step 1: Write failing tests**:

```ts
import { reducer, initialState } from './store';
test('setTab clears menu + mapKey', () => {
  const s = reducer({...initialState, menu:'sort', mapKey:'x'}, {type:'SET_TAB', tab:'map'});
  expect(s.tab).toBe('map'); expect(s.menu).toBeNull(); expect(s.mapKey).toBeNull();
});
test('toggleCol flips visibility', () => {
  const i = initialState.cols.findIndex(c=>c.id==='line');
  const s = reducer(initialState, {type:'TOGGLE_COL', index:i});
  expect(s.cols[i].vis).toBe(!initialState.cols[i].vis);
});
test('addFilter replaces same-key filter', () => {
  let s = reducer(initialState, {type:'ADD_FILTER', filter:{key:'cloud',val:'AWS',label:'Cloud is AWS'}});
  s = reducer(s, {type:'ADD_FILTER', filter:{key:'cloud',val:'GCP',label:'Cloud is GCP'}});
  expect(s.filters.filter(f=>f.key==='cloud')).toHaveLength(1);
});
```

- [ ] **Step 2: Run, verify fail** — Run: `npm test -- store`. Expected: FAIL.

- [ ] **Step 3: Implement** — `actions.ts` (discriminated union covering: SET_TAB, SET_SENSITIVITY, SET_SEARCH, ADD_FILTER, REMOVE_FILTER, CLEAR_FILTERS, SET_SORT, TOGGLE_COL, MOVE_COL, RESET_COLS, SET_RPP, OPEN_DETAIL, CLOSE_DETAIL, OPEN_RISK, CLOSE_RISK, OPEN_VAL_MODAL, CLOSE_VAL_MODAL, START_VALIDATION, FINISH_VALIDATION, SET_FEEDBACK, OPEN_FB, CLOSE_FB, SHOW_TOAST, HIDE_TOAST, OPEN_MAP_ASSET, CLOSE_MAP_ASSET, OPEN_CLASS, CLOSE_CLASS, SET_CLASS_SEARCH, TOGGLE_MENU, CLOSE_MENU, TOGGLE_CLASS_ENABLED); `store.ts` with `initialState` (port `cols` default array verbatim, `sensitivity:'balanced'`, `rpp:15`, `sortKey:'risk'`, `sortDir:'desc'`) and a pure `reducer`.

- [ ] **Step 4: Run, verify pass** — Run: `npm test -- store`. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: app reducer store + actions"`

---

## Task 12: common components

**Files:**
- Create: `src/components/common/{Icon,Toast,Popover,Avatar,SeverityBadge}.tsx`

**Interfaces:**
- Produces: `<Icon name=… size=… stroke=…/>` (inline stroke SVGs ported from the design, keyed by name: search, chevron-down, plus, x, eye, more, file, key, leaf, check, etc.), `<Toast message/>`, `<Popover open anchor onClose>{children}</Popover>` (absolute-positioned, click-outside closes), `<Avatar name/>` (initials + hashed bg color — port `initials`/`avBg`), `<SeverityBadge priority label/>`.

- [ ] **Step 1: Implement Icon + Avatar + SeverityBadge + Toast + Popover** — port inline SVG paths from the design verbatim into `Icon`; port `initials()`/`avBg()` into `Avatar`; `SeverityBadge` uses `priStyle`/`priLabel`. `Toast` = fixed bottom-right card with `uwslide` animation. `Popover` = absolutely-positioned wrapper with an outside-click handler.

- [ ] **Step 2: Smoke test** — `src/components/common/common.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';
test('avatar shows initials', () => {
  render(<Avatar name="Maya Rosen" />);
  expect(screen.getByText('MR')).toBeInTheDocument();
});
```
Run: `npm test -- common`. Expected: PASS.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: common UI components"`

---

## Task 13: shell + App wiring

**Files:**
- Create: `src/components/shell/{TopBar,PageHeader,Tabs}.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: store via `useReducer`; `Tabs` reads `state.tab`, dispatches `SET_TAB`.
- Produces: App renders TopBar + PageHeader + Tabs + the active view; `data-testid="findings-view"|"classifications-view"|"map-view"` on each view container.

- [ ] **Step 1: Implement shell** — `TopBar` (SignalLens logo gradient tile + wordmark — **"SignalLens"**, scope selector, search box, org switcher "Acme Cloud", avatar "E"); `PageHeader` (h1 "Exposed Sensitive Data" + description from the design); `Tabs` (three buttons, active style ported).

- [ ] **Step 2: Wire App** — `App.tsx` creates the store, renders shell, and switches view by `state.tab` (placeholder view divs for now with the testids).

- [ ] **Step 3: Smoke test** — `src/__tests__/smoke.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
test('renders SignalLens brand and switches tabs', () => {
  render(<App />);
  expect(screen.getByText('SignalLens')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Exposure map'));
  expect(screen.getByTestId('map-view')).toBeInTheDocument();
});
```
Run: `npm test -- smoke`. Expected: PASS.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: app shell (top bar, header, tabs) + routing"`

---

## Task 14: SummaryCards

**Files:**
- Create: `src/components/findings/SummaryCards.tsx`

**Interfaces:**
- Consumes: `FINDINGS`, `effPriority`, `state.sensitivity`.
- Produces: 4 metric cards (Total exposed findings `7,575`; Critical findings = count of `effPriority==='critical'`; Validated active `27`; Publicly exposed findings `184`) with label/value/trend/helper per the design.

- [ ] **Step 1: Implement** — port the `cards` array from the design; Critical value computed live from findings + sensitivity.

- [ ] **Step 2: Smoke test** — render within a sensitivity context; assert "Critical findings" card shows the live count. Run: `npm test -- SummaryCards`. Expected: PASS.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: findings summary cards"`

---

## Task 15: FilterToolbar + SensitivityControl

> ⚠️ **Updated by Product Feedback PF-5.** The **sensitivity control moves to the Settings screen (Task 24)** — this toolbar keeps only search + filter chips + Clear/Save view. `SensitivityControl` is built/owned by Task 24. Also rename the findings table "Priority" column to **"Remediation priority"** (PF-2).

**Files:**
- Create: `src/components/findings/FilterToolbar.tsx`, `src/components/findings/SensitivityControl.tsx`

**Interfaces:**
- Consumes: `state` (search, filters, menu, sensitivity) + dispatch.
- Produces: search input (→SET_SEARCH), removable filter chips (→REMOVE_FILTER), Add-filter menu (the 6 design options →ADD_FILTER), Clear/Save view, and `SensitivityControl` segmented Strict/Balanced/Flexible (→SET_SENSITIVITY) with tooltip text from the design.

- [ ] **Step 1: Implement** — port toolbar markup + the `filterOptions` list; `SensitivityControl` uses the ported `segStyle`.

- [ ] **Step 2: Smoke test** — clicking a sensitivity segment dispatches SET_SENSITIVITY (assert via a controlled wrapper). Run: `npm test -- FilterToolbar`. Expected: PASS.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: filter toolbar + sensitivity control"`

---

## Task 16: FindingsTable + cells + TableToolbar + Pagination

**Files:**
- Create: `src/components/findings/FindingsTable.tsx`, `src/components/findings/TableToolbar.tsx`, `src/components/findings/Pagination.tsx`, `src/components/findings/cells/*.tsx`
- Modify: `src/components/findings/FindingsView.tsx` (compose summary + toolbar + table)

**Interfaces:**
- Consumes: `rankFilter`/`sortRows` (lib/query), `state.cols` (visible+order), `effPriority`, `band`, cell style helpers.
- Produces: a table whose header = visible cols (sortable: priority/risk/createdAt), body = filtered+sorted+paged rows; row click → OPEN_DETAIL; each cell type rendered by a `cells/` component. `TableToolbar` = result count + Sort/Columns/Export menus. `Pagination` = rows-per-page menu.

- [ ] **Step 1: Implement cells** — one component per cell kind (port the design's `<sc-if cell.isX>` branches): Priority badge, SecretType (icon+mono), Classification chip, Risk (value+band+"why?" info →OPEN_RISK), Validation (chip + Validate button →OPEN_VAL_MODAL when `canValidate`), File (name+mono path), Env chip, Owner (Avatar+name), Feedback (👍→SET_FEEDBACK up + toast / 👎→OPEN_FB), Actions (eye→OPEN_DETAIL, more→toast), Text.

- [ ] **Step 2: Implement table + toolbar + pagination + view** — derive `filtered`/`sorted`/`page` via lib/query + `state.rpp`; header sort arrows from `state.sortKey/Dir`; Columns menu toggles/reorders (TOGGLE_COL/MOVE_COL/RESET_COLS); Export menu → toast; empty state when 0 rows.

- [ ] **Step 3: Smoke test** — render `FindingsView` in App; assert top row shows "AWS Access Key" and clicking it opens the detail drawer container (testid). Run: `npm test -- FindingsTable`. Expected: PASS.

- [ ] **Step 4: Verify dev** — `npm run dev`; compare Findings tab to `uploads/Screenshot…` references; fix spacing/colors via tokens only.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: findings table, cells, toolbar, pagination"`

---

## Task 17: DetailDrawer

**Files:**
- Create: `src/components/findings/DetailDrawer.tsx`

**Interfaces:**
- Consumes: selected `Finding` (by `state.selectedId`), `effPriority`, `valStyle`, `buildBreakdown` (lib/scoring), `explanationTitle`/`recommendedActions` (lib/explain), `curValidation` (state.validations override).
- Produces: right-side drawer (uwslide) with masked value, priority+validation chips, explanation block (FP vs critical styling), facts grid, score-breakdown bars, risk-up/down reason lists, regex/det/lgbm rules, numbered recommended actions, Validate/Mark-FP/Suppress buttons; close on backdrop/×.

- [ ] **Step 1: Implement** — port the design's drawer markup + the `d={…}` view-model derivation (use `buildBreakdown`, `recommendedActions`, `explanationTitle`).

- [ ] **Step 2: Smoke test** — open finding 1; assert drawer shows masked value + "Validated active" + a "Rotate this secret" action. Run: `npm test -- DetailDrawer`. Expected: PASS.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: finding detail drawer"`

---

## Task 18: RiskPopover

**Files:**
- Create: `src/components/findings/RiskPopover.tsx`

**Interfaces:**
- Consumes: `state.riskId`, the finding's `scores`, `band`, `priStyle`.
- Produces: "why this score?" popover with the 6-bar breakdown (regex, det, lgbm, exposure, asset criticality, priority) + explanation; close →CLOSE_RISK.

- [ ] **Step 1: Implement** — port the `rp={…}` breakdown (reuse `buildBreakdown` extended with exposure/asset-criticality bars from `lib/scoring`).
- [ ] **Step 2: Smoke test** — clicking a risk cell's info opens the popover with "Priority score". Run: `npm test -- RiskPopover`. Expected: PASS.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: risk score popover"`

---

## Task 19: ValidationModal

**Files:**
- Create: `src/components/findings/ValidationModal.tsx`

**Interfaces:**
- Consumes: `state.valModalId`; dispatches START_VALIDATION then (after `VALIDATION_DELAY_MS`) FINISH_VALIDATION with `mockValidate(type)`; shows toast.
- Produces: warning modal (external-validation caution per spec §13) with Cancel / Run validation.

- [ ] **Step 1: Implement** — on Run: dispatch START_VALIDATION; `setTimeout(VALIDATION_DELAY_MS)` → FINISH_VALIDATION (store writes `validations[id]`) + SHOW_TOAST. Validation cell/drawer read the override via `state.validations[id] ?? finding.validation`.

- [ ] **Step 2: Smoke test** — use fake timers; Run → advance 1500ms → finding's validation becomes `validated-active`. Run: `npm test -- ValidationModal`. Expected: PASS.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: mock validation modal + async flow"`

---

## Task 20: Finding lifecycle / triage (replaces FeedbackModal)

> ⚠️ **Updated by Product Feedback PF-4.** This becomes **finding lifecycle management** (`FindingStatus`: open / in-review / snoozed / accepted-risk / resolved / false-positive) with a **Snooze dialog** (`SnoozeInfo`: until / reason / applyToSimilar). Keep the ML 👍/👎 model-feedback as a *separate* control — lifecycle is triage, not model signal.

**Files:**
- Create: `src/components/findings/FeedbackModal.tsx`

**Interfaces:**
- Consumes: `state.fbId`.
- Produces: modal with "Incorrect classification" / "Suppress this exact finding" / "Suppress similar findings" → SET_FEEDBACK('down') / toast(s); close →CLOSE_FB. (Stores only feedback flags — no secret persisted, per spec §19.)

- [ ] **Step 1: Implement** — port the design's feedback handlers + toasts.
- [ ] **Step 2: Smoke test** — choosing "Suppress similar" closes modal + shows toast. Run: `npm test -- FeedbackModal`. Expected: PASS.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: feedback modal"`

---

## Task 21: Classifications view

**Files:**
- Create: `src/components/classifications/{ClassificationsView,ClassTable,ClassDrawer}.tsx`

**Interfaces:**
- Consumes: `CLASSIFICATIONS`, `classificationDetail`, `state.classSearch`, `state.classId`, `state.classEnabled`.
- Produces: filter row + table (name, category, patterns, rule packs, findings, critical, FP-reduction bar, created by, status) → row click OPEN_CLASS; `ClassDrawer` (description, pattern, up/down reasons, guardrail, enable/disable toggle →TOGGLE_CLASS_ENABLED).

- [ ] **Step 1: Implement** — port the classifications table + drawer markup; search filters by name/category.
- [ ] **Step 2: Smoke test** — Classifications tab lists "Placeholder API Key"; opening it shows "98%" FP reduction context. Run: `npm test -- classifications`. Expected: PASS.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: classifications view + drawer"`

---

## Task 22: Map view

> ⚠️ **Updated by Product Feedback PF-1.** Extend the map to **three exposure-location categories**: static (asset nodes — today's model), dynamic (`MapFlowEdge` between assets), and external-AI (`ExternalAiNode` for OpenAI/Anthropic/etc.). Add `ExposureLocationType` + the new map types, a legend/filter dimension for static/dynamic/external-AI, and 1–2 placeholder flow edges + 1 external-AI node in the (isolated, replaceable) demo data.

**Files:**
- Create: `src/components/map/{MapView,ExposureMap,AssetPanel}.tsx`

**Interfaces:**
- Consumes: `MAP_ASSETS`, `TOPOLOGY_EDGES`, `state.mapKey`, `priStyle`.
- Produces: filter bar + `ExposureMap` (SVG connection lines, highlighted edges for selected asset, provider group boxes, asset nodes colored by `highestSeverity`, validated-active check, legend) → node click OPEN_MAP_ASSET; `AssetPanel` (asset facts + findings list + View findings→switch to Findings filtered / Validate all / Export / Suppress → toasts).

- [ ] **Step 1: Implement** — port the SVG topology (`EDGES`/group boxes/positions), node placement from `MAP_ASSETS.position`, highlight logic (`hlEdges`, opacity dimming), and the asset panel from `mapData()`.
- [ ] **Step 2: Smoke test** — Map tab; selecting `customer-prod-bucket` opens the panel listing its findings. Run: `npm test -- map`. Expected: PASS.
- [ ] **Step 3: Verify dev** — `npm run dev`; compare map to reference screenshot.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: exposure map view + asset panel"`

---

## Task 23: Fidelity pass, smoke suite, masking audit

**Files:**
- Modify: any component needing visual fixes; add `src/__tests__/demo-flow.test.tsx`

**Interfaces:**
- Produces: a passing RTL demo-flow test + a masking audit + visual parity with the design screenshots.

- [ ] **Step 1: Demo-flow test** — one RTL test that walks §9: open AWS Access Key drawer (Critical, Validated active), toggle Flexible (a low finding becomes suppressed/dimmed), switch to Map, select an asset. Run: `npm test`. Expected: all PASS.

- [ ] **Step 2: Masking audit** — add a test asserting no rendered text matches raw secret patterns (`/AKIA[A-Z0-9]{16}/`, `/sk_live_[a-z0-9]{20,}/`, `/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*\n[A-Za-z0-9+/=]{40,}/`) across all findings/drawers. Run: `npm test -- masking`. Expected: PASS.

- [ ] **Step 3: Fidelity pass** — `npm run dev`, compare all three tabs + overlays to `uploads/Screenshot 2026-06-22 at 17.*.png`; adjust only via tokens. Confirm dark theme, fonts, spacing, severity colors.

- [ ] **Step 4: Full build + test gate** — Run: `npm run build && npm test`. Expected: build clean, all tests green.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "test: demo-flow + masking audit; fidelity pass"`

---

## Task 24: Settings screen (Product Feedback PF-5)

**Files:**
- Create: `src/components/settings/{SettingsModal,SensitivityControl}.tsx` (move `SensitivityControl` here from Task 15)
- Modify: `src/components/shell/TopBar.tsx` (gear icon → open settings), `src/state/store.ts` (settings state)

**Interfaces:**
- Consumes/produces settings state: `sensitivity` (Strict/Balanced/Flexible), `customerVertical` (SaaS/Fintech/Retail/Healthcare/General), `rulePacks` (default / vertical-specific / customer-specific toggles), `validation` (mocked; enabled/disabled placeholder). Sensitivity + vertical still feed the mocked pipeline.

- [ ] **Step 1:** Add a gear icon to `TopBar` that opens a `SettingsModal` (or slide-over). Move the segmented `SensitivityControl` out of the findings toolbar into Settings.
- [ ] **Step 2:** Add settings reducer state + actions (SET_SENSITIVITY already exists; add SET_VERTICAL, TOGGLE_RULE_PACK, SET_VALIDATION_MODE). Keep the dashboard free of config controls.
- [ ] **Step 3: Smoke test** — opening Settings shows the three sensitivity options + vertical selector; changing sensitivity still re-ranks findings (effPriority). Run: `npm test -- settings`.
- [ ] **Step 4: Commit** (suggested message): `feat: add settings screen (sensitivity, vertical, rule packs, validation)`

---

## Task 25: Suggested rules — mocked (Product Feedback PF-3)

**Files:**
- Create: `src/components/rules/SuggestedRulesPanel.tsx`; mocked data in an isolated, clearly-labeled placeholder module (e.g. `src/data/suggestedRules.placeholder.ts` — replaceable; not final mock data)
- Modify: `src/state/store.ts` (suggested-rule status: approve/dismiss)

**Interfaces:**
- Consumes a `SuggestedRule[]` (mocked); renders title/description/reason/scope/affected-count/ruleType, with Approve / Dismiss (state-only + toast). **No rule-authoring engine.**

- [ ] **Step 1:** Render the mocked `SuggestedRule[]` in a panel (in Settings or near Classifications). Approve/Dismiss update `status` in state and toast.
- [ ] **Step 2: Smoke test** — panel lists a mocked suggestion; Dismiss flips its status. Run: `npm test -- suggested`.
- [ ] **Step 3: Commit** (suggested message): `feat: add mocked suggested-rules panel`

> Lower priority — build after the core findings + map demo is stable. Keep the mocked rules isolated and replaceable (teammate owns final data).

---

## Verification (end-to-end)

- `npm run dev` → boots dark, Findings tab matches the design; tabs/drawer/popover/modals/map all interactive.
- `npm test` → all `lib/` unit tests + RTL smoke + demo-flow + masking audit pass.
- Manual demo (§9 of design plan): first view → FP reduction (README/test-card/dummy) → sensitivity toggle re-ranks → critical AWS key drawer with score breakdown → mock validation flips status → map asset panel.
- Masking invariant: no unmasked secret anywhere in DOM/data/logs.

## Self-review notes

- **Spec coverage:** Regex candidates (mock data), context object/features (types + hero findings), deterministic rules (lib/scoring `det` + guardrail floor field), LightGBM (lib + scores), authenticity+priority formulas (lib/scoring, spec §11), validation 6 statuses (lib/validation + classify), sensitivity modes (lib/priority), masked UI + explanation (drawer + lib/explain), summary cards/table/detail/map/filters/tabs (Tasks 14–22), feedback (Task 20). All mapped.
- **Open conflicts (resolved):** name→SignalLens (Global Constraints); 4 cards kept (Task 14).
- **Type consistency:** `validation` is kebab `ValidationStatus` end-to-end; `scores: RiskScoreBreakdown` consumed by `buildBreakdown`/drawer/popover; `effPriority(finding, sensitivity)` signature identical in priority/query/cards/drawer.

> On approval this plan is copied to `docs/superpowers/plans/2026-06-22-signallens-mvp.md` and committed.
