// corporate.go adds the people / money / medical / prose generators the
// omni-corp hybrid-enterprise agent needs to populate unstructured documents
// (contracts, invoices, patient charts, resumes) with realistic, deterministic
// context that defeats keyword-only detection.
//
// SECURITY NOTE (same invariant as generators.go): every identity, account
// number, and diagnosis here is synthetic. Names are drawn from fixed word
// pools, SSNs/IBANs/PANs wear the right shape but identify no real person.
package secrets

import (
	"fmt"
	"strings"
)

// ---------------------------------------------------------------------------
// People & PII
// ---------------------------------------------------------------------------

var firstNames = []string{
	"James", "Mary", "Robert", "Patricia", "Avi", "Noa", "Daniel", "Maya", "Liam",
	"Olivia", "Noah", "Emma", "Lucas", "Sophia", "Mateo", "Isabella", "Wei", "Yuki",
	"Omar", "Fatima", "Hannah", "Ethan", "Aria", "Leo", "Tamar", "Idan", "Priya", "Arjun",
}

var lastNames = []string{
	"Smith", "Johnson", "Cohen", "Levi", "Garcia", "Martinez", "Brown", "Davis",
	"Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Nguyen", "Kim",
	"Patel", "Khan", "Rossi", "Mizrahi", "Friedman", "OConnor", "Schwartz", "Yamamoto",
}

var streets = []string{
	"Maple Ave", "Oak St", "Dizengoff St", "Market St", "Rothschild Blvd", "King George St",
	"Industrial Pkwy", "Hudson St", "Sunset Blvd", "Allenby St", "Lincoln Ave", "Cedar Ln",
}

var cities = []string{
	"Tel Aviv", "San Francisco", "Austin", "New York", "Haifa", "London",
	"Berlin", "Singapore", "Toronto", "Boston", "Herzliya", "Denver",
}

var usStates = []string{"CA", "NY", "TX", "WA", "MA", "CO", "IL", "FL", "NJ", "GA"}

// FirstName returns a synthetic given name.
func (g *Gen) FirstName() string { return g.Pick(firstNames) }

// LastName returns a synthetic surname.
func (g *Gen) LastName() string { return g.Pick(lastNames) }

// FullName returns "First Last".
func (g *Gen) FullName() string { return g.FirstName() + " " + g.LastName() }

// Email returns a synthetic corporate email for a person at a company domain.
func (g *Gen) Email(first, last, domain string) string {
	return fmt.Sprintf("%s.%s@%s", strings.ToLower(first), strings.ToLower(last), domain)
}

// Phone returns a synthetic US-format phone number.
func (g *Gen) Phone() string {
	return fmt.Sprintf("+1-%03d-%03d-%04d", g.IntRange(200, 989), g.IntRange(200, 989), g.Intn(10000))
}

// StreetAddress returns a synthetic single-line postal address.
func (g *Gen) StreetAddress() string {
	return fmt.Sprintf("%d %s, %s, %s %05d",
		g.IntRange(1, 9999), g.Pick(streets), g.Pick(cities), g.Pick(usStates), g.Intn(100000))
}

// ---------------------------------------------------------------------------
// Money & banking
// ---------------------------------------------------------------------------

// IBAN returns a shape-valid IBAN (country + 2 check digits + BBAN). Synthetic.
func (g *Gen) IBAN() string {
	cc := g.Pick([]string{"DE", "GB", "FR", "NL", "IL", "ES"})
	return fmt.Sprintf("%s%02d%s", cc, g.IntRange(10, 98), g.Digits(18))
}

// ABARouting returns a 9-digit US ABA routing number (synthetic).
func (g *Gen) ABARouting() string { return g.Digits(9) }

// BankAccount returns a synthetic bank account number.
func (g *Gen) BankAccount() string { return g.Digits(g.IntRange(8, 12)) }

// MoneyUSD returns a formatted dollar amount in [lo,hi] with thousands commas.
func (g *Gen) MoneyUSD(lo, hi int) string {
	return "$" + withCommas(g.IntRange(lo, hi)) + ".00"
}

// Salary returns a plausible annual base salary figure (integer dollars).
func (g *Gen) Salary() int { return g.IntRange(78, 340) * 1000 }

func withCommas(n int) string {
	s := fmt.Sprintf("%d", n)
	if len(s) <= 3 {
		return s
	}
	var b strings.Builder
	pre := len(s) % 3
	if pre > 0 {
		b.WriteString(s[:pre])
		if len(s) > pre {
			b.WriteString(",")
		}
	}
	for i := pre; i < len(s); i += 3 {
		b.WriteString(s[i : i+3])
		if i+3 < len(s) {
			b.WriteString(",")
		}
	}
	return b.String()
}

// ---------------------------------------------------------------------------
// Dates & companies
// ---------------------------------------------------------------------------

// DateISO returns a deterministic YYYY-MM-DD between [loYear,hiYear].
func (g *Gen) DateISO(loYear, hiYear int) string {
	return fmt.Sprintf("%04d-%02d-%02d", g.IntRange(loYear, hiYear), g.IntRange(1, 12), g.IntRange(1, 28))
}

var companyHeads = []string{
	"Northbridge", "Acme", "Meridian", "Vertex", "Helios", "Cascade", "Quantum",
	"Summit", "Aurora", "Pioneer", "Lattice", "Orion", "Cobalt", "Beacon",
}
var companyTails = []string{"Holdings", "Systems", "Labs", "Capital", "Technologies", "Group", "Partners", "Industries"}

// CompanyName returns a synthetic company name.
func (g *Gen) CompanyName() string {
	return g.Pick(companyHeads) + " " + g.Pick(companyTails)
}

// ---------------------------------------------------------------------------
// Medical (PHI)
// ---------------------------------------------------------------------------

// ICD10Entry is one diagnostic-code / description pair.
type ICD10Entry struct {
	Code string
	Desc string
}

// ICD10Table is a fixed catalog of ICD-10-CM codes. It is exported so the FP
// "dictionary" Go file can render the whole map as benign source code, while the
// TP crash dump pulls live diagnoses for specific patients.
var ICD10Table = []ICD10Entry{
	{"E11.9", "Type 2 diabetes mellitus without complications"},
	{"I10", "Essential (primary) hypertension"},
	{"J45.909", "Unspecified asthma, uncomplicated"},
	{"F41.1", "Generalized anxiety disorder"},
	{"M54.5", "Low back pain"},
	{"K21.9", "Gastro-esophageal reflux disease without esophagitis"},
	{"N39.0", "Urinary tract infection, site not specified"},
	{"E78.5", "Hyperlipidemia, unspecified"},
	{"G43.909", "Migraine, unspecified, not intractable"},
	{"C50.911", "Malignant neoplasm of unspecified site of right female breast"},
	{"Z79.4", "Long term (current) use of insulin"},
	{"R07.9", "Chest pain, unspecified"},
}

// ICD10 returns a deterministic ICD-10 entry.
func (g *Gen) ICD10() ICD10Entry { return ICD10Table[g.Intn(len(ICD10Table))] }

// MRN returns a synthetic Medical Record Number.
func (g *Gen) MRN() string { return "MRN" + g.Digits(8) }

// NPI returns a synthetic 10-digit National Provider Identifier.
func (g *Gen) NPI() string { return g.Digits(10) }

// ---------------------------------------------------------------------------
// Corporate prose — padding that makes documents read like real ones (and
// defeats keyword-only detectors that key off short trigger words).
// ---------------------------------------------------------------------------

var proseClauses = []string{
	"The parties acknowledge that the obligations set forth herein are material to the transaction and shall survive termination.",
	"Each party represents and warrants that it has full corporate power and authority to enter into this agreement.",
	"In no event shall either party be liable for any indirect, incidental, or consequential damages arising out of this agreement.",
	"This agreement constitutes the entire understanding between the parties and supersedes all prior negotiations and communications.",
	"Confidential Information shall be held in strict confidence and used solely for the purposes contemplated by this agreement.",
	"Any notice required under this agreement shall be deemed given when delivered in writing to the addresses set forth below.",
	"The prevailing party in any dispute shall be entitled to recover its reasonable attorneys' fees and costs.",
	"Neither party may assign this agreement without the prior written consent of the other party, such consent not to be unreasonably withheld.",
	"This agreement shall be governed by and construed in accordance with the laws of the applicable jurisdiction.",
	"The failure of either party to enforce any provision shall not be deemed a waiver of such provision or the right to enforce it.",
}

// Clause returns one corporate boilerplate clause.
func (g *Gen) Clause() string { return g.Pick(proseClauses) }

// Paragraph returns n boilerplate clauses joined into a paragraph.
func (g *Gen) Paragraph(n int) string {
	if n < 1 {
		n = 1
	}
	parts := make([]string, n)
	for i := range parts {
		parts[i] = g.Clause()
	}
	return strings.Join(parts, " ")
}
