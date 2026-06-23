// scripts/export-predictions.ts
// READ-ONLY harness: runs the EXISTING dashboard pipeline (src/data/evenup.ts →
// features + rules + mock-LGBM + scoring) over the corpus and writes its verdicts
// to DB/predictions*.json for scoring against ground truth via cmd/evaluate.
//
// It does NOT modify any backend logic — it only reads the pipeline's output
// scores. The backend's independent "is this a real secret?" verdict is the
// authenticityScore (spec §11); we also export the raw LightGBM probability.
import { writeFileSync, mkdirSync } from 'node:fs';
import { FINDINGS } from '../src/data/evenup';
import rawFindings from '../src/data/evenup/findings.json';

const raw = rawFindings as unknown as { finding_id: string }[];

const authenticity = FINDINGS.map((f, i) => ({
  finding_id: raw[i].finding_id,
  secret_probability: f.scores.authenticityScore / 100, // 0–100 → 0–1
}));

const lgbm = FINDINGS.map((f, i) => ({
  finding_id: raw[i].finding_id,
  secret_probability: f.scores.lgbmProbability, // already 0–1
}));

mkdirSync('DB', { recursive: true });
writeFileSync('DB/predictions.json', JSON.stringify(authenticity, null, 2));
writeFileSync('DB/predictions.lgbm.json', JSON.stringify(lgbm, null, 2));
console.log(
  `wrote ${authenticity.length} predictions → DB/predictions.json (authenticity), DB/predictions.lgbm.json (lgbm)`,
);
