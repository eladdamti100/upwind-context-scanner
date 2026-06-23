// edgecases.go holds the "clever" data-class factories — the ones that make the
// context engine impressive. Each produces shapes a regex-only scanner WILL flag
// but whose value-validity or semantics prove they are benign (False Positives a
// rules+ML layer can clear), plus the inverse: real secrets that evade
// shape-based regex (True Positives only context catches).
//
// Many of these are deliberately placed by the agent in PRODUCTION paths, so the
// scanner cannot clear them by folder location alone — the value and its context
// become mandatory. Each finding carries an explicit `reason` for the UI's
// explanation / investigation panel.
//
// SECURITY NOTE: every value is synthetic (see pkg/secrets).
package content

import (
	"encoding/base64"
	"fmt"
	"io"

	"upwind-context-scanner/pkg/fsbuilder"
	"upwind-context-scanner/pkg/secrets"
)

// secSig appends a line carrying a sensitive-shaped value and records its finding
// with the value-intrinsic context signals set.
func (b *lineBuf) secSig(text, variable, detectedType, label, classification, validation, raw string,
	structurallyValid, knownTest, publicByDesign bool, reason string) {
	b.lines = append(b.lines, text)
	f := fsbuilder.NewFinding(len(b.lines), variable, detectedType, label, classification, validation, raw).
		WithSignals(structurallyValid, knownTest, publicByDesign, reason)
	b.finds = append(b.finds, f)
}

// secSigMod is secSig plus an extra builder step for the extended structural
// signals (format-invalid / already-masked / commit-SHA).
func (b *lineBuf) secSigMod(text, variable, detectedType, label, classification, validation, raw string,
	structurallyValid, knownTest, publicByDesign bool, reason string,
	mod func(fsbuilder.Finding) fsbuilder.Finding) {
	b.lines = append(b.lines, text)
	f := fsbuilder.NewFinding(len(b.lines), variable, detectedType, label, classification, validation, raw).
		WithSignals(structurallyValid, knownTest, publicByDesign, reason)
	if mod != nil {
		f = mod(f)
	}
	b.finds = append(b.finds, f)
}

// ===========================================================================
// Family 1 — invalid checksum / impossible range (deterministic rule clears it)
// ===========================================================================

// InvalidPaymentsBatch is an FP target placed in a finance export path: a batch
// of data-entry errors — card numbers that FAIL Luhn and IBANs with a bad check
// digit. Regex flags every one; a checksum rule clears them all.
func InvalidPaymentsBatch(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.add("# payment_corrections_batch — rejected rows (failed validation at ingest)")
	b.add("row_id,raw_card,raw_iban,note")
	for i := 0; i < 6; i++ {
		card := g.LuhnInvalidCard()
		iban := g.BadChecksumIBAN()
		b.secSig(fmt.Sprintf("%d,%s,%s,rejected:checksum", 1000+i, card, iban),
			"raw_card", "credit_card", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, card,
			false, false, false, "luhn_check_failed")
		// second finding on same line: the bad IBAN
		b.finds = append(b.finds, fsbuilder.NewFinding(len(b.lines), "raw_iban", "financial",
			fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, iban).
			WithSignals(false, false, false, "iban_checksum_failed"))
	}
	return b.done()
}

// ImpossibleSSNRoster is an FP target: a roster whose SSN column holds values in
// reserved/impossible ranges (area 000/666/9xx, group 00) — they fire SSN regex
// but cannot be real SSNs.
func ImpossibleSSNRoster(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.add("# synthetic_test_roster — generated IDs, NOT real claimants")
	b.add("idx,name,ssn_like")
	for i := 0; i < 6; i++ {
		ssn := g.ImpossibleSSN()
		b.secSig(fmt.Sprintf("%d,%s,%s", i, g.FullName(), ssn),
			"ssn_like", "pii", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, ssn,
			false, false, false, "ssn_reserved_range")
	}
	return b.done()
}

// ===========================================================================
// Family 2 — semantic mismatch (right shape, wrong meaning) — streamed prod log
// ===========================================================================

// ProdOrderLog is an FP target placed in a PRODUCTION log: every line has an
// order id (16 digits, Luhn-invalid) and a trace UUID. Card and token regexes
// fire on every line; only context (a benign field name + failed Luhn + a log
// path that also holds real leaks elsewhere) clears them. Streamed scale driver.
func ProdOrderLog(g *secrets.Gen, lines int) (func(io.Writer) error, []fsbuilder.Finding) {
	// Two representative findings near the top (orders + trace token).
	order0 := g.OrderID16()
	trace0 := g.UUID()
	finds := []fsbuilder.Finding{
		fsbuilder.NewFinding(1, "order_id", "credit_card", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, order0).
			WithSignals(false, false, false, "numeric_id_not_card"),
		fsbuilder.NewFinding(1, "trace_id", "api_key", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, trace0).
			WithSignals(true, false, false, "uuid_not_credential").
			WithFormatInvalid(""), // a UUID is not an API key

	}
	ng := g.Fork()
	fn := func(w io.Writer) error {
		// line 1 carries the planted order0/trace0 so finding lines match.
		fmt.Fprintf(w, "[2026-06-22T10:00:00Z] INFO orders order_id=%s trace_id=%s status=shipped\n", order0, trace0)
		total := Scaled(lines)
		for i := 1; i < total; i++ {
			fmt.Fprintf(w, "[2026-06-22T10:%02d:%02dZ] INFO orders order_id=%s trace_id=%s status=%s\n",
				i%60, (i*7)%60, ng.OrderID16(), ng.UUID(), ng.Pick([]string{"shipped", "pending", "refunded", "delivered"}))
		}
		return nil
	}
	return fn, finds
}

// SemanticIdExport is an FP target placed in an analytics export: a grab-bag of
// shapes that collide with secret/PII regexes but are semantically harmless — a
// phone in SSN shape, a 19-digit epoch in card shape, a git commit SHA, and a
// dictionary-word token.
func SemanticIdExport(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.add("# analytics_identifiers.export — internal ids only")
	phone := g.PhoneAsSSN()
	// A phone in SSN shape is not a PII identifier of that type → format mismatch.
	b.secSigMod("phone_ssn_shape: "+phone, "support_phone", "pii", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, phone,
		true, false, false, "phone_not_ssn",
		func(f fsbuilder.Finding) fsbuilder.Finding { return f.WithFormatInvalid("") })
	epoch := g.EpochNanos()
	b.secSig("event_ts_nanos: "+epoch, "event_ts", "credit_card", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, epoch,
		false, false, false, "numeric_id_not_card")
	sha := g.GitCommitSHA()
	b.secSigMod("build_commit: "+sha, "git_commit", "api_key", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, sha,
		true, false, false, "git_sha_not_secret",
		func(f fsbuilder.Finding) fsbuilder.Finding { return f.WithCommitSha("") })
	tok := g.DictionaryToken()
	// Dictionary-word token is low-entropy — not a real high-entropy credential.
	b.secSigMod("feature_label: "+tok, "feature_label", "api_key", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, tok,
		true, false, false, "dictionary_words_low_entropy",
		func(f fsbuilder.Finding) fsbuilder.Finding { return f.WithFormatInvalid("") })
	return b.done()
}

// ===========================================================================
// Family 3 — public-by-design (meant to be public, never a secret)
// ===========================================================================

// PublicConfig is an FP target placed in a PRODUCTION config: values that look
// secret-ish but are intentionally public — a Stripe publishable key, the AWS
// account id, and the public API URL.
func PublicConfig(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.add("# public client configuration — safe to ship to the browser")
	pk := g.PublishableKey()
	b.secSig("STRIPE_PUBLISHABLE_KEY: "+pk, "STRIPE_PUBLISHABLE_KEY", "api_key", fsbuilder.LabelPublicNonSec, "", fsbuilder.ValUnsupported, pk,
		true, false, true, "publishable_key_public")
	acct := g.AWSAccountID()
	b.secSig("AWS_ACCOUNT_ID: "+acct, "AWS_ACCOUNT_ID", "cloud_key", fsbuilder.LabelPublicNonSec, "", fsbuilder.ValUnsupported, acct,
		true, false, true, "account_id_public")
	url := g.PublicAPIURL()
	b.secSig("PUBLIC_API_URL: "+url, "PUBLIC_API_URL", "url", fsbuilder.LabelPublicNonSec, "", fsbuilder.ValUnsupported, url,
		true, false, true, "public_identifier")
	return b.done()
}

// ===========================================================================
// Family 4 — known test / example values (well-known, intentionally inert)
// ===========================================================================

// ExampleKeysDoc is an FP target: well-known test/example tokens — AWS's docs
// example key, a Stripe test key, the 4242 test card, an example.com email, and
// a 555-01xx phone. Identical shape to the real thing, but globally known-inert.
func ExampleKeysDoc(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.add("# Integration guide — sample credentials (do not use in production)")
	ex := g.ExampleAWSKey()
	b.secSig("aws_access_key_id = "+ex, "aws_access_key_id", "cloud_key", fsbuilder.LabelTestValue, "", fsbuilder.ValUnsupported, ex,
		true, true, false, "known_example_key")
	st := g.StripeTest()
	b.secSig("stripe_secret_key = "+st, "stripe_secret_key", "payment_secret", fsbuilder.LabelTestValue, "", fsbuilder.ValUnsupported, st,
		true, true, false, "test_mode_key")
	card := g.TestCard()
	b.secSig("test_card = "+card, "test_card", "credit_card", fsbuilder.LabelTestValue, "", fsbuilder.ValUnsupported, card,
		true, true, false, "known_test_card")
	email := g.ReservedExampleEmail()
	b.secSig("support_email = "+email, "support_email", "email", fsbuilder.LabelDocExample, "", fsbuilder.ValUnsupported, email,
		true, true, false, "reserved_example_domain")
	phone := g.ReservedPhone()
	b.secSig("support_phone = "+phone, "support_phone", "pii", fsbuilder.LabelDocExample, "", fsbuilder.ValUnsupported, phone,
		true, true, false, "reserved_example_phone")
	return b.done()
}

// ===========================================================================
// Family 5 — already redacted / encrypted (no live secret present)
// ===========================================================================

// RedactedConfig is an FP target: a config where the secrets have already been
// masked or are stored as sealed ciphertext — high-entropy, secret-shaped, but
// nothing usable is exposed.
func RedactedConfig(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.add("# values are redacted at export / sealed by the secrets controller")
	masked := "sk_live_****************"
	b.secSigMod("STRIPE_SECRET_KEY: "+masked, "STRIPE_SECRET_KEY", "payment_secret", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, masked,
		true, false, false, "already_redacted",
		func(f fsbuilder.Finding) fsbuilder.Finding { return f.WithAlreadyMasked("") })
	sealed := "ENC[" + g.B64(120) + "]"
	b.secSigMod("DB_PASSWORD: "+sealed, "DB_PASSWORD", "database_password", fsbuilder.LabelFalsePositive, "", fsbuilder.ValUnsupported, sealed,
		true, false, false, "sealed_ciphertext",
		func(f fsbuilder.Finding) fsbuilder.Finding { return f.WithAlreadyMasked("") })
	return b.done()
}

// ===========================================================================
// Regex-evading TRUE positives — real secrets shape-based regex misses.
// ===========================================================================

// GenericSecretEnv is a TP target placed in a PRODUCTION config: a real,
// high-entropy secret with NO vendor prefix hidden under a benign variable name,
// plus a genuinely live key whose random body happens to contain the substring
// "test" (which naive word-exclusion would wrongly suppress).
func GenericSecretEnv(g *secrets.Gen) (string, []fsbuilder.Finding) {
	b := &lineBuf{}
	b.add("# service runtime config")
	b.add("LOG_LEVEL: info")
	blob := g.GenericHighEntropySecret()
	b.secSig("DATA_BLOB: "+blob, "DATA_BLOB", "api_key", fsbuilder.LabelTrueSecret, "generic-high-entropy-secret", fsbuilder.ValActive, blob,
		true, false, false, "high_entropy_no_prefix_benign_varname")
	live := g.AlnumContaining(40, "test")
	b.secSig("session_signing_key: "+live, "session_signing_key", "api_key", fsbuilder.LabelTrueSecret, "generic-high-entropy-secret", fsbuilder.ValActive, live,
		true, false, false, "live_despite_test_substring")
	return b.done()
}

// SplitConcatSecret is a TP target: a real AWS secret assembled by concatenating
// two string fragments across lines, so a single-line regex never sees the whole
// value — but the secret is fully live at runtime.
func SplitConcatSecret(g *secrets.Gen) (string, []fsbuilder.Finding) {
	full := g.AWSSecret()
	half := len(full) / 2
	b := &lineBuf{}
	b.add("// credentials assembled at runtime to dodge naive scanners")
	b.secSig(fmt.Sprintf("const part1 = %q +", full[:half]), "aws_secret", "cloud_key", fsbuilder.LabelTrueSecret, "aws-secret-access-key", fsbuilder.ValActive, full,
		true, false, false, "split_concatenated_secret")
	b.add(fmt.Sprintf("              %q;", full[half:]))
	return b.done()
}

// EncodedSecret is a TP target: a real secret base64-wrapped inside a config
// value, so the raw key shape is hidden from regex but trivially decoded at use.
func EncodedSecret(g *secrets.Gen) (string, []fsbuilder.Finding) {
	raw := g.StripeLive()
	enc := base64.StdEncoding.EncodeToString([]byte(raw))
	b := &lineBuf{}
	b.add("# payment gateway config")
	b.secSig("GATEWAY_TOKEN_B64: "+enc, "GATEWAY_TOKEN_B64", "payment_secret", fsbuilder.LabelTrueSecret, "stripe-live-key", fsbuilder.ValActive, raw,
		true, false, false, "base64_encoded_secret")
	return b.done()
}
