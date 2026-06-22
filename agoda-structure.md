# Agoda Org — Annotated Corpus Structure (77 files)

Complete annotated structure of the **agoda** org, in the same format as the wix breakdown.

**Legend:** 🔴 real secret (TP) · 🟡 false positive (looks like a secret, but benign) · ⚪ clean noise.

```
customer-data/agoda/                              ← travel-fintech / PCI-DSS booking platform
│
├── srv/                                          ← production infrastructure & secure config
│   ├── secure/v2/
│   │   ├── config/
│   │   │   ├── 🔴 prod.env                        AWS key+secret · Postgres admin URL · OpenAI key (150-line env)
│   │   │   └── 🟡 .env.example                    sk_test_ + AKIAEXAMPLE… + "changeme" → benign template
│   │   └── keys/
│   │       ├── 🔴 id_rsa                          OpenSSH PRIVATE KEY (29-line PEM block, mode 0600)
│   │       ├── ⚪ id_rsa.pub                       public key (not a secret)
│   │       └── ⚪ known_hosts                       host fingerprints (benign)
│   │
│   └── data/pci/
│       ├── dumps/
│       │   └── 🟡 transactions.csv                2,300 rows of Luhn-valid test PANs → mistaken for cards
│       └── etl/
│           └── 🟡 pii-masking-site.xml            all-zero SSNs (000-00-0000) → placeholder masking defaults
│
├── root/.aws/                                    ← OS dotfiles (hidden dir)
│   ├── 🔴 credentials                            AWS access-key + secret, [default] & [prod-deploy] profiles
│   └── ⚪ config                                   region/role_arn profiles only — no secrets
│
├── var/log/nginx/prod-traffic/                   ← the "card-storm" log firehose
│   ├── 🟡 access-01.log                           4,200 lines; every line txn_id=5322… → mistaken for Visa PANs
│   ├── 🟡 access-02.log                           4,200 lines, clean
│   ├── 🟡 access-03.log                           4,200 lines, clean
│   ├── 🟡 access-04.log                           4,200 lines, clean
│   └── 🔴 access-05.log                           4,200 lines; line 2,345 = stack-trace dump leaking sk_live_ key
│
├── deploy/k8s/                                   ← clean manifests (env-from-secretRef only)
│   ├── ⚪ booking-api/deployment.yaml
│   ├── ⚪ pricing/deployment.yaml
│   └── ⚪ search/deployment.yaml
│
├── etc/nginx/
│   └── ⚪ nginx.conf                               documents the txn_id log field (explains the storm)
│
├── README.md  ⚪                                  top-level repo readme
│
└── src/api/v2/                                   ← backend source (50+ clean files, 500+ lines each)
    ├── ⚪ README.md / Dockerfile
    ├── controllers/   ⚪ 12 .cs                    Bookings, Payments, Refunds, Authorization, Ledger,
    │                                               Properties, Rates, Availability, Guests, Reviews,
    │                                               Quotes, Webhooks  (517+ lines each, C#/.NET)
    ├── models/        ⚪ 12 .cs                    BookingAggregate, PaymentIntent, RefundRecord,
    │                                               AuthorizationPolicy, LedgerEntry, RatePlan, … (C#)
    ├── services/      ⚪ 12 .cs                    Tokenization, Settlement, FraudScoring, Velocity,
    │                                               Chargeback, Reconciliation, Currency, Tax, … (C#)
    ├── pricing/       ⚪ 8 .go + go.sum + README    quote, rateplan, surge, currency, tax, ledger,
    │                                               rounding, fx (515+ lines each, Go) · go.sum=1,100-line hash storm
    └── search/        ⚪ 8 .go + go.sum + README    index, query, rank, facet, geo, suggest, filter,
                                                    paginate (Go) · go.sum = SHA hash firehose
```

## The secret matrix (4 files, 7 secret values)

| File | Data it contains | Classes |
|---|---|---|
| 🔴 `srv/secure/v2/config/prod.env` | A dense 150-line production env file burying an AWS access-key (`AKIA…`) + 40-char secret, a Postgres URL with **embedded admin password** (`postgres://admin:…@…rds.amazonaws.com/bookings_prod`), and an OpenAI project key (`sk-proj-`+48), all amid ~140 benign feature-flags/tunables | `aws-access-key-id`, `aws-secret-key`, `db-connection-string`, `openai-api-key` |
| 🔴 `root/.aws/credentials` | Two AWS profiles (`[default]`, `[prod-deploy]`) with plaintext access-key IDs + 40-char secret keys (+ a session token) | `aws-access-key-id`, `aws-secret-key` |
| 🔴 `srv/secure/v2/keys/id_rsa` | A full `-----BEGIN OPENSSH PRIVATE KEY-----` 29-line wrapped PEM block on disk (mode 0600) | `ssh-private-key` |
| 🔴 `var/log/nginx/prod-traffic/access-05.log` | A live Stripe key (`sk_live_`+24) leaked on **exactly line 2,345** inside a rare `StripeException` stack-trace dump — the other 4 logs are spotless | `stripe-live-key` |

## The traps (3 false-positive types — should NOT alert)

| File(s) | Why it looks dangerous | Why it's benign |
|---|---|---|
| 🟡 `var/log/nginx/prod-traffic/access-01…04.log` | Every one of 16,800 lines carries a 16-digit `txn_id=5322…` that passes a Luhn check | They're booking reference IDs with a Mastercard-like `5322` BIN — math-valid but not cards |
| 🟡 `srv/data/pci/dumps/transactions.csv` | 2,300 rows of 16-digit, Luhn-valid `card_pan` values | Synthetic test PANs in a fixture dump — no real account is issued |
| 🟡 `srv/secure/v2/config/.env.example` + `srv/data/pci/etl/pii-masking-site.xml` | `sk_test_` key shape, `AKIAEXAMPLE`, and `000-00-0000` SSNs | Sandbox template placeholders / all-zero masking defaults — no real credential or PII |

## The 66 clean files — the volume the needles hide in

- **52 source files** (`src/api/v2/`): 36 C#/.NET controllers/models/services + 16 Go pricing/search files, 500+ lines each, seeded with decoy identifiers (`clientSecret`, `apiKey`, `SecretToken`) bound to empty strings or `Environment.GetEnvironmentVariable` so shape-only scanners over-flag them.
- **Structural noise**: 2 `go.sum` lockfiles (1,100-line SHA hash storms), 3 READMEs, 2 Dockerfiles.
- **Clean infra**: 3 k8s deployments (`secretRef` only), `nginx.conf`, `root/.aws/config`, the SSH `id_rsa.pub` + `known_hosts`, top-level README.

**The whole point:** the 4 real needles are ~5% of agoda's files, buried in ~95% innocent volume (and especially the ~21,000-line card-shaped log/CSV firehose) — so you can score the legacy regex engine (which will drown in the txn-ID storm and flag the test PANs) against Phase-2's precision on the same disk.

## Phase 2 expansion — fintech / .NET / PCI operational-artifact realism

New surfaces where a payments shop actually leaks (added in `addFintechRealism` + the `PaymentsController` hotfix):

| File | Type | What / technique |
|------|------|------------------|
| `src/api/v2/controllers/PaymentsController.cs` | 🔴 | A `// HOTFIX 2026-03` comment pins a live Stripe key to bypass 3DS — and the key's body literally contains `demo` (`sk_live_…demo…`), so word-exclusion filters miss it — `hotfix-bypass-comment-prod-key` (`stripe-live-key`) |
| `src/api/v2/appsettings.Production.json` | 🔴 | .NET config with a prod DB connection string + Adyen live key — `dotnet-appsettings-prod-secret` (`db-connection-string`, `adyen-live-key`) |
| `srv/data/pci/payments_backup_2026.sql` | 🟡 | pg_dump backup with Luhn PANs + SSNs in `COPY`/INSERT rows — PII in SQL-dump form, not CSV/JSON — `sql-dump-pan-storm` |
| `var/log/payment-api/app-json/payment-api-01…03.log` | ⚪ | Streamed structured JSON app logs with `txn_id` (card-shaped) — `json-log-txn-noise` |
| `etc/envoy/envoy-sidecar.yaml` | ⚪ | Upstream bearer references an SDS/Vault path, no literal token — `vault-ref-no-value` (clean) |
