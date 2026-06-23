// validators.go is the Go-side mirror of the TypeScript universal validator
// library (src/lib/validators/). These run on the RAW value at generation /
// scan time — where the full value still exists — and feed the structural
// signals (structurally_valid / format_valid_for_type) the masked TS pipeline
// later consumes. Keeping both sides in lock-step means the demo's verdicts and
// a real customer-side scan use identical rules.
//
// SECURITY NOTE: validators only read the value to compute a boolean; nothing is
// stored or logged. Same synthetic-only invariant as the rest of pkg/secrets.
package secrets

import (
	"encoding/base64"
	"encoding/json"
	"strings"
)

// ValidIBAN reports whether an IBAN passes the ISO 7064 mod-97-10 check.
func ValidIBAN(s string) bool {
	s = strings.ToUpper(strings.ReplaceAll(s, " ", ""))
	if len(s) < 5 {
		return false
	}
	for _, c := range s {
		if !(c >= '0' && c <= '9') && !(c >= 'A' && c <= 'Z') {
			return false
		}
	}
	rearranged := s[4:] + s[:4]
	rem := 0
	for _, ch := range rearranged {
		var piece string
		if ch >= 'A' && ch <= 'Z' {
			piece = itoa(int(ch) - 55) // A=10..Z=35
		} else {
			piece = string(ch)
		}
		for _, c := range piece {
			rem = (rem*10 + int(c-'0')) % 97
		}
	}
	return rem == 1
}

// ValidNPI reports whether a 10-digit NPI passes the 80840-prefixed Luhn check.
func ValidNPI(s string) bool {
	if len(s) != 10 || !allDigits(s) {
		return false
	}
	return LuhnValid("80840" + s)
}

// ValidGTIN reports whether an 8/12/13/14-digit barcode passes the mod-10 check.
func ValidGTIN(s string) bool {
	if !allDigits(s) {
		return false
	}
	n := len(s)
	if n != 8 && n != 12 && n != 13 && n != 14 {
		return false
	}
	body := s[:n-1]
	check := int(s[n-1] - '0')
	sum, w := 0, 3
	for i := len(body) - 1; i >= 0; i-- {
		sum += int(body[i]-'0') * w
		if w == 3 {
			w = 1
		} else {
			w = 3
		}
	}
	return (10-(sum%10))%10 == check
}

// ValidJWT reports whether a token is a 3-part JWT whose header is valid
// base64url decoding to a JSON object carrying "alg".
func ValidJWT(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) != 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
		return false
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return false
	}
	var header map[string]any
	if err := json.Unmarshal(raw, &header); err != nil {
		return false
	}
	_, ok := header["alg"]
	return ok
}

// ValidDEA reports whether a DEA number (2 letters + 7 digits) passes its
// (d1+d3+d5) + 2*(d2+d4+d6) ≡ d7 (mod 10) checksum.
func ValidDEA(s string) bool {
	s = strings.ToUpper(strings.TrimSpace(s))
	if len(s) != 9 || s[0] < 'A' || s[0] > 'Z' || s[1] < 'A' || s[1] > 'Z' || !allDigits(s[2:]) {
		return false
	}
	d := s[2:]
	sum := int(d[0]-'0') + int(d[2]-'0') + int(d[4]-'0') +
		2*(int(d[1]-'0')+int(d[3]-'0')+int(d[5]-'0'))
	return sum%10 == int(d[6]-'0')
}

// ---- helpers ---------------------------------------------------------------

func allDigits(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	return string(b)
}
