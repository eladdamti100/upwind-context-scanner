package secrets

import "testing"

func TestValidIBAN(t *testing.T) {
	valid := []string{"DE89370400440532013000", "GB82WEST12345698765432"}
	invalid := []string{"DE00370400440532013000", "DE89370400440532013001", "XX"}
	for _, s := range valid {
		if !ValidIBAN(s) {
			t.Errorf("ValidIBAN(%q) = false, want true", s)
		}
	}
	for _, s := range invalid {
		if ValidIBAN(s) {
			t.Errorf("ValidIBAN(%q) = true, want false", s)
		}
	}
}

func TestValidNPI(t *testing.T) {
	if !ValidNPI("1234567893") {
		t.Error("ValidNPI(1234567893) = false, want true")
	}
	if ValidNPI("1234567890") {
		t.Error("ValidNPI(1234567890) = true, want false")
	}
}

func TestValidGTIN(t *testing.T) {
	if !ValidGTIN("036000291452") {
		t.Error("ValidGTIN(036000291452) = false, want true")
	}
	if ValidGTIN("036000291453") {
		t.Error("ValidGTIN(036000291453) = true, want false")
	}
}

func TestValidJWT(t *testing.T) {
	jwt := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
	if !ValidJWT(jwt) {
		t.Error("ValidJWT(valid) = false, want true")
	}
	if ValidJWT("eyJhbGci.eyJzdWIi") {
		t.Error("ValidJWT(2-part) = true, want false")
	}
	if ValidJWT("abc.def.ghi") {
		t.Error("ValidJWT(non-json header) = true, want false")
	}
}

func TestValidDEA(t *testing.T) {
	if !ValidDEA("BX1234563") {
		t.Error("ValidDEA(BX1234563) = false, want true")
	}
	if ValidDEA("BX1234560") {
		t.Error("ValidDEA(BX1234560) = true, want false")
	}
}

// Cross-check that the existing checksum validators still agree with the new ones.
func TestLuhnConsistency(t *testing.T) {
	if !LuhnValid("4242424242424242") || LuhnValid("4242424242424241") {
		t.Error("LuhnValid disagrees with known card vectors")
	}
}
