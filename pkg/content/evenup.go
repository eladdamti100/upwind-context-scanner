// evenup.go holds the EvenUp-specific data-class factories: a personal-injury
// claims platform (fintech-legal-hybrid) whose cloud stores legal settlement
// agreements, medical records (PHI), provider invoices, payroll proof-of-
// earnings, government IDs, and claimant payment details — all at once.
//
// Each factory pairs a True-Positive producer (live, unredacted claimant data in
// production/back-office paths) with the matching benign shapes used elsewhere,
// and returns its findings line-aligned with the bytes written (raw values are
// masked via fsbuilder.NewFinding and discarded).
//
// SECURITY NOTE: every claimant, diagnosis, document number, and card is
// synthetic (see pkg/secrets). Nothing identifies a real person.
package content

import (
	"fmt"
	"io"

	"upwind-context-scanner/pkg/fsbuilder"
	"upwind-context-scanner/pkg/secrets"
)

// ===========================================================================
// Legal — executed settlement agreement (TP)
// ===========================================================================

// SettlementAgreement is a TP target: an executed, confidential personal-injury
// settlement holding the claimant's SSN, the disbursement wire instructions, and
// a DocuSign envelope token — sitting in a public legal backup bucket.
func SettlementAgreement(g *secrets.Gen) (string, []fsbuilder.Finding) {
	claimant := g.FullName()
	insurer := g.CompanyName() + " Casualty Insurance"
	claim := g.ClaimID()
	caseNo := g.CaseNumber()
	date := g.DateISO(2026, 2026)
	amount := g.MoneyUSD(85_000, 4_500_000)
	ssn := g.RandSSN()
	iban := g.IBAN()
	aba := g.ABARouting()
	acct := g.BankAccount()
	docusign := "ds_live_" + g.Alnum(40)

	b := &lineBuf{}
	b.addf(
		"EXECUTED — CONFIDENTIAL SETTLEMENT AGREEMENT AND RELEASE",
		"",
		fmt.Sprintf("Case No. %s   Claim No. %s   Effective Date: %s", caseNo, claim, date),
		"",
		fmt.Sprintf("This Settlement Agreement is entered into by and between %s (\"Claimant\")", claimant),
		fmt.Sprintf("and %s (\"Releasee\").", insurer),
		"",
		g.Paragraph(3),
		"",
		fmt.Sprintf("1. Settlement Sum. In full and final settlement, Releasee shall pay %s to", amount),
		"   the Claimant, disbursed per the wire instructions in Schedule A.",
		"",
		"2. Release of Claims. " + g.Clause(),
		"3. Confidentiality. " + g.Clause(),
		"",
		"SCHEDULE A — DISBURSEMENT WIRE INSTRUCTIONS",
	)
	b.sec(fmt.Sprintf("  Beneficiary: %s   SSN: %s", claimant, ssn), "claimant_ssn", "pii",
		fsbuilder.LabelTrueSecret, "ssn", fsbuilder.ValNotValidated, ssn)
	b.sec(fmt.Sprintf("  IBAN: %s", iban), "beneficiary_iban", "financial",
		fsbuilder.LabelTrueSecret, "iban", fsbuilder.ValNotValidated, iban)
	b.sec(fmt.Sprintf("  ABA Routing: %s   Account: %s", aba, acct), "aba_routing", "financial",
		fsbuilder.LabelTrueSecret, "aba-routing", fsbuilder.ValNotValidated, aba)
	b.addf("", "SCHEDULE B — EXECUTION")
	b.sec(fmt.Sprintf("  DocuSign envelope token: %s", docusign), "docusign_token", "api_key",
		fsbuilder.LabelTrueSecret, "docusign-token", fsbuilder.ValActive, docusign)
	b.addf("", g.Paragraph(4))
	return b.done()
}

// SettlementTemplate is an FP target: a blank settlement agreement template with
// <PLACEHOLDER> tags. Legal terms abound but every value is a placeholder.
func SettlementTemplate(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.addf(
		"CONFIDENTIAL SETTLEMENT AGREEMENT AND RELEASE (TEMPLATE)",
		"",
		"Case No. <CASE_NUMBER>   Claim No. <CLAIM_ID>   Effective Date: <DATE>",
		"",
		"This Settlement Agreement is entered into by and between <CLAIMANT_NAME>",
		"(\"Claimant\") and <INSURER_NAME> (\"Releasee\").",
		"",
		g.Paragraph(2),
		"",
		"1. Settlement Sum. Releasee shall pay <SETTLEMENT_AMOUNT> to the Claimant.",
		"2. Release of Claims. " + g.Clause(),
		"",
		"SCHEDULE A — DISBURSEMENT WIRE INSTRUCTIONS",
		"  Beneficiary: <CLAIMANT_NAME>   SSN: <CLAIMANT_SSN>",
		"  IBAN: <BENEFICIARY_IBAN>   ABA Routing: <ABA_ROUTING>",
	)
	b.sec("  Contact: claims@<INSURER_DOMAIN>.example", "notice_email", "email",
		fsbuilder.LabelDocExample, "", fsbuilder.ValUnsupported, "claims@<INSURER_DOMAIN>.example")
	return b.done()
}

// ===========================================================================
// Medical — claims-AI crash dump leaking a full patient record (TP)
// ===========================================================================

// MedicalClaimLog is a TP target: the claims-AI worker crashed and dumped a full
// patient record (name, SSN, DOB, MRN, NPI, ICD-10 diagnosis, CPT procedure,
// insurance member id) plus the PHI database DSN. Streamed scale driver.
func MedicalClaimLog(g *secrets.Gen, lines int) (func(io.Writer) error, []fsbuilder.Finding) {
	patient := g.FullName()
	claim := g.ClaimID()
	ssn := g.RandSSN()
	dob := g.DateISO(1948, 2006)
	mrn := g.MRN()
	npi := g.NPI()
	member := g.InsuranceMemberID()
	icd := g.ICD10()
	cpt := g.CPT()
	dsn := g.PostgresURL("phi_app", "claims-phi-prod.cluster-czk.us-east-1.rds.amazonaws.com", "claims")

	const preamble = 5
	block := []string{
		fmt.Sprintf("[2026-06-22T03:14:07Z] ERROR claims-ai.worker Unhandled exception scoring claim %s", claim),
		"Traceback (most recent call last):",
		"  File \"/srv/claims-ai/scorer.py\", line 511, in evaluate_damages",
		"    chart = load_patient_chart(claim.patient_id)",
		fmt.Sprintf("    chart = PatientChart(name=%q, ssn=%q, dob=%q, mrn=%q, npi=%q, member_id=%q, dx=\"ICD-10-CM: %s\", proc=\"CPT %s\")",
			patient, ssn, dob, mrn, npi, member, icd.Code, cpt.Code),
		fmt.Sprintf("psycopg2.OperationalError: could not connect to PHI store: %s", dsn),
	}
	patientLineNo := preamble + 5 // block index 4 -> preamble + 4 + 1
	dsnLineNo := preamble + 6     // block index 5 -> preamble + 5 + 1
	finds := []fsbuilder.Finding{
		fsbuilder.NewFinding(patientLineNo, "ssn", "pii", fsbuilder.LabelTrueSecret, "ssn", fsbuilder.ValNotValidated, ssn),
		fsbuilder.NewFinding(patientLineNo, "mrn", "phi", fsbuilder.LabelTrueSecret, "medical-record-number", fsbuilder.ValNotValidated, mrn),
		fsbuilder.NewFinding(patientLineNo, "npi", "phi", fsbuilder.LabelTrueSecret, "npi", fsbuilder.ValNotValidated, npi),
		fsbuilder.NewFinding(patientLineNo, "member_id", "phi", fsbuilder.LabelTrueSecret, "insurance-member-id", fsbuilder.ValNotValidated, member),
		fsbuilder.NewFinding(dsnLineNo, "DATABASE_URL", "database_password", fsbuilder.LabelTrueSecret, "db-connection-string", fsbuilder.ValActive, dsn),
	}

	ng := g.Fork()
	fn := func(w io.Writer) error {
		for i := 0; i < preamble; i++ {
			fmt.Fprintf(w, "[2026-06-22T03:14:%02dZ] INFO claims-ai.worker scoring batch=%d ok latency_ms=%d\n", i, 1000+i, 40+ng.Intn(400))
		}
		for _, ln := range block {
			io.WriteString(w, ln+"\n")
		}
		total := Scaled(lines)
		for i := 0; i < total; i++ {
			fmt.Fprintf(w, "[2026-06-22T03:15:%02dZ] WARN claims-ai.worker retry scoring ref=%s attempt=%d\n", i%60, ng.UUID(), (i%5)+1)
		}
		return nil
	}
	return fn, finds
}

// ===========================================================================
// Finance — unencrypted settlement disbursements export (TP)
// ===========================================================================

// SettlementDisbursementsCSV is a TP target: a giant unencrypted export mapping
// claimants to payout cards, IBANs, and settlement amounts. plantRows carry the
// labeled findings; the rest are realistic noise from a forked gen.
func SettlementDisbursementsCSV(g *secrets.Gen, rows, plantRows int) (func(io.Writer) error, []fsbuilder.Finding) {
	const header = "disbursement_id,claim_id,claimant_name,claimant_email,ssn,iban,aba_routing,card_pan,settlement_usd,paid_at"
	var plants []string
	var finds []fsbuilder.Finding
	for i := 0; i < plantRows; i++ {
		first, last := g.FirstName(), g.LastName()
		email := g.Email(first, last, "claimants.evenup.example")
		ssn := g.RandSSN()
		iban := g.IBAN()
		aba := g.ABARouting()
		pan := g.LuhnCard()
		amt := g.IntRange(8500, 4500000)
		plants = append(plants, fmt.Sprintf("DSB-%06d,%s,%s %s,%s,%s,%s,%s,%s,%d.00,%s",
			100000+i, g.ClaimID(), first, last, email, ssn, iban, aba, pan, amt, g.DateISO(2026, 2026)))
		line := i + 2
		finds = append(finds,
			fsbuilder.NewFinding(line, "ssn", "pii", fsbuilder.LabelTrueSecret, "ssn", fsbuilder.ValNotValidated, ssn),
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
			fmt.Fprintf(w, "DSB-%06d,%s,%s %s,%s,%s,%s,%s,%s,%d.00,%s\n",
				100000+i, ng.ClaimID(), first, last, ng.Email(first, last, "claimants.evenup.example"),
				ng.RandSSN(), ng.IBAN(), ng.ABARouting(), ng.LuhnCard(), ng.IntRange(8500, 4500000), ng.DateISO(2026, 2026))
		}
		return nil
	}
	return fn, finds
}

// ===========================================================================
// Payroll — W-2 / proof-of-earnings export (TP)
// ===========================================================================

// PayrollW2Export is a TP target: an exposed payroll export proving lost earning
// capacity — names, SSNs, employer EINs, wages, and direct-deposit bank details.
func PayrollW2Export(g *secrets.Gen, rows, plantRows int) (func(io.Writer) error, []fsbuilder.Finding) {
	const header = "employee_id,name,ssn,employer_ein,gross_wages,net_pay,routing,account,tax_year"
	var plants []string
	var finds []fsbuilder.Finding
	for i := 0; i < plantRows; i++ {
		name := g.FullName()
		ssn := g.RandSSN()
		ein := g.EIN()
		gross := g.Wage()
		routing := g.ABARouting()
		acct := g.BankAccount()
		plants = append(plants, fmt.Sprintf("EMP-%06d,%s,%s,%s,%d,%d,%s,%s,2025",
			700000+i, name, ssn, ein, gross, gross*72/100, routing, acct))
		line := i + 2
		finds = append(finds,
			fsbuilder.NewFinding(line, "ssn", "pii", fsbuilder.LabelTrueSecret, "ssn", fsbuilder.ValNotValidated, ssn),
			fsbuilder.NewFinding(line, "employer_ein", "pii", fsbuilder.LabelTrueSecret, "ein", fsbuilder.ValNotValidated, ein),
			fsbuilder.NewFinding(line, "routing", "financial", fsbuilder.LabelTrueSecret, "aba-routing", fsbuilder.ValNotValidated, routing),
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
			gross := ng.Wage()
			fmt.Fprintf(w, "EMP-%06d,%s,%s,%s,%d,%d,%s,%s,2025\n",
				700000+i, ng.FullName(), ng.RandSSN(), ng.EIN(), gross, gross*72/100, ng.ABARouting(), ng.BankAccount())
		}
		return nil
	}
	return fn, finds
}

// ===========================================================================
// Identity — claimant government-ID export (TP)
// ===========================================================================

// IdentityExport is a TP target: an exposed claimant identity export mapping
// names to passports, driver's licenses, SSNs, and dates of birth.
func IdentityExport(g *secrets.Gen, rows, plantRows int) (func(io.Writer) error, []fsbuilder.Finding) {
	const header = "claimant_id,name,passport,drivers_license,ssn,dob,address"
	var plants []string
	var finds []fsbuilder.Finding
	for i := 0; i < plantRows; i++ {
		name := g.FullName()
		passport := g.Passport()
		dl := g.DriverLicense()
		ssn := g.RandSSN()
		dob := g.DateISO(1948, 2006)
		plants = append(plants, fmt.Sprintf("CLT-%06d,%s,%s,%s,%s,%s,%q",
			500000+i, name, passport, dl, ssn, dob, g.StreetAddress()))
		line := i + 2
		finds = append(finds,
			fsbuilder.NewFinding(line, "passport", "pii", fsbuilder.LabelTrueSecret, "passport", fsbuilder.ValNotValidated, passport),
			fsbuilder.NewFinding(line, "drivers_license", "pii", fsbuilder.LabelTrueSecret, "drivers-license", fsbuilder.ValNotValidated, dl),
			fsbuilder.NewFinding(line, "ssn", "pii", fsbuilder.LabelTrueSecret, "ssn", fsbuilder.ValNotValidated, ssn),
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
			fmt.Fprintf(w, "CLT-%06d,%s,%s,%s,%s,%s,%q\n",
				500000+i, ng.FullName(), ng.Passport(), ng.DriverLicense(), ng.RandSSN(), ng.DateISO(1948, 2006), ng.StreetAddress())
		}
		return nil
	}
	return fn, finds
}

// ===========================================================================
// Medical billing — hospital/provider invoice (TP) and its mock fixture (FP)
// ===========================================================================

// MedicalInvoice is a TP target: a hospital invoice tying a patient to provider
// NPI, CPT procedure lines, an insurance member id, a balance, and the card used
// to pay it.
func MedicalInvoice(g *secrets.Gen) (string, []fsbuilder.Finding) {
	patient := g.FullName()
	mrn := g.MRN()
	npi := g.NPI()
	member := g.InsuranceMemberID()
	pan := g.LuhnCard()
	provider := g.CompanyName() + " Regional Medical Center"

	b := &lineBuf{}
	b.addf(
		"PATIENT STATEMENT / INVOICE — CONFIDENTIAL",
		fmt.Sprintf("Provider: %s", provider),
		fmt.Sprintf("Invoice: INV-%06d   Date: %s", g.Intn(1000000), g.DateISO(2026, 2026)),
		"",
		fmt.Sprintf("Patient: %s", patient),
	)
	b.sec(fmt.Sprintf("MRN: %s   Provider NPI: %s", mrn, npi), "npi", "phi",
		fsbuilder.LabelTrueSecret, "npi", fsbuilder.ValNotValidated, npi)
	b.sec(fmt.Sprintf("Insurance Member ID: %s", member), "member_id", "phi",
		fsbuilder.LabelTrueSecret, "insurance-member-id", fsbuilder.ValNotValidated, member)
	b.addf("", "Line items:")
	for i := 0; i < 4; i++ {
		cpt := g.CPT()
		b.add(fmt.Sprintf("  CPT %s  %-52s $%d.00", cpt.Code, cpt.Desc, g.IntRange(120, 9800)))
	}
	b.addf("", fmt.Sprintf("Balance Due: %s", g.MoneyUSD(500, 60000)), "Payment method on file:")
	b.sec(fmt.Sprintf("  Card: %s", pan), "card_pan", "credit_card",
		fsbuilder.LabelTrueSecret, "credit-card-pan", fsbuilder.ValNotValidated, pan)
	return b.done()
}

// PatientChartFixture is an FP target: a mock patient chart used by tests, full
// of obvious placeholder values (Jane Doe / 000-00-0000 / MRN00000000).
func PatientChartFixture(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.addf(
		"{",
		"  \"$comment\": \"Static test fixture — synthetic placeholder PHI, not real.\",",
		"  \"patient\": {",
		"    \"name\": \"Jane Doe\",",
	)
	b.sec("    \"ssn\": \"000-00-0000\",", "ssn", "pii",
		fsbuilder.LabelPlaceholder, "", fsbuilder.ValUnsupported, "000-00-0000")
	b.sec("    \"mrn\": \"MRN00000000\",", "mrn", "phi",
		fsbuilder.LabelPlaceholder, "", fsbuilder.ValUnsupported, "MRN00000000")
	b.addf(
		"    \"dob\": \"1990-01-01\",",
		"    \"diagnoses\": [\"E11.9\"],",
		"    \"procedures\": [\"99213\"]",
		"  }",
		"}",
	)
	return b.done()
}

// CPTDictionary is an FP target: a pure-Go map of CPT codes to descriptions —
// benign source code that procedure-code detectors over-flag.
func CPTDictionary(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.addf(
		"// Package cpt is an autogenerated lookup of CPT procedure codes.",
		"// It contains NO patient data — only the public code-to-description map.",
		"package cpt",
		"",
		"// Procedures maps a CPT code to its human-readable description.",
		"var Procedures = map[string]string{",
	)
	for i, e := range secrets.CPTTable {
		line := fmt.Sprintf("\t%q: %q,", e.Code, e.Desc)
		if i == 0 {
			b.sec(line, "cpt_code", "phi", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, e.Code)
		} else {
			b.add(line)
		}
	}
	b.add("}")
	return b.done()
}
