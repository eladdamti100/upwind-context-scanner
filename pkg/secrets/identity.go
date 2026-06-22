// identity.go adds the identity / medical-billing / payroll generators the
// EvenUp (fintech-legal-hybrid) agent needs: a personal-injury claims platform
// where a single claimant file may carry a passport, a driver's license, an SSN,
// medical diagnoses + procedures, payroll proof-of-earnings, and settlement
// payment details all at once.
//
// SECURITY NOTE (same invariant as generators.go): every identifier here is
// synthetic — passports, licenses, EINs, member IDs, and procedure codes wear
// the right shape but identify no real person and authenticate nowhere.
package secrets

import "fmt"

// ---------------------------------------------------------------------------
// Government / identity documents
// ---------------------------------------------------------------------------

// Passport returns a synthetic passport number (1 letter + 8 digits).
func (g *Gen) Passport() string {
	return string(rune('A'+g.Intn(26))) + g.Digits(8)
}

// DriverLicense returns a synthetic US driver's license (state + 7 digits).
func (g *Gen) DriverLicense() string {
	return g.Pick(usStates) + "-" + g.Digits(7)
}

// EIN returns a synthetic Employer Identification Number (##-#######).
func (g *Gen) EIN() string {
	return g.Digits(2) + "-" + g.Digits(7)
}

// TIN is an alias for a taxpayer identification number (EIN-shaped).
func (g *Gen) TIN() string { return g.EIN() }

// InsuranceMemberID returns a synthetic health-insurance member id.
func (g *Gen) InsuranceMemberID() string {
	return g.Str(UpperAlnum, 3) + g.Digits(9)
}

// ClaimID returns a synthetic personal-injury claim identifier.
func (g *Gen) ClaimID() string {
	return fmt.Sprintf("CLM-%04d-%06d", 2024+g.Intn(3), g.Intn(1000000))
}

// CaseNumber returns a synthetic litigation case number.
func (g *Gen) CaseNumber() string {
	return fmt.Sprintf("%d-CV-%05d", 2024+g.Intn(3), g.Intn(100000))
}

// ---------------------------------------------------------------------------
// Payroll / earnings (loss-of-earning-capacity proof in injury cases)
// ---------------------------------------------------------------------------

// Wage returns a synthetic annual gross wage figure (integer dollars).
func (g *Gen) Wage() int { return g.IntRange(38, 210) * 1000 }

// ---------------------------------------------------------------------------
// Medical procedures (CPT) — complements the ICD-10 diagnosis table.
// ---------------------------------------------------------------------------

// CPTEntry is one CPT procedure-code / description pair.
type CPTEntry struct {
	Code string
	Desc string
}

// CPTTable is a fixed catalog of CPT procedure codes. Exported so the FP
// "dictionary" Go file can render the whole map as benign source code.
var CPTTable = []CPTEntry{
	{"99213", "Office/outpatient visit, established patient, low complexity"},
	{"99285", "Emergency department visit, high complexity"},
	{"72148", "MRI lumbar spine without contrast"},
	{"73721", "MRI lower extremity joint without contrast"},
	{"29881", "Arthroscopy, knee, surgical with meniscectomy"},
	{"62323", "Injection, epidural, lumbar/sacral with imaging"},
	{"97110", "Therapeutic exercises, each 15 minutes"},
	{"20610", "Arthrocentesis, aspiration/injection, major joint"},
	{"70450", "CT head/brain without contrast"},
	{"99204", "Office/outpatient visit, new patient, moderate complexity"},
}

// CPT returns a deterministic CPT entry.
func (g *Gen) CPT() CPTEntry { return CPTTable[g.Intn(len(CPTTable))] }
