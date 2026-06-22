// Package insurify builds a hyper-realistic, enterprise-scale simulated
// filesystem for "Insurify" — an InsurTech data-engineering shop whose stack is
// Apache Airflow (the data platform), Django/Python (the quote + pricing APIs),
// S3/Snowflake (the warehouse), and bare-metal racks fronted by netplan. The
// tree is generated as synthetic input for Upwind's Cloud Scanner: the vast
// majority of bytes are innocent — multi-thousand-row PII export sheets,
// blank-schema config files, ordinary service code, and telemetry dumps — while
// a handful of real-shaped (but inert) leaks are buried deep inside live data
// pipeline logic and infrastructure layers.
//
// The footprint deliberately recreates the two legacy-scanner failure classes:
//   - ALERT FATIGUE: 5 × 2,500-row quote dumps full of structurally-valid SSNs
//     and Luhn-valid PANs, plus blank-PII config schemas, that fire thousands of
//     PII/credit-card alerts on assets that leak nothing.
//   - CRITICAL MISSES: an OpenAI project key + Datadog token matrix hidden in an
//     Airflow DAG's env dict, and an AWS service-account token sitting beside a
//     compression-shortened IPv6 address in a netplan rack config.
//
// SECURITY NOTE: nothing here is a real credential. Every "secret" is random
// characters wearing the right prefix/checksum so a scanner's regex fires; none
// authenticate against any real service.
package insurify

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"upwind-context-scanner/pkg/content"
	"upwind-context-scanner/pkg/fsbuilder"
	"upwind-context-scanner/pkg/secrets"
)

// Build assembles and returns the complete Insurify workspace.
func Build(g *secrets.Gen) *fsbuilder.Workspace {
	ws := fsbuilder.NewWorkspace("insurify", "insurtech")

	buildExports(g, ws)        // srv/exports/quotes  — the structured PII storm
	buildAppConfig(g, ws)      // srv/app/config      — terminal + blank-PII schemas
	buildAirflow(g, ws)        // srv/airflow         — DAGs (secret leak) + telemetry
	buildSrcAPI(g, ws)         // src/api             — clean service code
	buildNetplan(g, ws)        // etc/netplan         — rack inventory (infra leak)
	buildMisc(g, ws)           // top-level docs + dependency-hash noise
	buildDataEngRealism(g, ws) // Airflow task-log/conn-uri leaks, airflow.cfg, Django/dbt, NDJSON

	return ws
}

// ---------------------------------------------------------------------------
// srv/exports/quotes — THE STRUCTURED PII STORM.
//
// Five 2,500-row relational CSV sheets. Every cell is synthetic: real-shaped
// SSNs (NNN-NN-NNNN) and Luhn-valid card PANs that a shape-only scanner reads as
// thousands of leaked credit cards and social-security numbers, while the asset
// is leaking nothing at all (hasRealSecret=false on every row).
// ---------------------------------------------------------------------------

func buildExports(g *secrets.Gen, ws *fsbuilder.Workspace) {
	const rowsPerSheet = 2500
	for n := 1; n <= 5; n++ {
		name := fmt.Sprintf("quotes_dump_%02d.csv", n)
		sheetG := g.Fork()
		ws.Add("srv/exports/quotes", fsbuilder.StreamFile(name, "text/csv", "deploy", "0640",
			func(w io.Writer) error { return streamQuotesDump(w, sheetG, rowsPerSheet) },
			fsbuilder.FPNoise("structured-pii-storm-csv")))
	}

	ws.Add("srv/exports", fsbuilder.File("README.md", "text/markdown", "deploy", "0644",
		content.ReadmeMd(g, "quote-exports"), fsbuilder.Clean()))
}

var (
	firstNames = []string{"James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
		"William", "Elizabeth", "David", "Barbara", "Maria", "Jose", "Aisha", "Chen", "Priya", "Omar",
		"Sofia", "Liam", "Noah", "Olivia", "Emma", "Ava", "Lucas", "Mia", "Ethan", "Isabella"}
	lastNames = []string{"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
		"Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Nguyen", "Patel", "Kim",
		"Cohen", "Levi", "Tanaka", "Okafor", "Singh", "Rossi", "Dubois", "Novak", "Haddad", "Costa"}
	quoteStatuses = []string{"quoted", "bound", "lapsed", "declined", "pending", "issued", "renewed", "cancelled"}
)

// streamQuotesDump writes a relational CSV of Scaled(rows) synthetic
// policyholder records straight to w (one of the structured-PII storm sheets).
func streamQuotesDump(w io.Writer, g *secrets.Gen, rows int) error {
	const vinChars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"
	const header = "customer_id,full_name,ssn,dob,zip,email,phone,card_pan,vehicle_vin,annual_premium,policy_status"
	return content.StreamCSV(w, header, rows, func(i int) string {
		first := g.Pick(firstNames)
		last := g.Pick(lastNames)
		name := first + " " + last

		// Structurally-valid SSN; occasionally an all-zero placeholder so the
		// sheet also exercises empty-schema matchers.
		ssn := g.RandSSN()
		if i%337 == 11 {
			ssn = secrets.PlaceholderSSN()
		}

		// Occasionally blank the phone to "N/A" — more empty-PII confusion.
		phone := fmt.Sprintf("(%s) %s-%s", g.Digits(3), g.Digits(3), g.Digits(4))
		if i%149 == 5 {
			phone = "N/A"
		}

		dob := fmt.Sprintf("%04d-%02d-%02d", g.IntRange(1945, 2005), g.IntRange(1, 12), g.IntRange(1, 28))
		zip := g.Digits(5)
		email := fmt.Sprintf("%s.%s%d@example.com", strings.ToLower(first), strings.ToLower(last), i%1000)
		pan := g.LuhnCard() // mathematically Luhn-valid, never issued
		vin := g.Str(vinChars, 17)
		premium := fmt.Sprintf("%d.%02d", g.IntRange(380, 4200), g.Intn(100))

		return fmt.Sprintf("Q%08d,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s",
			1000000+i, name, ssn, dob, zip, email, phone, pan, vin, premium, g.Pick(quoteStatuses))
	})
}

// ---------------------------------------------------------------------------
// srv/app/config — terminal settings + blank-PII configuration schemas.
//
// Ten+ complex JSON configs whose PII attributes are deliberately empty
// ("phone":"N/A", "ssn":"000-00-0000", "zip":"00000"). Lazy key-name matchers
// fire on the keys; the values carry no secret.
// ---------------------------------------------------------------------------

func buildAppConfig(g *secrets.Gen, ws *fsbuilder.Workspace) {
	// The headline example named in the architecture.
	ws.Add("srv/app/config/terminals", fsbuilder.File("terminal_settings.json", "application/json", "deploy", "0644",
		terminalSettings(g), fsbuilder.FPNoise("empty-pii-schema")))

	// Ten more complex blank-PII schemas, nested for depth.
	for i := 1; i <= 10; i++ {
		name := fmt.Sprintf("profile_%02d.json", i)
		ws.Add("srv/app/config/profiles", fsbuilder.File(name, "application/json", "deploy", "0644",
			blankPIIProfile(g, i), fsbuilder.FPNoise("empty-pii-schema")))
	}

	// Clean AWS storage mapping (S3 bucket → prefix routing). No literals.
	ws.Add("srv/app/config/storage", fsbuilder.File("s3_mappings.json", "application/json", "deploy", "0644",
		s3Mappings(g), fsbuilder.Clean()))
}

// terminalSettings is a deep config object whose operator PII fields are blanks.
func terminalSettings(g *secrets.Gen) string {
	doc := map[string]any{
		"schema_version": "2.4.0",
		"terminal_id":    fmt.Sprintf("TERM-%05d", g.IntRange(1, 9999)),
		"location":       "N/A",
		"timezone":       "America/New_York",
		"operator": map[string]any{
			"full_name": "N/A",
			"phone":     "N/A",
			"ssn":       "000-00-0000",
			"email":     "",
			"zip":       "00000",
			"badge_id":  "",
		},
		"card_reader": map[string]any{
			"enabled":     true,
			"model":       "VeriFone-P400",
			"firmware":    fmt.Sprintf("%d.%d.%d", g.Intn(5), g.Intn(20), g.Intn(40)),
			"masked_pan":  "************0000",
			"merchant_id": "",
		},
		"network": map[string]any{
			"dhcp":           true,
			"static_ip":      "0.0.0.0",
			"gateway":        "0.0.0.0",
			"proxy_password": "",
		},
		"compliance": map[string]any{
			"pci_dss_scope":       "out-of-scope",
			"data_retention_days": 0,
			"last_attested_by":    "N/A",
		},
	}
	return mustJSON(doc)
}

// blankPIIProfile emits a customer-profile schema with every PII slot blanked.
func blankPIIProfile(g *secrets.Gen, i int) string {
	doc := map[string]any{
		"profile_id":   fmt.Sprintf("PRF-%06d", i),
		"status":       "template",
		"created_from": "schema-default",
		"applicant": map[string]any{
			"full_name":       "N/A",
			"date_of_birth":   "0000-00-00",
			"ssn":             "000-00-0000",
			"drivers_license": "",
			"phone":           "N/A",
			"email":           "",
		},
		"address": map[string]any{
			"line1":   "",
			"line2":   "",
			"city":    "",
			"state":   "",
			"zip":     "00000",
			"country": "US",
		},
		"payment": map[string]any{
			"card_pan":       "0000000000000000",
			"card_holder":    "N/A",
			"expiry":         "00/00",
			"cvv":            "000",
			"billing_zip":    "00000",
			"bank_account":   "000000000",
			"routing_number": "000000000",
		},
		"underwriting": map[string]any{
			"credit_score":   0,
			"risk_tier":      "",
			"prior_claims":   0,
			"annual_premium": "0.00",
		},
	}
	return mustJSON(doc)
}

// s3Mappings is a clean export-routing config — no embedded credentials.
func s3Mappings(g *secrets.Gen) string {
	doc := map[string]any{
		"default_region": "us-east-1",
		"role_arn":       "arn:aws:iam::000000000000:role/insurify-exports-writer",
		"credentials":    "resolved-via-irsa", // never inline
		"buckets": map[string]any{
			"quote-exports":   map[string]any{"bucket": "insurify-quote-exports", "prefix": "quotes/", "sse": "aws:kms"},
			"telemetry":       map[string]any{"bucket": "insurify-telemetry-prod", "prefix": "events/", "sse": "AES256"},
			"airflow-logs":    map[string]any{"bucket": "insurify-airflow-logs", "prefix": "scheduler/", "sse": "aws:kms"},
			"warehouse-stage": map[string]any{"bucket": "insurify-warehouse-stage", "prefix": "stage/", "sse": "aws:kms"},
		},
	}
	return mustJSON(doc)
}

// ---------------------------------------------------------------------------
// srv/airflow — DAGs (the signature secret leak), plus telemetry noise.
// ---------------------------------------------------------------------------

func buildAirflow(g *secrets.Gen, ws *fsbuilder.Workspace) {
	dagDir := "srv/airflow/dags"

	// THE LEAK: a ~400-line production DAG with an OpenAI project key + a Datadog
	// API/APP token matrix buried inside an "active" env dict.
	ws.Add(dagDir, fsbuilder.File("secure_pipeline.py", "text/x-python", "airflow", "0644",
		securePipelineDAG(g), fsbuilder.TP("airflow-env-dict-leak",
			"openai-api-key", "datadog-api-key", "datadog-app-key")))

	// Clean DAGs alongside it for realism.
	for _, d := range []string{"quote_ingestion_dag", "policy_etl_dag", "premium_aggregation_dag", "snowflake_load_dag"} {
		ws.Add(dagDir, fsbuilder.File(d+".py", "text/x-python", "airflow", "0644",
			content.CleanPython(g, 520), fsbuilder.Clean()))
	}
	ws.Add(dagDir+"/common", fsbuilder.File("hooks.py", "text/x-python", "airflow", "0644",
		content.CleanPython(g, 480), fsbuilder.Clean()))
	ws.Add(dagDir+"/common", fsbuilder.File("operators.py", "text/x-python", "airflow", "0644",
		content.CleanPython(g, 480), fsbuilder.Clean()))

	// Massive telemetry dump — 16-digit txn ids fire card-shaped FPs every line.
	schedG := g.Fork()
	ws.Add("srv/airflow/logs/scheduler", fsbuilder.StreamFile("scheduler.log", "text/plain", "airflow", "0644",
		func(w io.Writer) error {
			return content.StreamNginxLog(w, schedG, content.LogOptions{MinLines: 5200, PlantLine: -1, Service: "scheduler"})
		},
		fsbuilder.FPNoise("airflow-telemetry-txnid-noise")))

	reqG := g.Fork()
	ws.Add("srv/airflow", fsbuilder.StreamFile("requirements.txt", "text/plain", "airflow", "0644",
		func(w io.Writer) error { return streamRequirementsLock(w, reqG, 1100) },
		fsbuilder.FPNoise("airflow-requirements-hash-storm")))
	ws.Add("srv/airflow", fsbuilder.File("Dockerfile", "text/plain", "airflow", "0644",
		content.Dockerfile(g, "apache/airflow:2.9.1-python3.11"), fsbuilder.Clean()))
}

// securePipelineDAG renders a ~400-line Airflow DAG template. The leak lives in
// PIPELINE_ENV — an active dict mapping fed to every task's environment — where
// an OpenAI project key and a Datadog API/APP token sit amongst ~20 innocuous
// tuning vars.
func securePipelineDAG(g *secrets.Gen) string {
	var b []string
	b = append(b,
		"\"\"\"secure_pipeline — Insurify quote-scoring + warehouse-load DAG.",
		"",
		"Runs hourly. Pulls raw quotes from S3, enriches them through the scoring",
		"service, emits metrics to Datadog, and lands curated facts in Snowflake.",
		"\"\"\"",
		"from __future__ import annotations",
		"",
		"import os",
		"from datetime import datetime, timedelta",
		"",
		"from airflow import DAG",
		"from airflow.models import Variable",
		"from airflow.operators.python import PythonOperator",
		"from airflow.operators.bash import BashOperator",
		"from airflow.providers.amazon.aws.hooks.s3 import S3Hook",
		"from airflow.providers.snowflake.operators.snowflake import SnowflakeOperator",
		"",
		"default_args = {",
		"    \"owner\": \"data-platform\",",
		"    \"retries\": 3,",
		"    \"retry_delay\": timedelta(minutes=5),",
		"    \"depends_on_past\": False,",
		"    \"email_on_failure\": True,",
		"    \"email\": [\"data-oncall@insurify.com\"],",
		"}",
		"",
		"# ---------------------------------------------------------------------------",
		"# Runtime environment injected into every task via execution_environment.",
		"# NOTE(platform): most of these are tuning knobs; the integration tokens were",
		"# pinned here during the 2026-Q2 migration and still need to move to Vault.",
		"# ---------------------------------------------------------------------------",
		"PIPELINE_ENV = {",
		"    \"AIRFLOW__CORE__PARALLELISM\": \"64\",",
		"    \"AIRFLOW__CORE__DAG_CONCURRENCY\": \"16\",",
		"    \"AIRFLOW__CORE__MAX_ACTIVE_RUNS_PER_DAG\": \"8\",",
		"    \"PIPELINE_BATCH_SIZE\": \"5000\",",
		"    \"PIPELINE_LOOKBACK_HOURS\": \"6\",",
		"    \"SCORING_MODEL\": \"gpt-4o-mini\",",
		"    \"SCORING_TEMPERATURE\": \"0.0\",",
		"    \"SCORING_MAX_TOKENS\": \"512\",",
		"    # OpenAI project key used by the quote-scoring enrichment step.",
		"    \"OPENAI_API_KEY\": \""+g.OpenAIKey()+"\",",
		"    \"OPENAI_ORG_ID\": \"org-"+g.Alnum(24)+"\",",
		"    # Datadog API + APP token matrix for custom pipeline metrics.",
		"    \"DD_SITE\": \"datadoghq.com\",",
		"    \"DD_API_KEY\": \""+g.DatadogAPIKey()+"\",",
		"    \"DD_APP_KEY\": \""+g.DatadogAppKey()+"\",",
		"    \"DD_SERVICE\": \"secure-pipeline\",",
		"    \"DD_ENV\": \"prod\",",
		"    \"S3_RAW_BUCKET\": \"insurify-quote-exports\",",
		"    \"S3_STAGE_BUCKET\": \"insurify-warehouse-stage\",",
		"    \"SNOWFLAKE_WAREHOUSE\": \"INSURIFY_ETL_WH\",",
		"    \"SNOWFLAKE_DATABASE\": \"INSURIFY_PROD\",",
		"    \"SNOWFLAKE_SCHEMA\": \"QUOTES\",",
		"    \"LOG_LEVEL\": \"INFO\",",
		"}",
		"",
		"# Connection ids are resolved from the Airflow metadata DB / Secrets Backend.",
		"AWS_CONN_ID = \"aws_default\"",
		"SNOWFLAKE_CONN_ID = \"snowflake_default\"",
		"S3_RAW_BUCKET = PIPELINE_ENV[\"S3_RAW_BUCKET\"]",
		"S3_STAGE_BUCKET = PIPELINE_ENV[\"S3_STAGE_BUCKET\"]",
		"",
	)

	// A pool of task callables; loop until the file is ~400 lines, then wire them.
	steps := []string{
		"discover_partitions", "download_raw_quotes", "validate_schema", "dedupe_records",
		"enrich_scores", "compute_premiums", "redact_pii", "stage_to_s3",
		"copy_into_snowflake", "merge_facts", "refresh_marts", "emit_datadog_metrics",
		"run_quality_checks", "archive_processed", "notify_downstream", "cleanup_tmp",
		"reconcile_counts", "build_audit_trail", "publish_lineage", "expire_staging",
		"snapshot_metrics", "rotate_logs", "checkpoint_offsets", "finalize_run",
	}
	for i, s := range steps {
		b = append(b,
			fmt.Sprintf("def _%s(**context):", s),
			fmt.Sprintf("    \"\"\"Step %d: %s.\"\"\"", i+1, strings.ReplaceAll(s, "_", " ")),
			"    ti = context[\"ti\"]",
			"    env = dict(PIPELINE_ENV)",
			fmt.Sprintf("    batch = int(env.get(\"PIPELINE_BATCH_SIZE\", \"%d\"))", g.IntRange(1000, 8000)),
			fmt.Sprintf("    run_id = context.get(\"run_id\", \"manual__%s\")", g.Hex(8)),
			fmt.Sprintf("    rows = min(batch, %d)", g.IntRange(500, 9000)),
			fmt.Sprintf("    ti.xcom_push(key=\"%s_rows\", value=rows)", s),
			fmt.Sprintf("    return {\"step\": \"%s\", \"rows\": rows, \"run_id\": run_id}", s),
			"",
		)
	}

	b = append(b,
		"with DAG(",
		"    dag_id=\"secure_pipeline\",",
		"    default_args=default_args,",
		"    description=\"Hourly quote-scoring + warehouse load.\",",
		"    schedule_interval=\"@hourly\",",
		"    start_date=datetime(2025, 1, 1),",
		"    catchup=False,",
		"    max_active_runs=1,",
		"    tags=[\"insurify\", \"quotes\", \"scoring\", \"prod\"],",
		") as dag:",
		"",
	)
	for _, s := range steps {
		b = append(b,
			fmt.Sprintf("    %s = PythonOperator(", s),
			fmt.Sprintf("        task_id=\"%s\",", s),
			fmt.Sprintf("        python_callable=_%s,", s),
			"        execution_timeout=timedelta(minutes=30),",
			"    )",
			"",
		)
	}
	// Wire the chain.
	chain := "    " + strings.Join(steps, " >> ")
	b = append(b, chain, "")

	return strings.Join(b, "\n")
}

// ---------------------------------------------------------------------------
// src/api — clean Python service code for the public APIs (no secrets).
// ---------------------------------------------------------------------------

func buildSrcAPI(g *secrets.Gen, ws *fsbuilder.Workspace) {
	services := []string{"quotes", "pricing-engine", "analytics"}
	subpkgs := []string{"handlers", "models", "serializers"}
	for _, svc := range services {
		base := "src/api/" + svc
		ws.Add(base, fsbuilder.File("__init__.py", "text/x-python", "deploy", "0644",
			"\"\"\"insurify."+strings.ReplaceAll(svc, "-", "_")+" API package.\"\"\"\n", fsbuilder.Clean()))
		ws.Add(base, fsbuilder.File("app.py", "text/x-python", "deploy", "0644",
			content.CleanPython(g, 520), fsbuilder.Clean()))
		for _, sp := range subpkgs {
			ws.Add(base+"/"+sp, fsbuilder.File(sp+".py", "text/x-python", "deploy", "0644",
				content.CleanPython(g, 540), fsbuilder.Clean()))
			ws.Add(base+"/"+sp, fsbuilder.File("__init__.py", "text/x-python", "deploy", "0644",
				"", fsbuilder.Clean()))
		}
		ws.Add(base+"/tests", fsbuilder.File("test_"+strings.ReplaceAll(svc, "-", "_")+".py", "text/x-python", "deploy", "0644",
			content.CleanPython(g, 360), fsbuilder.Clean()))
	}
}

// ---------------------------------------------------------------------------
// etc/netplan — bare-metal rack inventory. The infrastructure asset leak.
//
// network.yaml carries a compression-shortened IPv6 address (2001:db8::1) to
// exercise scanner rules that only match fully-expanded IPv6, and beside it an
// active AWS service-account access token (the real leak).
// ---------------------------------------------------------------------------

func buildNetplan(g *secrets.Gen, ws *fsbuilder.Workspace) {
	ws.Add("etc/netplan/racks/inventory", fsbuilder.File("network.yaml", "text/yaml", "root", "0600",
		networkYAML(g), fsbuilder.TP("netplan-aws-token-with-compressed-ipv6",
			"aws-access-key-id", "aws-secret-key")))

	// A clean sibling rack manifest for depth + realism.
	ws.Add("etc/netplan/racks/inventory", fsbuilder.File("racks.yaml", "text/yaml", "root", "0644",
		racksYAML(g), fsbuilder.Clean()))
}

func networkYAML(g *secrets.Gen) string {
	return strings.Join([]string{
		"# Netplan render for prod-eks data-plane racks (inventory: row-7).",
		"# Applied by cloud-init on first boot; do not edit by hand.",
		"network:",
		"  version: 2",
		"  renderer: networkd",
		"  ethernets:",
		"    eno1:",
		"      addresses:",
		"        - 10.40.12.8/24",
		"        - \"2001:db8::1/64\"        # compressed IPv6 mgmt address",
		"        - \"fe80::1%eno1/64\"       # link-local (zone-id form)",
		"        - \"::ffff:10.40.12.8\"     # IPv4-mapped IPv6",
		"      gateway4: 10.40.12.1",
		"      nameservers:",
		"        addresses: [10.40.0.2, \"2001:db8::53\"]",
		"      mtu: 9000",
		"    eno2:",
		"      addresses:",
		"        - 10.40.13.8/24",
		"      gateway4: 10.40.13.1",
		"  bonds:",
		"    bond0:",
		"      interfaces: [eno1, eno2]",
		"      parameters:",
		"        mode: 802.3ad",
		"        mii-monitor-interval: 100",
		"",
		"# cloud-init bootstrap: the telemetry agent ships rack metrics straight to",
		"# the S3 sink before IRSA is available, so the service-account token is",
		"# baked into the boot config. TODO(sre): migrate to instance profile.",
		"aws_telemetry_sink:",
		"  region: us-east-1",
		"  bucket: insurify-telemetry-prod",
		"  access_key_id: " + g.AWSKeyID(),
		"  secret_access_key: " + g.AWSSecret(),
		"  endpoint: https://s3.us-east-1.amazonaws.com",
		"",
	}, "\n")
}

func racksYAML(g *secrets.Gen) string {
	var b []string
	b = append(b, "# Physical rack inventory — row-7, prod-eks data plane.", "racks:")
	for r := 1; r <= 6; r++ {
		b = append(b,
			fmt.Sprintf("  - id: rack-7-%02d", r),
			fmt.Sprintf("    u_height: %d", 42),
			fmt.Sprintf("    pdu_mac: %s", g.MAC()),
			"    nodes:")
		for n := 1; n <= 4; n++ {
			b = append(b,
				fmt.Sprintf("      - hostname: eks-node-7-%02d-%02d", r, n),
				fmt.Sprintf("        bmc_ip: 10.40.%d.%d", 20+r, 10+n),
				fmt.Sprintf("        serial: %s", g.Upper(10)))
		}
	}
	return strings.Join(b, "\n") + "\n"
}

// ---------------------------------------------------------------------------
// Top-level docs + dependency-hash noise.
// ---------------------------------------------------------------------------

func buildMisc(g *secrets.Gen, ws *fsbuilder.Workspace) {
	ws.Add("", fsbuilder.File("README.md", "text/markdown", "deploy", "0644",
		content.ReadmeMd(g, "insurify-data-platform"), fsbuilder.Clean()))
	ws.Add("", fsbuilder.File("CODEOWNERS", "text/plain", "deploy", "0644",
		"* @insurify/platform\nsrv/airflow/ @insurify/data-eng\nsrv/exports/ @insurify/data-eng\netc/netplan/ @insurify/sre\nsrc/api/ @insurify/backend\n",
		fsbuilder.Clean()))
	poetryG := g.Fork()
	ws.Add("src/api", fsbuilder.StreamFile("poetry.lock", "text/plain", "deploy", "0644",
		func(w io.Writer) error { return streamRequirementsLock(w, poetryG, 1200) },
		fsbuilder.FPNoise("poetry-lock-hash-storm")))
}

// streamRequirementsLock writes a poetry.lock-style body of >= Scaled(minLines)
// lines to w, every entry carrying a high-entropy sha256 hash (generic-key FP).
func streamRequirementsLock(w io.Writer, g *secrets.Gen, minLines int) error {
	pkgs := []string{"apache-airflow", "boto3", "snowflake-connector-python", "pandas", "numpy",
		"pydantic", "requests", "redis", "sqlalchemy", "great-expectations", "dbt-snowflake",
		"openai", "datadog", "psycopg2-binary", "pyarrow", "cryptography"}
	io.WriteString(w, "# This file is automatically @generated by Poetry and should not be changed by hand.\n\n")
	minLines = content.Scaled(minLines)
	for line := 2; line < minLines; line += 11 {
		i := line
		name := fmt.Sprintf("%s-%d", pkgs[i%len(pkgs)], i)
		fmt.Fprintf(w, "[[package]]\nname = %q\nversion = \"%d.%d.%d\"\ndescription = \"\"\noptional = false\npython-versions = \">=3.9\"\nfiles = [\n",
			name, g.Intn(20), g.Intn(30), g.Intn(40))
		fmt.Fprintf(w, "    {file = \"%s.tar.gz\", hash = \"sha256:%s\"},\n", name, g.SHA256Hex())
		fmt.Fprintf(w, "    {file = \"%s-py3-none-any.whl\", hash = \"sha256:%s\"},\n]\n\n", name, g.SHA256Hex())
	}
	return nil
}

// mustJSON marshals v with two-space indent; deterministic (map keys sorted).
func mustJSON(v any) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		panic(fmt.Sprintf("insurify: marshal config: %v", err))
	}
	return string(data) + "\n"
}

// ---------------------------------------------------------------------------
// Data-engineering operational realism — the Airflow / Django / dbt surfaces
// where an InsurTech shop actually leaks: a Connection URI echoed in a task-log
// stack trace, airflow.cfg's fernet_key + metadata DSN, an exported connections
// file, Django settings, a dbt profile, plus an NDJSON data-lake firehose.
// ---------------------------------------------------------------------------

func buildDataEngRealism(g *secrets.Gen, ws *fsbuilder.Workspace) {
	// TP: an Airflow task-instance log whose traceback echoes a Connection URI
	// (Postgres DSN with embedded password) when get_connection() fails.
	connURI := g.AirflowConnURI("postgresql", "airflow", "airflow-meta-prod.cluster-czk.us-east-1.rds.amazonaws.com", "airflow")
	taskG := g.Fork()
	ws.Add("srv/airflow/logs/task_logs/secure_pipeline/copy_into_snowflake/2026-06-20",
		fsbuilder.StreamFile("attempt=1.log", "text/plain", "airflow", "0644",
			func(w io.Writer) error {
				return content.StreamAirflowTaskLog(w, taskG, content.PlantLog{MinLines: 4000, PlantLine: 1500, Plant: connURI})
			},
			fsbuilder.TP("airflow-task-log-conn-uri-leak", "airflow-conn-uri")))

	// TP: airflow.cfg with the Fernet key and the metadata-DB connection string.
	ws.Add("srv/airflow", fsbuilder.File("airflow.cfg", "text/plain", "airflow", "0600",
		airflowCfg(g),
		fsbuilder.TP("airflow-cfg-fernet-and-dsn", "fernet-key", "db-connection-string")))

	// TP: `airflow connections export` output — real Connection URIs.
	ws.Add("srv/airflow", fsbuilder.File("connections_export.json", "application/json", "airflow", "0600",
		airflowConnectionsExport(g),
		fsbuilder.TP("airflow-connections-export", "airflow-conn-uri")))

	// TP: Django settings.py with SECRET_KEY + a prod DB password.
	ws.Add("src/api/quotes", fsbuilder.File("settings.py", "text/x-python", "deploy", "0644",
		djangoSettings(g),
		fsbuilder.TP("django-settings-secret-key", "django-secret-key", "db-connection-string")))

	// TP: dbt profiles.yml with a Snowflake account password.
	ws.Add("src/dbt", fsbuilder.File("profiles.yml", "text/yaml", "deploy", "0600",
		dbtProfiles(g),
		fsbuilder.TP("dbt-profiles-password", "dbt-snowflake-password")))

	// Scale: NDJSON data-lake event streams (UUID token-FP noise), streamed.
	for i := 1; i <= 4; i++ {
		ndG := g.Fork()
		ws.Add("srv/exports/datalake", fsbuilder.StreamFile(
			fmt.Sprintf("events_2026-06-%02d.ndjson", 17+i), "application/x-ndjson", "deploy", "0640",
			func(w io.Writer) error { return content.StreamNDJSON(w, ndG, 6000) },
			fsbuilder.FPNoise("ndjson-uuid-noise")))
	}
}

func airflowCfg(g *secrets.Gen) string {
	metaDSN := g.PostgresURL("airflow", "airflow-meta-prod.cluster-czk.us-east-1.rds.amazonaws.com", "airflow")
	return strings.Join([]string{
		`[core]`,
		`dags_folder = /opt/airflow/dags`,
		`executor = CeleryExecutor`,
		`parallelism = 64`,
		`# fernet_key encrypts Connection/Variable secrets in the metadata DB.`,
		`fernet_key = ` + g.FernetKey(),
		``,
		`[database]`,
		`sql_alchemy_conn = ` + metaDSN,
		`sql_alchemy_pool_size = 32`,
		``,
		`[webserver]`,
		`base_url = https://airflow.insurify.internal`,
		`workers = 8`,
		``,
		`[celery]`,
		`broker_url = redis://airflow-broker.prod.cache.amazonaws.com:6379/0`,
		`result_backend = db+` + metaDSN,
	}, "\n") + "\n"
}

func airflowConnectionsExport(g *secrets.Gen) string {
	snow := fmt.Sprintf("snowflake://insurify_etl:%s@xy12345.us-east-1/INSURIFY_PROD?warehouse=INSURIFY_ETL_WH", g.SnowflakePassword())
	pg := g.AirflowConnURI("postgresql", "quotes_ro", "quotes-prod.cluster-czk.us-east-1.rds.amazonaws.com", "quotes")
	redis := g.RedisURL("airflow-broker.prod.cache.amazonaws.com")
	return strings.Join([]string{
		`{`,
		`  "snowflake_default": { "conn_type": "snowflake", "uri": "` + snow + `" },`,
		`  "quotes_pg": { "conn_type": "postgres", "uri": "` + pg + `" },`,
		`  "broker_redis": { "conn_type": "redis", "uri": "` + redis + `" }`,
		`}`,
	}, "\n") + "\n"
}

func djangoSettings(g *secrets.Gen) string {
	dbPass := g.Alnum(20)
	return strings.Join([]string{
		`"""Django settings for the Insurify quotes API."""`,
		`from pathlib import Path`,
		``,
		`BASE_DIR = Path(__file__).resolve().parent.parent`,
		``,
		`# SECURITY WARNING: keep the secret key used in production secret!`,
		`SECRET_KEY = "` + g.DjangoSecretKey() + `"`,
		`DEBUG = False`,
		`ALLOWED_HOSTS = ["quotes.insurify.internal"]`,
		``,
		`DATABASES = {`,
		`    "default": {`,
		`        "ENGINE": "django.db.backends.postgresql",`,
		`        "NAME": "quotes",`,
		`        "USER": "quotes_app",`,
		`        "PASSWORD": "` + dbPass + `",`,
		`        "HOST": "quotes-prod.cluster-czk.us-east-1.rds.amazonaws.com",`,
		`        "PORT": "5432",`,
		`    }`,
		`}`,
		``,
		`INSTALLED_APPS = ["django.contrib.admin", "rest_framework", "quotes"]`,
	}, "\n") + "\n"
}

func dbtProfiles(g *secrets.Gen) string {
	return strings.Join([]string{
		`insurify:`,
		`  target: prod`,
		`  outputs:`,
		`    prod:`,
		`      type: snowflake`,
		`      account: xy12345.us-east-1`,
		`      user: insurify_dbt`,
		`      password: ` + g.SnowflakePassword(),
		`      role: TRANSFORMER`,
		`      database: INSURIFY_PROD`,
		`      warehouse: INSURIFY_ETL_WH`,
		`      schema: analytics`,
		`      threads: 8`,
	}, "\n") + "\n"
}
