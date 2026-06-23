// scripts/trace-pipeline.ts
// End-to-end visibility: runs the REAL live pipeline (src/data/evenup.ts → FINDINGS)
// and prints every stage for representative findings — Regex → Rules → Forest
// model (+ spatial) → Scoring → Priority — plus an overall confusion matrix at
// the evaluator's threshold (secret_probability >= 0.5 ⇒ authenticityScore >= 50).
import { FINDINGS } from '../src/data/evenup';
import rawFindings from '../src/data/evenup/findings.json';

const RAW = rawFindings as unknown as { finding_id: string; ground_truth: { is_secret: boolean; label: string; reason?: string } }[];
const THRESHOLD = 50; // authenticityScore cutoff (mirrors evaluator's 0.5)

const predicted = (i: number) => FINDINGS[i].scores.authenticityScore >= THRESHOLD;
const spatiallyDowngraded = (i: number) => FINDINGS[i].riskDownReasons.some((r) => r.includes('group-downgraded'));

function trace(i: number, title: string) {
  const f = FINDINGS[i];
  const gt = RAW[i].ground_truth;
  const s = f.scores;
  const pred = predicted(i);
  const correct = pred === gt.is_secret;
  console.log(`\n━━ ${title} ━━  [${RAW[i].finding_id}]  ${f.classification} = ${f.maskedValue}`);
  console.log(`   file: ${f.path}/${f.file}`);
  console.log(`   STAGE 1 · Regex    : confidence ${s.regexConfidence.toFixed(2)}  (candidate flagged)`);
  console.log(
    `   STAGE 2 · Rules    : Δ ${s.deterministicRules >= 0 ? '+' : ''}${s.deterministicRules}` +
      `  guardrail=${f.basePriority === 'critical' || f.basePriority === 'high' ? '(floor active)' : 'none'}` +
      `  suppress=${f.suppressedByAgent ? `YES (${f.suppressReason})` : 'no'}`,
  );
  if (f.riskUpReasons.length) console.log(`             ↑ ${f.riskUpReasons.join(' · ')}`);
  if (f.riskDownReasons.length) console.log(`             ↓ ${f.riskDownReasons.join(' · ')}`);
  console.log(`   STAGE 3 · Forest   : model p=${s.lgbmProbability.toFixed(2)}${spatiallyDowngraded(i) ? '   (spatial group-downgrade applied)' : ''}`);
  console.log(`   STAGE 4 · Scoring  : authenticity ${s.authenticityScore}/100  →  remediation ${s.remediationPriority}  →  priority ${f.basePriority.toUpperCase()}`);
  console.log(`   GROUND TRUTH       : ${gt.is_secret ? 'REAL SECRET' : `benign (${gt.label}${gt.reason ? '/' + gt.reason : ''})`}  →  ${correct ? '✅ correct' : '❌ wrong'}`);
}

// ---- overall confusion matrix (same logic as cmd/evaluate) ----
let tp = 0, fp = 0, fn = 0, tn = 0;
for (let i = 0; i < FINDINGS.length; i++) {
  const a = RAW[i].ground_truth.is_secret;
  const p = predicted(i);
  if (p && a) tp++;
  else if (p && !a) fp++;
  else if (!p && a) fn++;
  else tn++;
}
const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) : '0.0');

console.log('=== SignalLens pipeline trace (live evenup.ts → FINDINGS) ===');
console.log(`findings: ${FINDINGS.length}   |   engine: in-process forest + spatial (synchronous)`);
console.log(`\n--- confusion matrix @ authenticity>=${THRESHOLD} ---`);
console.log(`  TP ${tp}   FN ${fn}   FP ${fp}   TN ${tn}`);
console.log(`  Precision ${pct(tp, tp + fp)}%   Recall ${pct(tp, tp + fn)}%   (FN must be 0)`);

// ---- pick one hero per category to show all stages working ----
const idx = (pred: (i: number) => boolean) => FINDINGS.findIndex((_, i) => pred(i));

const realSecret = FINDINGS
  .map((f, i) => ({ i, a: f.scores.authenticityScore }))
  .filter((x) => RAW[x.i].ground_truth.is_secret)
  .sort((a, b) => b.a - a.a)[0]?.i;

const suppressedFP = idx((i) => !RAW[i].ground_truth.is_secret && FINDINGS[i].suppressedByAgent);
const forestFP = idx((i) => !RAW[i].ground_truth.is_secret && !FINDINGS[i].suppressedByAgent && !predicted(i) && FINDINGS[i].scores.lgbmProbability < 0.4);
const spatialFP = idx((i) => !RAW[i].ground_truth.is_secret && spatiallyDowngraded(i));
const residualFP = idx((i) => !RAW[i].ground_truth.is_secret && predicted(i));
const realSecretMissed = idx((i) => RAW[i].ground_truth.is_secret && !predicted(i));

if (realSecret !== undefined && realSecret >= 0) trace(realSecret, 'REAL SECRET → caught (regex+rules+forest agree)');
if (suppressedFP >= 0) trace(suppressedFP, 'FP cleared by RULES (deterministic hard-suppress)');
if (forestFP >= 0) trace(forestFP, 'FP cleared by the FOREST MODEL (rules did not suppress)');
if (spatialFP >= 0) trace(spatialFP, 'FP cleared by SPATIAL context (whole-file group downgrade)');
if (residualFP >= 0) trace(residualFP, 'RESIDUAL FP still leaking (the 7 the model misses)');
console.log(`\nMISSED real secrets (FN): ${realSecretMissed >= 0 ? RAW[realSecretMissed].finding_id : 'NONE ✅'}`);
