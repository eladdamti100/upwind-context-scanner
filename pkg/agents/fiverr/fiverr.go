// Package fiverr builds a hyper-realistic, enterprise-scale simulated
// filesystem for Fiverr (Marketplace / Gig Economy) used as synthetic test
// data for Upwind's Cloud Scanner. The stack is modeled as a Ruby on Rails
// gig-economy monolith flanked by Node.js Kafka consumers, a user-profile
// caching relay, a CI/CD deploy pipeline, a KYC upload pipeline, and a
// back-office checkout/export zone.
//
// The physical tree mirrors the Phase-2 target architecture:
//
//	fiverr/src/marketplace/gig-economy/controllers/   (40+ Rails controllers)
//	fiverr/src/marketplace/gig-economy/models/
//	fiverr/src/marketplace/gig-economy/kafka-consumers/ (40+ Node handlers)
//	fiverr/srv/services/user-profile/cache/redis.conf
//	fiverr/srv/exports/backoffice/billing_fixtures.json
//	fiverr/home/deploy/pipelines/git-credentials
//	fiverr/var/data/kyc/uploads/
//
// ~90% of files are CLEAN or benign-but-noisy (synthetic PII storms, Luhn-valid
// test cards, UUIDs, lockfile hashes) that a shape-only scanner over-reports.
// Exactly three files are True Positives, each planted with a distinct
// technique that defeats naive regex scanning:
//
//	TP #1 "Debug Comment" Trap   — a commented-out, real-shaped Braintree/PayPal
//	                               production token in a Rails controller.
//	TP #2 "Demo" Variable Paradox — an active production credential bound to a
//	                               variable literally named demo_key_backup_override
//	                               (probes the bug where scanners drop real leaks
//	                               near exclusion words like "demo"/"test").
//	TP #3 Pipeline Leak          — a raw, unredacted OAuth token in the deploy
//	                               git-credentials store, mapping to the prod cluster.
//
// SECURITY NOTE: nothing here is a real credential. Every "secret" merely wears
// the correct prefix/checksum shape so a scanner's regex fires; none
// authenticate against any real service.
package fiverr

import (
	"fmt"
	"io"
	"strings"

	"upwind-context-scanner/pkg/content"
	"upwind-context-scanner/pkg/fsbuilder"
	"upwind-context-scanner/pkg/secrets"
)

// Scale constants — the haystack must dwarf the needles.
const (
	numControllers = 42  // 40+ Rails controllers, 500+ lines each
	numConsumers   = 40  // 40+ Node.js Kafka consumer handlers, 500+ lines each
	codeLines      = 520 // per source file
)

// Build assembles the complete Fiverr workspace.
func Build(g *secrets.Gen) *fsbuilder.Workspace {
	ws := fsbuilder.NewWorkspace("fiverr", "marketplace")

	buildGigEconomyMonolith(ws, g) // src/marketplace/gig-economy/** + TP #1
	buildKafkaConsumers(ws, g)     // src/marketplace/gig-economy/kafka-consumers/** + TP #2
	buildUserProfileService(ws, g) // srv/services/user-profile/** (cache/redis.conf)
	buildBackofficeExports(ws, g)  // srv/exports/backoffice/** (massive PII + test-card storm)
	buildKYCUploads(ws, g)         // var/data/kyc/uploads/** (synthetic KYC PII) + fixed-width PII
	buildDeployPipelines(ws, g)    // home/deploy/pipelines/** + TP #3
	buildLogs(ws, g)               // operational log noise
	buildCICDRealism(ws, g)        // CI job-log env dump (TP) + Rails master.key (TP) + Kafka DSN stacktrace (TP)

	return ws
}

// ---------------------------------------------------------------------------
// Rails gig-economy monolith — 40+ controllers, models, lockfiles, TP #1.
// ---------------------------------------------------------------------------

func buildGigEconomyMonolith(ws *fsbuilder.Workspace, g *secrets.Gen) {
	const base = "src/marketplace/gig-economy"
	const ctrlDir = base + "/controllers"
	const modelDir = base + "/models"

	// Names for the 40+ Rails controllers. The loop wraps the list so we can
	// scale numControllers arbitrarily high.
	ctrlNames := []string{
		"gigs", "orders", "sellers", "buyers", "reviews", "payouts", "checkout_legacy",
		"messages", "offers", "milestones", "disputes", "refunds", "favorites",
		"categories", "subcategories", "search", "recommendations", "promotions",
		"coupons", "wallets", "withdrawals", "invoices", "subscriptions", "analytics",
		"notifications", "portfolios", "certifications", "skills", "languages",
		"availability", "delivery", "revisions", "tips", "ratings", "reports",
		"affiliates", "referrals", "studios", "teams", "agencies",
	}
	for i := 0; i < numControllers; i++ {
		name := ctrlNames[i%len(ctrlNames)]
		// Disambiguate when the name list wraps.
		fileName := fmt.Sprintf("%s_controller.rb", name)
		if i >= len(ctrlNames) {
			fileName = fmt.Sprintf("%s_v%d_controller.rb", name, i/len(ctrlNames)+1)
		}
		ws.Add(ctrlDir, fsbuilder.File(
			fileName, "text/x-ruby", "deploy", "0644",
			content.CleanRuby(g, codeLines), fsbuilder.Clean(),
		))
	}

	// Rails models (clean).
	for _, m := range []string{
		"gig.rb", "order.rb", "seller.rb", "buyer.rb", "payout.rb",
		"review.rb", "milestone.rb", "wallet.rb", "portfolio.rb", "dispute.rb",
	} {
		ws.Add(modelDir, fsbuilder.File(
			m, "text/x-ruby", "deploy", "0644",
			content.CleanRuby(g, codeLines), fsbuilder.Clean(),
		))
	}

	// Service objects, workers, routes (clean).
	ws.Add(base+"/services/billing", fsbuilder.File(
		"charge_service.rb", "text/x-ruby", "deploy", "0644",
		content.CleanRuby(g, codeLines), fsbuilder.Clean(),
	))
	ws.Add(base+"/workers/sidekiq", fsbuilder.File(
		"payout_worker.rb", "text/x-ruby", "deploy", "0644",
		content.CleanRuby(g, codeLines), fsbuilder.Clean(),
	))
	ws.Add(base+"/config", fsbuilder.File(
		"routes.rb", "text/x-ruby", "deploy", "0644",
		content.CleanRuby(g, codeLines), fsbuilder.Clean(),
	))

	// Gemfile.lock — 1100+ lines of dependency-hash noise (streamed).
	gemG := g.Fork()
	ws.Add(base, fsbuilder.StreamFile(
		"Gemfile.lock", "text/plain", "deploy", "0644",
		func(w io.Writer) error { return streamGemfileLock(w, gemG, 1100) }, fsbuilder.Clean(),
	))
	ws.Add(base, fsbuilder.File(
		"README.md", "text/markdown", "deploy", "0644",
		content.ReadmeMd(g, "gig-economy"), fsbuilder.Clean(),
	))
	ws.Add(base, fsbuilder.File(
		"Dockerfile", "text/plain", "deploy", "0644",
		content.Dockerfile(g, "ruby:3.3-slim"), fsbuilder.Clean(),
	))

	// --- TRUE POSITIVE #1: "Debug Comment" Trap ---
	// A real-shaped Braintree production access token (+ PayPal secret) sits in
	// a commented-out hotfix block. Shape-only scanners that ignore comments —
	// or that treat "commented => dead => safe" — miss this live leak.
	ws.Add(ctrlDir, fsbuilder.File(
		"checkout_controller.rb", "text/x-ruby", "deploy", "0644",
		braintreeDebugTrapController(g),
		fsbuilder.TP("commented-out-prod-braintree-token",
			"braintree-prod-token", "paypal-client-secret"),
	))
}

// braintreeDebugTrapController emits a full (~500-line) Rails checkout
// controller whose only sin is a commented-out production payment-gateway
// override left in during a hotfix.
func braintreeDebugTrapController(g *secrets.Gen) string {
	// Braintree access tokens have the distinctive
	// access_token$production$<merchantId>$<32hex> shape.
	braintreeToken := fmt.Sprintf("access_token$production$%s$%s", g.Hex(16), g.Hex(32))
	// PayPal live client secrets are ~E + base64-ish, fairly long.
	paypalSecret := "E" + g.Str(secrets.Base64URL, 79)

	b := []string{
		"# frozen_string_literal: true",
		"",
		"# CheckoutController drives the gig-economy checkout funnel: it builds the",
		"# order, authorizes the buyer's payment instrument through the active gateway,",
		"# captures funds into escrow, and enqueues the seller payout job.",
		"class CheckoutController < ApplicationController",
		"  before_action :authenticate_user!",
		"  before_action :load_order, only: %i[show authorize capture refund]",
		"",
		"  # Gateways are resolved from Vault at boot; nothing is hard-coded here.",
		"  GATEWAY = ENV.fetch(\"PAYMENT_GATEWAY\", \"braintree\")",
		"  BRAINTREE_MERCHANT_ID = ENV[\"BRAINTREE_MERCHANT_ID\"]",
		"  BRAINTREE_ACCESS_TOKEN = ENV[\"BRAINTREE_ACCESS_TOKEN\"] # injected by Capistrano",
		"  PAYPAL_CLIENT_SECRET   = ENV[\"PAYPAL_CLIENT_SECRET\"]",
		"",
		"  # ---------------------------------------------------------------------",
		"  # DEBUG: temporary production bypass for hotfix - remove before merge",
		"  # Sandbox gateway creds were rate-limiting the incident replay, so we",
		"  # pinned the live Braintree token below just to reproduce ORDER-88213.",
		"  # DO NOT SHIP. (left commented so CI secret-scan stays green — it won't)",
		fmt.Sprintf("  #   gateway_token       = \"%s\"", braintreeToken),
		fmt.Sprintf("  #   paypal_fallback_sec = \"%s\"", paypalSecret),
		"  #   Braintree::Configuration.access_token = gateway_token",
		"  # ---------------------------------------------------------------------",
		"",
	}

	// Pad with plausible controller actions until we exceed 500 lines.
	actions := []string{"show", "create", "authorize", "capture", "refund", "void", "status"}
	for i := 0; len(b) < 520; i++ {
		act := actions[i%len(actions)]
		b = append(b,
			fmt.Sprintf("  # %s handles the %s step of the checkout state machine.", act, act),
			fmt.Sprintf("  def %s_%d", act, i),
			"    order = current_order",
			"    gateway = PaymentGateway.resolve(GATEWAY)",
			fmt.Sprintf("    result = gateway.%s(order, idempotency_key: request.uuid)", act),
			"    if result.success?",
			"      render json: { ok: true, order_id: order.id, state: result.state }",
			"    else",
			"      Rails.logger.warn(\"checkout step failed: #{result.message}\")",
			"      render json: { ok: false, error: result.code }, status: :payment_required",
			"    end",
			"  rescue PaymentGateway::Error => e",
			"    Rails.logger.error(\"gateway error: #{e.message}\")",
			"    head :bad_gateway",
			"  end",
			"",
		)
	}
	b = append(b,
		"  private",
		"",
		"  def load_order",
		"    @order = Order.find(params[:id])",
		"  end",
		"end",
		"",
	)
	return strings.Join(b, "\n")
}

// streamGemfileLock writes a Bundler-style Gemfile.lock of >= Scaled(minLines)
// lines straight to w; every spec carries dependency-version noise.
func streamGemfileLock(w io.Writer, g *secrets.Gen, minLines int) error {
	gems := []string{
		"rails", "puma", "pg", "redis", "sidekiq", "ruby-kafka", "bootsnap", "nokogiri",
		"devise", "pundit", "jbuilder", "rack-cors", "faraday", "oj", "dalli",
		"aws-sdk-s3", "braintree", "paypal-sdk-rest", "sendgrid-ruby", "kaminari", "sentry-ruby",
	}
	io.WriteString(w, "GEM\n  remote: https://rubygems.org/\n  specs:\n")
	minLines = content.Scaled(minLines)
	for line := 3; line < minLines; line += 3 {
		i := line
		name := gems[i%len(gems)]
		ver := fmt.Sprintf("%d.%d.%d", g.Intn(8), g.Intn(20), g.Intn(40))
		fmt.Fprintf(w, "    %s-dep%d (%s)\n", name, i, ver)
		fmt.Fprintf(w, "      %s (~> %d.%d)\n", gems[(i+1)%len(gems)], g.Intn(8), g.Intn(20))
		fmt.Fprintf(w, "      rack (>= %d.%d.0)\n", g.Intn(3), g.Intn(9))
	}
	io.WriteString(w, "\nPLATFORMS\n  ruby\n  x86_64-linux\n\nDEPENDENCIES\n")
	for _, name := range gems {
		fmt.Fprintf(w, "  %s\n", name)
	}
	io.WriteString(w, "\nBUNDLED WITH\n   2.5.6\n")
	return nil
}

// ---------------------------------------------------------------------------
// Node.js Kafka consumers — 40+ handlers + TP #2 ("Demo" Variable Paradox).
// ---------------------------------------------------------------------------

func buildKafkaConsumers(ws *fsbuilder.Workspace, g *secrets.Gen) {
	const base = "src/marketplace/gig-economy/kafka-consumers"

	topics := []string{
		"orders.placed", "orders.cancelled", "gigs.published", "gigs.paused",
		"payouts.settled", "payouts.failed", "kyc.submitted", "kyc.approved",
		"reviews.created", "messages.sent", "offers.accepted", "milestones.completed",
		"disputes.opened", "refunds.issued", "wallets.credited", "withdrawals.requested",
		"subscriptions.renewed", "promotions.applied", "coupons.redeemed", "analytics.events",
	}
	for i := 0; i < numConsumers; i++ {
		topic := topics[i%len(topics)]
		fileName := fmt.Sprintf("%sConsumer.ts", camel(topic))
		if i >= len(topics) {
			fileName = fmt.Sprintf("%sConsumerV%d.ts", camel(topic), i/len(topics)+1)
		}
		ws.Add(base, fsbuilder.File(
			fileName, "application/typescript", "node", "0644",
			content.CleanTypeScript(g, codeLines), fsbuilder.Clean(),
		))
	}

	// Lockfiles & infra noise for the Node side (streamed).
	yarnG, pkgG := g.Fork(), g.Fork()
	ws.Add(base, fsbuilder.StreamFile(
		"yarn.lock", "text/plain", "node", "0644",
		func(w io.Writer) error { return content.StreamYarnLock(w, yarnG, 1100) }, fsbuilder.Clean(),
	))
	ws.Add(base, fsbuilder.StreamFile(
		"package-lock.json", "application/json", "node", "0644",
		func(w io.Writer) error { return content.StreamPackageLock(w, pkgG, 600) }, fsbuilder.Clean(),
	))
	ws.Add(base, fsbuilder.File(
		"Dockerfile", "text/plain", "node", "0644",
		content.Dockerfile(g, "node:20-alpine"), fsbuilder.Clean(),
	))

	// --- TRUE POSITIVE #2: "Demo" Variable Paradox (Bug §H) ---
	// An ACTIVE production Stripe live key bound to a variable named
	// demo_key_backup_override. A scanner that drops candidates near the words
	// "demo"/"test"/"backup" to fight alert fatigue will wrongly suppress this.
	ws.Add(base+"/config", fsbuilder.File(
		"gateway.config.js", "application/javascript", "node", "0644",
		demoParadoxGatewayConfig(g),
		fsbuilder.TP("demo-named-variable-real-secret",
			"stripe-live-key", "paypal-client-secret"),
	))
}

func demoParadoxGatewayConfig(g *secrets.Gen) string {
	var b strings.Builder
	b.WriteString("// Payment-gateway runtime config for the checkout Kafka consumers.\n")
	b.WriteString("// Production values are sourced from the environment at boot.\n\n")
	b.WriteString("'use strict';\n\n")
	b.WriteString("const config = {\n")
	b.WriteString("  port: Number(process.env.PORT ?? 8090),\n")
	b.WriteString("  kafkaBrokers: (process.env.KAFKA_BROKERS ?? '').split(','),\n")
	b.WriteString("  stripeKey: process.env.STRIPE_SECRET_KEY ?? '',\n")
	b.WriteString("  jwtSecret: process.env.JWT_SECRET ?? '',\n")
	b.WriteString("  apiKey: 'unpopulated',\n\n")
	b.WriteString("  // FIXME(checkout): primary Stripe rotation broke the EU payout cron last\n")
	b.WriteString("  // night. Pinned the working live key here as a backup so settlements\n")
	b.WriteString("  // keep clearing until SRE finishes the rotation. The 'demo' name keeps\n")
	b.WriteString("  // it out of the secret-scan report. Rotate + delete once #PAY-4471 lands.\n")
	b.WriteString(fmt.Sprintf("  demo_key_backup_override: '%s',\n", g.StripeLive()))
	b.WriteString(fmt.Sprintf("  test_gateway_credential: '%s',\n", "E"+g.Str(secrets.Base64URL, 79)))
	b.WriteString("};\n\n")
	b.WriteString("// Fall back to the pinned key when the env var is missing (it is, in prod).\n")
	b.WriteString("config.stripeKey = config.stripeKey || config.demo_key_backup_override;\n\n")
	b.WriteString("module.exports = config;\n")
	return b.String()
}

// camel turns "orders.placed" into "OrdersPlaced".
func camel(topic string) string {
	parts := strings.FieldsFunc(topic, func(r rune) bool { return r == '.' || r == '_' || r == '-' })
	for i, p := range parts {
		if p == "" {
			continue
		}
		parts[i] = strings.ToUpper(p[:1]) + p[1:]
	}
	return strings.Join(parts, "")
}

// ---------------------------------------------------------------------------
// User-profile caching relay — srv/services/user-profile/** (clean infra).
// ---------------------------------------------------------------------------

func buildUserProfileService(ws *fsbuilder.Workspace, g *secrets.Gen) {
	const base = "srv/services/user-profile"

	// Clean service code (Go).
	for _, f := range []struct{ dir, name string }{
		{base + "/internal/cache", "lru.go"},
		{base + "/internal/profile", "loader.go"},
		{base + "/internal/profile", "resolver.go"},
		{base + "/cmd/server", "main.go"},
	} {
		ws.Add(f.dir, fsbuilder.File(
			f.name, "text/x-go", "deploy", "0644",
			content.CleanGo(g, codeLines), fsbuilder.Clean(),
		))
	}
	sumG := g.Fork()
	ws.Add(base, fsbuilder.StreamFile(
		"go.sum", "text/plain", "deploy", "0644",
		func(w io.Writer) error { return content.StreamGoSum(w, sumG, 1100) }, fsbuilder.Clean(),
	))

	// cache/redis.conf — clean: auth lives in a separate ACL file, not here.
	ws.Add(base+"/cache", fsbuilder.File(
		"redis.conf", "text/plain", "root", "0644",
		redisConf(g), fsbuilder.Clean(),
	))

	// --- FALSE POSITIVE: profile-cache warmup dump full of UUIDs/session ids ---
	// Looks like a firehose of opaque tokens; every value is just a v4 UUID.
	ws.Add(base+"/cache/snapshots", fsbuilder.File(
		"warmup_keys.json", "application/json", "root", "0640",
		cacheWarmupSnapshot(g),
		fsbuilder.FPNoise("uuid-mistaken-for-session-token"),
	))
}

func redisConf(g *secrets.Gen) string {
	var b strings.Builder
	b.WriteString("# redis.conf — user-profile cache relay (auth via ACL file, not here)\n")
	b.WriteString("bind 0.0.0.0\n")
	b.WriteString("port 6379\n")
	b.WriteString("protected-mode yes\n")
	b.WriteString("maxmemory 8gb\n")
	b.WriteString("maxmemory-policy allkeys-lru\n")
	b.WriteString("appendonly yes\n")
	b.WriteString("appendfsync everysec\n")
	b.WriteString("tcp-keepalive 300\n")
	b.WriteString(fmt.Sprintf("# cluster node id: %s\n", g.SHA256Hex()[:40]))
	b.WriteString("aclfile /etc/redis/users.acl\n")
	return b.String()
}

func cacheWarmupSnapshot(g *secrets.Gen) string {
	var b strings.Builder
	b.WriteString("{\n  \"snapshotId\": \"" + g.UUID() + "\",\n  \"keys\": [\n")
	const rows = 220
	for i := 0; i < rows; i++ {
		comma := ","
		if i == rows-1 {
			comma = ""
		}
		b.WriteString(fmt.Sprintf(
			"    { \"key\": \"profile:%d\", \"etag\": \"%s\", \"session_token\": \"%s\", \"shard\": %d }%s\n",
			100000+i, g.UUID(), g.UUID(), i%32, comma))
	}
	b.WriteString("  ]\n}\n")
	return b.String()
}

// ---------------------------------------------------------------------------
// Back-office exports — srv/exports/backoffice/** (massive PII + test cards).
// ---------------------------------------------------------------------------

func buildBackofficeExports(ws *fsbuilder.Workspace, g *secrets.Gen) {
	const base = "srv/exports/backoffice"

	// --- FALSE POSITIVE: billing_fixtures.json — back-office checkout matrix ---
	// 1500+ lines of Luhn-valid / 4242-series TEST cards. Math-valid PANs that
	// trip card regexes on every row, but they are documented test fixtures.
	ws.Add(base, fsbuilder.File(
		"billing_fixtures.json", "application/json", "deploy", "0640",
		billingFixturesJSON(g, content.Scaled(260)),
		fsbuilder.FPTest("test-card-storm"),
	))

	// --- FALSE POSITIVE: gig marketplace export — 1500+ lines synthetic PII ---
	// Gig listings + seller portfolios + metadata tags. Realistic but synthetic.
	ws.Add(base+"/marketplace", fsbuilder.File(
		"gig_catalog_export.json", "application/json", "deploy", "0640",
		gigCatalogJSON(g, content.Scaled(130)),
		fsbuilder.FPNoise("synthetic-marketplace-pii"),
	))

	// --- FALSE POSITIVE: user-profile dump — 2000+ rows synthetic SSN/PII (streamed) ---
	piiG := g.Fork()
	ws.Add(base+"/users", fsbuilder.StreamFile(
		"user_profiles_dump.csv", "text/csv", "deploy", "0640",
		func(w io.Writer) error { return streamUserPIIDump(w, piiG, 2300) },
		fsbuilder.FPNoise("synthetic-user-pii-array"),
	))
}

func billingFixturesJSON(g *secrets.Gen, n int) string {
	scenarios := []string{"happy_path", "declined", "insufficient_funds", "3ds_required", "refund", "chargeback"}
	currencies := []string{"USD", "EUR", "GBP", "ILS", "INR", "BRL"}
	var b strings.Builder
	b.WriteString("{\n")
	b.WriteString("  \"description\": \"Back-office checkout test fixtures. Sandbox PANs only — safe to commit.\",\n")
	b.WriteString("  \"fixtures\": [\n")
	for i := 0; i < n; i++ {
		card := g.LuhnCard()
		if i%5 == 0 {
			card = g.TestCard() // 4242 series
		}
		comma := ","
		if i == n-1 {
			comma = ""
		}
		b.WriteString("    {\n")
		b.WriteString(fmt.Sprintf("      \"fixture_id\": %d,\n", 9000+i))
		b.WriteString(fmt.Sprintf("      \"scenario\": %q,\n", scenarios[i%len(scenarios)]))
		b.WriteString(fmt.Sprintf("      \"card_number\": %q,\n", card))
		b.WriteString(fmt.Sprintf("      \"exp\": \"%02d/%02d\",\n", 1+g.Intn(12), 26+g.Intn(6)))
		b.WriteString("      \"cvc\": \"***\",\n")
		b.WriteString(fmt.Sprintf("      \"amount_cents\": %d,\n", g.Intn(50000)+100))
		b.WriteString(fmt.Sprintf("      \"currency\": %q,\n", currencies[i%len(currencies)]))
		b.WriteString(fmt.Sprintf("      \"order_ref\": %q\n", g.UUID()))
		b.WriteString("    }" + comma + "\n")
	}
	b.WriteString("  ]\n}\n")
	return b.String()
}

func gigCatalogJSON(g *secrets.Gen, n int) string {
	cats := []string{"Graphics & Design", "Programming & Tech", "Writing & Translation",
		"Video & Animation", "Music & Audio", "Digital Marketing", "Business", "Data", "AI Services"}
	tags := []string{"logo", "wordpress", "seo", "react", "voiceover", "illustration",
		"copywriting", "data-entry", "android", "ios", "branding", "ux", "chatbot", "ml"}
	var b strings.Builder
	b.WriteString("{\n")
	b.WriteString("  \"export\": \"gig-catalog\",\n")
	b.WriteString(fmt.Sprintf("  \"generated_id\": %q,\n", g.UUID()))
	b.WriteString("  \"gigs\": [\n")
	for i := 0; i < n; i++ {
		comma := ","
		if i == n-1 {
			comma = ""
		}
		seller := fmt.Sprintf("%s_%d", g.Lower(7), i)
		b.WriteString("    {\n")
		b.WriteString(fmt.Sprintf("      \"gig_id\": %q,\n", g.UUID()))
		b.WriteString(fmt.Sprintf("      \"seller\": %q,\n", seller))
		b.WriteString(fmt.Sprintf("      \"seller_email\": \"%s@example.com\",\n", seller))
		b.WriteString(fmt.Sprintf("      \"title\": \"I will deliver a %s gig in 24h\",\n", g.Pick(tags)))
		b.WriteString(fmt.Sprintf("      \"category\": %q,\n", g.Pick(cats)))
		b.WriteString(fmt.Sprintf("      \"tags\": [%q, %q, %q],\n", g.Pick(tags), g.Pick(tags), g.Pick(tags)))
		b.WriteString(fmt.Sprintf("      \"price_usd\": %d,\n", 5+g.Intn(995)))
		b.WriteString(fmt.Sprintf("      \"rating\": %d.%d,\n", 3+g.Intn(2), g.Intn(10)))
		b.WriteString(fmt.Sprintf("      \"orders_completed\": %d,\n", g.Intn(5000)))
		b.WriteString("      \"portfolio\": [\n")
		for j := 0; j < 3; j++ {
			pc := ","
			if j == 2 {
				pc = ""
			}
			b.WriteString(fmt.Sprintf(
				"        { \"asset_id\": %q, \"sha256\": %q, \"kind\": \"image/png\" }%s\n",
				g.UUID(), g.SHA256Hex(), pc))
		}
		b.WriteString("      ]\n")
		b.WriteString("    }" + comma + "\n")
	}
	b.WriteString("  ]\n}\n")
	return b.String()
}

// streamUserPIIDump writes Scaled(rows) synthetic user PII rows straight to w.
func streamUserPIIDump(w io.Writer, g *secrets.Gen, rows int) error {
	countries := []string{"US", "IN", "GB", "PK", "PH", "NG", "BR", "DE", "CA", "AU", "IL", "FR"}
	return content.StreamCSV(w, "user_id,username,email,full_name,ssn,phone,country", rows, func(i int) string {
		user := fmt.Sprintf("%s_%d", g.Lower(6), i)
		ssn := g.RandSSN()
		if i%250 == 0 {
			ssn = secrets.PlaceholderSSN()
		}
		return fmt.Sprintf("%d,%s,%s@example.com,%s %s,%s,+%s,%s",
			100000+i, user, user, strings.Title(g.Lower(5)), strings.Title(g.Lower(7)),
			ssn, g.Digits(11), g.Pick(countries))
	})
}

// ---------------------------------------------------------------------------
// KYC upload pipeline — var/data/kyc/uploads/** (synthetic KYC PII).
// ---------------------------------------------------------------------------

func buildKYCUploads(ws *fsbuilder.Workspace, g *secrets.Gen) {
	const base = "var/data/kyc"

	// Clean ingest code.
	ws.Add(base+"/src/verify", fsbuilder.File(
		"document_verifier.go", "text/x-go", "deploy", "0644",
		content.CleanGo(g, codeLines), fsbuilder.Clean(),
	))

	// --- FALSE POSITIVE: KYC upload manifest — 1500+ lines synthetic PII ---
	ws.Add(base+"/uploads", fsbuilder.File(
		"kyc_batch_manifest.json", "application/json", "deploy", "0640",
		kycBatchManifest(g, content.Scaled(150)),
		fsbuilder.FPNoise("synthetic-kyc-pii-array"),
	))

	// --- FALSE POSITIVE: pipe-delimited fixed-width PII export. Valid SSNs in a
	// non-standard columnar format that rigid CSV/JSON matchers skip entirely. ---
	dwG := g.Fork()
	ws.Add(base+"/uploads", fsbuilder.StreamFile(
		"kyc_batch_2026.dat", "text/plain", "deploy", "0640",
		func(w io.Writer) error { _, err := io.WriteString(w, content.FixedWidthPII(dwG, 2000)); return err },
		fsbuilder.FPNoise("fixed-width-pii-export"),
	))

	// Per-batch upload index files (clean metadata).
	for i := 0; i < 4; i++ {
		ws.Add(fmt.Sprintf("%s/uploads/batch-%04d", base, i), fsbuilder.File(
			"index.json", "application/json", "deploy", "0640",
			kycUploadIndex(g, 40), fsbuilder.Clean(),
		))
	}
}

func kycBatchManifest(g *secrets.Gen, n int) string {
	docTypes := []string{"passport", "drivers_license", "national_id", "utility_bill", "selfie"}
	statuses := []string{"pending", "approved", "rejected", "manual_review"}
	countries := []string{"US", "IN", "GB", "PK", "PH", "NG", "BR", "DE", "IL"}
	var b strings.Builder
	b.WriteString("{\n")
	b.WriteString(fmt.Sprintf("  \"batch_id\": %q,\n", g.UUID()))
	b.WriteString("  \"documents\": [\n")
	for i := 0; i < n; i++ {
		comma := ","
		if i == n-1 {
			comma = ""
		}
		applicant := fmt.Sprintf("%s_%d", g.Lower(6), i)
		b.WriteString("    {\n")
		b.WriteString(fmt.Sprintf("      \"doc_id\": %q,\n", g.UUID()))
		b.WriteString(fmt.Sprintf("      \"applicant\": %q,\n", applicant))
		b.WriteString(fmt.Sprintf("      \"applicant_email\": \"%s@example.com\",\n", applicant))
		b.WriteString(fmt.Sprintf("      \"type\": %q,\n", docTypes[i%len(docTypes)]))
		b.WriteString(fmt.Sprintf("      \"country\": %q,\n", countries[i%len(countries)]))
		b.WriteString(fmt.Sprintf("      \"dob\": \"19%02d-%02d-%02d\",\n", 60+g.Intn(40), 1+g.Intn(12), 1+g.Intn(28)))
		b.WriteString(fmt.Sprintf("      \"sha256\": %q,\n", g.SHA256Hex()))
		b.WriteString(fmt.Sprintf("      \"status\": %q\n", statuses[i%len(statuses)]))
		b.WriteString("    }" + comma + "\n")
	}
	b.WriteString("  ]\n}\n")
	return b.String()
}

func kycUploadIndex(g *secrets.Gen, n int) string {
	var b strings.Builder
	b.WriteString("{\n  \"files\": [\n")
	for i := 0; i < n; i++ {
		comma := ","
		if i == n-1 {
			comma = ""
		}
		b.WriteString(fmt.Sprintf(
			"    { \"object\": \"s3://fiverr-kyc-uploads/%s.bin\", \"bytes\": %d, \"md5\": %q }%s\n",
			g.UUID(), 1024+g.Intn(4_000_000), g.Hex(32), comma))
	}
	b.WriteString("  ]\n}\n")
	return b.String()
}

// ---------------------------------------------------------------------------
// Deploy pipelines — home/deploy/pipelines/** + TP #3 (git-credentials leak).
// ---------------------------------------------------------------------------

func buildDeployPipelines(ws *fsbuilder.Workspace, g *secrets.Gen) {
	const base = "home/deploy/pipelines"

	// Clean GitHub Actions / deploy script noise.
	ws.Add(base, fsbuilder.File(
		"deploy.sh", "text/x-shellscript", "deploy", "0755",
		deployScript(g), fsbuilder.Clean(),
	))
	ws.Add(base+"/workflows", fsbuilder.File(
		"deploy.yml", "text/yaml", "deploy", "0644",
		githubWorkflow(g), fsbuilder.Clean(),
	))

	// --- TRUE POSITIVE #3: Pipeline Leak ---
	// The deploy bot's git credential store with a RAW, unredacted OAuth token
	// that maps back to the production deployment cluster. git-credentials files
	// are commonly excluded from scans by filename, so the token slips through.
	ws.Add(base, fsbuilder.File(
		"git-credentials", "text/plain", "deploy", "0600",
		gitCredentialsStore(g),
		fsbuilder.TP("git-credentials-oauth-token", "github-oauth-token"),
	))
}

func gitCredentialsStore(g *secrets.Gen) string {
	var b strings.Builder
	b.WriteString("# ~/.git-credentials — used by the prod deploy bot (credential.helper=store)\n")
	b.WriteString("# Maps the deploy bot to the production deployment cluster repos.\n")
	// Raw OAuth token embedded in the URL — the live leak.
	b.WriteString(fmt.Sprintf("https://fiverr-deploy-bot:%s@github.com/fiverr/prod-deploy-cluster.git\n", g.GitHubOAuth()))
	b.WriteString(fmt.Sprintf("https://fiverr-deploy-bot:%s@git.prod-cluster.fiverr.internal/infra/k8s-manifests.git\n", g.GitHubOAuth()))
	return b.String()
}

func deployScript(g *secrets.Gen) string {
	var b strings.Builder
	b.WriteString("#!/usr/bin/env bash\n")
	b.WriteString("set -euo pipefail\n\n")
	b.WriteString("# Deploys the gig-economy monolith + Kafka consumers to the prod cluster.\n")
	b.WriteString("# Secrets are pulled from Vault at runtime; nothing is hard-coded here.\n\n")
	b.WriteString("CLUSTER=\"${CLUSTER:-prod-eks}\"\n")
	b.WriteString(fmt.Sprintf("BUILD_REV=\"%d\"\n", g.Intn(99999)))
	b.WriteString("export GIT_TERMINAL_PROMPT=0\n\n")
	b.WriteString("vault read -field=value secret/deploy/stripe > /dev/null\n")
	b.WriteString("git pull --ff-only origin main\n")
	b.WriteString("kubectl --context \"$CLUSTER\" apply -k ./manifests/overlays/prod\n")
	b.WriteString("kubectl --context \"$CLUSTER\" rollout status deploy/gig-economy --timeout=300s\n")
	b.WriteString("echo \"deployed rev ${BUILD_REV} to ${CLUSTER}\"\n")
	return b.String()
}

func githubWorkflow(g *secrets.Gen) string {
	var b strings.Builder
	b.WriteString("name: deploy\n\n")
	b.WriteString("on:\n  push:\n    branches: [main]\n\n")
	b.WriteString("jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n")
	b.WriteString("      - uses: actions/checkout@v4\n")
	b.WriteString("      - uses: ruby/setup-ruby@v1\n        with:\n          ruby-version: '3.3'\n")
	b.WriteString("      - run: bundle install\n")
	b.WriteString("      - run: bundle exec rake deploy\n")
	b.WriteString("        env:\n")
	b.WriteString("          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}\n")
	b.WriteString("          BRAINTREE_ACCESS_TOKEN: ${{ secrets.BRAINTREE_ACCESS_TOKEN }}\n")
	b.WriteString(fmt.Sprintf("          BUILD_REV: %d\n", g.Intn(99999)))
	return b.String()
}

// ---------------------------------------------------------------------------
// CI/CD + Rails-credentials operational realism — the surfaces where a gig
// marketplace actually leaks: secrets printed into a CI job log, a committed
// Rails master.key, and a connection string echoed in a Kafka consumer crash.
// ---------------------------------------------------------------------------

func buildCICDRealism(ws *fsbuilder.Workspace, g *secrets.Gen) {
	// TP: a CI job log where `set -x` (or a debug step) printed the deploy creds
	// into the build output in plaintext — the classic CI env-dump leak.
	awsID, awsSecret := g.AWSKeyID(), g.AWSSecret()
	plant := fmt.Sprintf("##[debug] resolved deploy env -> AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_DEFAULT_REGION=us-east-1", awsID, awsSecret)
	ciG := g.Fork()
	ws.Add("home/deploy/ci-logs", fsbuilder.StreamFile(
		"deploy-2026-06-19.log", "text/plain", "deploy", "0640",
		func(w io.Writer) error {
			return content.StreamCIJobLog(w, ciG, content.PlantLog{MinLines: 4000, PlantLine: 1840, Plant: plant})
		},
		fsbuilder.TP("ci-job-log-env-dump", "aws-access-key-id", "aws-secret-key")))

	// Scale: additional CI run logs, secret-free (ci-log-noise firehose).
	for i := 1; i <= 3; i++ {
		actG := g.Fork()
		ws.Add("home/deploy/ci-logs", fsbuilder.StreamFile(
			fmt.Sprintf("actions-run-%04d.log", 70000+i), "text/plain", "deploy", "0640",
			func(w io.Writer) error {
				return content.StreamCIJobLog(w, actG, content.PlantLog{MinLines: 4000, PlantLine: -1})
			},
			fsbuilder.FPNoise("ci-log-noise")))
	}

	// TP: a committed Rails master.key that decrypts config/credentials.yml.enc.
	ws.Add("config/credentials", fsbuilder.File("master.key", "text/plain", "deploy", "0600",
		g.RailsMasterKey()+"\n",
		fsbuilder.TP("rails-master-key-committed", "rails-master-key")))

	// CLEAN-but-noisy: the encrypted credentials blob — high-entropy, safe.
	ws.Add("config/credentials", fsbuilder.File("credentials.yml.enc", "text/plain", "deploy", "0644",
		g.B64(420)+"\n", fsbuilder.FPNoise("rails-encrypted-credentials-noise")))

	// TP: a Kafka consumer crash whose stack trace echoes a Postgres DSN with an
	// embedded password — the connection-string-in-a-stacktrace leak.
	dsn := g.PostgresURL("payouts_rw", "payouts-prod.cluster-czk.us-east-1.rds.amazonaws.com", "payouts")
	ws.Add("var/log/fiverr/kafka", fsbuilder.File("payouts-consumer.error.log", "text/plain", "node", "0640",
		kafkaConsumerErrorLog(g, dsn),
		fsbuilder.TP("stacktrace-dsn-leak", "db-connection-string")))
}

// kafkaConsumerErrorLog renders a Node.js consumer error log: mostly routine
// processing lines, with one unhandled-rejection stack trace whose error message
// echoes the database DSN (password and all).
func kafkaConsumerErrorLog(g *secrets.Gen, dsn string) string {
	var b strings.Builder
	lines := content.Scaled(800)
	crash := lines / 2
	for i := 0; i < lines; i++ {
		if i == crash {
			fmt.Fprintf(&b, "[2026-06-19T%02d:%02d:%02d.%03dZ] ERROR PayoutsConsumer unhandledRejection\n", i%24, i%60, (i*7)%60, g.Intn(1000))
			b.WriteString("SequelizeConnectionError: password authentication failed for user \"payouts_rw\"\n")
			b.WriteString("    at Client._connectionCallback (/app/node_modules/pg/lib/client.js:132:24)\n")
			fmt.Fprintf(&b, "    at connect (/app/src/db.js:18:11) using DATABASE_URL=%s\n", dsn)
			b.WriteString("    at PayoutsConsumer.eachMessage (/app/src/consumers/payouts.js:54:9)\n")
			continue
		}
		fmt.Fprintf(&b, "[2026-06-19T%02d:%02d:%02d.%03dZ] INFO PayoutsConsumer processed offset=%d partition=%d txn_id=%s\n",
			i%24, i%60, (i*7)%60, g.Intn(1000), 100000+i, i%12, g.TxnID())
	}
	return b.String()
}

// ---------------------------------------------------------------------------
// Operational logs — large clean production logs (no plants).
// ---------------------------------------------------------------------------

func buildLogs(ws *fsbuilder.Workspace, g *secrets.Gen) {
	const logDir = "var/log/fiverr"

	prodG, sideG := g.Fork(), g.Fork()
	ws.Add(logDir, fsbuilder.StreamFile(
		"production.log", "text/plain", "deploy", "0640",
		func(w io.Writer) error {
			return content.StreamNginxLog(w, prodG, content.LogOptions{MinLines: 5200, PlantLine: -1, Service: "rails"})
		},
		fsbuilder.Clean(),
	))
	ws.Add(logDir, fsbuilder.StreamFile(
		"sidekiq.log", "text/plain", "deploy", "0640",
		func(w io.Writer) error {
			return content.StreamNginxLog(w, sideG, content.LogOptions{MinLines: 5200, PlantLine: -1, Service: "sidekiq"})
		},
		fsbuilder.Clean(),
	))
}
