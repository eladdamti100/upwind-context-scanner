# Demo Goals

# Demo Goals

## Purpose

The goal of the demo is to show how SignalLens improves an existing Regex-based Cloud Scanner by adding context-aware classification, prioritization, and explanation.

The demo should prove that the product can reduce noisy sensitive-data alerts without missing real secrets.

## Core Demo Story

Existing scanners detect too many candidates because they rely mainly on Regex and rigid rules.
SignalLens keeps Regex as the first detection layer, but adds a smart context layer that decides whether each finding is likely a real secret, a false positive, or a finding that requires review.

The flow shown in the demo should be:

```text
Customer Cloud Files
→ Regex Candidate Detection
→ Context Feature Extraction
→ Deterministic Rules
→ LightGBM Classification
→ Risk Score + Priority
→ Masked Finding + Explanation in UI
```

## What the Demo Must Show

### 1. Regex finds candidates

Show that the system scans mock customer files and detects candidate secrets such as:

* API keys
* Cloud credentials
* GitHub tokens
* private keys
* database passwords
* payment provider secrets
* suspicious tokens

### 2. Context reduces false positives

Show examples where Regex detects something suspicious, but the context layer correctly downgrades it.

Example cases:

* API key-looking value inside README documentation
* placeholder value such as `YOUR_API_KEY`
* dummy/test token inside test fixtures
* fake secret inside documentation
* transaction ID that looks like a credit card number

### 3. Real secrets are prioritized

Show examples where the system gives high priority to real secrets.

Example cases:

* AWS key inside a production `.env` file
* Stripe secret key inside a production payment config
* private key inside a deployment file
* database password inside a production config file

### 4. Every finding is explained

Each finding should include a short explanation that tells the user why the system made its decision.

Example:

```text
High Risk: Found in production config file, under a secret-like variable name, with high entropy and a live-looking prefix.
```

Example:

```text
Likely False Positive: Found in documentation, surrounded by example language, and the value appears to be a placeholder.
```

### 5. The user sees prioritization

The UI should show findings sorted by priority, so the most critical exposed secrets appear first.

Priority should be based on:

* likelihood that the finding is a real secret
* type of secret
* file location
* asset exposure
* production/test/docs context
* validation status, if available

### 6. Sensitivity control

Show that the customer can control how strict the scanner should be.

Modes:

* Strict
* Balanced
* Flexible

The same finding can be handled differently depending on the selected sensitivity mode.

### 7. Validation flow

Show a validation status for supported secrets.

For the demo, validation can be mocked.

Possible statuses:

* Not validated
* Validated active
* Validated inactive
* Validation unsupported
* Validation failed

### 8. Map view

Show a visual map that connects sensitive-data findings to cloud assets.

The map should help users understand:

* where secrets were found
* which assets contain the most critical secrets
* whether the asset is exposed
* which secrets should be handled first

## Success Criteria

The demo is successful if it clearly shows:

* Regex-only produces noisy findings.
* SignalLens reduces false positives using context.
* Real secrets are not missed.
* Critical findings are prioritized.
* Every decision is explainable.
* Secrets are masked by default.
* The UI feels like a practical security product, not just a technical script.
