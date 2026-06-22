# Fiverr Org — Annotated Structure (124 files)

Here's the complete annotated structure of the fiverr org (124 files).

**Legend:** 🔴 real secret (TP) · 🟡 false positive (looks like a secret, but benign) · ⚪ clean noise.

```
customer-data/fiverr/                              (marketplace — gig-economy)
│
├── src/marketplace/gig-economy/                  ← Rails monolith + Node consumers (app source)
│   ├── controllers/                              ← 43 Rails controllers, 532 lines each
│   │   ├── 🔴 checkout_controller.rb              Braintree PROD token + PayPal secret in a
│   │   │                                          commented-out "DEBUG hotfix" block
│   │   └── ⚪ gigs, orders, sellers, payouts, …    42 clean controllers (decoy SECRET_TOKEN="")
│   │
│   ├── kafka-consumers/                          ← 40 Node.js TS handlers, 522 lines each
│   │   ├── config/
│   │   │   └── 🔴 gateway.config.js               LIVE Stripe sk_live_ key bound to a var named
│   │   │                                          demo_key_backup_override (+ PayPal secret)
│   │   ├── ⚪ OrdersPlacedConsumer.ts … (40 .ts)   clean (decoy jwtSecret="", apiKey="unpopulated")
│   │   ├── ⚪ yarn.lock                            1,102 lines of sha512 integrities
│   │   ├── ⚪ package-lock.json                    608 lines
│   │   └── ⚪ Dockerfile
│   │
│   ├── models/        ⚪ 10 .rb                     gig, order, seller, buyer, payout, wallet, …
│   ├── config/        ⚪ routes.rb
│   ├── services/billing/  ⚪ charge_service.rb
│   ├── workers/sidekiq/   ⚪ payout_worker.rb
│   ├── ⚪ Gemfile.lock                             1,131 lines of dependency hashes
│   └── ⚪ README.md / Dockerfile
│
├── home/deploy/pipelines/                        ← CI/CD deploy bot
│   ├── 🔴 git-credentials                         2 raw gho_ OAuth tokens in credential-store URLs
│   │                                              mapping to the PROD deploy cluster
│   ├── ⚪ deploy.sh                                pulls creds from Vault (clean)
│   └── workflows/ ⚪ deploy.yml                     uses ${{ secrets.* }} refs (clean)
│
├── srv/                                           ← back-office exports + caching relay
│   ├── exports/backoffice/
│   │   ├── 🟡 billing_fixtures.json               2,605 lines of Luhn/4242 test PANs
│   │   ├── marketplace/
│   │   │   └── 🟡 gig_catalog_export.json         2,086 lines — synthetic gig/portfolio PII
│   │   └── users/
│   │       └── 🟡 user_profiles_dump.csv          2,301 rows — synthetic SSN/email/phone
│   │
│   └── services/user-profile/                     ← Go caching relay
│       ├── cache/
│       │   ├── ⚪ redis.conf                        auth via ACL file, not here (clean)
│       │   └── snapshots/
│       │       └── 🟡 warmup_keys.json            UUID "session_token" fields → not credentials
│       ├── internal/cache/ profile/  ⚪ .go         lru, loader, resolver (529 lines each)
│       ├── cmd/server/  ⚪ main.go
│       └── ⚪ go.sum                                1,100 lines
│
└── var/                                           ← KYC pipeline + operational logs
    ├── data/kyc/
    │   ├── uploads/
    │   │   ├── 🟡 kyc_batch_manifest.json         1,505 lines — synthetic KYC PII (names, DOBs)
    │   │   └── batch-0000 … 0003/  ⚪ index.json    S3 object indexes (clean metadata)
    │   └── src/verify/  ⚪ document_verifier.go
    │
    └── log/fiverr/
        ├── ⚪ production.log                        5,200 lines (clean — no plant)
        └── ⚪ sidekiq.log                           5,200 lines (clean — no plant)
```

## The secret matrix (3 files, 6 secrets)

| File | Data it contains | Classes |
|---|---|---|
| 🔴 `home/deploy/pipelines/git-credentials` | Two raw `gho_` GitHub OAuth tokens embedded in `https://deploy-bot:<token>@…` URLs pointing at `prod-deploy-cluster` and the internal k8s-manifests repo | `github-oauth-token` |
| 🔴 `src/marketplace/gig-economy/controllers/checkout_controller.rb` | A Braintree production access token (`access_token$production$…`) and a PayPal client secret, left in a `# DEBUG: temporary production bypass for hotfix - remove before merge` comment block | `braintree-prod-token`, `paypal-client-secret` |
| 🔴 `src/marketplace/gig-economy/kafka-consumers/config/gateway.config.js` | A live Stripe key (`sk_live_…`) bound to a variable named `demo_key_backup_override`, plus a PayPal secret in `test_gateway_credential` — and it's actively used as the runtime fallback | `stripe-live-key`, `paypal-client-secret` |

## The traps (5 false positives — should NOT alert)

| File | Why it looks dangerous | Why it's benign |
|---|---|---|
| 🟡 `srv/exports/backoffice/billing_fixtures.json` | 2,605 lines of 16-digit Luhn-valid / 4242 PANs | documented checkout test fixtures — move no real money |
| 🟡 `srv/exports/backoffice/users/user_profiles_dump.csv` | 2,301 rows of SSN / email / phone columns | synthetic PII; SSNs are random / 000-00-0000 placeholders |
| 🟡 `srv/exports/backoffice/marketplace/gig_catalog_export.json` | 2,086 lines of emails, UUIDs, SHA-256 asset hashes | synthetic marketplace catalog — opaque IDs, not credentials |
| 🟡 `var/data/kyc/uploads/kyc_batch_manifest.json` | 1,505 lines of names, DOBs, document hashes | synthetic KYC records; hashes are not secrets |
| 🟡 `srv/services/user-profile/cache/snapshots/warmup_keys.json` | fields literally named `session_token` | values are opaque v4 UUIDs, not session credentials |

## Everything else (116 files) — clean structural noise

The whole haystack: 43 Rails controllers + 40 Node Kafka consumers + 10 models (each 500+ lines, seeded with decoy `SECRET_TOKEN=""` / `jwtSecret=""` / `apiKey="unpopulated"` identifiers), the user-profile Go service, the 5 lockfiles (Gemfile.lock, yarn.lock, package-lock.json, 2× go.sum ≈ 5,000 lines of hashes), two 5,200-line logs, Dockerfiles, READMEs, deploy scripts, and KYC batch indexes.

**The point:** the 6 real needles live in just 3 files (~2.4%), buried under ~97.6% innocent volume — and the 5 traps are specifically engineered to break naive scanners (the `demo_`-named live key defeats word-filtering; the commented-out Braintree token defeats "comments are dead code" assumptions; the `git-credentials` filename is commonly scan-excluded). That's the precision-vs-recall scorecard. All annotations trace to the ground-truth `_truth/manifest.json`.

## Phase 2 expansion — CI/CD + Rails-credentials operational-artifact realism

New surfaces where a marketplace actually leaks (added in `buildCICDRealism` + fixed-width KYC):

| File | Type | What / technique |
|------|------|------------------|
| `home/deploy/ci-logs/deploy-2026-06-19.log` | 🔴 | CI job log that printed `AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…` in plaintext (env dump) — `ci-job-log-env-dump` (`aws-access-key-id`, `aws-secret-key`) |
| `config/credentials/master.key` | 🔴 | Committed Rails `master.key` (32-hex) that decrypts `credentials.yml.enc` — `rails-master-key-committed` (`rails-master-key`) |
| `var/log/fiverr/kafka/payouts-consumer.error.log` | 🔴 | Consumer crash whose stack trace echoes a Postgres DSN with embedded password — `stacktrace-dsn-leak` (`db-connection-string`) |
| `config/credentials/credentials.yml.enc` | 🟡 | Encrypted credentials blob — high entropy, genuinely safe — `rails-encrypted-credentials-noise` |
| `var/data/kyc/uploads/kyc_batch_2026.dat` | 🟡 | Pipe-delimited fixed-width PII export — valid SSNs in a non-tabular format rigid matchers skip — `fixed-width-pii-export` |
| `home/deploy/ci-logs/actions-run-*.log` | ⚪ | Streamed GitHub-Actions run logs, secret-free (scale driver) — `ci-log-noise` |
