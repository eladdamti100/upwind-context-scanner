# Product Spec

# Product Spec — Context-Aware Sensitive Data Classification for Cloud Scanner

## 1. Product Summary

The product is an intelligent classification layer for a Cloud Scanner that scans customer files in the cloud and detects sensitive data, secrets, and credentials.  
The existing system identifies findings mainly through Regex and rigid rule-based detection. This approach is useful as an initial candidate-detection layer, but it creates many false positives because it detects text patterns without understanding the context in which the finding appears.

The proposed product does not replace the Regex layer. Instead, it adds a Context-Aware Classification layer on top of it. This layer analyzes the file type, file location, variable name, surrounding text, technical characteristics of the suspicious value, asset exposure, customer type, deterministic rules, and a LightGBM model in order to decide whether the finding is a real secret, a borderline finding, or a false positive.

The main goal is to reduce alert noise without missing real secrets, and to prioritize the most critical findings for the customer.

---

## 2. Problem

Today, Regex-based secret scanners identify findings based only on the shape of the text. For example, a string that looks like an API key, token, credit card, password, or cloud credential may be flagged as suspicious even if it appears inside a README file, test file, documentation, placeholder, or test fixture.

The core problem is that Regex does not understand the following questions:

- Is the finding located in a production file or a test file?
- Does it appear inside documentation or inside a real configuration file?
- Does the value look like a real secret or like a placeholder?
- Does the variable name indicate that this is a real secret?
- Is the finding located in an exposed cloud asset or an internal asset?
- Is this a highly dangerous credential type?
- Is the secret still active and valid?
- Is the finding relevant to the customer’s industry and data profile?

As a result, two problems occur at the same time:

1. Too many false positives — the customer receives too many alerts and starts ignoring the system.
2. False negatives — due to inaccurate Regex rules, missing rules, over-filtering, or structural limitations, real secrets may be missed.

---

## 3. Product Goals

### Main Goals

- Reduce false positives in sensitive data and secret findings.
- Maintain high recall and avoid missing real secrets.
- Assign every finding a clear Risk Score and Priority.
- Explain to the user why a finding is dangerous or why it is likely a false positive.
- Display findings safely using masking and redaction.
- Allow the customer to control the scanner’s sensitivity level.
- Adapt rules based on customer type or industry vertical.
- Prioritize the most critical exposed secrets for the customer.

### Hackathon Demo Goals

- Demonstrate improvement compared to a Regex-only scanner.
- Show examples where Regex detects a finding, but the context layer downgrades it to Low Risk.
- Show examples where a real secret receives high priority.
- Present a clear GUI with findings, Risk Score, explanation, masking, validation status, and a map view.
- Use mock data built specifically for the demo.

---

## 4. Non-Goals for the First Phase

The MVP does not require:

- Replacing the entire existing Regex engine.
- Running a heavy LLM on every file.
- Sending real secrets to an external model.
- Building a full production-ready system.
- Supporting every possible secret type.
- Performing automatic remediation.
- Training a large model from scratch.
- Building a full real-time feedback learning system, only designing it as a future extension.

---

## 5. High-Level Architecture

The system will include the following stages:

```text id="lsfqhd"
Customer Cloud Files
→ Regex Layer
→ Finding Context Object
→ Context Feature Extraction
→ Deterministic Rules
→ LightGBM Model
→ Final Risk & Priority Scoring
→ Validation Layer
→ UI: Findings + Map + Explanation
```

### General Explanation

1. **Customer Cloud Files**  
   The input is the customer’s cloud files, such as config files, env files, source code, logs, documentation, IaC files, JSON files, and YAML files.

2. **Regex Layer**  
   A static layer that identifies sensitive-data candidates using Regex, entropy, validators, and rule packs.

3. **Finding Context Object**  
   Each finding is passed to the intelligent layer as a structured, masked, and normalized object.

4. **Context Feature Extraction**  
   The system extracts features from the finding’s location, variable name, surrounding text, file type, and value characteristics.

5. **Deterministic Rules**  
   Clear rules that increase or decrease risk based on known context.

6. **LightGBM Model**  
   A lightweight ML model that runs on the customer side and returns the probability that the finding is a real secret.

7. **Final Scoring**  
   The system combines Regex confidence, deterministic rules, LightGBM output, asset exposure, secret criticality, and validation status.

8. **UI**  
   Findings are displayed by priority, including explanation, masked value, validation status, and map representation.

---

## 6. Regex Layer and Rule Packs

The Regex layer is responsible for candidate generation, not for the final decision.

### Rule Pack Structure

Rules will be divided into several layers:

- **Base Rules** — rules that run for every customer.
- **Vertical Rule Packs** — rules based on customer type or vertical, such as Fintech, SaaS, Healthcare, and E-commerce.
- **Customer-Specific Rules** — future rules customized for a specific customer.
- **Context Suppression Rules** — rules that lower confidence in clear noise scenarios.

### Examples

Base Rules:

- AWS Access Key
- AWS Secret Key
- GitHub Token
- Slack Token
- Google API Key
- PEM Private Key
- JWT
- Generic API Key
- Email
- Credit Card

Fintech Rule Pack:

- Stripe Secret Key
- PayPal Token
- Plaid Secret
- IBAN
- Card numbers with validation
- Risk reduction for test card numbers

SaaS Rule Pack:

- OpenAI Key
- Anthropic Key
- Datadog API Key
- Sentry DSN
- NPM Token
- DockerHub Token
- Database connection strings

Healthcare Rule Pack:

- NPI
- SSN in a healthcare context
- MRN
- FHIR / HL7 tokens
- Patient-related identifiers

### Regex Layer Output

This layer will pass a Finding Context Object to the intelligent layer.

---

## 7. Finding Context Object

Every finding that reaches the intelligent layer will include only masked and normalized information.

Example:

```json id="cjgf86"
{
  "finding_id": "finding_001",
  "file": {
    "file_name": ".env",
    "file_path": "/services/payment/prod/.env",
    "file_extension": "env",
    "file_role": "production_config",
    "storage_location": "s3://customer-prod-bucket/services/payment/.env"
  },
  "candidate": {
    "detected_type": "api_key",
    "masked_value": "sk_live_************",
    "value_prefix": "sk_live",
    "value_suffix": "x92a",
    "value_length": 48,
    "entropy": 4.72,
    "entropy_level": "high",
    "line_number": 12,
    "variable_name": "STRIPE_SECRET_KEY"
  },
  "regex": {
    "rule_id": "stripe_secret_key",
    "rule_source": "fintech",
    "regex_confidence": "high"
  },
  "local_context": {
    "line_text_masked": "STRIPE_SECRET_KEY=sk_live_********",
    "previous_lines_masked": ["# Production payment configuration"],
    "next_lines_masked": ["STRIPE_WEBHOOK_SECRET=whsec_********"]
  },
  "scan_metadata": {
    "sensitivity_mode": "balanced",
    "customer_vertical": "fintech",
    "enabled_rule_packs": ["base", "fintech"]
  }
}
```

The guiding principle is to pass enough information for decision-making, but not the full secret and not the entire file content.

---

## 8. Context Feature Extraction

The Context Feature Extraction layer does not make decisions.  
Its role is to transform raw information into clear features that can be used by deterministic rules and the ML model.

### Main Features

#### File & Path Features

- `is_prod_path`
- `is_dev_path`
- `is_test_path`
- `is_docs_path`
- `is_example_path`
- `is_config_file`
- `is_source_code_file`
- `is_log_file`
- `is_iac_file`
- `file_role`
- `environment_hint`

#### Value Features

- `detected_type`
- `value_prefix`
- `value_length`
- `entropy`
- `entropy_level`
- `has_live_prefix`
- `has_test_prefix`
- `looks_like_placeholder`
- `is_known_test_value`

#### Variable Features

- `variable_name`
- `has_secret_variable_name`
- `has_public_variable_name`
- `variable_intent`

Examples:

- `STRIPE_SECRET_KEY` → secret intent
- `PUBLIC_API_URL` → public config intent
- `example_token` → example/test intent

#### Text Context Features

- `has_example_language`
- `has_placeholder_language`
- `has_test_language`
- `has_secret_language`
- `has_production_language`
- `has_documentation_context`

Examples of words that reduce risk:

- example
- sample
- dummy
- fake
- mock
- placeholder
- replace_me
- your_api_key
- test only

Examples of words that increase risk:

- production
- secret
- private
- token
- password
- credential
- live
- deploy

#### Exposure & Asset Features

- `storage_type`
- `storage_exposure`
- `is_publicly_accessible`
- `asset_criticality`
- `service_context`
- `account_context`
- `cloud_provider`

---

## 9. Deterministic Rules Layer

The deterministic rules layer will run in parallel to the LightGBM model and produce a rule-based score.

The rules will be divided into:

1. Default deterministic rules
2. Vertical-specific deterministic rules
3. Future customer-specific deterministic rules
4. Guardrail rules

### Risk-Increasing Rules

Examples:

```text id="mwfq8h"
IF is_prod_path = true
AND is_config_file = true
AND has_secret_variable_name = true
THEN increase risk
```

```text id="j69dh2"
IF detected_type = private_key
THEN set minimum severity = high
```

```text id="6wohe0"
IF has_live_prefix = true
AND entropy_level = high
THEN increase risk
```

```text id="2yw4j2"
IF storage_exposure = public
AND detected_type in [cloud_key, private_key, database_password]
THEN set priority = critical
```

### Risk-Reducing Rules

Examples:

```text id="jnl183"
IF is_docs_path = true
AND has_example_language = true
THEN decrease risk
```

```text id="tyxog0"
IF is_test_path = true
AND is_known_test_value = true
THEN decrease risk
```

```text id="p3lct4"
IF looks_like_placeholder = true
THEN decrease risk
```

```text id="28ad92"
IF detected_type = email
AND file_role = documentation
THEN decrease risk
```

### Guardrails

Guardrails prevent the system from lowering the risk too much in dangerous cases.

Examples:

```text id="901awo"
Private key block can never be lower than High
```

```text id="pa1rrw"
Cloud credential in production config can never be lower than High
```

```text id="t8pk15"
Validated active secret can never be lower than Critical
```

```text id="svuv94"
High-risk secret in public asset cannot be suppressed automatically
```

---

## 10. LightGBM Model

The central model in the intelligent layer will be LightGBM.

### Why LightGBM

LightGBM is well-suited for this problem because the model input is structured tabular features, not free text.  
The product does not need a heavy language model that understands an entire file. Instead, it needs a lightweight model that receives masked attributes and returns the probability that the finding is a real secret.

Advantages:

- Runs locally in the customer environment.
- Lightweight in terms of resources.
- Suitable for tabular classification.
- Enables fast inference.
- Can be trained on mock data for the demo.
- Easier to explain than an SLM.
- Does not require sending secrets to an external model.

### Model Input

The model will receive features such as:

```text id="85r66i"
detected_type
regex_confidence
value_length
entropy_level
has_live_prefix
has_test_prefix
looks_like_placeholder
file_role
environment_hint
is_prod_path
is_docs_path
is_test_path
is_config_file
variable_intent
has_secret_variable_name
has_example_language
has_placeholder_language
has_test_language
storage_exposure
asset_criticality
customer_vertical
```

### Model Output

The model will return:

```json id="xmi57h"
{
  "secret_probability": 0.91
}
```

Or in an extended version:

```json id="ak2zj4"
{
  "secret_probability": 0.91,
  "model_classification": "likely_true_secret"
}
```

### Training Labels

In the mock data, every finding will be labeled using one of the following labels:

- `true_secret`
- `likely_secret`
- `false_positive`
- `placeholder`
- `documentation_example`
- `test_value`
- `public_non_secret`
- `unknown_or_review`

For the MVP, the model can start with binary classification:

- `true_secret`
- `false_positive`

Later, it can be expanded to multi-class classification.

---

## 11. Final Risk Score

The system will generate two different scores:

1. **Authenticity Score** — how likely the finding is to be a real secret.
2. **Priority Score** — how urgent it is to handle this finding.

### Authenticity Score

Authenticity Score answers the question:

> Is this a real secret or a false positive?

Suggested formula:

```text id="o3fsvh"
Authenticity Score =
25% Regex Confidence
+ 35% Deterministic Rules Score
+ 40% LightGBM Secret Probability
```

LightGBM receives the highest weight because it learns the combination of different features.  
The deterministic rules remain highly significant in order to preserve transparency and guardrails.

### Priority Score

Priority Score answers the question:

> What should the customer handle first?

Suggested formula:

```text id="ua5ull"
Priority Score =
45% Authenticity Score
+ 25% Secret Type Severity
+ 20% Exposure Score
+ 10% Asset Criticality
```

### Secret Type Severity

Example ranking:

- Private Key — 100
- Cloud Access Key — 95
- Database Password — 90
- Payment Provider Secret — 85
- GitHub Token — 80
- Generic API Token — 65
- Credit Card / PII — depends on volume and context
- Email — lower, unless it is bulk PII

### Exposure Score

Example ranking:

- Public bucket / publicly accessible asset — 100
- Internet-exposed asset — 90
- Shared storage / broad access — 75
- Internal production asset — 65
- Private dev/test asset — 30
- Documentation-only context — 10

### Priority Levels

```text id="vxj755"
90–100 → Critical
75–89  → High
50–74  → Medium
25–49  → Low
0–24   → Suppressed / Informational
```

---

## 12. What Counts as “Most Critical”

A critical finding is not only a finding that looks like a secret. It is a finding that combines several risk factors:

1. High probability of being a real secret.
2. High potential damage based on the secret type.
3. Broad exposure or dangerous location.
4. Located in production or in a critical asset.
5. Validated as active, if validation was performed.

Examples of critical findings:

```text id="83rsyy"
AWS Access Key
+ production config
+ public/shared cloud storage
+ high asset criticality
```

```text id="bde2p9"
Private Key
+ container image layer
+ internet-facing workload
```

```text id="wpr55x"
Database Password
+ prod .env file
+ payment service
```

```text id="u00dln"
Stripe Secret Key
+ live prefix
+ fintech customer
+ production config
```

---

## 13. Secret Validation Layer

The product will include the ability to validate a sensitive finding in order to determine whether the secret is still active.

### Purpose of Validation

Regex and ML can estimate that a finding looks like a secret, but validation can check whether it is actually an active credential against the relevant service.

Examples:

- GitHub Token — check against the GitHub API.
- AWS Access Key — check through AWS STS or a safe identity verification call.
- Stripe Secret Key — check against the Stripe API.
- Slack Token — check against a Slack auth endpoint.
- Datadog API Key — check against a dedicated API endpoint.

### Safe Validation Design

Validation will run in the customer environment or inside an isolated local component.

Principles:

- The full secret will not be sent to Upwind.
- The secret will not be stored after validation.
- Validation will be opt-in or triggered by an explicit user action.
- An audit log will record who ran validation and when.
- Only the validation result will be stored, not the secret value.
- Rate limits must be defined to avoid operational load or risk.
- The user should see a warning before external validation is performed.

### Possible Statuses

- `not_validated`
- `validated_active`
- `validated_inactive`
- `validation_unsupported`
- `validation_failed`
- `validation_permission_required`

### Impact on Priority

- `validated_active` → significantly increases Priority.
- `validated_inactive` → lowers Priority, but does not necessarily suppress the finding.
- `validation_failed` → does not change the score, only indicates uncertainty.
- `validation_unsupported` → remains based on the regular Risk Score.

For the demo, validation can be implemented as a mock service that returns statuses based on secret type and mock data.

---

## 14. Sensitivity Control

The customer will be able to choose the scanner’s sensitivity level.

Product wording:

> The customer can choose the scanner’s sensitivity level — from a strict mode that prioritizes not missing secrets, to a flexible mode that reduces noise and surfaces only meaningful findings.

### Proposed Modes

- **Strict** — surfaces more findings and almost never suppresses.
- **Balanced** — the default mode, balancing security and noise reduction.
- **Flexible** — surfaces mainly meaningful findings and downgrades more findings to Low Priority.

### System Impact

The sensitivity level does not change the score itself, but rather the thresholds.

Example:

```text id="yh018g"
Strict:
Priority Score 60+ → Alert

Balanced:
Priority Score 75+ → Alert

Flexible:
Priority Score 85+ → Alert
```

The same finding can receive the same score but be displayed differently depending on the selected sensitivity level.

---

## 15. Personalization by Customer Type

In addition to sensitivity control, the system will adapt its rules to the customer type.

Important: This is not a feature manually controlled by the user in the demo.  
It is an internal product capability. The customer type will be determined through customer profile, metadata, or onboarding.

### Example Verticals

- Fintech
- SaaS
- Healthcare
- E-commerce
- Default / General

### Where This Has Impact

1. Regex Rule Packs  
   Adapts which secret types are searched for.

2. Deterministic Rules  
   Adapts which rules increase or decrease risk.

3. Secret Type Severity  
   Adjusts the severity of secret types based on the customer’s domain.

4. Validation Support  
   Adapts supported external validation services.

### Example

A Fintech customer will receive stronger rules around:

- Payment provider keys
- Stripe / PayPal / Plaid
- Credit cards
- IBAN
- Banking identifiers

A SaaS customer will receive stronger rules around:

- Cloud credentials
- GitHub tokens
- CI/CD secrets
- API provider keys
- Database connection strings

---

## 16. Map View

The product will include a map view that connects Sensitive Data findings to the cloud assets in which they were found.

### Purpose of the Map

The map helps the user understand where exposed secrets exist inside the cloud environment and what their potential impact is.

### Proposed Display

The map will show:

- Cloud accounts
- Storage assets
- Buckets
- Repositories
- Workloads / services, if available
- Internet ingress / public exposure
- Secret findings on top of assets
- Severity by color or badge

### User Capabilities

The user can:

- See which assets contain secrets.
- Understand which secrets are located in the most exposed assets.
- Click an asset and view its findings.
- Filter by Critical / High / Medium / Low.
- See whether the finding was validated or not.
- Understand the relationship between a secret and broad exposure.

### Example

In the map, a bucket that contains a critical secret receives a red badge.  
Clicking it opens a side panel:

```text id="f8xo8c"
Asset: customer-prod-bucket
Exposure: Public / Broad Access
Findings:
- AWS Access Key — Critical — Validated Active
- Stripe Secret Key — High — Not Validated
- Email list — Medium — Bulk PII
```

---

## 17. Main UI — Findings Dashboard

The main dashboard will display findings by Priority.

### Core Components

#### Summary Cards

- Total Findings
- Critical Findings
- High Risk Secrets
- Likely False Positives Reduced
- Validated Active Secrets
- Suppressed Findings

#### Findings Table

Suggested columns:

- Priority
- Secret Type
- Classification
- Risk Score
- Validation Status
- File Path
- Asset / Storage
- Environment
- Reason
- Action

#### Finding Detail Panel

When a user clicks a finding, the panel will show:

- Masked value
- File path
- Line number
- Detected type
- Regex rule
- Triggered deterministic rules
- LightGBM probability
- Risk score breakdown
- Validation status
- Explanation
- Recommended action

### Example Explanation

```text id="4sg6mi"
Critical finding: AWS Access Key found in production config file.
The value has high entropy, appears under a secret variable name, is located in a production path, and the storage asset is publicly accessible.
```

False positive example:

```text id="itqmwp"
Likely false positive: API key-looking value found in README documentation.
The surrounding text describes it as an example, and the value uses a placeholder-like pattern.
```

---

## 18. Recommended Actions

Each finding can include a recommended action.

Examples:

- Rotate this secret.
- Remove the secret from the file.
- Move the secret to a secret manager.
- Restrict access to the storage asset.
- Validate whether the credential is active.
- Mark as false positive.
- Add suppression rule.
- Review manually.

In the MVP, these actions can be recommendations only, not actual remediation.

---

## 19. Learning Feedback — Optional Future Feature

Future feature: the user can mark whether the classification was correct.

### Possible Actions

- Confirm as real secret
- Mark as false positive
- Suppress similar findings
- Add to allowlist
- Add customer-specific rule

### Stored Information

If the user marks a finding as non-sensitive, the system will not store the secret itself. Instead, it will store a fingerprint or masked attributes:

- hash of the value
- detected type
- normalized path pattern
- variable name
- reason
- customer scope

### Goal

In future scans, the system can downgrade or hide similar findings based on the customer’s decision.

---

## 20. Onboarding Deep Scan — Optional Future Feature

Future feature: during onboarding, the customer can run a deep scan designed to learn the customer’s environment and generate customized rules.

### Proposed Flow

- Broad scan of files and assets.
- Detection of recurring patterns.
- Use of a stronger LLM to analyze the customer environment.
- Generation of suggested custom rule packs.
- Human approval before activation.

### Infrastructure Considerations

Because this type of scan requires more compute power, it can run as a dedicated onboarding job in a controlled environment rather than as part of the regular scan flow.

### Output

- Customer-specific Regex rules
- Custom suppression rules
- Sensitive terminology dictionary
- Recommended sensitivity profile

---

## 21. Mock Data

During the hackathon, we will work with mock data built specifically for the demo.

The mock data structure is still being developed by the teammate responsible for the data and Regex side. Once the structure is finalized, it will be integrated into this spec.

### High-Level Mock Data Requirements

The mock data should include:

1. Files with example real secrets:
   - production `.env`
   - cloud credentials
   - GitHub token
   - private key
   - database password
   - payment provider secret

2. Files that generate false positives:
   - README with example API key
   - test fixtures
   - placeholder values
   - dummy tokens
   - support email
   - transaction IDs that look like card numbers
   - UUIDs / hashes that look like tokens

3. Files by vertical:
   - Fintech examples
   - SaaS examples
   - Healthcare examples
   - E-commerce examples

4. Ground Truth:
   Every finding should have a label:

```text id="homed4"
true_secret
false_positive
placeholder
documentation_example
test_value
unknown
```

5. Metadata:
   Each file should ideally include:

```text id="9ppma9"
file_path
file_type
environment
storage_exposure
asset_criticality
customer_vertical
expected_findings
expected_classification
```

---

## 22. Evaluation Metrics

### Demo Success Metrics

- False Positive Reduction Rate
- True Positive Recall
- Precision
- Number of Critical Findings correctly prioritized
- Number of findings correctly suppressed or downgraded
- Demo validation accuracy
- Explanation quality

### Proposed Metrics

```text id="m5vtrg"
Recall = how many real secrets the system did not miss
Precision = how many findings marked as risky are actually risky
False Positive Reduction = how much noise was reduced compared to Regex-only
Priority Accuracy = whether the truly critical findings appear first
```

### Demo Target

- Do not miss any True Secret in the mock data.
- Significantly reduce the number of false positives.
- Display the most critical findings at the top.
- Provide a clear explanation for every decision.

---

## 23. Privacy & Security

Because the product handles sensitive information, clear safety principles must be defined.

### Principles

- Secrets are always masked by default.
- The model receives only masked features.
- LightGBM does not receive the full secret value.
- Validation uses the full value only temporarily and only inside the customer environment.
- Full secrets are not stored in the database.
- Feedback learning stores only a hash or fingerprint.
- Every validation action is logged.
- Full secret reveal, if supported, is limited to authorized users only.

---

## 24. Data Flow Summary

```text id="pnr7y7"
1. Cloud Scanner scans customer files
2. Regex Rule Packs detect candidate secrets
3. Static layer creates Finding Context Object
4. Context Feature Extraction creates normalized features
5. Deterministic Rules produce rule-based score and explanations
6. LightGBM predicts secret_probability
7. Final Scoring combines authenticity, exposure and criticality
8. Optional validation checks whether the secret is active
9. UI presents prioritized findings with masking and explanation
10. User can review, validate, suppress or mark as false positive
```

---

## 25. MVP Scope

### Must Have

- Mock Data
- Regex candidates
- Finding Context Object
- Context feature extraction
- Deterministic rules
- LightGBM model
- Final Risk Score
- Priority Score
- Masked UI
- Explanation
- Sensitivity mode
- Vertical-based rule personalization
- Basic validation mock
- Findings dashboard
- Basic map view

### Should Have

- Real validation design for selected providers
- Rule-trigger breakdown
- Risk score breakdown
- Suppression reason
- Filters by severity, validation status, and asset

### Nice to Have

- User feedback learning
- Onboarding deep scan
- LLM-generated custom rules
- Advanced map overlays
- Runtime / lineage integration

---

## 26. Open Questions

1. Which secret types are included in the first MVP?
2. Will validation in the demo be real or mocked?
3. What will the final mock data structure look like?
4. Will we present multi-class classification or binary classification?
5. Will LightGBM be trained on a small dataset, or will we simulate predictions using rules?
6. Which verticals will be shown in the demo?
7. Will the map be a standalone screen or a layer on top of the existing Inventory map?
8. Which actions will be shown to the user — recommendations only or clickable actions?
9. Will Sensitivity Mode be global or per asset / per scan?
10. What should be the customer default: Strict or Balanced?

---

## 27. Elevator Pitch

Our product turns the Cloud Scanner from a noisy Regex engine into a Context-Aware system that understands the meaning of each finding.  
Regex detects candidates, but the context layer, deterministic rules, and LightGBM decide what is truly risky, what is likely a false positive, and what the customer should handle first.  
This reduces alert fatigue, protects real secrets, and gives the customer clear, explainable, and safe prioritization.
