# Wix Org — Annotated Structure

Complete annotated structure of the **wix** org (95 files).

**Legend:** 🔴 real secret (TP) · 🟡 false positive (looks like a secret, but benign) · ⚪ clean noise.

```
customer-data/wix/
│
├── srv/                                          ← production infrastructure
│   ├── k8s/prod-cluster/
│   │   ├── ingress/
│   │   │   ├── 🔴 tls.key                         OpenSSH PRIVATE KEY (30-line PEM block)
│   │   │   ├── ⚪ tls.crt                          public cert (not a secret)
│   │   │   └── ⚪ ingress.yaml
│   │   └── namespaces/
│   │       ├── auth/
│   │       │   ├── ⚪ deployment-spec.yaml         CLEAN — uses secretKeyRef
│   │       │   ├── ⚪ service.yaml / configmap.yaml / hpa.yaml
│   │       ├── billing/
│   │       │   ├── 🔴 deployment-spec.yaml         GitHub fine-grained PAT + Slack webhook (env block)
│   │       │   ├── ⚪ service.yaml / configmap.yaml / hpa.yaml
│   │       └── routing/
│   │           ├── ⚪ deployment-spec.yaml         CLEAN — uses secretKeyRef
│   │           ├── 🟡 feature-flags.yaml           UUID "tokens" → mistaken for credentials
│   │           ├── ⚪ service.yaml / configmap.yaml / hpa.yaml
│   │
│   ├── deploy/terraform/
│   │   ├── 🔴 main.tfstate                         AWS access key (AKIA…) + 40-char secret (542-line JSON)
│   │   ├── ⚪ main.tf / variables.tf / backend.tf
│   │
│   ├── observability/
│   │   ├── ⚪ datadog.env                           CLEAN — values are ${ENV} references, not literals
│   │   └── ⚪ datadog-agent.yaml                    api_key via Vault ENC[…]
│   │
│   └── log/edge-router/
│       └── 🟡 access.log                           5,200 lines; 16-digit txn IDs → mistaken for Visa PANs
│
├── root/.git/                                     ← checked-out repo (hidden dir)
│   ├── 🔴 config                                   GitHub PAT embedded in remote origin URL
│   ├── ⚪ HEAD / description / packed-refs
│   ├── ⚪ hooks/pre-commit.sample
│   └── ⚪ info/exclude
│
├── home/jenkins/cache/                            ← the "lockfile firehose" (high-entropy noise)
│   └── build-01 … build-10/   (10 dirs)
│       ├── ⚪ go.sum                                ~1,050 lines of SHA hashes each
│       └── ⚪ package-lock.json                     ~1,050 lines of sha512 integrities each
│
└── src/                                           ← application source (clean code w/ decoy identifiers)
    ├── web/editor/
    │   ├── components/   ⚪ 10 .tsx + index.ts      Button, Modal, Tooltip, Dropdown, …
    │   ├── dashboard/    ⚪ 10 .tsx + index.ts      Overview, AnalyticsPanel, BillingCard, …
    │   └── blocks/       ⚪ 10 .tsx + index.ts      HeroBlock, GalleryBlock, FormBlock, …
    │                                                (30 TSX files, 420+ lines each)
    └── server/
        ├── checkout/  domains/  media/             ⚪ handlers.go + handlers_test.go (Go)
        ├── identity/  bookings/                    ⚪ {Name}Service.scala + {Name}Repository.scala
        └── premium/
            ├── ⚪ PremiumService.scala / PremiumRepository.scala
            └── test/resources/
                └── 🟡 stripe-sandbox.conf          sk_test_ sandbox key → benign test fixture
```

## The secret matrix (4 files, 6 secrets)

| File | Data it contains | Classes |
|------|------------------|---------|
| 🔴 `srv/k8s/.../billing/deployment-spec.yaml` | Fine-grained GitHub PAT (`github_pat_`+82) **and** Slack incoming webhook URL, pasted plaintext into the container `env:` array | `github-pat`, `slack-webhook` |
| 🔴 `srv/deploy/terraform/main.tfstate` | Live AWS access-key ID (`AKIA…`) **and** 40-char secret access key, persisted in plaintext Terraform state | `aws-access-key-id`, `aws-secret-access-key` |
| 🔴 `root/.git/config` | GitHub PAT baked into the `url = https://<pat>@github.com/…` remote | `github-pat` |
| 🔴 `srv/k8s/.../ingress/tls.key` | Full `-----BEGIN OPENSSH PRIVATE KEY-----` 30-line PEM block | `ssh-private-key` |

## The traps (3 false positives — should NOT alert)

| File | Why it looks dangerous | Why it's benign |
|------|------------------------|-----------------|
| 🟡 `.../routing/feature-flags.yaml` | fields literally named `experiment_token` / `cohort_token` | values are opaque experiment UUIDs, not credentials |
| 🟡 `srv/log/edge-router/access.log` | every line has a 16-digit `txn_id=` | transaction IDs that collide with Visa-card regex |
| 🟡 `.../premium/.../stripe-sandbox.conf` | `sk_test_…` Stripe secret key shape | Stripe **test-mode** key — moves no real money |

**Everything else (88 files)** — the deployments using `secretKeyRef`, `datadog.env` with `${ENV}` references, the 20 lockfiles, and all 42 source files — is clean structural noise. The whole point: the 6 real needles are ~4% of the files, buried in 96% innocent volume so you can score precision vs. recall.

## Phase 2 expansion — GitOps / observability operational-artifact realism

New surfaces where an EKS shop actually leaks (added in `buildGitOpsRealism`):

| File | Type | What / technique |
|------|------|------------------|
| `srv/k8s/helm/billing/values-prod.yaml` | 🔴 | Plaintext PAT + prod DB URL pasted into a Helm override while debugging a SealedSecret — `helm-values-plaintext-override` (`github-pat`, `db-connection-string`) |
| `srv/runbooks/incident-2026-04-payments.md` | 🔴 | Postmortem with a `kubectl describe pod` env dump in a code block leaking Datadog keys — `postmortem-env-dump-paste` (`datadog-api-key`, `datadog-app-key`) |
| `srv/observability/datadog/synthetics_monitors.json` | 🔴 | Exported monitor with API+APP keys embedded for CI re-import — `datadog-export-embedded-key` |
| `src/web/editor/.npmrc` | 🔴 | Real npm registry `_authToken` committed — `npmrc-auth-token` (`npm-token`) |
| `srv/k8s/helm/billing/sealed-secret.yaml` | 🟡 | Genuine SealedSecret ciphertext — high entropy, encrypted, leaks nothing — `sealedsecret-ciphertext-noise` |
| `srv/observability/datadog/metrics-stream.pem` | 🟡 | `-----BEGIN …-----` block that base64-decodes to benign metrics — `fake-pem-telemetry-block` |
| `srv/log/eks-audit/audit-01…04.json` | ⚪ | Streamed CloudWatch/EKS audit firehose (scales with `CORPUS_SCALE`) — `k8s-audit-log-noise` |
