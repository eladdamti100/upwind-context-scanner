# SignalLens — מסמך הכנה להצגה (Demo Prep)

> מסמך אחד שמאגד את כל מה שצריך כדי להציג: מה הבעיה, מי המשתמש, מה המוצר, איך עובד כל שלב בפייפליין (Regex / Rules / SLM), תרשים מעבר בין השכבות, ומה ה‑KPIs המרכזיים.

---

## 1. בקצרה — מה אנחנו מציגים (Elevator Pitch)

הופכים את ה‑Cloud Scanner ממנוע **Regex רועש** למערכת **Context‑Aware** שמבינה את **המשמעות** של כל ממצא.

> ה‑Regex מגלה *מועמדים*. שכבת ההקשר, כללים דטרמיניסטיים ומודל ML מחליטים מה **באמת מסוכן**, מה כנראה **False Positive**, ומה הלקוח צריך **לטפל בו קודם**.

התוצאה: פחות עייפות התראות (alert fatigue), בלי לפספס סודות אמיתיים, עם הסבר שקוף וניתן להגנה לכל החלטה.

---

## 2. הבעיה (The Problem)

סורקי סודות מבוססי Regex היום מזהים ממצאים **רק לפי צורת הטקסט**. מחרוזת שנראית כמו API key / token / כרטיס אשראי / סיסמה / cloud credential מסומנת כחשודה — גם אם היא יושבת בתוך README, קובץ טסט, תיעוד, placeholder או fixture.

ה‑Regex לא יודע לענות על השאלות החשובות:

- האם הממצא בקובץ **production** או בקובץ **טסט**?
- האם הוא בתוך **תיעוד** או בתוך **קונפיג אמיתי**?
- האם הערך נראה כמו **סוד אמיתי** או כמו **placeholder**?
- האם שם המשתנה מעיד שזה סוד אמיתי?
- האם הנכס **חשוף לאינטרנט** או פנימי?
- האם זה סוג credential **מסוכן במיוחד**?
- האם הסוד עדיין **פעיל ותקף**?

זה יוצר שתי בעיות בו‑זמנית:

1. **יותר מדי False Positives** → הלקוח מוצף בהתראות ומתחיל להתעלם מהמערכת.
2. **False Negatives** → בגלל כללים לא מדויקים או over‑filtering, סודות אמיתיים עלולים להתפספס.

---

## 3. מי המשתמש ומה הכאב שלו (User & Pain)

**המשתמש:** איש/אשת **Security / AppSec / Cloud Security** אצל הלקוח — מי שמקבל את ההתראות מה‑Cloud Scanner וצריך להחליט במה לטפל.

**הכאב:**

- מקבל **מאות–אלפי ממצאים** רובם רעש; לא יכול לתעדף ידנית.
- כל False Positive שהוא בודק זה זמן מבוזבז → מאבד אמון במערכת → **מתחיל להתעלם** → ואז מפספס את הסוד האמיתי שמתחבא בערימה.
- כשהוא כן מוצא ממצא, אין לו דרך מהירה להבין **למה** הוא מסוכן, **כמה דחוף**, ו**מה לעשות**.
- צריך לאזן בין "לא לפספס סוד" (recall) לבין "לא להטביע אותי ברעש" (precision).

**מה SignalLens נותן לו:** רשימה ממוינת לפי דחיפות, ציון סיכון מוסבר, סטטוס validation, וערכים ממוסכים — חוויה של מוצר אבטחה אמיתי, לא סקריפט.

---

## 4. מה יש לנו ב‑DB — סוגי מידע רגיש

הנתונים מגיעים כממצאים ממוסכים (`src/data/evenup/findings.json`) ועוברים נרמול ל‑`FindingContextObject`. ה‑validators נמצאים תחת [src/lib/validators/](src/lib/validators/) ומבצעים אימות **מבני** אמיתי (checksum / Luhn / mod‑97 וכו') — לא רק התאמת צורה.

| קטגוריה | סוגים מזוהים | אימות מבני (validator) |
|---|---|---|
| **Secrets / Cloud** | AWS Access/Secret Key, GitHub Token, Slack Token, Google API Key, PEM Private Key, JWT, Generic API Key, DB connection strings | `validateAWSKey`, `validateJWT` ([validators/saas.ts](src/lib/validators/saas.ts)) |
| **Fintech / PCI** | Credit Card / PAN, IBAN, ABA Routing, SWIFT/BIC, CUSIP, BTC/Crypto wallet | Luhn + BIN, ISO 7064 mod‑97, ABA checksum, base58check ([validators/fintech.ts](src/lib/validators/fintech.ts)) |
| **Identity / PII** | SSN, Israeli ID / National ID, EIN/TIN, Passport (MRZ), Email | SSA range, mod‑10, IRS prefix, MRZ check digits ([validators/identity.ts](src/lib/validators/identity.ts)) |
| **Healthcare / PHI** | NPI, ICD‑10, DEA, MBI (Medicare ID), MRN | Luhn‑80840, מבנה ICD, DEA checksum, תבנית MBI ([validators/healthcare.ts](src/lib/validators/healthcare.ts)) |
| **Retail** | GTIN, UPC, EAN, VAT | `validateGTIN`, `validateVAT` ([validators/retail.ts](src/lib/validators/retail.ts)) |

**Ground Truth (תוויות אמת לכל ממצא):** `true_secret`, `false_positive`, `placeholder`, `documentation_example`, `test_value`, `public_non_secret`, `unknown` — אלו משמשים גם לאימון המודל וגם למדידת ה‑KPIs.

> **פרטיות (Invariant):** אף פעם לא שומרים/מתעדים/מעבירים את הסוד המלא. רק **ערכים ממוסכים** + **דגלים מבניים בוליאניים** עוברים בפייפליין. ראו `src/types.ts`.

---

## 5. הארכיטקטורה — איך עובד כל שלב

הפייפליין מודולרי: כל שלב עצמאי וניתן לבדיקה. סדר השלבים:

### שלב 1 — Regex Detection (גילוי מועמדים)
- **מה עושה:** מזהה מועמדים לפי תבניות, entropy ו‑rule packs. **לא מחליט** — רק מייצר מועמדים.
- **קלט → פלט:** JSON גולמי → `FindingContextObject` ממוסך ומנורמל (`buildContext()` ב‑[src/data/evenup.ts](src/data/evenup.ts)).
- **Rule packs:** Base (לכל לקוח) + Vertical (Fintech / SaaS / Healthcare / Retail) + Suppression.
- **למה זה כאן:** שכבת recall גבוהה — מעדיפים לתפוס יותר מדי מאשר לפספס.

### שלב 2 — Context Feature Extraction (הנדסת פיצ'רים ממוסכים)
- **מה עושה:** הופך מידע גולמי ל‑**45 פיצ'רים** מבניים/ממוסכים. **לא מחליט** — רק מכין קלט לכללים ולמודל.
- **קובץ:** `extractFeatures()` + `buildCorpusStats()` ב‑[src/lib/features.ts](src/lib/features.ts).
- **קבוצות פיצ'רים:**
  - **Path:** `isProdPath`, `isTestPath`, `isDocsPath`, `isConfigFile`, `inFixturesDir`, `environmentHint`…
  - **Value:** `entropy`, `entropyLevel`, `hasLivePrefix`, `hasTestPrefix`, `looksLikePlaceholder`, `isKnownTestValue`.
  - **Variable:** `hasSecretVariableName`, `hasPublicVariableName`, `variableIntent`.
  - **Text context:** `hasExampleLanguage`, `hasSecretLanguage`, `hasProductionLanguage`…
  - **Asset / Exposure:** `storageExposure`, `isPubliclyAccessible`, `assetCriticality`, `customerVertical`.
  - **Structural signals (מ‑validators):** `structurallyValid`, `luhnValid`, `formatValidForType`, `isPublicByDesign`, `isHighEntropySha`, `isAlreadyMasked`, `shapeContradictsType`, `isKnownTestVector`.
  - **Corpus‑wide:** `patternFrequency`, `isHighFrequencyPattern` — באיזו תדירות התבנית חוזרת בכל הריפו (תבנית חוזרת = כנראה boilerplate).

### שלב 3 — Deterministic Rules (כללים שקופים)
- **מה עושה:** מחשב **ציון‑delta חתום** (בערך ‑120 עד +70) מסכום משקלי הכללים שנדלקו, ומחזיר רשימת כללים שנדלקו + הסברים.
- **קובץ:** `evaluateRules()` ב‑[src/lib/rules.ts](src/lib/rules.ts) — 22 Base Rules + Vertical Rules + Guardrails.
- **כללים שמעלים סיכון:** `prod-config-secret` (+12), `public-exposure` (+10), `live-prefix-high-entropy` (+8), `secret-language` (+4)…
- **כללים שמורידים סיכון:** `test-known-value` (‑20), `docs-example` (‑18), `placeholder-value` (‑16), `fixture-sample-template-path` (‑16)…
- **"רוצחי" False‑Positive מבניים:** `structural-invalid` (‑40, נכשל ב‑checksum/Luhn), `public-by-design` (‑30, למשל `pk_live_`), `already-masked` (‑30), `commit-sha-not-token` (‑28), `shape-contradicts-type` (‑28).
- **Guardrails (רצפות קשיחות):** Private Key → לעולם לא מתחת ל‑High; Cloud cred ב‑prod config → לא מתחת ל‑High; סוד high‑severity בנכס ציבורי → Critical, **לא ניתן להשתקה אוטומטית**. ה‑guardrail גובר על השתקה.

### שלב 4 — DomainRulesAgent (פילטר מבני/סמנטי קשיח)
- **מה עושה:** מחזיר verdict סמכותי: `suppress` / `keep` / `boost` עם נימוקים. זה מה שמייצר את "Suppressed by DomainRulesAgent" ב‑UI.
- **קובץ:** `runDomainRules()` ב‑[src/lib/domainRules.ts](src/lib/domainRules.ts).
- **Hard‑suppress** ("זה בוודאות לא סוד חי"): נכשל באימות מבני, public‑by‑design, ערך טסט ידוע, ערך ממוסך, git SHA שמתחזה לטוקן, מספר‑ID בצורת PAN.
- **Recall‑guarded:** השתקה רכה **לא** מופעלת על credential high‑severity ב‑prod/public.

### שלב 5 — SLM / Semantic Model (הסתברות ML)
- **מה עושה:** מחזיר `secretProbability ∈ [0,1]` + סיווג (`true_secret` / `placeholder` / `test_value` / `false_positive` / `public_non_secret`) + נימוק.
- **המנוע בפועל:** **Spatial Semantic Engine** — `forestSpatialEngine.classifyCorpus()` ב‑[src/lib/semanticEngine.ts](src/lib/semanticEngine.ts), בשני מעברים:
  1. **Base score:** Random Forest (120 עצי CART) — `evaluateForest()` ב‑[src/lib/forest.ts](src/lib/forest.ts) על וקטור 45 פיצ'רים. המודל מאומן ושמור ב‑[src/lib/semantic-model.json](src/lib/semantic-model.json) (אימון: [scripts/train-semantic.ts](scripts/train-semantic.ts)).
  2. **Spatial adjustment:** מקבץ ממצאים לפי קובץ/תיקייה, מחשב "benign prior", ומכפיל **רק כלפי מטה** (`1 − 0.6·prior`). כלומר ההקשר המרחבי יכול רק **להוריד** הסתברות — לעולם לא ליצור False Negative.
- **למה SLM/forest ולא LLM:** הקלט הוא **פיצ'רים טבלאיים ממוסכים**, לא טקסט חופשי. מודל קל: רץ מקומית אצל הלקוח, inference מהיר, מוסבר, ולא שולח סודות החוצה. (קיים גם mock LightGBM ב‑[src/lib/lgbm.ts](src/lib/lgbm.ts) כ‑fallback.)
- **למה ה‑SLM/Forest מנצח את ה‑Regex:** ה‑Regex רואה מחרוזת בודדת; המודל לומד את **השילוב** בין path, שם משתנה, entropy, שפה סובבת, חשיפה ותדירות — בדיוק ההקשר שה‑Regex עיוור אליו.

### שלב 6 — Risk Scoring & Priority (ציון מורכב ותעדוף)
- **קובץ:** [src/lib/scoring.ts](src/lib/scoring.ts).
- **Authenticity Score** (כמה סביר שזה סוד אמיתי, 0–100):
  `0.25·RegexConfidence + 0.35·DeterministicRules + 0.40·ModelProbability`
- **Remediation Priority** (במה לטפל קודם, 0–100):
  `Authenticity × (0.30·Access + 0.30·Exposure + 0.25·TypeSeverity + 0.15·Activity)`
- **Bands:** Critical ≥90 · High ≥70 · Medium ≥40 · Low ≥20 · Suppressed <20 ([src/lib/priority.ts](src/lib/priority.ts)).
- **Sensitivity Mode** (Strict / Balanced / Flexible): לא משנה את הציון — משנה את **הסף** שמעליו מתריעים.

### שלב 7 — Validation (אופציונלי, mock בדמו)
- בודק אם הסוד **עדיין פעיל** מול השירות. סטטוסים: `not_validated`, `validated_active`, `validated_inactive`, `validation_unsupported`, `validation_failed`.
- `validated_active` מעלה priority משמעותית. הסוד המלא לא נשלח ל‑Upwind ולא נשמר — רק התוצאה.

### שלב 8 — UI
- **SummaryCards** ([SummaryCards.tsx](src/components/findings/SummaryCards.tsx)): ה‑KPIs (ראו סעיף 7).
- **FindingsTable**: רשימה ממוינת לפי priority + פילטרים.
- **DetailDrawer** ([DetailDrawer.tsx](src/components/findings/DetailDrawer.tsx)): כל פרטי הממצא + פירוק ציון + פעולות מומלצות.
- **RiskPopover** ([RiskPopover.tsx](src/components/findings/RiskPopover.tsx)): פירוק 5 הצירים של הציון.
- **DomainRulesBanner** ([DomainRulesBanner.tsx](src/components/findings/DomainRulesBanner.tsx)): סיבת ההשתקה.

---

## 6. תרשים מעבר בין השכבות

```text
                  ┌─────────────────────────────────────────────┐
                  │  Customer Cloud Files (.env, src, IaC, docs) │
                  └───────────────────────┬─────────────────────┘
                                          │
            [1] REGEX LAYER  ── candidate detection (high recall, no decision)
                                          │  → FindingContextObject (masked)
                                          ▼
            [2] FEATURE EXTRACTION  ── 45 masked/structural features + corpus stats
                                          │  → ContextFeatures
                                          ▼
                 ┌────────────────────────┴────────────────────────┐
                 │                                                  │
      [3] DETERMINISTIC RULES                          [4] DomainRulesAgent
      signed score Δ + triggered[]                     suppress / keep / boost
      + Guardrail floors                               (structural/semantic verdict)
                 │                                                  │
                 └────────────────────────┬─────────────────────────┘
                          combine (Guardrail OVERRIDES suppress for genuine creds)
                                          ▼
            [5] SLM / SEMANTIC MODEL  (Random Forest + Spatial downweight)
                                          │  → secretProbability (0..1) + classification
                                          ▼
            [6] RISK SCORING
                Authenticity = 0.25·Regex + 0.35·Rules + 0.40·Model
                Priority     = Authenticity × (Access, Exposure, TypeSeverity, Activity)
                                          │  → band: Critical/High/Medium/Low/Suppressed
                                          ▼
            [7] VALIDATION (optional, mock) ── active / inactive / unsupported
                                          ▼
            [8] UI  ── SummaryCards · FindingsTable · DetailDrawer · RiskPopover
                       (masked values + explanation + recommended action)
```

**שתי תובנות מפתח להצגה:**
1. **Regex רק מציע — ההקשר מחליט.** כל שלב אחרי ה‑Regex או מעלה או מוריד את הביטחון, עם הסבר.
2. **Recall תמיד מוגן.** ההתאמה המרחבית רק מורידה הסתברות, וה‑Guardrails חוסמים השתקה של סודות מסוכנים אמיתיים — כך מורידים רעש בלי לפספס.

---

## 7. KPIs מרכזיים

### א. KPIs שמוצגים על המסך (SummaryCards)
| KPI | משמעות |
|---|---|
| **Findings surfaced** | כמה ממצאים נשארו אחרי סינון ההקשר (total − suppressed) |
| **Noise suppressed** | כמה רעש שכבת ההקשר ניקתה (מספר + % מהסך) — **ה‑KPI המנצח של הדמו** |
| **Critical findings** | ממצאים בעדיפות Critical |
| **Validated active** | סודות שאומתו כפעילים |
| **Publicly exposed** | ממצאים בנכסים חשופים (Public / Internet‑facing) |

### ב. KPIs להצלחת הדמו (מדדי איכות)
| מדד | הגדרה | יעד בדמו |
|---|---|---|
| **False Positive Reduction** | כמה רעש הופחת מול Regex‑only | הפחתה משמעותית וברורה |
| **Recall (True Positive)** | כמה סודות אמיתיים **לא** פספסנו | **0 פספוסים** של true_secret |
| **Precision** | מתוך מה שסומן מסוכן — כמה באמת מסוכן | גבוה |
| **Priority Accuracy** | האם הקריטיים באמת מופיעים ראשונים | הקריטיים בראש הרשימה |
| **Explanation quality** | יש הסבר ברור לכל החלטה | הסבר לכל ממצא |

> **המסר המספרי לדמו:** "Regex‑only ייצר X ממצאים; SignalLens השתיק Y% רעש (FP), בלי לפספס אף סוד אמיתי (Recall 100%), והקפיץ את ה‑Z הקריטיים לראש הרשימה — כל החלטה עם הסבר."

---

## 8. סיפור הדמו ב‑3 דקות (Talk Track)

1. **הבעיה:** "Regex מסמן כל מה שנראה כמו סוד — מאות התראות, רובן רעש. צוות האבטחה מתעייף ומפספס את האחת שחשובה."
2. **השכבה החכמה:** "אנחנו לא מחליפים את ה‑Regex — מוסיפים מעליו הקשר: איפה הקובץ, מה שם המשתנה, entropy, האם הערך עובר אימות מבני, האם הנכס חשוף."
3. **הדגמה — מורידים רעש:** ממצא שנראה כמו API key בתוך README / placeholder / test fixture → המערכת מורידה ל‑Low / Suppressed ומראה **למה** (DomainRulesBanner).
4. **הדגמה — תופסים סוד אמיתי:** AWS key / Stripe live key בתוך `.env` production בנכס חשוף → Critical, עם פירוק ציון ו‑validation.
5. **הסיכום (KPIs):** מצביעים על SummaryCards — "Y% רעש הושתק, 0 סודות פוספסו, הקריטיים בראש."

---

### קישורים מהירים
- מפרט מלא: [docs/product-spec.md](docs/product-spec.md)
- יעדי דמו: [docs/demo-goals.md](docs/demo-goals.md)
- פייפליין מרכזי: [src/data/evenup.ts](src/data/evenup.ts) · [src/lib/features.ts](src/lib/features.ts) · [src/lib/rules.ts](src/lib/rules.ts) · [src/lib/domainRules.ts](src/lib/domainRules.ts) · [src/lib/semanticEngine.ts](src/lib/semanticEngine.ts) · [src/lib/scoring.ts](src/lib/scoring.ts)
