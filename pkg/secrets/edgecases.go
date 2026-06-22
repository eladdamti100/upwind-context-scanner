// edgecases.go generates the "clever" values that make the context layer worth
// building: shapes a regex-only scanner WILL flag, but whose validity or
// semantics prove they are benign — and the inverse, real secrets that evade
// shape-based regex. These power the value-intrinsic / context-mandatory False
// Positives and the regex-evading True Positives in pkg/content/edgecases.go.
//
// SECURITY NOTE (same invariant as generators.go): everything here is synthetic.
package secrets

import (
	"fmt"
	"strings"
)

// ---------------------------------------------------------------------------
// Validators — also usable by the feature extractor to recompute validity.
// ---------------------------------------------------------------------------

// LuhnValid reports whether the digit string passes the Luhn checksum.
func LuhnValid(s string) bool {
	sum, double := 0, false
	for i := len(s) - 1; i >= 0; i-- {
		c := s[i]
		if c < '0' || c > '9' {
			return false
		}
		d := int(c - '0')
		if double {
			if d *= 2; d > 9 {
				d -= 9
			}
		}
		sum += d
		double = !double
	}
	return sum%10 == 0
}

// ValidSSN reports whether an SSN (###-##-####) falls outside the reserved /
// impossible ranges the SSA never issues.
func ValidSSN(s string) bool {
	p := strings.Split(s, "-")
	if len(p) != 3 || len(p[0]) != 3 || len(p[1]) != 2 || len(p[2]) != 4 {
		return false
	}
	area := atoi(p[0])
	group := atoi(p[1])
	serial := atoi(p[2])
	if area == 0 || area == 666 || area >= 900 {
		return false
	}
	if group == 0 || serial == 0 {
		return false
	}
	return true
}

// ValidABA reports whether a 9-digit routing number passes the ABA checksum.
func ValidABA(s string) bool {
	if len(s) != 9 {
		return false
	}
	d := make([]int, 9)
	for i := 0; i < 9; i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
		d[i] = int(s[i] - '0')
	}
	sum := 3*(d[0]+d[3]+d[6]) + 7*(d[1]+d[4]+d[7]) + (d[2] + d[5] + d[8])
	return sum%10 == 0
}

func atoi(s string) int {
	n := 0
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return -1
		}
		n = n*10 + int(s[i]-'0')
	}
	return n
}

// ---------------------------------------------------------------------------
// Invalid-by-construction — sensitive SHAPE, structurally impossible value.
// ---------------------------------------------------------------------------

// LuhnInvalidCard returns a 16-digit card-shaped number that FAILS Luhn (a real
// card never would) — e.g. an order id or data-entry typo that fires card regex.
func (g *Gen) LuhnInvalidCard() string {
	c := g.LuhnCard() // valid
	last := c[15]
	repl := byte('0' + ((last-'0')+1)%10) // bump the check digit so Luhn fails
	return c[:15] + string(repl)
}

// ImpossibleSSN returns an SSN-shaped value in a reserved/impossible range
// (area 000/666/9xx, group 00, or serial 0000) — cannot be a real SSN.
func (g *Gen) ImpossibleSSN() string {
	switch g.Intn(4) {
	case 0:
		return "000-" + g.Digits(2) + "-" + g.Digits(4)
	case 1:
		return "666-" + g.Digits(2) + "-" + g.Digits(4)
	case 2:
		return fmt.Sprintf("9%02d-%s-%s", g.Intn(100), g.Digits(2), g.Digits(4))
	default:
		return g.Digits(3) + "-00-" + g.Digits(4)
	}
}

// BadChecksumABA returns a 9-digit routing number that FAILS the ABA checksum.
func (g *Gen) BadChecksumABA() string {
	for {
		s := g.Digits(9)
		if !ValidABA(s) {
			return s
		}
	}
}

// BadChecksumIBAN returns an IBAN-shaped value whose check digits are "00",
// which fails the IBAN mod-97 rule (valid check digits are 02–98).
func (g *Gen) BadChecksumIBAN() string {
	cc := g.Pick([]string{"DE", "GB", "FR", "NL", "IL", "ES"})
	return cc + "00" + g.Digits(18)
}

// ---------------------------------------------------------------------------
// Semantic mismatch — right shape, wrong meaning (only context can tell).
// ---------------------------------------------------------------------------

// OrderID16 returns a 16-digit order id (Luhn-invalid by construction) that
// collides with credit-card regex but is just an internal identifier.
func (g *Gen) OrderID16() string {
	for {
		s := "8" + g.Digits(15) // "8" BIN never issued; usually fails Luhn anyway
		if !LuhnValid(s) {
			return s
		}
	}
}

// EpochNanos returns a 19-digit nanosecond timestamp that card/long-number
// regexes mistake for an account number.
func (g *Gen) EpochNanos() string {
	return fmt.Sprintf("17%d%s", g.IntRange(10, 59), g.Digits(15))
}

// PhoneAsSSN returns a phone number rendered in ###-##-#### shape — matches SSN
// regex but is a phone number.
func (g *Gen) PhoneAsSSN() string {
	return fmt.Sprintf("%03d-%02d-%04d", g.IntRange(201, 989), g.IntRange(10, 99), g.Intn(10000))
}

// GitCommitSHA returns a 40-hex commit hash — fires generic-key/entropy rules
// but is a public VCS object id.
func (g *Gen) GitCommitSHA() string { return g.Hex(40) }

var dictWords = []string{
	"correct", "horse", "battery", "staple", "sunset", "monkey", "garden", "rocket",
	"silver", "planet", "coffee", "window", "yellow", "guitar", "puzzle", "anchor",
}

// DictionaryToken returns a low-entropy token built from dictionary words — looks
// token-ish to a length/charset rule but is obviously not random.
func (g *Gen) DictionaryToken() string {
	parts := make([]string, 5)
	for i := range parts {
		parts[i] = g.Pick(dictWords)
	}
	return strings.Join(parts, "_")
}

// LowEntropyKey returns an AKIA-prefixed key whose body is a repeated/sequential
// run — wears the AWS shape but has near-zero entropy (a disabled stub).
func (g *Gen) LowEntropyKey() string {
	ch := byte('A' + g.Intn(26))
	return "AKIA" + strings.Repeat(string(ch), 16)
}

// ---------------------------------------------------------------------------
// Public-by-design — meant to be public, never a secret.
// ---------------------------------------------------------------------------

// PublishableKey returns a Stripe publishable key (pk_live_) — safe to expose.
func (g *Gen) PublishableKey() string { return "pk_live_" + g.Alnum(24) }

// AWSAccountID returns a 12-digit AWS account id — an identifier, not a secret.
func (g *Gen) AWSAccountID() string { return g.Digits(12) }

// PublicAPIURL returns a public API base URL (a public_non_secret config value).
func (g *Gen) PublicAPIURL() string {
	return "https://api.evenup.example/v1/" + g.Pick([]string{"claims", "intake", "billing", "status"})
}

// ---------------------------------------------------------------------------
// Known test / example values — well-known, intentionally inert.
// ---------------------------------------------------------------------------

// ExampleAWSKey returns AWS's documentation example access key id.
func (g *Gen) ExampleAWSKey() string { return "AKIAIOSFODNN7EXAMPLE" }

// ReservedExampleEmail returns an @example.com address (RFC 2606 reserved).
func (g *Gen) ReservedExampleEmail() string {
	return strings.ToLower(g.FirstName()) + "@example.com"
}

// ReservedPhone returns a 555-01xx phone number (reserved for fiction/testing).
func (g *Gen) ReservedPhone() string { return fmt.Sprintf("+1-555-01%02d", g.Intn(100)) }

// ---------------------------------------------------------------------------
// Regex-evading TRUE positives — real secrets shape-based regex misses.
// ---------------------------------------------------------------------------

// GenericHighEntropySecret returns a 48-char high-entropy secret with NO known
// vendor prefix — a real credential that prefix-anchored regex rules skip.
func (g *Gen) GenericHighEntropySecret() string { return g.Str(Base64Std, 48) }

// MalformedJWT returns a JWT-shaped string with a broken structure (only two
// segments) — fires JWT regex but cannot be a valid token.
func (g *Gen) MalformedJWT() string {
	header := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
	return header + "." + g.Str(Base64URL, 40) // missing signature segment
}
