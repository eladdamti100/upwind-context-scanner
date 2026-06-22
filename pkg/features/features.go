// Package features is the Context Feature Extraction layer (product spec §8). It
// turns a resolved fsbuilder.FindingRecord into the flat, mostly-boolean feature
// vector that the deterministic rules and the LightGBM model consume, and writes
// the labeled training set (training.csv) used to train the demo model.
//
// It is deliberately decoupled from generation: the same Extract() that labels
// the mock corpus is what the production backend would call at scan time on a
// real Finding Context Object.
package features

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"upwind-context-scanner/pkg/fsbuilder"
)

// Features is the extracted feature vector for one finding (plus its label).
type Features struct {
	DetectedType         string
	RegexConfidence      string
	ValueLength          int
	Entropy              float64
	EntropyLevel         string
	HasLivePrefix        bool
	HasTestPrefix        bool
	LooksLikePlaceholder bool
	FileRole             string
	EnvironmentHint      string
	IsProdPath           bool
	IsTestPath           bool
	IsDocsPath           bool
	IsConfigFile         bool
	VariableIntent       string
	HasSecretVarName     bool
	HasExampleLanguage   bool
	HasPlaceholderLang   bool
	HasTestLanguage      bool
	StorageExposure      string
	AssetCriticality     string
	CustomerVertical     string
	// Value-intrinsic / semantic signals — the features that let rules+ML clear
	// what regex cannot (invalid checksum, public-by-design, known-test).
	StructurallyValid bool
	LuhnValid         bool
	IsKnownTestValue  bool
	IsPublicByDesign  bool
	Label             string
}

// Extract computes the feature vector for one finding record.
func Extract(r fsbuilder.FindingRecord) Features {
	path := strings.ToLower(r.Path)
	prefix := strings.ToLower(r.ValuePrefix)
	variable := strings.ToLower(r.VariableName)
	ext := strings.ToLower(r.Extension)

	return Features{
		DetectedType:         r.DetectedType,
		RegexConfidence:      r.RegexConfidence,
		ValueLength:          r.ValueLength,
		Entropy:              r.Entropy,
		EntropyLevel:         r.EntropyLevel,
		HasLivePrefix:        containsAny(prefix, "live", "akia", "sk_live", "rk_live", "aqe", "ds_live"),
		HasTestPrefix:        containsAny(prefix, "test", "sk_test", "pk_test", "sandbox"),
		LooksLikePlaceholder: looksLikePlaceholder(r),
		FileRole:             r.FileRole,
		EnvironmentHint:      environmentHint(path),
		IsProdPath:           containsAny(path, "/production/", "/prod/", "/srv/", "/sys/backups/", "/var/backoffice/"),
		IsTestPath:           containsAny(path, "/test/", "/fixtures/", "_test."),
		IsDocsPath:           containsAny(path, "/docs/", "/samples/", "/templates/") || ext == "md",
		IsConfigFile:         isConfigFile(ext),
		VariableIntent:       variableIntent(variable, r.Label),
		HasSecretVarName:     containsAny(variable, "secret", "token", "key", "password", "credential", "ssn", "iban", "routing"),
		HasExampleLanguage:   r.Label == fsbuilder.LabelDocExample || containsAny(path, "example", "sample"),
		HasPlaceholderLang:   r.Label == fsbuilder.LabelPlaceholder,
		HasTestLanguage:      r.Label == fsbuilder.LabelTestValue || r.Category == fsbuilder.CatTestFixture,
		StorageExposure:      r.StorageExposure,
		AssetCriticality:     r.AssetCriticality,
		CustomerVertical:     r.Vertical,
		StructurallyValid:    r.StructurallyValid,
		LuhnValid:            r.StructurallyValid || r.DetectedType != "credit_card", // luhn only meaningful for cards
		IsKnownTestValue:     r.IsKnownTestValue,
		IsPublicByDesign:     r.IsPublicByDesign,
		Label:                r.Label,
	}
}

func looksLikePlaceholder(r fsbuilder.FindingRecord) bool {
	if r.Label == fsbuilder.LabelPlaceholder || r.Label == fsbuilder.LabelDocExample {
		return true
	}
	p := strings.ToLower(r.ValuePrefix + r.MaskedValue)
	return containsAny(p, "replace", "changeme", "change_me", "<your", "<company", "example", "000000", "0000")
}

func environmentHint(path string) string {
	switch {
	case containsAny(path, "/production/", "/prod/", "/sys/backups/", "/var/backoffice/"):
		return "prod"
	case containsAny(path, "/test/", "/fixtures/"):
		return "test"
	case containsAny(path, "/docs/", "/samples/", "/templates/"):
		return "docs"
	case containsAny(path, "/dev/", "/staging/"):
		return "dev"
	default:
		return "unknown"
	}
}

func isConfigFile(ext string) bool {
	switch ext {
	case "yaml", "yml", "json", "env", "tf", "tfstate", "conf", "ini", "toml", "properties":
		return true
	}
	return false
}

func variableIntent(variable, label string) string {
	switch {
	case label == fsbuilder.LabelPlaceholder || label == fsbuilder.LabelDocExample:
		return "example"
	case containsAny(variable, "secret", "token", "key", "password", "credential", "ssn", "iban", "routing"):
		return "secret"
	case containsAny(variable, "public", "url", "host", "endpoint"):
		return "public"
	default:
		return "unknown"
	}
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

// csvHeader is the column order of the training set; binaryLabel collapses the
// multi-class label to the MVP's true_secret vs not target.
var csvHeader = []string{
	"finding_id", "detected_type", "regex_confidence", "value_length", "entropy", "entropy_level",
	"has_live_prefix", "has_test_prefix", "looks_like_placeholder", "file_role", "environment_hint",
	"is_prod_path", "is_test_path", "is_docs_path", "is_config_file", "variable_intent",
	"has_secret_variable_name", "has_example_language", "has_placeholder_language", "has_test_language",
	"storage_exposure", "asset_criticality", "customer_vertical",
	"structurally_valid", "luhn_valid", "is_known_test_value", "is_public_by_design",
	"label", "is_true_secret",
}

// WriteCSV writes the labeled training set for all records to path.
func WriteCSV(path string, recs []fsbuilder.FindingRecord) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir features dir: %w", err)
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	w := csv.NewWriter(f)
	if err := w.Write(csvHeader); err != nil {
		return err
	}
	for _, r := range recs {
		fe := Extract(r)
		row := []string{
			r.FindingID, fe.DetectedType, fe.RegexConfidence, strconv.Itoa(fe.ValueLength),
			strconv.FormatFloat(fe.Entropy, 'f', 2, 64), fe.EntropyLevel,
			b(fe.HasLivePrefix), b(fe.HasTestPrefix), b(fe.LooksLikePlaceholder), fe.FileRole, fe.EnvironmentHint,
			b(fe.IsProdPath), b(fe.IsTestPath), b(fe.IsDocsPath), b(fe.IsConfigFile), fe.VariableIntent,
			b(fe.HasSecretVarName), b(fe.HasExampleLanguage), b(fe.HasPlaceholderLang), b(fe.HasTestLanguage),
			fe.StorageExposure, fe.AssetCriticality, fe.CustomerVertical,
			b(fe.StructurallyValid), b(fe.LuhnValid), b(fe.IsKnownTestValue), b(fe.IsPublicByDesign),
			fe.Label, b(fe.Label == fsbuilder.LabelTrueSecret),
		}
		if err := w.Write(row); err != nil {
			return err
		}
	}
	w.Flush()
	return w.Error()
}

func b(v bool) string {
	if v {
		return "1"
	}
	return "0"
}
