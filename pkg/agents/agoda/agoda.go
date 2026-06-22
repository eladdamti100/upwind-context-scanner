// Package agoda builds a hyper-realistic, enterprise-scale simulated filesystem
// for Agoda (travel / big-data / fintech / PCI-DSS) as synthetic test data for
// a secret-scanner. The corpus is ~95% CLEAN by design: its job is ALERT
// FATIGUE — a firehose of card-shaped 16-digit booking-reference ids drowning a
// handful of genuinely real-shaped leaks so a side-by-side scorecard can prove
// Phase-2 precision against the legacy regex engine.
//
// Physical tree (7–10 levels deep) materialized under customer-data/agoda/:
//
//	srv/secure/v2/config/prod.env        (TP: AWS key + Postgres admin URL + OpenAI key)
//	srv/secure/v2/keys/id_rsa            (TP: line-wrapped OpenSSH private key)
//	root/.aws/credentials                (TP: AWS credentials block)
//	var/log/nginx/prod-traffic/access-0[1-5].log
//	                                     (4,000+ lines each; access-05 line 2,345
//	                                      leaks a live Stripe key; the other four
//	                                      stay clean)
//	src/api/v2/{controllers,models,services,pricing,search}/
//	                                     (50+ clean C#/.NET + Go files, 500+ lines)
//
// Exactly FOUR files carry real-shaped production secrets (the True Positives).
//
// NOTHING here is a real credential. Every "secret" is a random body wearing the
// correct prefix/checksum so a scanner's regex fires; none authenticate against
// any real service. The corpus exists solely to exercise Upwind's Cloud Scanner.
package agoda

import (
	"fmt"
	"io"
	"strings"

	"upwind-context-scanner/pkg/content"
	"upwind-context-scanner/pkg/fsbuilder"
	"upwind-context-scanner/pkg/secrets"
)

// stripePlantLine is the 0-based index whose 1-based line number is 2,345 —
// the single line in access-05.log that leaks a live Stripe key.
const stripePlantLine = 2344

// Build assembles Agoda's complete simulated workspace.
func Build(g *secrets.Gen) *fsbuilder.Workspace {
	ws := fsbuilder.NewWorkspace("agoda", "travel-fintech")

	addBackendSource(ws, g)    // 50+ clean C#/.NET + Go files (+ TP: PaymentsController hotfix)
	addProxyLogs(ws, g)        // 5 nginx logs; TP buried in access-05
	addSecureConfig(ws, g)     // TP — prod.env secret matrix
	addAwsDotfile(ws, g)       // TP — ~/.aws/credentials
	addSshKey(ws, g)           // TP — keys/id_rsa
	addNoise(ws, g)            // benign FP storms + clean infra padding
	addFintechRealism(ws, g)   // .NET appsettings, SQL pg_dump, JSON app logs, envoy

	return ws
}

// ---------------------------------------------------------------------------
// Backend enterprise source — 50+ clean files, 500+ lines each, no secrets.
// Spread across the spec's src/api/v2/{controllers,models,services,pricing,search}.
// ---------------------------------------------------------------------------

func addBackendSource(ws *fsbuilder.Workspace, g *secrets.Gen) {
	const minLines = 510 // comfortably above the 500-line floor

	base := "src/api/v2"

	// C#/.NET layers (controllers, models, services) — 12 files each.
	csharp := map[string][]string{
		"controllers": {
			"BookingsController", "PaymentsController", "RefundsController", "AuthorizationController",
			"LedgerController", "PropertiesController", "RatesController", "AvailabilityController",
			"GuestsController", "ReviewsController", "QuotesController", "WebhooksController",
		},
		"models": {
			"BookingAggregate", "PaymentIntent", "RefundRecord", "AuthorizationPolicy",
			"LedgerEntry", "PropertyListing", "RatePlan", "AvailabilityWindow",
			"GuestProfile", "ReviewSummary", "QuoteSnapshot", "MoneyValueObject",
		},
		"services": {
			"TokenizationService", "SettlementService", "FraudScoringService", "VelocityService",
			"ChargebackService", "ReconciliationService", "CurrencyService", "TaxService",
			"NotificationService", "AuditService", "PricingService", "InventoryService",
		},
	}
	// CleanCSharp doesn't draw from g, so the map-iteration order is harmless for
	// determinism — except PaymentsController, which we replace with the hotfix
	// trap below, so skip it in the clean pass.
	for dir, names := range csharp {
		for _, n := range names {
			if n == "PaymentsController" {
				continue
			}
			ws.Add(base+"/"+dir, fsbuilder.File(
				n+".cs", "text/x-csharp", "deploy", "0644",
				content.CleanCSharp(g, minLines), fsbuilder.Clean()))
		}
	}

	// TP: a "HOTFIX" code comment in PaymentsController.cs pins a live Stripe key
	// to bypass 3DS during an incident replay. The key's randomized body even
	// contains the substring "demo" — proving word-exclusion filters miss it.
	ws.Add(base+"/controllers", fsbuilder.File(
		"PaymentsController.cs", "text/x-csharp", "deploy", "0644",
		paymentsControllerHotfix(g, minLines),
		fsbuilder.TP("hotfix-bypass-comment-prod-key", "stripe-live-key")))

	// Go services (pricing, search) — 8 files each, plus a go.sum lockfile per
	// package (every line is a high-entropy hash → generic-key FP noise). Iterate
	// a fixed order: GoSum/Fork draw from g, so map order would break determinism.
	type goPkg struct {
		dir   string
		files []string
	}
	golang := []goPkg{
		{"pricing", []string{"quote", "rateplan", "surge", "currency", "tax", "ledger", "rounding", "fx"}},
		{"search", []string{"index", "query", "rank", "facet", "geo", "suggest", "filter", "paginate"}},
	}
	for _, pkg := range golang {
		for _, n := range pkg.files {
			ws.Add(base+"/"+pkg.dir, fsbuilder.File(
				n+".go", "text/x-go", "deploy", "0644",
				content.CleanGo(g, minLines), fsbuilder.Clean()))
		}
		sumG := g.Fork()
		ws.Add(base+"/"+pkg.dir, fsbuilder.StreamFile(
			"go.sum", "text/plain", "deploy", "0644",
			func(w io.Writer) error { return content.StreamGoSum(w, sumG, 1100) }, fsbuilder.Clean()))
		ws.Add(base+"/"+pkg.dir, fsbuilder.File(
			"README.md", "text/markdown", "deploy", "0644",
			content.ReadmeMd(g, "agoda-"+pkg.dir), fsbuilder.Clean()))
	}

	// A clean solution-level README + Dockerfile for depth.
	ws.Add(base, fsbuilder.File("README.md", "text/markdown", "deploy", "0644",
		content.ReadmeMd(g, "agoda-booking-api-v2"), fsbuilder.Clean()))
	ws.Add(base, fsbuilder.File("Dockerfile", "text/plain", "deploy", "0644",
		content.Dockerfile(g, "mcr.microsoft.com/dotnet/aspnet:8.0"), fsbuilder.Clean()))
}

// ---------------------------------------------------------------------------
// Proxy logs — the card-storm. Five 4,000+ line nginx access logs; every line
// carries a 16-digit Luhn-valid booking reference (txn_id=5322…) that legacy
// PAN matchers mistake for a Visa/Mastercard card. Four logs are spotless; only
// access-05.log leaks — a single Stripe live key on exactly line 2,345.
// ---------------------------------------------------------------------------

func addProxyLogs(ws *fsbuilder.Workspace, g *secrets.Gen) {
	const minLines = 4200 // > 4,000-line floor
	dir := "var/log/nginx/prod-traffic"

	for i := 1; i <= 5; i++ {
		plantAt, plant := -1, ""
		gt := fsbuilder.FPNoise("card-shaped-booking-ref-storm")
		if i == 5 {
			plantAt = stripePlantLine
			plant = g.StripeLive()
			gt = fsbuilder.TP("stripe-key-leaked-in-stacktrace-log", "stripe-live-key")
		}
		// Stream each multi-MB log straight to disk via a forked generator.
		logG := g.Fork()
		ws.Add(dir, fsbuilder.StreamFile(
			fmt.Sprintf("access-%02d.log", i), "text/plain", "www-data", "0644",
			func(w io.Writer) error { return streamNginxAccessLog(w, logG, minLines, plantAt, plant) }, gt))
	}
}

// nginxAccessLog renders an nginx access log of exactly minLines lines. Every
// line embeds a 16-digit Luhn-valid booking reference and a UUID request id.
// When plantLine >= 0, that line becomes a rare application-error/stack-trace
// dump that leaks the Stripe key in `plant` (while still carrying a txn_id, so
// the "every line has a booking ref" invariant holds).
// streamNginxAccessLog writes Scaled(minLines) lines straight to w. Every line
// embeds a 16-digit Luhn-valid booking reference and a UUID request id. When
// plantLine >= 0 (interpreted in unscaled index space), that line becomes a rare
// application-error/stack-trace dump that leaks the Stripe key in `plant`.
func streamNginxAccessLog(w io.Writer, g *secrets.Gen, minLines, plantLine int, plant string) error {
	methods := []string{"GET", "POST", "PUT", "DELETE", "PATCH"}
	routes := []string{
		"/v2/bookings", "/v2/properties", "/v2/payments", "/v2/refunds",
		"/v2/quotes", "/v2/availability", "/assets/app.js", "/healthz", "/metrics", "/api/kyc",
	}
	uas := []string{
		"Mozilla/5.0 (X11; Linux x86_64)", "okhttp/4.12", "curl/8.4.0",
		"Go-http-client/2.0", "python-requests/2.31", "agoda-mobile/9.7.2 (iOS)",
	}
	codes := []string{"200", "201", "204", "301", "400", "401", "404", "429", "500", "502"}

	lines := content.Scaled(minLines)
	for i := 0; i < lines; i++ {
		ip := g.IPv4()
		ts := fmt.Sprintf("%02d/Jun/2026:%02d:%02d:%02d +0000", 1+(i%28), i%24, i%60, (i*7)%60)
		txn := bookingRef(g)
		req := g.UUID()

		if i == plantLine && plant != "" {
			// Rare unhandled-exception line dumped into the access log: a Stripe
			// SDK error echoes the live key it was initialized with.
			fmt.Fprintf(w,
				"%s - - [%s] \"POST /v2/payments HTTP/1.1\" 500 0 txn_id=%s req_id=%s "+
					"error=\"StripeException at Agoda.Payment.Gateway.Charge(): "+
					"authentication failed initializing client with sk_live key %s; "+
					"see stacktrace agoda.payment.gateway:512\" \"%s\"\n",
				ip, ts, txn, req, plant, g.Pick(uas))
			continue
		}

		fmt.Fprintf(w,
			"%s - - [%s] \"%s %s HTTP/1.1\" %s %d txn_id=%s req_id=%s \"%s\"\n",
			ip, ts, g.Pick(methods), g.Pick(routes), g.Pick(codes),
			g.Intn(9000)+100, txn, req, g.Pick(uas))
	}
	return nil
}

// bookingRef returns a 16-digit Luhn-valid booking reference with a Mastercard-
// like "5322" BIN — engineered to trip legacy card/PAN regexes and Luhn checks.
func bookingRef(g *secrets.Gen) string {
	return secrets.LuhnComplete("5322" + g.Digits(11))
}

// ---------------------------------------------------------------------------
// TP #2 — srv/secure/v2/config/prod.env: a dense 150+ line production env file
// burying a real AWS key pair, a Postgres prod URL with embedded admin creds,
// and an OpenAI project key amid mountains of benign configuration.
// ---------------------------------------------------------------------------

func addSecureConfig(ws *fsbuilder.Workspace, g *secrets.Gen) {
	awsID := g.AWSKeyID()
	awsSecret := g.AWSSecret()
	pgURL := g.PostgresURL("admin", "booking-prod.cluster-czk.ap-southeast-1.rds.amazonaws.com", "bookings_prod")
	openAI := g.OpenAIKey()

	lines := []string{
		"# ====================================================================",
		"# Agoda Booking Engine — PRODUCTION environment (v2)",
		"# Synced from Vault by the platform-eng rotation job. DO NOT EDIT BY HAND.",
		"# ====================================================================",
		"SERVICE_NAME=booking-engine",
		"DEPLOY_ENV=production",
		"REGION=ap-southeast-1",
		"LOG_LEVEL=info",
		"LOG_FORMAT=json",
		"HTTP_BIND=0.0.0.0",
		"HTTP_PORT=8443",
		"GRPC_PORT=9443",
		"REQUEST_TIMEOUT_MS=3000",
		"MAX_INFLIGHT_REQUESTS=4096",
		"GRACEFUL_SHUTDOWN_SEC=30",
		"METRICS_PATH=/metrics",
		"TRACING_ENABLED=true",
		"TRACING_SAMPLE_RATE=0.05",
		"OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.observability:4317",
		"",
		"# --- Service discovery / upstreams ---------------------------------",
		"PRICING_UPSTREAM=pricing.svc.cluster.local:9443",
		"SEARCH_UPSTREAM=search.svc.cluster.local:9443",
		"FRAUD_UPSTREAM=fraud.svc.cluster.local:9443",
		"INVENTORY_UPSTREAM=inventory.svc.cluster.local:9443",
		"REDIS_HOST=booking-cache.prod.cache.amazonaws.com",
		"REDIS_PORT=6379",
		"REDIS_TLS=true",
		"KAFKA_BROKERS=b-1.prod.kafka.ap-southeast-1.amazonaws.com:9094,b-2.prod.kafka.ap-southeast-1.amazonaws.com:9094",
		"KAFKA_TOPIC_BOOKINGS=prod.bookings.v2",
		"KAFKA_TOPIC_PAYMENTS=prod.payments.v2",
		"",
		"# --- Datastore -----------------------------------------------------",
		"DB_POOL_MIN=8",
		"DB_POOL_MAX=64",
		"DB_STATEMENT_TIMEOUT_MS=5000",
		"DB_SSL_MODE=require",
		"# Primary writer connection string (rotated weekly):",
		"DATABASE_URL=" + pgURL,
		"DATABASE_READONLY_URL=postgres://reader:${DB_READER_PASSWORD}@booking-prod-ro.cluster-czk.ap-southeast-1.rds.amazonaws.com:5432/bookings_prod?sslmode=require",
		"",
		"# --- Object storage / AWS ------------------------------------------",
		"S3_BUCKET_RECEIPTS=agoda-prod-receipts-apse1",
		"S3_BUCKET_EXPORTS=agoda-prod-exports-apse1",
		"AWS_REGION=ap-southeast-1",
		"AWS_ACCESS_KEY_ID=" + awsID,
		"AWS_SECRET_ACCESS_KEY=" + awsSecret,
		"AWS_S3_FORCE_PATH_STYLE=false",
		"",
		"# --- Third-party integrations --------------------------------------",
		"STRIPE_API_KEY=${STRIPE_API_KEY}",
		"STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}",
		"# Internal LLM itinerary-summarizer (project-scoped):",
		"OPENAI_API_KEY=" + openAI,
		"OPENAI_ORG=org-agoda-data-platform",
		"OPENAI_MODEL=gpt-4o-mini",
		"SENDGRID_API_KEY=${SENDGRID_API_KEY}",
		"TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}",
		"",
		"# --- Feature flags / tunables --------------------------------------",
	}

	// Pad with deterministic benign feature flags + tunables until >= 150 lines.
	flagNames := []string{
		"NEW_CHECKOUT_FLOW", "ASYNC_REFUNDS", "GEO_RANKING_V3", "SURGE_PRICING",
		"LOYALTY_BONUS", "MULTI_CURRENCY_WALLET", "INSTANT_CONFIRMATION", "SMART_RETRY",
		"PROPERTY_BADGES", "REVIEW_SUMMARIES", "PARTIAL_REFUND", "FRAUD_VELOCITY_CHECK",
	}
	for i := 0; len(lines) < 150; i++ {
		switch i % 3 {
		case 0:
			lines = append(lines, fmt.Sprintf("FF_%s_%02d=%t", flagNames[i%len(flagNames)], i, g.Bool()))
		case 1:
			lines = append(lines, fmt.Sprintf("CACHE_TTL_%02d_SEC=%d", i, g.IntRange(30, 3600)))
		default:
			lines = append(lines, fmt.Sprintf("RATE_LIMIT_%02d_RPS=%d", i, g.IntRange(50, 5000)))
		}
	}

	ws.Add("srv/secure/v2/config", fsbuilder.File(
		"prod.env", "text/plain", "root", "0600",
		strings.Join(lines, "\n")+"\n",
		fsbuilder.TP("dense-prod-env-secret-matrix",
			"aws-access-key-id", "aws-secret-key", "db-connection-string", "openai-api-key")))

	// FP companion — a sandbox .env.example with placeholder/test values only.
	example := strings.Join([]string{
		"# Copy to prod.env and fill from Vault. Example values are inert.",
		"SERVICE_NAME=booking-engine",
		"DEPLOY_ENV=development",
		"REGION=ap-southeast-1",
		"DATABASE_URL=postgres://booking:changeme@localhost:5432/bookings_dev?sslmode=disable",
		"AWS_ACCESS_KEY_ID=AKIAEXAMPLEEXAMPLE00",
		"AWS_SECRET_ACCESS_KEY=changeme-not-a-real-secret-key-value-000",
		"STRIPE_API_KEY=" + g.StripeTest(),
		"OPENAI_API_KEY=sk-proj-REPLACE_ME",
		"HTTP_PORT=8080",
		"LOG_LEVEL=debug",
	}, "\n") + "\n"
	ws.Add("srv/secure/v2/config", fsbuilder.File(
		".env.example", "text/plain", "deploy", "0644",
		example, fsbuilder.FPTest("env-example-placeholder-and-test-key")))
}

// ---------------------------------------------------------------------------
// TP #3 — root/.aws/credentials: a real-shaped AWS credentials dotfile.
// ---------------------------------------------------------------------------

func addAwsDotfile(ws *fsbuilder.Workspace, g *secrets.Gen) {
	creds := strings.Join([]string{
		"[default]",
		"aws_access_key_id = " + g.AWSKeyID(),
		"aws_secret_access_key = " + g.AWSSecret(),
		"region = ap-southeast-1",
		"",
		"[prod-deploy]",
		"aws_access_key_id = " + g.AWSKeyID(),
		"aws_secret_access_key = " + g.AWSSecret(),
		"aws_session_token = " + g.B64(120),
		"region = ap-southeast-1",
	}, "\n") + "\n"
	ws.Add("root/.aws", fsbuilder.File(
		"credentials", "text/plain", "root", "0600", creds,
		fsbuilder.TP("aws-credentials-dotfile", "aws-access-key-id", "aws-secret-key")))

	// Clean ~/.aws/config alongside it (no secrets — profiles + regions only).
	cfg := strings.Join([]string{
		"[default]",
		"region = ap-southeast-1",
		"output = json",
		"",
		"[profile prod-deploy]",
		"region = ap-southeast-1",
		"role_arn = arn:aws:iam::480912345678:role/booking-deploy",
		"source_profile = default",
	}, "\n") + "\n"
	ws.Add("root/.aws", fsbuilder.File(
		"config", "text/plain", "root", "0600", cfg, fsbuilder.Clean()))
}

// ---------------------------------------------------------------------------
// TP #4 — srv/secure/v2/keys/id_rsa: a full, line-wrapped OpenSSH private key.
// ---------------------------------------------------------------------------

func addSshKey(ws *fsbuilder.Workspace, g *secrets.Gen) {
	ws.Add("srv/secure/v2/keys", fsbuilder.File(
		"id_rsa", "text/plain", "root", "0600",
		g.PEM("OPENSSH PRIVATE KEY", 26),
		fsbuilder.TP("ssh-private-key-on-disk", "ssh-private-key")))

	// Clean public key alongside it.
	ws.Add("srv/secure/v2/keys", fsbuilder.File(
		"id_rsa.pub", "text/plain", "root", "0644",
		"ssh-ed25519 AAAA"+g.B64(60)+" booking-deploy@agoda.prod\n",
		fsbuilder.Clean()))

	// Clean known_hosts (host fingerprints — benign).
	known := strings.Join([]string{
		"github.com ssh-ed25519 AAAA" + g.B64(60),
		"git.agoda.local ssh-rsa AAAA" + g.B64(120),
	}, "\n") + "\n"
	ws.Add("srv/secure/v2/keys", fsbuilder.File(
		"known_hosts", "text/plain", "root", "0644", known, fsbuilder.Clean()))
}

// ---------------------------------------------------------------------------
// Benign FP storms + clean infra padding to keep the corpus ~95% non-leaking.
// ---------------------------------------------------------------------------

func addNoise(ws *fsbuilder.Workspace, g *secrets.Gen) {
	// PCI transaction dump — Luhn-valid test PANs + 16-digit refs (card-storm FP).
	csvG := g.Fork()
	currencies := []string{"USD", "THB", "SGD", "EUR", "JPY", "GBP", "AUD", "HKD"}
	ws.Add("srv/data/pci/dumps", fsbuilder.StreamFile(
		"transactions.csv", "text/csv", "spark", "0640",
		func(w io.Writer) error {
			return content.StreamCSV(w, "txn_id,timestamp,amount,currency,card_pan,auth_code", 2300, func(i int) string {
				return fmt.Sprintf("%s,2026-06-%02dT%02d:%02d:%02dZ,%d.%02d,%s,%s,%s",
					bookingRef(csvG), 1+(i%28), i%24, i%60, (i*13)%60,
					csvG.Intn(9000)+10, csvG.Intn(100), currencies[i%len(currencies)],
					csvG.LuhnCard(), csvG.Upper(6))
			})
		},
		fsbuilder.FPNoise("luhn-valid-test-pan-storm")))

	// Placeholder-PII config (all-zero SSNs → benign masking defaults).
	piiSite := strings.Join([]string{
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<configuration>`,
		`  <!-- ETL anonymization defaults: placeholder values for masked columns. -->`,
		`  <property><name>etl.pii.default.ssn</name><value>` + secrets.PlaceholderSSN() + `</value></property>`,
		`  <property><name>etl.pii.default.tax_id</name><value>000-00-0000</value></property>`,
		`  <property><name>etl.pii.default.phone</name><value>000-000-0000</value></property>`,
		`  <property><name>etl.pii.mask.char</name><value>X</value></property>`,
		`</configuration>`,
	}, "\n") + "\n"
	ws.Add("srv/data/pci/etl", fsbuilder.File(
		"pii-masking-site.xml", "text/xml", "spark", "0644", piiSite,
		fsbuilder.FPNoise("placeholder-pii")))

	// Clean k8s manifests (env-from-secret references only — no inline secrets).
	for _, svc := range []string{"booking-api", "pricing", "search"} {
		k8s := strings.Join([]string{
			"apiVersion: apps/v1",
			"kind: Deployment",
			"metadata:",
			"  name: " + svc,
			"  namespace: booking",
			"spec:",
			"  replicas: 6",
			"  selector: { matchLabels: { app: " + svc + " } }",
			"  template:",
			"    metadata: { labels: { app: " + svc + " } }",
			"    spec:",
			"      containers:",
			"        - name: " + svc,
			"          image: registry.agoda.local/" + svc + ":latest",
			"          envFrom:",
			"            - secretRef: { name: " + svc + "-secrets }",
			"          ports: [ { containerPort: 8443 } ]",
		}, "\n") + "\n"
		ws.Add("deploy/k8s/"+svc, fsbuilder.File(
			"deployment.yaml", "text/yaml", "deploy", "0644", k8s, fsbuilder.Clean()))
	}

	// Clean nginx vhost that documents the txn_id log field (explains the storm).
	nginxConf := strings.Join([]string{
		"worker_processes auto;",
		"events { worker_connections 8192; }",
		"http {",
		"    log_format prod '$remote_addr - - [$time_local] \"$request\" '",
		"                    '$status $body_bytes_sent txn_id=$arg_txn req_id=$request_id \"$http_user_agent\"';",
		"    access_log /var/log/nginx/prod-traffic/access.log prod;",
		"    upstream booking { server booking-api:8443; }",
		"    server {",
		"        listen 443 ssl http2;",
		"        server_name api.agoda.com;",
		"        location /v2/ { proxy_pass https://booking; }",
		"        location /healthz { return 200; }",
		"    }",
		"}",
	}, "\n") + "\n"
	ws.Add("etc/nginx", fsbuilder.File(
		"nginx.conf", "text/plain", "www-data", "0644", nginxConf, fsbuilder.Clean()))

	// Top-level repo README.
	ws.Add("", fsbuilder.File("README.md", "text/markdown", "deploy", "0644",
		content.ReadmeMd(g, "agoda-booking-platform"), fsbuilder.Clean()))
}

// ---------------------------------------------------------------------------
// Fintech operational realism — the messy .NET / PCI surfaces where Agoda-style
// shops actually leak: a hotfix comment in a controller, an appsettings.*.json
// with prod secrets, a logical SQL backup with PANs (non-CSV PII), structured
// JSON app logs (txn_id storm), and a clean Envoy sidecar with a Vault ref.
// ---------------------------------------------------------------------------

// paymentsControllerHotfix renders a ~minLines C# controller whose only sin is a
// "HOTFIX" comment pinning a live Stripe key to bypass 3DS during an incident.
// The key's randomized body contains "demo" so naive word-exclusion filters that
// drop candidates near "demo"/"test" wrongly suppress this genuine live leak.
func paymentsControllerHotfix(g *secrets.Gen, minLines int) string {
	liveKey := "sk_live_" + g.AlnumContaining(24, "demo")
	b := []string{
		"using System;",
		"using System.Threading.Tasks;",
		"using Microsoft.AspNetCore.Mvc;",
		"using Stripe;",
		"",
		"namespace Agoda.Booking.Api.Controllers",
		"{",
		"    [ApiController]",
		"    [Route(\"api/v2/payments\")]",
		"    public class PaymentsController : ControllerBase",
		"    {",
		"        // Gateway keys are injected from Vault at startup; never hard-coded.",
		"        private readonly string _stripeKey = Environment.GetEnvironmentVariable(\"STRIPE_API_KEY\");",
		"",
		"        // -----------------------------------------------------------------",
		"        // HOTFIX 2026-03-04 (INC-22871): the 3DS step-up was rejecting the",
		"        // incident-replay traffic, so we pinned the ops Stripe key below to",
		"        // force-capture and reproduce the failed authorizations. REMOVE once",
		"        // the replay harness has its own sandbox key. Left here to unblock.",
		fmt.Sprintf("        //   var bypassKey = \"%s\";", liveKey),
		"        //   StripeConfiguration.ApiKey = bypassKey; // skips 3DS step-up",
		"        // -----------------------------------------------------------------",
		"",
	}
	for i := 0; len(b) < minLines; i++ {
		op := []string{"Authorize", "Capture", "Void", "Refund", "Status"}[i%5]
		b = append(b,
			fmt.Sprintf("        [HttpPost(\"%s\")]", strings.ToLower(op)),
			fmt.Sprintf("        public async Task<IActionResult> %s%d([FromBody] PaymentRequest req)", op, i),
			"        {",
			"            await Task.Yield();",
			"            if (req == null) return BadRequest();",
			fmt.Sprintf("            return Ok(new { ok = true, op = \"%s\", id = req.OrderId });", op),
			"        }",
			"",
		)
	}
	b = append(b, "    }", "", "    public record PaymentRequest(string OrderId, long AmountCents, string Currency);", "}", "")
	return strings.Join(b, "\n")
}

func addFintechRealism(ws *fsbuilder.Workspace, g *secrets.Gen) {
	// TP: appsettings.Production.json with a prod DB conn string + Adyen live key.
	ws.Add("src/api/v2", fsbuilder.File("appsettings.Production.json", "application/json", "deploy", "0640",
		appsettingsProduction(g),
		fsbuilder.TP("dotnet-appsettings-prod-secret", "db-connection-string", "adyen-live-key")))

	// FP: a pg_dump logical backup — Luhn PANs + SSNs in SQL INSERT/COPY format,
	// not a clean CSV/JSON array, so structural matchers miss the PII.
	dumpG := g.Fork()
	ws.Add("srv/data/pci", fsbuilder.StreamFile("payments_backup_2026.sql", "application/sql", "spark", "0640",
		func(w io.Writer) error { return content.StreamSQLDump(w, dumpG, "payments_authorizations", 4000) },
		fsbuilder.FPNoise("sql-dump-pan-storm")))

	// Scale: structured JSON application logs (txn_id storm), streamed.
	for i := 1; i <= 3; i++ {
		logG := g.Fork()
		ws.Add("var/log/payment-api/app-json", fsbuilder.StreamFile(
			fmt.Sprintf("payment-api-%02d.log", i), "application/json", "www-data", "0640",
			func(w io.Writer) error { return content.StreamJSONLog(w, logG, "payment-api", 5200) },
			fsbuilder.FPNoise("json-log-txn-noise")))
	}

	// Clean: Envoy sidecar config — the upstream bearer references a Vault path,
	// no literal secret present.
	ws.Add("etc/envoy", fsbuilder.File("envoy-sidecar.yaml", "text/yaml", "deploy", "0644",
		envoySidecarYAML(), fsbuilder.Clean()))
}

func appsettingsProduction(g *secrets.Gen) string {
	dbURL := g.PostgresURL("booking_app", "booking-prod.cluster-czk.ap-southeast-1.rds.amazonaws.com", "bookings_prod")
	return strings.Join([]string{
		`{`,
		`  "Logging": { "LogLevel": { "Default": "Information" } },`,
		`  "AllowedHosts": "*",`,
		`  "ConnectionStrings": {`,
		`    "BookingsDb": "` + dbURL + `"`,
		`  },`,
		`  "Payments": {`,
		`    "Provider": "Adyen",`,
		`    "Adyen": {`,
		`      "MerchantAccount": "AgodaBookingPlatformPROD",`,
		`      "ApiKey": "` + g.AdyenKey() + `",`,
		`      "Environment": "live"`,
		`    }`,
		`  }`,
		`}`,
	}, "\n") + "\n"
}

func envoySidecarYAML() string {
	return strings.Join([]string{
		`# Envoy sidecar for the payment-api pod. The upstream authorization header`,
		`# is sourced from an SDS secret backed by Vault — no literal token here.`,
		`static_resources:`,
		`  listeners:`,
		`    - name: ingress`,
		`      address: { socket_address: { address: 0.0.0.0, port_value: 15001 } }`,
		`  clusters:`,
		`    - name: settlement_upstream`,
		`      type: STRICT_DNS`,
		`      load_assignment:`,
		`        cluster_name: settlement_upstream`,
		`        endpoints:`,
		`          - lb_endpoints:`,
		`              - endpoint: { address: { socket_address: { address: settlement.svc, port_value: 9443 } } }`,
		`      transport_socket:`,
		`        name: envoy.transport_sockets.tls`,
		`# Authorization: Bearer is injected from sds: vault:secret/data/payment-api#upstream_token`,
	}, "\n") + "\n"
}
