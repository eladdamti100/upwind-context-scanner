// Package secrets provides deterministic, high-entropy generators for the
// credential shapes a secret-scanner is expected to detect (AWS keys, Stripe
// keys, GitHub PATs, Slack webhooks, JWTs, PEM blocks) plus the benign-but-
// noisy shapes that trigger false positives (Luhn-valid test cards, UUIDs,
// placeholder PII).
//
// Every draw flows through a single seeded *math/rand.Rand so a given seed
// reproduces a byte-for-byte identical corpus. Each of the four customer
// agents receives its own *Gen with a distinct seed, which keeps the agents
// independent while remaining fully deterministic across runs.
//
// SECURITY NOTE: nothing here is a real credential. Bodies are random
// characters wearing the correct prefix/checksum so a scanner's regex fires;
// none authenticate against any real service. This corpus exists solely to
// exercise Upwind's Cloud Scanner.
package secrets

import (
	"fmt"
	"math/rand"
	"strings"
)

// Charsets shared by the generators.
const (
	MixedAlnum  = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	UpperAlnum  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	LowerAlnum  = "abcdefghijklmnopqrstuvwxyz0123456789"
	Base64Std   = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	Base64URL   = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
	HexLower    = "0123456789abcdef"
	HexUpper    = "0123456789ABCDEF"
	DigitsCharset = "0123456789"
)

// Gen is a deterministic generator bound to one seeded RNG.
type Gen struct {
	rng  *rand.Rand
	Seed int64
}

// New returns a generator seeded with the given value.
func New(seed int64) *Gen {
	return &Gen{rng: rand.New(rand.NewSource(seed)), Seed: seed}
}

// Fork returns an independent generator deterministically seeded from g. It is
// used for STREAMED files whose bodies are generated lazily at deploy time: the
// fork is created (and its seed drawn from g) at Build time, so a streamed
// file's output is stable regardless of the order Deploy flushes files in,
// without coupling to the shared sequence the eager files consume.
func (g *Gen) Fork() *Gen { return New(g.rng.Int63()) }

// ---------------------------------------------------------------------------
// Low-level primitives
// ---------------------------------------------------------------------------

// Intn returns a deterministic pseudo-random int in [0,n).
func (g *Gen) Intn(n int) int {
	if n <= 0 {
		return 0
	}
	return g.rng.Intn(n)
}

// IntRange returns a deterministic int in [lo,hi].
func (g *Gen) IntRange(lo, hi int) int {
	if hi <= lo {
		return lo
	}
	return lo + g.rng.Intn(hi-lo+1)
}

// Bool returns a deterministic coin flip.
func (g *Gen) Bool() bool { return g.rng.Intn(2) == 0 }

// Str builds a random string of length n from charset.
func (g *Gen) Str(charset string, n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = charset[g.rng.Intn(len(charset))]
	}
	return string(b)
}

func (g *Gen) Alnum(n int) string  { return g.Str(MixedAlnum, n) }

// AlnumContaining returns a random n-char alnum string with sub spliced in at a
// deterministic offset. Used to plant the "demo-substring paradox": a genuinely
// live key whose randomized body literally contains an exclusion word like
// "demo" or "test", proving word-exclusion filters miss real leaks. n must be
// >= len(sub).
func (g *Gen) AlnumContaining(n int, sub string) string {
	if n <= len(sub) {
		return sub
	}
	body := []byte(g.Alnum(n - len(sub)))
	at := g.Intn(len(body) + 1)
	return string(body[:at]) + sub + string(body[at:])
}

func (g *Gen) Upper(n int) string  { return g.Str(UpperAlnum, n) }
func (g *Gen) Lower(n int) string  { return g.Str(LowerAlnum, n) }
func (g *Gen) Hex(n int) string    { return g.Str(HexLower, n) }
func (g *Gen) Digits(n int) string { return g.Str(DigitsCharset, n) }
func (g *Gen) B64(n int) string    { return g.Str(Base64Std, n) }

// Pick returns a deterministic element of xs.
func (g *Gen) Pick(xs []string) string { return xs[g.rng.Intn(len(xs))] }

// ---------------------------------------------------------------------------
// TRUE-POSITIVE credential generators — correct prefix + high-entropy body.
// These are the shapes that SHOULD trip a scanner.
// ---------------------------------------------------------------------------

// AWSKeyID returns an AKIA-prefixed 20-char access key id.
func (g *Gen) AWSKeyID() string { return "AKIA" + g.Upper(16) }

// AWSTempKeyID returns an ASIA-prefixed temporary access key id.
func (g *Gen) AWSTempKeyID() string { return "ASIA" + g.Upper(16) }

// AWSSecret returns a 40-char base64-ish secret access key.
func (g *Gen) AWSSecret() string { return g.Str(Base64Std, 40) }

// StripeLive returns a sk_live_ key (a real production-shaped Stripe secret).
func (g *Gen) StripeLive() string { return "sk_live_" + g.Alnum(24) }

// StripeRestricted returns an rk_live_ restricted Stripe key.
func (g *Gen) StripeRestricted() string { return "rk_live_" + g.Alnum(24) }

// StripeTest returns a sk_test_ key — math-shaped like a real key but inert.
func (g *Gen) StripeTest() string { return "sk_test_" + g.Alnum(24) }

// GitHubPAT returns a fine-grained github_pat_ token.
func (g *Gen) GitHubPAT() string {
	return "github_pat_" + g.Str(MixedAlnum, 22) + "_" + g.Str(MixedAlnum, 59)
}

// GitHubClassic returns a classic ghp_ personal access token.
func (g *Gen) GitHubClassic() string { return "ghp_" + g.Alnum(36) }

// GitHubOAuth returns a gho_ OAuth access token.
func (g *Gen) GitHubOAuth() string { return "gho_" + g.Alnum(36) }

// OpenAIKey returns a sk-proj- OpenAI project key.
func (g *Gen) OpenAIKey() string { return "sk-proj-" + g.Alnum(48) }

// AnthropicKey returns an sk-ant-api03- Anthropic key.
func (g *Gen) AnthropicKey() string { return "sk-ant-api03-" + g.Str(Base64URL, 93) + "AA" }

// DatadogAPIKey returns a 32-char hex Datadog API key.
func (g *Gen) DatadogAPIKey() string { return g.Hex(32) }

// DatadogAppKey returns a 40-char hex Datadog application key.
func (g *Gen) DatadogAppKey() string { return g.Hex(40) }

// GCPKey returns a Google API key (AIza-prefixed, 39 chars total).
func (g *Gen) GCPKey() string { return "AIza" + g.Str(Base64URL, 35) }

// SendGridKey returns an SG. SendGrid API key.
func (g *Gen) SendGridKey() string {
	return "SG." + g.Str(Base64URL, 22) + "." + g.Str(Base64URL, 43)
}

// TwilioKey returns an SK-prefixed Twilio API key (32 hex after prefix).
func (g *Gen) TwilioKey() string { return "SK" + g.Hex(32) }

// SlackWebhook returns a hooks.slack.com webhook URL.
func (g *Gen) SlackWebhook() string {
	return "https://hooks.slack.com/services/T" + g.Upper(8) +
		"/B" + g.Upper(8) + "/" + g.Alnum(24)
}

// SlackBotToken returns an xoxb- Slack bot token.
func (g *Gen) SlackBotToken() string {
	return fmt.Sprintf("xoxb-%s-%s-%s", g.Digits(12), g.Digits(13), g.Alnum(24))
}

// JWT returns a structurally valid (HS256) JWT with a random payload+signature.
func (g *Gen) JWT() string {
	header := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" // {"alg":"HS256","typ":"JWT"}
	return header + "." + g.Str(Base64URL, 96) + "." + g.Str(Base64URL, 43)
}

// PEM returns a multi-line PEM block (e.g. an SSH/RSA private key body).
func (g *Gen) PEM(label string, lines int) string {
	var sb strings.Builder
	sb.WriteString("-----BEGIN " + label + "-----\n")
	for i := 0; i < lines; i++ {
		sb.WriteString(g.Str(Base64Std, 64) + "\n")
	}
	sb.WriteString(g.Str(Base64Std, 40) + "=\n")
	sb.WriteString("-----END " + label + "-----\n")
	return sb.String()
}

// PostgresURL returns a postgres:// connection string with an embedded password.
func (g *Gen) PostgresURL(user, host, db string) string {
	return fmt.Sprintf("postgres://%s:%s@%s:5432/%s?sslmode=require", user, g.Alnum(20), host, db)
}

// MongoURL returns a mongodb+srv:// connection string with credentials.
func (g *Gen) MongoURL(user, host string) string {
	return fmt.Sprintf("mongodb+srv://%s:%s@%s/prod?retryWrites=true&w=majority", user, g.Alnum(18), host)
}

// RedisURL returns a redis:// connection string with an auth password.
func (g *Gen) RedisURL(host string) string {
	return fmt.Sprintf("redis://:%s@%s:6379/0", g.Alnum(24), host)
}

// NpmToken returns an npm_ automation/registry auth token (npm_ + 36 alnum).
func (g *Gen) NpmToken() string { return "npm_" + g.Alnum(36) }

// RailsMasterKey returns a Rails master.key value — 32 lowercase-hex chars that
// decrypt config/credentials.yml.enc.
func (g *Gen) RailsMasterKey() string { return g.Hex(32) }

// FernetKey returns an Airflow/cryptography Fernet key: 44-char url-safe base64
// ending in '=' (32 raw bytes encoded).
func (g *Gen) FernetKey() string { return g.Str(Base64URL, 43) + "=" }

// AdyenKey returns an Adyen live API key (AQE + base64-ish body), a common
// fintech payment credential alongside Stripe.
func (g *Gen) AdyenKey() string { return "AQE" + g.Str(Base64Std, 80) }

// AirflowConnURI returns an Airflow Connection URI with an embedded password —
// the shape that leaks when a task logs its conn object in a stack trace.
func (g *Gen) AirflowConnURI(scheme, user, host, db string) string {
	return fmt.Sprintf("%s://%s:%s@%s:5432/%s", scheme, user, g.Alnum(20), host, db)
}

// SnowflakePassword returns a high-entropy Snowflake account password.
func (g *Gen) SnowflakePassword() string { return g.Alnum(28) }

// DjangoSecretKey returns a Django SECRET_KEY (50-char high-entropy body with
// the punctuation Django's startproject emits).
func (g *Gen) DjangoSecretKey() string {
	return "django-insecure-" + g.Str(MixedAlnum+"!@#$%^&*(-_=+)", 50)
}

// ---------------------------------------------------------------------------
// FALSE-POSITIVE / noise generators — benign shapes that LOOK like secrets.
// ---------------------------------------------------------------------------

// LuhnComplete appends the correct Luhn check digit to a numeric payload.
func LuhnComplete(payload string) string {
	sum, double := 0, true
	for i := len(payload) - 1; i >= 0; i-- {
		d := int(payload[i] - '0')
		if double {
			if d *= 2; d > 9 {
				d -= 9
			}
		}
		sum += d
		double = !double
	}
	return payload + fmt.Sprintf("%d", (10-(sum%10))%10)
}

// LuhnCard returns a Luhn-valid 16-digit Visa-shaped PAN (math-valid, not issued).
func (g *Gen) LuhnCard() string { return LuhnComplete("4" + g.Digits(14)) }

// TestCard returns a well-known math-valid test PAN (Stripe's 4242 series).
func (g *Gen) TestCard() string { return "4242424242424242" }

// TxnID returns a 16-digit transaction id — collides with card-shaped regexes.
func (g *Gen) TxnID() string { return g.Digits(16) }

// UUID returns a v4-shaped UUID — frequently mistaken for an opaque token.
func (g *Gen) UUID() string {
	return fmt.Sprintf("%s-%s-4%s-%s%s-%s",
		g.Hex(8), g.Hex(4), g.Hex(3),
		g.Pick([]string{"8", "9", "a", "b"}), g.Hex(3), g.Hex(12))
}

// PlaceholderSSN returns the canonical all-zero placeholder SSN.
func PlaceholderSSN() string { return "000-00-0000" }

// RandSSN returns a random ###-##-#### value (synthetic).
func (g *Gen) RandSSN() string {
	return g.Digits(3) + "-" + g.Digits(2) + "-" + g.Digits(4)
}

// FakeSecretLikeUUID returns a 32-hex string formatted to resemble an API key
// even though it is just an entropy-free identifier.
func (g *Gen) FakeSecretLikeUUID() string { return g.Hex(32) }

// IPv4 returns a random dotted-quad address.
func (g *Gen) IPv4() string {
	return fmt.Sprintf("%d.%d.%d.%d", g.Intn(255), g.Intn(255), g.Intn(255), g.Intn(255))
}

// IPv6 returns a fully expanded IPv6 address.
func (g *Gen) IPv6() string {
	parts := make([]string, 8)
	for i := range parts {
		parts[i] = g.Hex(4)
	}
	return strings.Join(parts, ":")
}

// MAC returns a colon-separated MAC address.
func (g *Gen) MAC() string {
	parts := make([]string, 6)
	for i := range parts {
		parts[i] = g.Hex(2)
	}
	return strings.Join(parts, ":")
}

// SHA256Hex returns a 64-char hex digest (lockfile / git-object noise).
func (g *Gen) SHA256Hex() string { return g.Hex(64) }
