// unstructured.go holds the five "advanced" data-class factories for the
// omni-corp hybrid-enterprise agent: legal contracts, financial invoices, PHI
// medical records, CV/resume packets, and YAML infra config. Each class ships a
// benign False-Positive target (placeholders / templates / code constants) and
// an exposed True-Positive target (live, unredacted business data).
//
// Unlike the bulk factories in factory.go, these return their line-level
// findings alongside the content so the deployer can emit Finding Context
// Objects whose line_number matches exactly what was written. Raw secret bodies
// are turned into masked findings via fsbuilder.NewFinding and never persisted.
//
// SECURITY NOTE: every identity, account number, key, and diagnosis is
// synthetic (see pkg/secrets). Nothing authenticates against any real service
// and no value identifies any real person.
package content

import (
	"fmt"
	"io"
	"strings"

	"upwind-context-scanner/pkg/fsbuilder"
	"upwind-context-scanner/pkg/secrets"
)

// lineBuf accumulates document lines while tracking 1-based line numbers, so a
// finding can be stamped with the exact line it was written on.
type lineBuf struct {
	lines []string
	finds []fsbuilder.Finding
}

func (b *lineBuf) add(s string) { b.lines = append(b.lines, s) }
func (b *lineBuf) addf(args ...string) {
	for _, s := range args {
		b.lines = append(b.lines, s)
	}
}

// sec appends a line carrying a sensitive value and records its finding at the
// just-written line. raw is masked by NewFinding and discarded.
func (b *lineBuf) sec(text, variable, detectedType, label, classification, validation, raw string) {
	b.lines = append(b.lines, text)
	b.finds = append(b.finds, fsbuilder.NewFinding(len(b.lines), variable, detectedType, label, classification, validation, raw))
}

func (b *lineBuf) done() (string, []fsbuilder.Finding) {
	return strings.Join(b.lines, "\n") + "\n", b.finds
}

// ===========================================================================
// 1. enterprise-contract (Legal)
// ===========================================================================

// NDATemplate is the FP target: a generic NDA full of <PLACEHOLDER> tags. A
// keyword scanner trips on "Confidential"/email shapes, but every value is a
// template placeholder — a documentation_example, not a secret.
func NDATemplate(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.addf(
		"MUTUAL NON-DISCLOSURE AGREEMENT (TEMPLATE)",
		"",
		"This Mutual Non-Disclosure Agreement (this \"Agreement\") is entered into",
		"as of <EFFECTIVE_DATE> by and between <COMPANY_NAME> (\"Disclosing Party\")",
		"and <COUNTERPARTY_NAME> (\"Receiving Party\").",
		"",
		g.Paragraph(3),
		"",
		"1. Definition of Confidential Information. " + g.Clause(),
		"2. Obligations of Receiving Party. " + g.Clause(),
		"3. Term. This Agreement shall remain in effect for <TERM_YEARS> years.",
		"",
		"Notices to the Disclosing Party shall be sent to:",
	)
	b.sec("  Email: legal@<COMPANY_NAME>.example", "notice_email", "email",
		fsbuilder.LabelDocExample, "", fsbuilder.ValUnsupported, "legal@<COMPANY_NAME>.example")
	b.addf(
		"  Address: <COMPANY_ADDRESS>",
		"",
		g.Paragraph(2),
		"",
		"IN WITNESS WHEREOF, the parties have executed this template as of the date",
		"first written above.",
		"",
		"<COMPANY_NAME>                         <COUNTERPARTY_NAME>",
		"By: _______________________           By: _______________________",
	)
	return b.done()
}

// AcquisitionMemo is the TP target: an *executed* acquisition agreement holding
// live corporate identities, wire instructions (IBAN/ABA/account), a signatory
// SSN, and a DocuSign envelope token — all in a public legal backup bucket.
func AcquisitionMemo(g *secrets.Gen) (string, []fsbuilder.Finding) {
	buyer := "Wix.com Ltd."
	target := g.CompanyName()
	date := g.DateISO(2026, 2026)
	cash := g.MoneyUSD(50_000_000, 900_000_000)
	sigName := g.FullName()
	sigSSN := g.RandSSN()
	iban := g.IBAN()
	aba := g.ABARouting()
	acct := g.BankAccount()
	docusign := "ds_live_" + g.Alnum(40)

	b := &lineBuf{}
	b.addf(
		"EXECUTED — ASSET PURCHASE AGREEMENT (STRICTLY CONFIDENTIAL)",
		"",
		fmt.Sprintf("This Asset Purchase Agreement is entered into as of %s by and between", date),
		fmt.Sprintf("%s (\"Buyer\") and %s (\"Seller\").", buyer, target),
		"",
		g.Paragraph(3),
		"",
		fmt.Sprintf("1. Purchase Price. The aggregate consideration shall be %s, payable in", cash),
		"   immediately available funds to the account set forth in Schedule A.",
		"",
		"2. Representations. " + g.Clause(),
		"",
		"SCHEDULE A — WIRE INSTRUCTIONS",
	)
	b.sec(fmt.Sprintf("  Beneficiary IBAN: %s", iban), "beneficiary_iban", "financial",
		fsbuilder.LabelTrueSecret, "iban", fsbuilder.ValNotValidated, iban)
	b.sec(fmt.Sprintf("  ABA Routing: %s   Account No: %s", aba, acct), "aba_routing", "financial",
		fsbuilder.LabelTrueSecret, "aba-routing", fsbuilder.ValNotValidated, aba)
	b.addf("", "SCHEDULE B — AUTHORIZED SIGNATORIES")
	b.sec(fmt.Sprintf("  Authorized Signatory: %s   SSN: %s", sigName, sigSSN), "signatory_ssn", "pii",
		fsbuilder.LabelTrueSecret, "ssn", fsbuilder.ValNotValidated, sigSSN)
	b.addf("", "SCHEDULE C — EXECUTION")
	b.sec(fmt.Sprintf("  DocuSign envelope token: %s", docusign), "docusign_token", "api_key",
		fsbuilder.LabelTrueSecret, "docusign-token", fsbuilder.ValActive, docusign)
	b.addf("", g.Paragraph(4))
	return b.done()
}

// ===========================================================================
// 2. financial-invoice (Finance)
// ===========================================================================

// InvoiceMockModel is the FP target: a static JSON schema/fixture with zeroed
// placeholder fields. Card/IBAN shapes appear but every value is "0000…" — a
// test fixture, not a live record.
func InvoiceMockModel(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.addf(
		"{",
		"  \"$schema\": \"https://omni-corp.example/schemas/invoice.v1.json\",",
		"  \"description\": \"Static fixture used by billing unit tests. No live data.\",",
		"  \"example\": {",
		"    \"invoice_id\": \"INV-0000\",",
		"    \"customer_name\": \"Example Customer\",",
	)
	b.sec("    \"iban\": \"DE00000000000000000000\",", "iban", "financial",
		fsbuilder.LabelPlaceholder, "", fsbuilder.ValUnsupported, "DE00000000000000000000")
	b.sec("    \"card_last4\": \"0000\",", "card_last4", "credit_card",
		fsbuilder.LabelPlaceholder, "", fsbuilder.ValUnsupported, "0000")
	b.addf(
		"    \"amount_usd\": 0,",
		"    \"line_items\": []",
		"  }",
		"}",
	)
	return b.done()
}

// SettlementsCSV is the TP target: a giant, unencrypted B2B settlements export
// mapping real names/emails to IBANs, routing numbers, and card PANs. Streamed
// so it scales to the corpus-size driver. The first rows carry the labeled
// findings; the remaining Scaled(rows) are realistic noise from a forked gen.
func SettlementsCSV(g *secrets.Gen, rows int) (func(io.Writer) error, []fsbuilder.Finding) {
	const header = "settlement_id,customer_name,customer_email,iban,aba_routing,bank_account,card_pan,amount_usd,settled_at"
	var plants []string
	var finds []fsbuilder.Finding
	for i := 0; i < 3; i++ {
		first, last := g.FirstName(), g.LastName()
		email := g.Email(first, last, "omni-corp.example")
		iban := g.IBAN()
		aba := g.ABARouting()
		acct := g.BankAccount()
		pan := g.LuhnCard()
		amt := g.IntRange(1000, 500000)
		plants = append(plants, fmt.Sprintf("STL-%06d,%s %s,%s,%s,%s,%s,%s,%d.00,%s",
			100000+i, first, last, email, iban, aba, acct, pan, amt, g.DateISO(2026, 2026)))
		line := i + 2 // header is line 1; data row i is line i+2
		finds = append(finds,
			fsbuilder.NewFinding(line, "iban", "financial", fsbuilder.LabelTrueSecret, "iban", fsbuilder.ValNotValidated, iban),
			fsbuilder.NewFinding(line, "card_pan", "credit_card", fsbuilder.LabelTrueSecret, "credit-card-pan", fsbuilder.ValNotValidated, pan),
		)
	}
	ng := g.Fork()
	fn := func(w io.Writer) error {
		io.WriteString(w, header+"\n")
		total := Scaled(rows)
		for i := 0; i < total; i++ {
			if i < len(plants) {
				io.WriteString(w, plants[i]+"\n")
				continue
			}
			first, last := ng.FirstName(), ng.LastName()
			fmt.Fprintf(w, "STL-%06d,%s %s,%s,%s,%s,%s,%s,%d.00,%s\n",
				100000+i, first, last, ng.Email(first, last, "omni-corp.example"),
				ng.IBAN(), ng.ABARouting(), ng.BankAccount(), ng.LuhnCard(),
				ng.IntRange(1000, 500000), ng.DateISO(2026, 2026))
		}
		return nil
	}
	return fn, finds
}

// ===========================================================================
// 3. phi-medical-record (HR / Corporate Insurance)
// ===========================================================================

// ICD10Dictionary is the FP target: a pure Go file mapping ICD-10 codes to
// descriptions. A naive PHI/ICD detector lights up on the code shapes, but this
// is benign source code — no patient is attached to any code.
func ICD10Dictionary(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.addf(
		"// Package icd10 is an autogenerated lookup of ICD-10-CM diagnostic codes.",
		"// It contains NO patient data — only the public code-to-description map.",
		"package icd10",
		"",
		"// Diagnoses maps an ICD-10-CM code to its human-readable description.",
		"var Diagnoses = map[string]string{",
	)
	for i, e := range secrets.ICD10Table {
		line := fmt.Sprintf("\t%q: %q,", e.Code, e.Desc)
		if i == 0 {
			// One representative false positive: the code shape trips ICD detectors.
			b.sec(line, "icd10_code", "phi", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, e.Code)
		} else {
			b.add(line)
		}
	}
	b.add("}")
	return b.done()
}

// CrashDump is the TP target: a production worker crash log whose exception
// stack trace dumped a full patient record (name, MRN, SSN, DOB, active ICD-10
// diagnosis) plus the database DSN. Streamed; PHI sits at deterministic lines.
func CrashDump(g *secrets.Gen, lines int) (func(io.Writer) error, []fsbuilder.Finding) {
	name := g.FullName()
	mrn := g.MRN()
	ssn := g.RandSSN()
	dob := g.DateISO(1950, 2005)
	icd := g.ICD10()
	dsn := g.PostgresURL("phi_app", "phi-prod.cluster-czk.us-east-1.rds.amazonaws.com", "patients")

	const preamble = 6
	patientLine := fmt.Sprintf("    record = PatientRecord(name=%q, mrn=%q, ssn=%q, dob=%q, dx=\"ICD-10-CM: %s %s\")",
		name, mrn, ssn, dob, icd.Code, icd.Desc)
	dsnLine := fmt.Sprintf("psycopg2.OperationalError: could not connect to server: connection string %s", dsn)
	block := []string{
		"[2026-06-22T03:14:07Z] ERROR insurance-api.worker Task failed with unhandled exception",
		"Traceback (most recent call last):",
		"  File \"/srv/insurance-api/worker.py\", line 412, in process_claim",
		"    record = load_patient(claim.patient_id)",
		patientLine,
		dsnLine,
	}
	// Line numbers: preamble lines occupy 1..preamble, block starts at preamble+1.
	ssnLineNo := preamble + 5 // block index 4 (patientLine) -> preamble + 4 + 1
	dsnLineNo := preamble + 6 // block index 5 (dsnLine)     -> preamble + 5 + 1
	finds := []fsbuilder.Finding{
		fsbuilder.NewFinding(ssnLineNo, "ssn", "pii", fsbuilder.LabelTrueSecret, "ssn", fsbuilder.ValNotValidated, ssn),
		fsbuilder.NewFinding(ssnLineNo, "mrn", "phi", fsbuilder.LabelTrueSecret, "medical-record-number", fsbuilder.ValNotValidated, mrn),
		fsbuilder.NewFinding(dsnLineNo, "DATABASE_URL", "database_password", fsbuilder.LabelTrueSecret, "db-connection-string", fsbuilder.ValActive, dsn),
	}

	ng := g.Fork()
	fn := func(w io.Writer) error {
		for i := 0; i < preamble; i++ {
			fmt.Fprintf(w, "[2026-06-22T03:14:%02dZ] INFO insurance-api.worker handling claim batch=%d ok\n", i, 1000+i)
		}
		for _, ln := range block {
			io.WriteString(w, ln+"\n")
		}
		total := Scaled(lines)
		for i := 0; i < total; i++ {
			fmt.Fprintf(w, "[2026-06-22T03:15:%02dZ] WARN insurance-api.worker retry claim ref=%s attempt=%d\n",
				i%60, ng.UUID(), (i%5)+1)
		}
		return nil
	}
	return fn, finds
}

// ===========================================================================
// 4. cv-resume-packet (Recruiting)
// ===========================================================================

// ResumePlaceholder is the FP target: a sample resume with obvious placeholder
// contact details (John Doe / example.com / 555). Tempting for PII detectors,
// but every field is a placeholder.
func ResumePlaceholder(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.addf(
		"JOHN DOE",
		"Senior Software Engineer (SAMPLE RESUME — placeholder data only)",
		"",
	)
	b.sec("Email: your.email@example.com  |  Phone: (555) 555-5555", "contact_email", "email",
		fsbuilder.LabelPlaceholder, "", fsbuilder.ValUnsupported, "your.email@example.com")
	b.addf(
		"Address: 123 Main St, Anytown, ST 00000",
		"",
		"SUMMARY",
		"Experienced engineer with a track record of <ACHIEVEMENTS>. " + g.Clause(),
		"",
		"EXPERIENCE",
		"  <COMPANY>, <TITLE> (<START> – <END>)",
		"   - " + g.Clause(),
		"   - " + g.Clause(),
		"",
		"EDUCATION",
		"  <UNIVERSITY>, <DEGREE>, <YEAR>",
		"",
		"EXPECTED BASE SALARY: $<AMOUNT>",
	)
	return b.done()
}

// SalaryIndex is the TP target: an exposed fixed-width payload mapping real
// hired candidates to SSN, DOB, base salary, and direct-deposit bank details.
// Streamed; the first records carry the labeled findings.
func SalaryIndex(g *secrets.Gen, rows int) (func(io.Writer) error, []fsbuilder.Finding) {
	const header = "# hired_candidates_salary_index | name(24) | ssn(11) | dob(10) | base_salary(9) | routing(9) | account(12)"
	var plants []string
	var finds []fsbuilder.Finding
	for i := 0; i < 3; i++ {
		name := g.FullName()
		ssn := g.RandSSN()
		dob := g.DateISO(1975, 2002)
		sal := g.Salary()
		routing := g.ABARouting()
		acct := g.BankAccount()
		plants = append(plants, fmt.Sprintf("%-24s|%s|%s|%9d|%s|%-12s", trunc(name, 24), ssn, dob, sal, routing, acct))
		line := i + 2 // header comment is line 1
		finds = append(finds,
			fsbuilder.NewFinding(line, "ssn", "pii", fsbuilder.LabelTrueSecret, "ssn", fsbuilder.ValNotValidated, ssn),
			fsbuilder.NewFinding(line, "base_salary", "pii", fsbuilder.LabelTrueSecret, "salary", fsbuilder.ValNotValidated, fmt.Sprintf("%d", sal)),
		)
	}
	ng := g.Fork()
	fn := func(w io.Writer) error {
		io.WriteString(w, header+"\n")
		total := Scaled(rows)
		for i := 0; i < total; i++ {
			if i < len(plants) {
				io.WriteString(w, plants[i]+"\n")
				continue
			}
			fmt.Fprintf(w, "%-24s|%s|%s|%9d|%s|%-12s\n",
				trunc(ng.FullName(), 24), ng.RandSSN(), ng.DateISO(1975, 2002),
				ng.Salary(), ng.ABARouting(), ng.BankAccount())
		}
		return nil
	}
	return fn, finds
}

func trunc(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// ===========================================================================
// 5. yaml-infra-config (DevOps)
// ===========================================================================

// TestValuesYAML is the FP target: a Helm test values file full of hardcoded
// developer placeholders (REPLACE_ME_IN_PROD / CHANGEME). Regex fires on the
// "password:" / "token:" keys, but every value is a placeholder.
func TestValuesYAML(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.addf(
		"# Helm test values — local/dev only. Real values are injected in CI.",
		"replicaCount: 1",
		"image:",
		"  repository: registry.omni-corp.example/billing",
		"  tag: test",
		"env:",
		"  LOG_LEVEL: debug",
	)
	b.sec("  DB_PASSWORD: REPLACE_ME_IN_PROD", "DB_PASSWORD", "database_password",
		fsbuilder.LabelPlaceholder, "", fsbuilder.ValUnsupported, "REPLACE_ME_IN_PROD")
	b.sec("  API_KEY: CHANGEME", "API_KEY", "api_key",
		fsbuilder.LabelPlaceholder, "", fsbuilder.ValUnsupported, "CHANGEME")
	b.sec("  JWT_SIGNING_TOKEN: \"<YOUR_TOKEN_HERE>\"", "JWT_SIGNING_TOKEN", "api_key",
		fsbuilder.LabelPlaceholder, "", fsbuilder.ValUnsupported, "<YOUR_TOKEN_HERE>")
	b.addf(
		"resources:",
		"  requests:",
		"    cpu: 100m",
		"    memory: 128Mi",
	)
	return b.done()
}

// ProdDeploymentYAML is the TP target: a production Kubernetes deployment spec
// with high-entropy credentials inlined in the container env — AWS access key +
// secret, a Postgres DSN, and a signing JWT.
func ProdDeploymentYAML(g *secrets.Gen) (string, []fsbuilder.Finding) {
	awsID := g.AWSKeyID()
	awsSecret := g.AWSSecret()
	dbURL := g.PostgresURL("billing_app", "billing-prod.cluster-czk.us-east-1.rds.amazonaws.com", "billing")
	jwt := g.JWT()
	stripe := g.StripeLive()

	b := &lineBuf{}
	b.addf(
		"apiVersion: apps/v1",
		"kind: Deployment",
		"metadata:",
		"  name: billing-service",
		"  namespace: kube-system",
		"spec:",
		"  replicas: 6",
		"  template:",
		"    spec:",
		"      containers:",
		"        - name: billing-service",
		"          image: registry.omni-corp.example/billing:prod",
		"          env:",
		"            - name: DEPLOY_ENV",
		"              value: \"prod\"",
		"            # TEMP(oncall): inlined creds during the SealedSecret outage — revert!",
		"            - name: AWS_ACCESS_KEY_ID",
	)
	b.sec(fmt.Sprintf("              value: %q", awsID), "AWS_ACCESS_KEY_ID", "cloud_key",
		fsbuilder.LabelTrueSecret, "aws-access-key-id", fsbuilder.ValActive, awsID)
	b.add("            - name: AWS_SECRET_ACCESS_KEY")
	b.sec(fmt.Sprintf("              value: %q", awsSecret), "AWS_SECRET_ACCESS_KEY", "cloud_key",
		fsbuilder.LabelTrueSecret, "aws-secret-access-key", fsbuilder.ValActive, awsSecret)
	b.add("            - name: DATABASE_URL")
	b.sec(fmt.Sprintf("              value: %q", dbURL), "DATABASE_URL", "database_password",
		fsbuilder.LabelTrueSecret, "db-connection-string", fsbuilder.ValActive, dbURL)
	b.add("            - name: JWT_SIGNING_TOKEN")
	b.sec(fmt.Sprintf("              value: %q", jwt), "JWT_SIGNING_TOKEN", "api_key",
		fsbuilder.LabelTrueSecret, "jwt", fsbuilder.ValNotValidated, jwt)
	b.add("            - name: STRIPE_SECRET_KEY")
	b.sec(fmt.Sprintf("              value: %q", stripe), "STRIPE_SECRET_KEY", "payment_secret",
		fsbuilder.LabelTrueSecret, "stripe-live-key", fsbuilder.ValActive, stripe)
	b.addf(
		"          resources:",
		"            requests:",
		"              cpu: 500m",
		"              memory: 1Gi",
	)
	return b.done()
}
