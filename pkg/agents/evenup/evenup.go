// Package evenup builds the flagship demo organization: EvenUp, an AI personal-
// injury claims platform (industry fintech-legal-hybrid). It is the single
// hyper-dense customer for the context engine — one company whose cloud holds the
// full intersection of sensitive data: legal settlement agreements, medical
// records (PHI), provider invoices, payroll proof-of-earnings, government IDs,
// and claimant payment cards.
//
// The tree is split into two extreme spaces:
//   - Exposed-hazard (True Positives): srv/production/, var/backoffice/exports/,
//     sys/backups/legal/ — live, unredacted claimant data.
//   - Benign-noise (False Positives): src/.../test/, docs/, samples/ — templates,
//     fixtures, code constants, and placeholders that a regex-only scanner floods.
//
// SECURITY NOTE: nothing here is a real credential or a real person — see
// pkg/secrets. The corpus exists solely to exercise Upwind's Cloud Scanner.
package evenup

import (
	"fmt"
	"io"

	"upwind-context-scanner/pkg/content"
	"upwind-context-scanner/pkg/fsbuilder"
	"upwind-context-scanner/pkg/secrets"
)

// Build assembles the complete EvenUp workspace and returns it.
func Build(g *secrets.Gen) *fsbuilder.Workspace {
	ws := fsbuilder.NewWorkspace("evenup", "fintech-legal-hybrid")

	declareAssets(ws)
	buildLegalLeaks(ws, g)       // executed settlements (TP) in public legal backups
	buildMedicalLeaks(ws, g)     // claims-AI crash dumps leaking PHI (TP)
	buildFinanceLeaks(ws, g)     // unencrypted disbursement exports (TP)
	buildPayrollLeaks(ws, g)     // W-2 / earnings exports (TP)
	buildIdentityLeaks(ws, g)    // claimant passport/license/SSN exports (TP)
	buildBillingLeaks(ws, g)     // medical invoices with cards (TP)
	buildInfraLeaks(ws, g)       // prod deployment with live cloud + Stripe secrets (TP)
	buildBenignFixtures(ws, g)   // templates, fixtures, dictionaries, placeholders (FP)
	buildStructuralNoise(ws, g)  // PEM/PII/SQL/NDJSON shapes that fire regex (FP)
	buildCleverFalsePositives(ws, g)   // value-intrinsic / context-mandatory FPs (the "wow")
	buildRegexEvadingTruePositives(ws, g) // real secrets shape-based regex misses
	buildCleanCodebase(ws, g)    // the large clean haystack (source, lockfiles, logs)

	return ws
}

// ---------------------------------------------------------------------------
// Cloud assets — exposure + criticality keyed by client-relative path prefix.
// ---------------------------------------------------------------------------

func declareAssets(ws *fsbuilder.Workspace) {
	ws.AddAsset(fsbuilder.Asset{
		AssetID: "evenup-legal-backups", Type: "bucket", StorageExposure: "public",
		AssetCriticality: "critical", IsPubliclyAccessible: true, CloudProvider: "aws",
		ServiceContext: "legal-archive", PathPrefix: "sys/backups/legal",
	})
	ws.AddAsset(fsbuilder.Asset{
		AssetID: "evenup-claims-exports", Type: "bucket", StorageExposure: "shared",
		AssetCriticality: "critical", IsPubliclyAccessible: true, CloudProvider: "aws",
		ServiceContext: "backoffice-exports", PathPrefix: "var/backoffice/exports",
	})
	ws.AddAsset(fsbuilder.Asset{
		AssetID: "evenup-claims-ai-prod", Type: "workload", StorageExposure: "internet",
		AssetCriticality: "critical", IsPubliclyAccessible: true, CloudProvider: "aws",
		ServiceContext: "production-claims-ai", PathPrefix: "srv/production",
	})
	ws.AddAsset(fsbuilder.Asset{
		AssetID: "evenup-monorepo", Type: "repo", StorageExposure: "internal",
		AssetCriticality: "medium", IsPubliclyAccessible: false, CloudProvider: "github",
		ServiceContext: "engineering", PathPrefix: "src",
	})
	ws.AddAsset(fsbuilder.Asset{
		AssetID: "evenup-docs", Type: "repo", StorageExposure: "internal",
		AssetCriticality: "low", IsPubliclyAccessible: false, CloudProvider: "github",
		ServiceContext: "documentation", PathPrefix: "docs",
	})
	ws.AddAsset(fsbuilder.Asset{
		AssetID: "evenup-samples", Type: "repo", StorageExposure: "internal",
		AssetCriticality: "low", IsPubliclyAccessible: false, CloudProvider: "github",
		ServiceContext: "samples", PathPrefix: "samples",
	})
	ws.AddAsset(fsbuilder.Asset{
		AssetID: "evenup-internal-host", Type: "host", StorageExposure: "internal",
		AssetCriticality: "low", IsPubliclyAccessible: false, CloudProvider: "aws",
		ServiceContext: "internal", PathPrefix: "",
	})
}

// ---------------------------------------------------------------------------
// True-Positive spaces.
// ---------------------------------------------------------------------------

func buildLegalLeaks(ws *fsbuilder.Workspace, g *secrets.Gen) {
	for i := 1; i <= 5; i++ {
		memo, finds := content.SettlementAgreement(g)
		ws.Add("sys/backups/legal/executed", fsbuilder.File(
			fmt.Sprintf("settlement_%03d_signed_confidential.md", i), "text/markdown", "legal", "0640",
			memo, fsbuilder.TP("executed-settlement-wire-pii", "ssn", "iban", "aba-routing", "docusign-token")).
			WithFindings(finds...))
	}
}

func buildMedicalLeaks(ws *fsbuilder.Workspace, g *secrets.Gen) {
	for i := 1; i <= 7; i++ {
		stream, finds := content.MedicalClaimLog(g, 2200)
		ws.Add("srv/production/analytics/claims", fsbuilder.StreamFile(
			fmt.Sprintf("case_%04d_medical.log", 9900+i), "text/plain", "root", "0640",
			stream, fsbuilder.TP("claims-ai-crash-phi-leak", "ssn", "medical-record-number", "npi", "insurance-member-id", "db-connection-string")).
			WithFindings(finds...))
	}
}

func buildFinanceLeaks(ws *fsbuilder.Workspace, g *secrets.Gen) {
	quarters := []string{"q1", "q2", "q3"}
	for _, q := range quarters {
		stream, finds := content.SettlementDisbursementsCSV(g, 3500, 6)
		ws.Add("var/backoffice/exports/finance", fsbuilder.StreamFile(
			fmt.Sprintf("%s_settlements_unencrypted.csv", q), "text/csv", "finance", "0644",
			stream, fsbuilder.TP("unencrypted-disbursement-export", "ssn", "iban", "credit-card-pan")).
			WithFindings(finds...))
	}
}

func buildPayrollLeaks(ws *fsbuilder.Workspace, g *secrets.Gen) {
	stream, finds := content.PayrollW2Export(g, 2600, 6)
	ws.Add("var/backoffice/exports/payroll", fsbuilder.StreamFile(
		"w2_earnings_export_2025.csv", "text/csv", "payroll", "0644",
		stream, fsbuilder.TP("exposed-payroll-w2-export", "ssn", "ein", "aba-routing")).
		WithFindings(finds...))

	salary, sFinds := content.SalaryIndex(g, 2200)
	ws.Add("var/backoffice/exports/payroll", fsbuilder.StreamFile(
		"loss_of_earnings_index.dat", "text/plain", "payroll", "0644",
		salary, fsbuilder.TP("exposed-earnings-index", "ssn", "salary")).
		WithFindings(sFinds...))
}

func buildIdentityLeaks(ws *fsbuilder.Workspace, g *secrets.Gen) {
	stream, finds := content.IdentityExport(g, 2400, 6)
	ws.Add("var/backoffice/exports/identity", fsbuilder.StreamFile(
		"claimant_identity_export.csv", "text/csv", "intake", "0644",
		stream, fsbuilder.TP("exposed-government-id-export", "passport", "drivers-license", "ssn")).
		WithFindings(finds...))
}

func buildBillingLeaks(ws *fsbuilder.Workspace, g *secrets.Gen) {
	for i := 1; i <= 5; i++ {
		inv, finds := content.MedicalInvoice(g)
		ws.Add("var/backoffice/exports/medical/invoices", fsbuilder.File(
			fmt.Sprintf("provider_invoice_%03d.txt", i), "text/plain", "billing", "0640",
			inv, fsbuilder.TP("provider-invoice-phi-card", "npi", "insurance-member-id", "credit-card-pan")).
			WithFindings(finds...))
	}
}

func buildInfraLeaks(ws *fsbuilder.Workspace, g *secrets.Gen) {
	for i := 1; i <= 3; i++ {
		dep, finds := content.ProdDeploymentYAML(g)
		ws.Add("srv/production/manifests", fsbuilder.File(
			fmt.Sprintf("deployment-prod-%02d.yaml", i), "text/yaml", "devops", "0644",
			dep, fsbuilder.TP("k8s-prod-inlined-credentials", "aws-access-key-id", "aws-secret-access-key", "db-connection-string", "jwt", "stripe-live-key")).
			WithFindings(finds...))
	}
}

// ---------------------------------------------------------------------------
// False-Positive spaces.
// ---------------------------------------------------------------------------

func buildBenignFixtures(ws *fsbuilder.Workspace, g *secrets.Gen) {
	// Legal templates (placeholders only).
	for i := 1; i <= 3; i++ {
		tmpl, f := content.NDATemplate(g)
		ws.Add("src/apps/legal/test/fixtures", fsbuilder.File(
			fmt.Sprintf("contract_template_%02d.txt", i), "text/plain", "legal", "0644",
			tmpl, fsbuilder.FPTest("nda-template-placeholders")).WithFindings(f...))
	}
	for i := 1; i <= 2; i++ {
		tmpl, f := content.SettlementTemplate(g)
		ws.Add("docs/legal/templates", fsbuilder.File(
			fmt.Sprintf("settlement_template_%02d.txt", i), "text/plain", "legal", "0644",
			tmpl, fsbuilder.FPTest("settlement-template-placeholders")).WithFindings(f...))
	}

	// Invoice schema fixtures.
	for i := 1; i <= 3; i++ {
		model, f := content.InvoiceMockModel(g)
		ws.Add("src/apps/billing/test/fixtures", fsbuilder.File(
			fmt.Sprintf("invoice_mock_model_%02d.json", i), "application/json", "finance", "0644",
			model, fsbuilder.FPTest("invoice-schema-fixture")).WithFindings(f...))
	}

	// Mock patient chart fixtures (placeholder PHI).
	for i := 1; i <= 4; i++ {
		chart, f := content.PatientChartFixture(g)
		ws.Add("src/apps/medical/test/fixtures", fsbuilder.File(
			fmt.Sprintf("patient_chart_fixture_%02d.json", i), "application/json", "medical", "0644",
			chart, fsbuilder.FPTest("mock-patient-chart")).WithFindings(f...))
	}

	// Code-constant dictionaries (no patient coupling).
	icd, icdF := content.ICD10Dictionary(g)
	ws.Add("src/apps/medical/constants", fsbuilder.File("icd10_diagnostic_dictionary.go", "text/x-go", "medical", "0644",
		icd, fsbuilder.FPTest("icd10-code-constants")).WithFindings(icdF...))
	cpt, cptF := content.CPTDictionary(g)
	ws.Add("src/apps/medical/constants", fsbuilder.File("cpt_procedure_dictionary.go", "text/x-go", "medical", "0644",
		cpt, fsbuilder.FPTest("cpt-code-constants")).WithFindings(cptF...))
	icd2, icd2F := content.ICD10Dictionary(g)
	ws.Add("docs/integration/dictionaries", fsbuilder.File("icd10_map.go", "text/x-go", "docs", "0644",
		icd2, fsbuilder.FPTest("icd10-translation-map")).WithFindings(icd2F...))

	// Placeholder resumes.
	for i := 1; i <= 3; i++ {
		resume, f := content.ResumePlaceholder(g)
		ws.Add("docs/recruiting/sample_resumes", fsbuilder.File(
			fmt.Sprintf("candidate_placeholder_%02d.pdf.txt", i), "text/plain", "recruiting", "0644",
			resume, fsbuilder.FPTest("placeholder-resume")).WithFindings(f...))
	}

	// Helm test values (REPLACE_ME placeholders).
	for _, dir := range []string{"src/infra/charts", "src/infra/charts/billing", "src/infra/charts/claims"} {
		tv, f := content.TestValuesYAML(g)
		ws.Add(dir, fsbuilder.File("test-values.yaml", "text/yaml", "devops", "0644",
			tv, fsbuilder.FPTest("helm-test-placeholders")).WithFindings(f...))
	}
}

func buildStructuralNoise(ws *fsbuilder.Workspace, g *secrets.Gen) {
	ws.Add("srv/production/workloads/gateway/telemetry", fsbuilder.File("metrics-stream.pem", "text/plain", "root", "0644",
		content.TelemetryPEM(g), fsbuilder.FPNoise("fake-pem-telemetry-block")))

	ws.Add("var/backoffice/exports/kyc", fsbuilder.File("kyc_fixed_width.dat", "text/plain", "compliance", "0644",
		content.FixedWidthPII(g, 500), fsbuilder.FPNoise("synthetic-pii-fixed-width")))

	dumpG := g.Fork()
	ws.Add("var/backoffice/exports/db", fsbuilder.StreamFile("claims_dump.sql", "text/plain", "dba", "0640",
		func(w io.Writer) error { return content.StreamSQLDump(w, dumpG, "claim_payments", 1800) },
		fsbuilder.FPNoise("sql-dump-pii-noise")))

	ndG := g.Fork()
	ws.Add("var/datalake/events", fsbuilder.StreamFile("claim_events.ndjson", "application/x-ndjson", "data", "0644",
		func(w io.Writer) error { return content.StreamNDJSON(w, ndG, 4000) },
		fsbuilder.FPNoise("uuid-mistaken-for-token")))
}

// ---------------------------------------------------------------------------
// Clever false positives — value-intrinsic / context-mandatory. Deliberately
// placed in PRODUCTION + back-office paths so folder location alone can't clear
// them: the value's validity and surrounding context become mandatory. This is
// the set a regex-only scanner gets wrong and our context layer gets right.
// ---------------------------------------------------------------------------

func buildCleverFalsePositives(ws *fsbuilder.Workspace, g *secrets.Gen) {
	// Family 1 — invalid checksum / impossible range (in operational paths).
	for i := 1; i <= 3; i++ {
		c, f := content.InvalidPaymentsBatch(g)
		ws.Add("var/backoffice/exports/finance", fsbuilder.File(
			fmt.Sprintf("payment_corrections_%02d.csv", i), "text/csv", "finance", "0644",
			c, fsbuilder.FPNoise("luhn-invalid-card-batch")).WithFindings(f...))
	}
	for i := 1; i <= 3; i++ {
		c, f := content.ImpossibleSSNRoster(g)
		ws.Add("var/backoffice/exports/intake", fsbuilder.File(
			fmt.Sprintf("synthetic_roster_%02d.csv", i), "text/csv", "intake", "0644",
			c, fsbuilder.FPNoise("impossible-ssn-range")).WithFindings(f...))
	}

	// Family 2 — semantic mismatch. ProdOrderLog lives in a PRODUCTION log path
	// (streamed scale driver); SemanticIdExport in an analytics export.
	for i := 1; i <= 4; i++ {
		stream, f := content.ProdOrderLog(g, 2000)
		ws.Add("srv/production/workloads/orders/logs", fsbuilder.StreamFile(
			fmt.Sprintf("orders-%02d.log", i), "text/plain", "root", "0640",
			stream, fsbuilder.FPNoise("order-id-and-uuid-not-secret")).WithFindings(f...))
	}
	for i := 1; i <= 3; i++ {
		c, f := content.SemanticIdExport(g)
		ws.Add("var/backoffice/exports/analytics", fsbuilder.File(
			fmt.Sprintf("identifiers_%02d.export", i), "text/plain", "data", "0644",
			c, fsbuilder.FPNoise("semantic-id-mismatch")).WithFindings(f...))
	}

	// Family 3 — public-by-design, in PRODUCTION config (not test/docs).
	for i := 1; i <= 4; i++ {
		c, f := content.PublicConfig(g)
		ws.Add("srv/production/workloads/web/config", fsbuilder.File(
			fmt.Sprintf("public-client-%02d.yaml", i), "text/yaml", "devops", "0644",
			c, fsbuilder.FPNoise("public-by-design-config")).WithFindings(f...))
	}

	// Family 4 — known test / example values (docs AND a prod config comment file).
	for i := 1; i <= 2; i++ {
		c, f := content.ExampleKeysDoc(g)
		ws.Add("docs/integration/guides", fsbuilder.File(
			fmt.Sprintf("integration_guide_%02d.md", i), "text/markdown", "docs", "0644",
			c, fsbuilder.FPTest("known-example-credentials")).WithFindings(f...))
	}
	for i := 1; i <= 2; i++ {
		c, f := content.ExampleKeysDoc(g)
		ws.Add("srv/production/workloads/gateway/config", fsbuilder.File(
			fmt.Sprintf("sample-env-reference-%02d.txt", i), "text/plain", "devops", "0644",
			c, fsbuilder.FPTest("known-example-credentials-in-prod-doc")).WithFindings(f...))
	}

	// Family 5 — already redacted / encrypted, in PRODUCTION config.
	for i := 1; i <= 3; i++ {
		c, f := content.RedactedConfig(g)
		ws.Add("srv/production/workloads/billing/config", fsbuilder.File(
			fmt.Sprintf("secrets-redacted-%02d.yaml", i), "text/yaml", "devops", "0640",
			c, fsbuilder.FPNoise("redacted-or-sealed-values")).WithFindings(f...))
	}
}

// ---------------------------------------------------------------------------
// Regex-evading true positives — real, live secrets that shape-based regex
// misses (no vendor prefix, "test" inside a live body, benign variable name,
// split across lines, base64-wrapped). Placed in production config/source.
// ---------------------------------------------------------------------------

func buildRegexEvadingTruePositives(ws *fsbuilder.Workspace, g *secrets.Gen) {
	for i := 1; i <= 3; i++ {
		c, f := content.GenericSecretEnv(g)
		ws.Add("srv/production/workloads/claims-ai/config", fsbuilder.File(
			fmt.Sprintf("runtime-%02d.yaml", i), "text/yaml", "devops", "0640",
			c, fsbuilder.TP("generic-and-substring-evading-secret", "generic-high-entropy-secret")).WithFindings(f...))
	}
	for i := 1; i <= 2; i++ {
		c, f := content.SplitConcatSecret(g)
		ws.Add("src/apps/billing/internal/creds", fsbuilder.File(
			fmt.Sprintf("assemble_%02d.go", i), "text/x-go", "billing", "0644",
			c, fsbuilder.TP("split-concatenated-secret", "aws-secret-access-key")).WithFindings(f...))
	}
	for i := 1; i <= 2; i++ {
		c, f := content.EncodedSecret(g)
		ws.Add("srv/production/workloads/gateway/config", fsbuilder.File(
			fmt.Sprintf("gateway-%02d.conf", i), "text/plain", "devops", "0640",
			c, fsbuilder.TP("base64-encoded-secret", "stripe-live-key")).WithFindings(f...))
	}
}

// ---------------------------------------------------------------------------
// Clean codebase — the large haystack (realistic, not scaled) plus the
// streamed scale drivers (lockfiles, production logs).
// ---------------------------------------------------------------------------

func buildCleanCodebase(ws *fsbuilder.Workspace, g *secrets.Gen) {
	codeDirs := []struct {
		dir   string
		count int
		gen   func(*secrets.Gen, int) string
		name  func(int) string
		ftype string
	}{
		{"src/apps/legal/server", 14, content.CleanGo, func(i int) string { return fmt.Sprintf("handler_%02d.go", i) }, "text/x-go"},
		{"src/apps/claims/scorer", 14, content.CleanPython, func(i int) string { return fmt.Sprintf("scorer_%02d.py", i) }, "text/x-python"},
		{"src/apps/medical/api", 12, content.CleanPython, func(i int) string { return fmt.Sprintf("api_%02d.py", i) }, "text/x-python"},
		{"src/apps/billing/internal", 12, content.CleanGo, func(i int) string { return fmt.Sprintf("billing_%02d.go", i) }, "text/x-go"},
		{"src/apps/intake/portal", 14, content.CleanTypeScript, func(i int) string { return fmt.Sprintf("View%02d.tsx", i) }, "text/tsx"},
		{"src/apps/payroll/svc", 10, content.CleanCSharp, func(i int) string { return fmt.Sprintf("Service%02d.cs", i) }, "text/x-csharp"},
		{"src/apps/intake/legacy", 10, content.CleanRuby, func(i int) string { return fmt.Sprintf("controller_%02d.rb", i) }, "text/x-ruby"},
		{"src/platform/core", 12, content.CleanScala, func(i int) string { return fmt.Sprintf("Module%02d.scala", i) }, "text/x-scala"},
		{"src/web/dashboard", 14, content.CleanTypeScript, func(i int) string { return fmt.Sprintf("Panel%02d.tsx", i) }, "text/tsx"},
	}
	for _, d := range codeDirs {
		for i := 1; i <= d.count; i++ {
			ws.Add(d.dir, fsbuilder.File(d.name(i), d.ftype, "evenup", "0644",
				d.gen(g, 400), fsbuilder.Clean()))
		}
	}

	// Dependency-lockfile firehose (streamed, scaled) — generic-hash FP noise.
	for i := 1; i <= 6; i++ {
		dir := fmt.Sprintf("home/ci/cache/build-%02d", i)
		goG, pkgG, yarnG := g.Fork(), g.Fork(), g.Fork()
		ws.Add(dir, fsbuilder.StreamFile("go.sum", "text/plain", "ci", "0644",
			func(w io.Writer) error { return content.StreamGoSum(w, goG, 1050) }, fsbuilder.Clean()))
		ws.Add(dir, fsbuilder.StreamFile("package-lock.json", "application/json", "ci", "0644",
			func(w io.Writer) error { return content.StreamPackageLock(w, pkgG, 1050) }, fsbuilder.Clean()))
		ws.Add(dir, fsbuilder.StreamFile("yarn.lock", "text/plain", "ci", "0644",
			func(w io.Writer) error { return content.StreamYarnLock(w, yarnG, 1050) }, fsbuilder.Clean()))
	}

	// Production log firehose (streamed, scaled).
	logServices := []string{"claims-ai", "intake-api", "billing-api", "gateway"}
	for _, svc := range logServices {
		auditG, jsonG := g.Fork(), g.Fork()
		ws.Add("srv/production/workloads/"+svc+"/logs",
			fsbuilder.StreamFile("audit.json", "application/json", "root", "0640",
				func(w io.Writer) error { return content.StreamAuditLog(w, auditG, 4200) }, fsbuilder.Clean()))
		ws.Add("srv/production/workloads/"+svc+"/logs",
			fsbuilder.StreamFile("app.json", "application/json", "root", "0640",
				func(w io.Writer) error { return content.StreamJSONLog(w, jsonG, svc, 4200) }, fsbuilder.FPNoise("txn-id-mistaken-for-pan")))
	}
}
