// Package store turns the resolved finding records into the DB-ready artifacts
// the rest of the team consumes: the masked Finding Context Objects
// (findings.json, product spec §7), the cloud-asset inventory (assets.json), and
// a ready-to-load SQLite database (scanner.db) the backend/UI can query directly.
//
// Privacy invariant: only masked projections of values are emitted — raw secret
// bodies were discarded back in fsbuilder.NewFinding and never reach this layer.
package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "modernc.org/sqlite" // pure-Go, CGO-free SQLite driver

	"upwind-context-scanner/pkg/fsbuilder"
)

// ---------------------------------------------------------------------------
// Finding Context Object (product spec §7) + JSON emit
// ---------------------------------------------------------------------------

type fileBlock struct {
	FileName        string `json:"file_name"`
	FilePath        string `json:"file_path"`
	FileExtension   string `json:"file_extension"`
	FileRole        string `json:"file_role"`
	StorageLocation string `json:"storage_location"`
}

type candidateBlock struct {
	DetectedType string  `json:"detected_type"`
	MaskedValue  string  `json:"masked_value"`
	ValuePrefix  string  `json:"value_prefix"`
	ValueSuffix  string  `json:"value_suffix"`
	ValueLength  int     `json:"value_length"`
	Entropy      float64 `json:"entropy"`
	EntropyLevel string  `json:"entropy_level"`
	LineNumber   int     `json:"line_number"`
	VariableName string  `json:"variable_name"`
}

type regexBlock struct {
	RuleID          string `json:"rule_id"`
	RuleSource      string `json:"rule_source"`
	RegexConfidence string `json:"regex_confidence"`
}

type localContext struct {
	LineTextMasked string `json:"line_text_masked"`
}

// signals are the value-intrinsic / semantic features that let the rules + ML
// clear what a regex-only scanner cannot (invalid checksum, public-by-design,
// known-test). The backend reads these directly — they are NOT answer-key data.
type signalBlock struct {
	StructurallyValid  bool `json:"structurally_valid"`
	LuhnValid          bool `json:"luhn_valid"`
	FormatValidForType bool `json:"format_valid_for_type"`
	IsKnownTestValue   bool `json:"is_known_test_value"`
	IsPublicByDesign   bool `json:"is_public_by_design"`
	IsAlreadyMasked    bool `json:"is_already_masked"`
	IsHighEntropySha   bool `json:"is_high_entropy_sha"`
}

type scanMetadata struct {
	SensitivityMode  string   `json:"sensitivity_mode"`
	CustomerVertical string   `json:"customer_vertical"`
	EnabledRulePacks []string `json:"enabled_rule_packs"`
}

// groundTruth is the answer-key block the backend/ML use for training/eval; it
// would not exist in a production object but is invaluable for the demo.
type groundTruth struct {
	Label                string `json:"label"`
	Classification       string `json:"classification"`
	IsSecret             bool   `json:"is_secret"`
	IsSensitive          bool   `json:"is_sensitive"`
	Reason               string `json:"reason,omitempty"`
	Validation           string `json:"validation"`
	AssetID              string `json:"asset_id"`
	StorageExposure      string `json:"storage_exposure"`
	AssetCriticality     string `json:"asset_criticality"`
	IsPubliclyAccessible bool   `json:"is_publicly_accessible"`
}

// FindingContextObject is the masked, normalized object passed to the intelligent
// layer (plus a ground_truth block for the demo).
type FindingContextObject struct {
	FindingID    string         `json:"finding_id"`
	File         fileBlock      `json:"file"`
	Candidate    candidateBlock `json:"candidate"`
	Signals      signalBlock    `json:"signals"`
	Regex        regexBlock     `json:"regex"`
	LocalContext localContext   `json:"local_context"`
	ScanMetadata scanMetadata   `json:"scan_metadata"`
	GroundTruth  groundTruth    `json:"ground_truth"`
}

func toContextObject(r fsbuilder.FindingRecord) FindingContextObject {
	lineText := r.MaskedValue
	if r.VariableName != "" {
		lineText = fmt.Sprintf("%s=%s", r.VariableName, r.MaskedValue)
	}
	ruleID := r.Classification
	if ruleID == "" {
		ruleID = r.DetectedType
	}
	return FindingContextObject{
		FindingID: r.FindingID,
		File: fileBlock{
			FileName: r.FileName, FilePath: r.Path, FileExtension: r.Extension,
			FileRole: r.FileRole, StorageLocation: r.StorageLocation,
		},
		Candidate: candidateBlock{
			DetectedType: r.DetectedType, MaskedValue: r.MaskedValue, ValuePrefix: r.ValuePrefix,
			ValueSuffix: r.ValueSuffix, ValueLength: r.ValueLength, Entropy: r.Entropy,
			EntropyLevel: r.EntropyLevel, LineNumber: r.Line, VariableName: r.VariableName,
		},
		Signals: signalBlock{
			StructurallyValid:  r.StructurallyValid,
			LuhnValid:          r.StructurallyValid || r.DetectedType != "credit_card",
			FormatValidForType: r.FormatValidForType,
			IsKnownTestValue:   r.IsKnownTestValue,
			IsPublicByDesign:   r.IsPublicByDesign,
			IsAlreadyMasked:    r.IsAlreadyMasked,
			IsHighEntropySha:   r.IsHighEntropySha,
		},
		Regex: regexBlock{RuleID: ruleID, RuleSource: r.Vertical, RegexConfidence: r.RegexConfidence},
		LocalContext: localContext{LineTextMasked: lineText},
		ScanMetadata: scanMetadata{
			SensitivityMode: "balanced", CustomerVertical: r.Vertical,
			EnabledRulePacks: []string{"base", r.Vertical},
		},
		GroundTruth: groundTruth{
			Label: r.Label, Classification: r.Classification,
			IsSecret: isSecret(r), IsSensitive: isSensitive(r), Reason: r.Reason, Validation: r.Validation,
			AssetID: r.AssetID, StorageExposure: r.StorageExposure,
			AssetCriticality: r.AssetCriticality, IsPubliclyAccessible: r.IsPubliclyAccessible,
		},
	}
}

func isSecret(r fsbuilder.FindingRecord) bool { return r.Label == fsbuilder.LabelTrueSecret }

// isSensitive is broader than isSecret: PII/PHI/financial data is sensitive even
// when it is not a credential — BUT a sensitive-shaped value that fails its
// checksum/range, is public by design, or is a known test value is NOT real
// sensitive data (a Luhn-invalid "card" is just an order id). This is exactly the
// distinction a regex-only scanner cannot make.
func isSensitive(r fsbuilder.FindingRecord) bool {
	if isSecret(r) {
		return true
	}
	switch r.DetectedType {
	case "pii", "phi", "credit_card", "financial", "database_password":
		return r.StructurallyValid && !r.IsPublicByDesign && !r.IsKnownTestValue
	}
	return false
}

// WriteFindingsJSON emits the array of Finding Context Objects to path.
func WriteFindingsJSON(path string, recs []fsbuilder.FindingRecord) error {
	objs := make([]FindingContextObject, 0, len(recs))
	for _, r := range recs {
		objs = append(objs, toContextObject(r))
	}
	return writeJSON(path, objs)
}

// WriteAssetsJSON emits the cloud-asset inventory to path.
func WriteAssetsJSON(path string, assets []fsbuilder.Asset) error {
	return writeJSON(path, assets)
}

func writeJSON(path string, v any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir store dir: %w", err)
	}
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal %s: %w", filepath.Base(path), err)
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

// ---------------------------------------------------------------------------
// SQLite — ready-to-load store the backend/UI can query directly.
// ---------------------------------------------------------------------------

const schema = `
CREATE TABLE files (
    path           TEXT PRIMARY KEY,
    client         TEXT NOT NULL,
    extension      TEXT,
    category       TEXT,
    has_real_secret INTEGER NOT NULL,
    bytes          INTEGER NOT NULL,
    lines          INTEGER NOT NULL
);
CREATE TABLE assets (
    asset_id              TEXT PRIMARY KEY,
    client                TEXT NOT NULL,
    type                  TEXT,
    storage_exposure      TEXT,
    asset_criticality     TEXT,
    is_publicly_accessible INTEGER NOT NULL,
    cloud_provider        TEXT,
    service_context       TEXT
);
CREATE TABLE findings (
    finding_id      TEXT PRIMARY KEY,
    client          TEXT NOT NULL,
    customer_vertical TEXT,
    file_path       TEXT NOT NULL REFERENCES files(path),
    file_role       TEXT,
    asset_id        TEXT REFERENCES assets(asset_id),
    line_number     INTEGER,
    variable_name   TEXT,
    detected_type   TEXT,
    masked_value    TEXT,
    value_prefix    TEXT,
    value_length    INTEGER,
    entropy         REAL,
    entropy_level   TEXT,
    label           TEXT,
    classification  TEXT,
    validation      TEXT,
    regex_confidence TEXT,
    is_secret       INTEGER NOT NULL,
    is_sensitive    INTEGER NOT NULL,
    storage_exposure TEXT,
    asset_criticality TEXT,
    is_publicly_accessible INTEGER NOT NULL,
    structurally_valid INTEGER NOT NULL,
    is_known_test_value INTEGER NOT NULL,
    is_public_by_design INTEGER NOT NULL,
    format_valid_for_type INTEGER NOT NULL,
    is_already_masked INTEGER NOT NULL,
    is_high_entropy_sha INTEGER NOT NULL,
    reason          TEXT
);
CREATE INDEX idx_findings_label  ON findings(label);
CREATE INDEX idx_findings_asset  ON findings(asset_id);
CREATE INDEX idx_findings_file   ON findings(file_path);
CREATE INDEX idx_findings_reason ON findings(reason);
`

// WriteSQLite builds scanner.db with files/assets/findings tables and bulk-loads
// every record in a single transaction.
func WriteSQLite(path string, recs []fsbuilder.FindingRecord, assets []fsbuilder.Asset, files map[string]fsbuilder.ManifestEntry) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir store dir: %w", err)
	}
	_ = os.Remove(path) // start from a clean database each run

	db, err := sql.Open("sqlite", path)
	if err != nil {
		return fmt.Errorf("open sqlite: %w", err)
	}
	defer db.Close()

	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("create schema: %w", err)
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := insertFiles(tx, files); err != nil {
		return err
	}
	if err := insertAssets(tx, assets); err != nil {
		return err
	}
	if err := insertFindings(tx, recs); err != nil {
		return err
	}
	return tx.Commit()
}

func insertFiles(tx *sql.Tx, files map[string]fsbuilder.ManifestEntry) error {
	stmt, err := tx.Prepare(`INSERT INTO files(path, client, extension, category, has_real_secret, bytes, lines) VALUES(?,?,?,?,?,?,?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	// Insert in sorted key order so scanner.db is byte-for-byte reproducible
	// (Go map iteration order is randomized).
	paths := make([]string, 0, len(files))
	for path := range files {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	for _, path := range paths {
		e := files[path]
		if _, err := stmt.Exec(path, e.Client, extOf(path), e.Category, boolToInt(e.HasRealSecret), e.Bytes, e.Lines); err != nil {
			return fmt.Errorf("insert file %s: %w", path, err)
		}
	}
	return nil
}

func insertAssets(tx *sql.Tx, assets []fsbuilder.Asset) error {
	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO assets(asset_id, client, type, storage_exposure, asset_criticality, is_publicly_accessible, cloud_provider, service_context) VALUES(?,?,?,?,?,?,?,?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, a := range assets {
		if _, err := stmt.Exec(a.AssetID, a.Client, a.Type, a.StorageExposure, a.AssetCriticality,
			boolToInt(a.IsPubliclyAccessible), a.CloudProvider, a.ServiceContext); err != nil {
			return fmt.Errorf("insert asset %s: %w", a.AssetID, err)
		}
	}
	return nil
}

func insertFindings(tx *sql.Tx, recs []fsbuilder.FindingRecord) error {
	stmt, err := tx.Prepare(`INSERT INTO findings(
        finding_id, client, customer_vertical, file_path, file_role, asset_id, line_number,
        variable_name, detected_type, masked_value, value_prefix, value_length, entropy, entropy_level,
        label, classification, validation, regex_confidence, is_secret, is_sensitive,
        storage_exposure, asset_criticality, is_publicly_accessible,
        structurally_valid, is_known_test_value, is_public_by_design,
        format_valid_for_type, is_already_masked, is_high_entropy_sha, reason
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, r := range recs {
		if _, err := stmt.Exec(
			r.FindingID, r.Client, r.Vertical, r.Path, r.FileRole, r.AssetID, r.Line,
			r.VariableName, r.DetectedType, r.MaskedValue, r.ValuePrefix, r.ValueLength, r.Entropy, r.EntropyLevel,
			r.Label, r.Classification, r.Validation, r.RegexConfidence, boolToInt(isSecret(r)), boolToInt(isSensitive(r)),
			r.StorageExposure, r.AssetCriticality, boolToInt(r.IsPubliclyAccessible),
			boolToInt(r.StructurallyValid), boolToInt(r.IsKnownTestValue), boolToInt(r.IsPublicByDesign),
			boolToInt(r.FormatValidForType), boolToInt(r.IsAlreadyMasked), boolToInt(r.IsHighEntropySha), r.Reason,
		); err != nil {
			return fmt.Errorf("insert finding %s: %w", r.FindingID, err)
		}
	}
	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func extOf(name string) string {
	if i := strings.LastIndexByte(name, '.'); i >= 0 && i < len(name)-1 {
		return strings.ToLower(name[i+1:])
	}
	return ""
}
