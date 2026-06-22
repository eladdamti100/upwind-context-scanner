# Insurify Org — Structure & Secret Map

Full structure of the **`insurify`** org (InsurTech data-engineering shop),
annotated with what each file holds and whether it contains a real secret.

> Kept outside `customer-data/` (so it never pollutes the scan corpus) and
> outside `_truth/` (which the generator wipes on every run). Ground truth of
> record lives in `_truth/manifest.json`.

## Legend
- 🔴 **REAL SECRET** (True Positive — `prod-credential`)
- 🟡 **PII / noise** (`noise-pii` — looks alarming, leaks nothing)
- ⚪ **clean** (`asset-inventory` — ordinary code/docs)

## Tree

```
insurify/
├── README.md                                          ⚪ platform docs
├── CODEOWNERS                                          ⚪ team ownership
│
├── srv/
│   ├── exports/
│   │   ├── README.md                                  ⚪
│   │   └── quotes/
│   │       ├── quotes_dump_01.csv                      🟡 2,500 rows PII
│   │       ├── quotes_dump_02.csv                      🟡 2,500 rows PII
│   │       ├── quotes_dump_03.csv                      🟡 2,500 rows PII
│   │       ├── quotes_dump_04.csv                      🟡 2,500 rows PII
│   │       └── quotes_dump_05.csv                      🟡 2,500 rows PII
│   │
│   ├── app/config/
│   │   ├── terminals/terminal_settings.json           🟡 blank-PII schema
│   │   ├── profiles/profile_01.json … profile_10.json 🟡 blank-PII schema (×10)
│   │   └── storage/s3_mappings.json                   ⚪ S3 routing (IRSA, no creds)
│   │
│   └── airflow/
│       ├── Dockerfile                                 ⚪
│       ├── requirements.txt                           🟡 1,100-line hash storm
│       ├── logs/scheduler/scheduler.log               🟡 5,200-line telemetry dump
│       └── dags/
│           ├── secure_pipeline.py                     🔴 REAL SECRET (459 lines)
│           ├── quote_ingestion_dag.py                 ⚪
│           ├── policy_etl_dag.py                       ⚪
│           ├── premium_aggregation_dag.py             ⚪
│           ├── snowflake_load_dag.py                  ⚪
│           └── common/{hooks.py, operators.py}        ⚪
│
├── src/api/
│   ├── poetry.lock                                    🟡 1,200-line hash storm
│   ├── quotes/         {app.py, handlers/, models/, serializers/, tests/}   ⚪
│   ├── pricing-engine/ {app.py, handlers/, models/, serializers/, tests/}   ⚪
│   └── analytics/      {app.py, handlers/, models/, serializers/, tests/}   ⚪
│
└── etc/netplan/racks/inventory/
    ├── network.yaml                                   🔴 REAL SECRET (34 lines)
    └── racks.yaml                                     ⚪ rack inventory
```

## 🔴 The two real secrets (True Positives)

| File | What's leaked | How it's hidden |
|------|---------------|-----------------|
| `srv/airflow/dags/secure_pipeline.py` | OpenAI project key (`sk-proj-…`) + Datadog **API key** (32-hex) + Datadog **APP key** (40-hex) | Buried in the live `PIPELINE_ENV` dict among ~20 innocuous `AIRFLOW__CORE__*` / scoring tuning vars |
| `etc/netplan/racks/inventory/network.yaml` | AWS **access-key-id** (`AKIA…`) + **secret-access-key** | In an `aws_telemetry_sink` cloud-init block, sitting right next to a compression-shortened IPv6 `2001:db8::1` (decoy meant to slip past expanded-IPv6-only rules) |

## 🟡 The noise that fools legacy scanners (False Positives — no real data leaked)

| Files | What they contain | Why a dumb scanner panics |
|-------|-------------------|----------------------------|
| `quotes_dump_01–05.csv` | 12,500 synthetic rows: `customer_id, full_name, ssn (NNN-NN-NNNN), dob, zip, email, phone, card_pan, vehicle_vin, premium, status` | SSNs are structurally valid; `card_pan`s are **Luhn-valid** → thousands of fake credit-card / PII alerts |
| `terminal_settings.json` + `profile_01–10.json` | Config schemas with PII **keys** but empty/placeholder values (`"ssn":"000-00-0000"`, `"phone":"N/A"`, `"zip":"00000"`) | Lazy key-name matchers fire on the field names |
| `scheduler.log` | 5,200 log lines, each carrying a 16-digit `txn_id` | Card-shaped regex matches every line |
| `requirements.txt`, `poetry.lock` | ~2,300 lines of pinned `sha256:` package hashes | High-entropy hashes read as generic API keys |

## Totals

60 files (~3 MB) — **2 with real secrets**, 19 PII/noise decoys, 39 clean.
Everything is synthetic (random characters wearing real prefixes/checksums);
nothing authenticates against any service.

## Phase 2 expansion — data-engineering operational-artifact realism

New surfaces where an InsurTech/Airflow shop actually leaks (added in `buildDataEngRealism`):

| File | Type | What / technique |
|------|------|------------------|
| `srv/airflow/logs/task_logs/secure_pipeline/copy_into_snowflake/2026-06-20/attempt=1.log` | 🔴 | Task traceback echoes a Connection URI (Postgres DSN with embedded password) when `get_connection()` fails — `airflow-task-log-conn-uri-leak` (`airflow-conn-uri`) |
| `srv/airflow/airflow.cfg` | 🔴 | `fernet_key` + `sql_alchemy_conn` metadata-DB password — `airflow-cfg-fernet-and-dsn` (`fernet-key`, `db-connection-string`) |
| `srv/airflow/connections_export.json` | 🔴 | `airflow connections export` output with Snowflake/Postgres/Redis URIs — `airflow-connections-export` (`airflow-conn-uri`) |
| `src/api/quotes/settings.py` | 🔴 | Django `SECRET_KEY` + prod DB password — `django-settings-secret-key` (`django-secret-key`, `db-connection-string`) |
| `src/dbt/profiles.yml` | 🔴 | dbt Snowflake account password — `dbt-profiles-password` (`dbt-snowflake-password`) |
| `srv/exports/datalake/events_2026-06-*.ndjson` | ⚪ | Streamed NDJSON data-lake event stream; UUIDs ≈ token-FP noise (scale driver) — `ndjson-uuid-noise` |

Also: `etc/netplan/racks/inventory/network.yaml` now carries two more compressed
IPv6 forms (`fe80::1%eno1`, `::ffff:10.40.12.8`) next to the AWS token, widening
the compression-slip coverage.

## Scale & determinism (whole corpus)

The four agents now total **389 files**; bulk noise (logs, lockfiles, CSV/SQL/NDJSON
dumps) streams to disk and scales with the `CORPUS_SCALE` env var — `CORPUS_SCALE=8`
yields a ~240 MB corpus while peak RSS stays ~23 MB. Output is byte-for-byte
reproducible per scale (per-agent seeds; streamed files draw from a forked
generator). Ground truth of record remains `_truth/manifest.json`.
