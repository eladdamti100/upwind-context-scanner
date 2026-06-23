# שקופית: ה‑Mock Data — "Even" כלקוח Upwind

> שקופית אחת. מבוססת על נתונים אמיתיים מ‑`src/data/evenup/findings.json` (345 ממצאים מתויגים). הסעיפים מסומנים לפי מה שמופיע על השקף עצמו מול מה שאומרים בעל פה (Speaker notes).

---

## כותרת השקופית
**בנינו לקוח אמיתי, לא דאטה סינתטית — "Even"**
*ארגון רב‑תחומי שמדמה לקוח Upwind טיפוסי: Fintech · Healthcare · Legal · Claims · Payroll*

---

## על השקף (Bullets)

### 1. למה לקוח רב‑תחומי?
ארגון אחד שנוגע בכל סוגי המידע הרגיש שהמוצר אמור לטפל בהם — כדי לבדוק את המערכת על **מגוון אמיתי**, לא על מקרה אחד.

**6 דומיינים עסקיים → 220 קבצים → 345 ממצאים מתויגים:**

| דומיין | מה יש בו | סוג מידע רגיש |
|---|---|---|
| ⚖️ **Legal** | חוזים, הסכמי פשרה שבוצעו (executed settlements) | SSN, IBAN, DocuSign tokens, wire data |
| 🏥 **Medical / Healthcare** | לוגים קליניים, מילוני קודים (ICD10/CPT), patient charts | PHI: MRN, NPI, SSN |
| 💳 **Billing / Fintech** | מודולי חיוב, הרכבת credentials, חשבוניות | AWS keys, Stripe keys, IBAN |
| 📋 **Claims** | מנוע scoring, לוגי production AI | DB connection strings, PHI |
| 👥 **Intake / Payroll** | פורטל React, שירותי C# | PII, emails |
| 📄 **Docs / Backups / Exports** | תיעוד, גיבויים, CSV exports | Credit cards, test values, placeholders |

### 2. בנוי על שימושים אמיתיים של החברה
לא המצאנו ערכים אקראיים — דימינו את הדברים שארגון כזה *באמת* מייצר: חוזים משפטיים, יצוא CSV לא מוצפן של פשרות, לוגים של pods ב‑K8s שדולפים PHI, AWS key מפוצל בין שורות כדי לחמוק מ‑regex.

### 3. כל ממצא מתויג ב‑Ground Truth
כדי שנוכל למדוד דיוק — לכל ממצא יש label אמת:

| Label | כמות | משמעות |
|---|---|---|
| `true_secret` | **191** | סוד אמיתי ומסוכן |
| `false_positive` | **91** | נראה כמו סוד — לא |
| `placeholder` | 26 | ערך תבנית |
| `documentation_example` | 13 | דוגמה מתועדת |
| `test_value` | 12 | credential ידוע לבדיקות |
| `public_non_secret` | 12 | ציבורי מעצם תכנונו |

**סה"כ 345 ממצאים — מתוכם 154 (45%) הם רעש שצריך לסנן.**

---

## הליבה של השקופית: תקפנו את שני המקרים — TP ו‑FP

### ✅ True Positives — סודות אמיתיים שאסור לפספס

| # | סוג | קובץ | למה זה אמיתי ומסוכן |
|---|---|---|---|
| 1 | `cloud_key` (AWS Secret) | `billing/internal/creds/assemble_01.go` | מפתח AWS **מפוצל בין שורות** כדי לחמוק מ‑regex פשוט — validated active |
| 2 | `phi` (MRN) | `srv/production/analytics/claims/case_9901_medical.log` | מספר תיק רפואי בלוג production **חשוף לאינטרנט**, נכס critical |
| 3 | `pii` (SSN) | אותו לוג production | מספר ביטוח לאומי שדלף ללוג של pod |
| 4 | `credit_card` (PAN) | `var/backoffice/exports/finance/q1_settlements_unencrypted.csv` | כרטיס אשראי אמיתי (**Luhn valid**) ב‑CSV **לא מוצפן** ב‑S3 משותף |
| 5 | `database_password` | אותו לוג production | connection string מלא של PostgreSQL, entropy 5.04 |

➡️ **המכנה המשותף:** prod path + נכס חשוף + ערך שעובר אימות מבני → צריכים לעלות ל‑Critical.

### ❌ False Positives — נראים כמו סוד, אבל לא (הרעש שאנחנו מנקים)

| # | סוג שזוהה | קובץ | למה זה FP |
|---|---|---|---|
| 1 | `phi` (ICD10) | `docs/integration/dictionaries/icd10_map.go` | "E11.9" הוא קוד אבחנה **ציבורי** (סוכרת סוג 2), לא סוד |
| 2 | `cloud_key` | `docs/integration/guides/integration_guide_01.md` | `AKIAIOSAMPLE...` — מפתח דוגמה ש‑AWS עצמה מפרסמת בתיעוד |
| 3 | `credit_card` | אותו guide | `4242 4242...` — כרטיס הטסט המפורסם של Stripe (entropy 1.0) |
| 4 | `payment_secret` | `workloads/billing/config/secrets-redacted-01.yaml` | הערך **כבר ממוסך/חתום** (`ENC[...]` / `****`) — אין סוד גלוי |
| 5 | `credit_card` | `workloads/orders/logs/orders-01.log` | `order_id` — מספר מזהה ש**נכשל ב‑Luhn**, לא PAN |
| 6 | `email` | `docs/recruiting/sample_resumes/candidate_placeholder_01.pdf.txt` | `your.email@...` — placeholder בקו"ח לדוגמה |

➡️ **המכנה המשותף:** docs/test path, נכשל באימות מבני, ערך ידוע/placeholder, או כבר ממוסך → צריכים לרדת ל‑Low / Suppressed.

---

## המסר של השקופית (Speaker note / Punchline)

> "בנינו לקוח רב‑תחומי עם **345 ממצאים מתויגים** — 191 סודות אמיתיים ו‑154 מקרי רעש. הקושי הוא שהרעש **נראה בדיוק כמו** הסוד: כרטיס טסט מול כרטיס אמיתי, קוד ICD מול PHI, מפתח דוגמה מול AWS key חי. כל מנוע Regex היה נכשל כאן. ה‑Ground Truth מאפשר לנו להוכיח בדיוק כמה רעש סיננו — בלי לפספס אף סוד אמיתי."

---

### נתוני עזר לשקופית (אם נשאלים)
- **הנכסים הכי מסוכנים:** `evenup-claims-exports` (S3, 179 ממצאים, כרטיסי אשראי לא מוצפנים) · `evenup-claims-ai-prod` (K8s, 99 ממצאים, PHI בלוגים חשופים).
- **פיזור סוגים:** credit_card (87), cloud_key (62), payment_secret (44), phi (43), database_password (38), pii (27), email (27).
- **המחולל:** `cmd/generate/main.go` — מייצר את הקבצים ואת ה‑DB עם התוויות (`go run ./cmd/generate`).
