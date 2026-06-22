// Package fsbuilder models an in-memory filesystem tree (folders + files with
// ground-truth annotations) and materializes it to disk under a scan root,
// emitting a separate answer-key manifest the scanner must never read.
//
// Each customer agent builds a *Workspace by repeatedly calling Add with a
// client-relative directory path; the builder lazily creates the intermediate
// FolderNodes. The orchestrator then calls Deploy to write everything via
// os.MkdirAll / os.WriteFile and accumulate the manifest.
package fsbuilder

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Ground-truth categories.
const (
	CatProdCredential = "prod-credential" // a real, exploitable-shaped leak (True Positive)
	CatTestFixture    = "test-fixture"    // intentional test/sandbox value (benign)
	CatAssetInventory = "asset-inventory" // clean code / infra / data (benign)
	CatNoisePII       = "noise-pii"       // placeholder or synthetic PII storm (benign)
)

// GroundTruth annotates a file with what a perfect scanner should conclude.
type GroundTruth struct {
	HasRealSecret           bool     `json:"hasRealSecret"`
	Category                string   `json:"category"`
	ExpectedClassifications []string `json:"expectedClassifications"`
	// Technique records HOW a True Positive was planted (crash-dump, commented-out,
	// demo_override naming, …) or WHY a tempting file is actually benign.
	Technique string `json:"technique,omitempty"`
}

// FileNode is one synthetic file plus its ground truth.
type FileNode struct {
	FileName    string
	FileType    string // MIME-ish hint: text/plain, application/json, text/yaml, …
	Owner       string // root, ubuntu, www-data, jenkins, deploy
	Mode        string // 0600, 0644, 0640
	Content     string
	GroundTruth GroundTruth
	// Stream, when non-nil, generates the file body directly to disk instead of
	// holding it in Content (used for the >MB logs/dumps that drive the corpus to
	// ~100MB+). Content stays "" in that case; the deployer streams via a buffered
	// io.Writer and counts bytes/lines as they pass through, so the manifest stays
	// exact without ever buffering the whole file in memory.
	Stream func(w io.Writer) error
	// Findings carries the line-level, per-candidate ground truth used to emit the
	// rich Finding Context Objects, the ML training set, and the SQLite store. When
	// empty, the deployer synthesizes a coarse finding from the file-level
	// GroundTruth (so the legacy file-level agents still populate the DB outputs).
	Findings []Finding
}

// Finding is one line-level candidate inside a file plus its ground truth — the
// unit the context engine, the ML model, and the map view all reason about. Raw
// secret bodies never reach here: MaskedValue/ValuePrefix/ValueSuffix are derived
// by NewFinding, which keeps the full value inside the generator.
type Finding struct {
	Line           int     `json:"line_number"`
	VariableName   string  `json:"variable_name"`
	DetectedType   string  `json:"detected_type"`
	MaskedValue    string  `json:"masked_value"`
	ValuePrefix    string  `json:"value_prefix"`
	ValueSuffix    string  `json:"value_suffix"`
	ValueLength    int     `json:"value_length"`
	Entropy        float64 `json:"entropy"`
	Label          string  `json:"label"`          // true_secret|false_positive|placeholder|documentation_example|test_value|public_non_secret
	Classification string  `json:"classification"` // expected detector label; "" for benign
	Validation     string  `json:"validation"`     // not_validated|validated_active|validated_inactive|validation_unsupported|...

	// Context signals — the value-intrinsic / semantic features that let the
	// rules + ML clear a finding a regex-only scanner cannot. Defaults
	// (StructurallyValid=true, others false, Reason="") describe an ordinary
	// well-formed candidate; the clever FP/TP factories override them.
	StructurallyValid bool   `json:"structurally_valid"` // false when value fails its format's checksum/range (Luhn, SSN range, IBAN/ABA mod check)
	IsKnownTestValue  bool   `json:"is_known_test_value"`
	IsPublicByDesign  bool   `json:"is_public_by_design"`
	Reason            string `json:"reason,omitempty"` // why benign (fp) or why dangerous (tp)
}

// Ground-truth labels for a Finding (product spec §10 training labels).
const (
	LabelTrueSecret    = "true_secret"
	LabelFalsePositive = "false_positive"
	LabelPlaceholder   = "placeholder"
	LabelDocExample    = "documentation_example"
	LabelTestValue     = "test_value"
	LabelPublicNonSec  = "public_non_secret"
)

// Validation statuses (product spec §13).
const (
	ValNotValidated      = "not_validated"
	ValActive            = "validated_active"
	ValInactive          = "validated_inactive"
	ValUnsupported       = "validation_unsupported"
	ValPermissionReq     = "validation_permission_required"
)

// NewFinding builds a Finding from a raw (synthetic) value, masking it on the
// way in. rawValue is hashed down to prefix/suffix/length/entropy and then
// discarded — only the masked projection is retained, honoring the privacy
// invariant that full secret bodies never leave the generator.
func NewFinding(line int, variable, detectedType, label, classification, validation, rawValue string) Finding {
	return Finding{
		Line:              line,
		VariableName:      variable,
		DetectedType:      detectedType,
		MaskedValue:       maskValue(rawValue),
		ValuePrefix:       valuePrefix(rawValue),
		ValueSuffix:       valueSuffix(rawValue),
		ValueLength:       len(rawValue),
		Entropy:           shannon(rawValue),
		Label:             label,
		Classification:    classification,
		Validation:        validation,
		StructurallyValid: true, // overridden by WithSignals for invalid-shaped FPs
	}
}

// WithSignals sets the value-intrinsic / semantic context signals (builder style)
// — used by the clever FP/TP factories to mark invalid checksums, known-test or
// public-by-design values, and to attach a human/ML reason.
func (f Finding) WithSignals(structurallyValid, knownTest, publicByDesign bool, reason string) Finding {
	f.StructurallyValid = structurallyValid
	f.IsKnownTestValue = knownTest
	f.IsPublicByDesign = publicByDesign
	f.Reason = reason
	return f
}

// WithReason attaches only an explanation (leaving the boolean signals at their
// defaults) — handy for regex-evading true positives.
func (f Finding) WithReason(reason string) Finding {
	f.Reason = reason
	return f
}

// WithFindings attaches line-level findings to a file (builder style).
func (f FileNode) WithFindings(fs ...Finding) FileNode {
	f.Findings = fs
	return f
}

// maskValue keeps a short visible prefix and replaces the body with asterisks,
// preserving roughly the original length so the UI can render a faithful mask.
func maskValue(s string) string {
	if s == "" {
		return ""
	}
	keep := 7
	if len(s) <= keep+4 {
		keep = len(s) / 3
	}
	stars := len(s) - keep
	if stars > 16 {
		stars = 16
	}
	if stars < 4 {
		stars = 4
	}
	return s[:keep] + strings.Repeat("*", stars)
}

func valuePrefix(s string) string {
	// Prefer the token up to the first separator (sk_live, AKIA, github_pat, …).
	for i := 0; i < len(s) && i < 8; i++ {
		if s[i] == '_' || s[i] == '-' || s[i] == '.' {
			return s[:i]
		}
	}
	if len(s) < 6 {
		return s
	}
	return s[:6]
}

func valueSuffix(s string) string {
	if len(s) < 4 {
		return s
	}
	return s[len(s)-4:]
}

// shannon returns the Shannon entropy (bits/byte) of s — the value-feature the
// rules and the LightGBM model lean on to tell high-entropy keys from words.
func shannon(s string) float64 {
	if s == "" {
		return 0
	}
	var freq [256]float64
	for i := 0; i < len(s); i++ {
		freq[s[i]]++
	}
	n := float64(len(s))
	h := 0.0
	for _, c := range freq {
		if c == 0 {
			continue
		}
		p := c / n
		h -= p * math.Log2(p)
	}
	return math.Round(h*100) / 100
}

// FolderNode is a directory within a client workspace.
type FolderNode struct {
	Name         string
	RelativePath string // path from client root, e.g. "srv/secure/v2/config"
	SubFolders   []FolderNode
	Files        []FileNode
}

// Workspace is one customer's complete simulated filesystem.
type Workspace struct {
	ClientName string
	Industry   string
	Root       FolderNode
	// Assets are the cloud assets this client's files live in. Each finding is
	// linked to the asset whose PathPrefix is the longest match for its file —
	// this is what powers the map view and the Priority Score's exposure term.
	Assets []Asset
}

// Asset is a cloud resource (bucket, workload, repo, host) that files live in.
// PathPrefix is a client-relative directory prefix; the deployer links a finding
// to the asset with the longest matching prefix.
type Asset struct {
	AssetID              string `json:"asset_id"`
	Client               string `json:"client"`
	Type                 string `json:"type"`              // bucket|workload|repo|host
	StorageExposure      string `json:"storage_exposure"`  // public|internet|shared|internal|private|docs
	AssetCriticality     string `json:"asset_criticality"` // critical|high|medium|low
	IsPubliclyAccessible bool   `json:"is_publicly_accessible"`
	CloudProvider        string `json:"cloud_provider"`
	ServiceContext       string `json:"service_context"`
	PathPrefix           string `json:"-"` // client-relative prefix used for finding→asset resolution
}

// FindingRecord is a fully-resolved finding ready to emit (Finding Context
// Object JSON, training.csv row, SQLite row). It joins the line-level Finding
// with its file, file role, and the asset it was found in.
type FindingRecord struct {
	FindingID            string  `json:"finding_id"`
	Client               string  `json:"client"`
	Vertical             string  `json:"customer_vertical"`
	Path                 string  `json:"file_path"`
	FileName             string  `json:"file_name"`
	Extension            string  `json:"file_extension"`
	FileRole             string  `json:"file_role"`
	Category             string  `json:"category"`
	StorageLocation      string  `json:"storage_location"`
	AssetID              string  `json:"asset_id"`
	StorageExposure      string  `json:"storage_exposure"`
	AssetCriticality     string  `json:"asset_criticality"`
	IsPubliclyAccessible bool    `json:"is_publicly_accessible"`
	Line                 int     `json:"line_number"`
	VariableName         string  `json:"variable_name"`
	DetectedType         string  `json:"detected_type"`
	MaskedValue          string  `json:"masked_value"`
	ValuePrefix          string  `json:"value_prefix"`
	ValueSuffix          string  `json:"value_suffix"`
	ValueLength          int     `json:"value_length"`
	Entropy              float64 `json:"entropy"`
	EntropyLevel         string  `json:"entropy_level"`
	Label                string  `json:"label"`
	Classification       string  `json:"classification"`
	Validation           string  `json:"validation"`
	RegexConfidence      string  `json:"regex_confidence"`
	StructurallyValid    bool    `json:"structurally_valid"`
	IsKnownTestValue     bool    `json:"is_known_test_value"`
	IsPublicByDesign     bool    `json:"is_public_by_design"`
	Reason               string  `json:"reason,omitempty"`
}

// NewWorkspace returns an empty workspace for a client.
func NewWorkspace(name, industry string) *Workspace {
	return &Workspace{
		ClientName: name,
		Industry:   industry,
		Root:       FolderNode{Name: name, SubFolders: []FolderNode{}, Files: []FileNode{}},
		Assets:     []Asset{},
	}
}

// AddAsset registers a cloud asset for the workspace (client is filled in).
func (w *Workspace) AddAsset(a Asset) {
	a.Client = w.ClientName
	w.Assets = append(w.Assets, a)
}

// Add places a file at the given client-relative directory, creating folders.
func (w *Workspace) Add(relDir string, f FileNode) {
	folder := ensureRel(&w.Root, relDir)
	folder.Files = append(folder.Files, f)
}

// ensureRel walks/creates the folder chain for relDir and returns the leaf.
func ensureRel(root *FolderNode, relDir string) *FolderNode {
	cur := root
	relDir = strings.Trim(relDir, "/")
	if relDir == "" {
		return cur
	}
	cumulative := ""
	for _, part := range strings.Split(relDir, "/") {
		if cumulative == "" {
			cumulative = part
		} else {
			cumulative += "/" + part
		}
		var next *FolderNode
		for i := range cur.SubFolders {
			if cur.SubFolders[i].Name == part {
				next = &cur.SubFolders[i]
				break
			}
		}
		if next == nil {
			cur.SubFolders = append(cur.SubFolders, FolderNode{
				Name: part, RelativePath: cumulative,
				SubFolders: []FolderNode{}, Files: []FileNode{},
			})
			next = &cur.SubFolders[len(cur.SubFolders)-1]
		}
		cur = next
	}
	return cur
}

// File is a terse FileNode constructor.
func File(name, ftype, owner, mode, content string, gt GroundTruth) FileNode {
	return FileNode{FileName: name, FileType: ftype, Owner: owner, Mode: mode, Content: content, GroundTruth: gt}
}

// StreamFile is a FileNode constructor for bodies generated lazily to disk. The
// stream closure writes the entire file body to w; the deployer wraps w in a
// buffered, byte/line-counting writer. Use for multi-MB logs/dumps that should
// never fully materialize in RAM. (Determinism: the closure must draw from its
// OWN forked *secrets.Gen, captured at Build time, so its output is independent
// of the order Deploy happens to flush files in — see secrets.Gen.Fork.)
func StreamFile(name, ftype, owner, mode string, stream func(w io.Writer) error, gt GroundTruth) FileNode {
	return FileNode{FileName: name, FileType: ftype, Owner: owner, Mode: mode, Stream: stream, GroundTruth: gt}
}

// ---------------------------------------------------------------------------
// Ground-truth constructors — agents use these to label every file.
// ---------------------------------------------------------------------------

// TP marks a file as containing a real-shaped secret (a True Positive).
func TP(technique string, classes ...string) GroundTruth {
	if classes == nil {
		classes = []string{}
	}
	return GroundTruth{HasRealSecret: true, Category: CatProdCredential, ExpectedClassifications: classes, Technique: technique}
}

// FPTest marks an intentional test/sandbox value that naive scanners over-flag.
func FPTest(technique string) GroundTruth {
	return GroundTruth{HasRealSecret: false, Category: CatTestFixture, ExpectedClassifications: []string{}, Technique: technique}
}

// FPNoise marks placeholder/synthetic PII or ID storms (benign alert fatigue).
func FPNoise(technique string) GroundTruth {
	return GroundTruth{HasRealSecret: false, Category: CatNoisePII, ExpectedClassifications: []string{}, Technique: technique}
}

// Clean marks ordinary secret-free asset inventory (code, infra, docs).
func Clean() GroundTruth {
	return GroundTruth{HasRealSecret: false, Category: CatAssetInventory, ExpectedClassifications: []string{}}
}

// ---------------------------------------------------------------------------
// Manifest + disk deployment
// ---------------------------------------------------------------------------

// ManifestEntry is one answer-key row keyed by the on-disk relative path.
type ManifestEntry struct {
	Client                  string   `json:"client"`
	HasRealSecret           bool     `json:"hasRealSecret"`
	Category                string   `json:"category"`
	ExpectedClassifications []string `json:"expectedClassifications"`
	Technique               string   `json:"technique,omitempty"`
	Bytes                   int      `json:"bytes"`
	Lines                   int      `json:"lines"`
}

// Stats summarizes a deployment.
type Stats struct {
	Files     int
	Bytes     int
	TruePos   int
	FalsePos  int
	CleanFile int
}

// Deploy writes the workspace under scanRoot/<client>/... and records every
// file in manifest (keyed by client-relative scan path). It also returns the
// fully-resolved line-level finding records (joined to file role + asset) that
// feed the Finding Context Objects, the ML training set, and the SQLite store.
func Deploy(scanRoot string, w *Workspace, manifest map[string]ManifestEntry) (Stats, []FindingRecord, error) {
	var st Stats
	dc := &deployCtx{ws: w}
	err := deployFolder(scanRoot, w.ClientName, w.Root, manifest, &st, dc)
	return st, dc.findings, err
}

// deployCtx threads per-workspace context (assets, accumulated findings, a
// deterministic finding counter) through the recursive folder walk.
type deployCtx struct {
	ws       *Workspace
	findings []FindingRecord
	seq      int
}

func deployFolder(scanRoot, client string, folder FolderNode, manifest map[string]ManifestEntry, st *Stats, dc *deployCtx) error {
	dir := filepath.Join(scanRoot, client, filepath.FromSlash(folder.RelativePath))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", dir, err)
	}
	for _, f := range folder.Files {
		path := filepath.Join(dir, f.FileName)

		var nbytes, nlines int
		if f.Stream != nil {
			n, l, err := writeStream(path, f.Stream)
			if err != nil {
				return fmt.Errorf("stream %s/%s: %w", dir, f.FileName, err)
			}
			nbytes, nlines = n, l
		} else {
			if err := os.WriteFile(path, []byte(f.Content), 0o644); err != nil {
				return fmt.Errorf("write %s/%s: %w", dir, f.FileName, err)
			}
			nbytes, nlines = len(f.Content), strings.Count(f.Content, "\n")
		}

		rel := folder.RelativePath
		key := client
		if rel != "" {
			key += "/" + rel
		}
		key += "/" + f.FileName

		manifest[key] = ManifestEntry{
			Client:                  client,
			HasRealSecret:           f.GroundTruth.HasRealSecret,
			Category:                f.GroundTruth.Category,
			ExpectedClassifications: f.GroundTruth.ExpectedClassifications,
			Technique:               f.GroundTruth.Technique,
			Bytes:                   nbytes,
			Lines:                   nlines,
		}
		st.Files++
		st.Bytes += nbytes
		switch {
		case f.GroundTruth.HasRealSecret:
			st.TruePos++
		case f.GroundTruth.Category == CatTestFixture || f.GroundTruth.Category == CatNoisePII:
			st.FalsePos++
		default:
			st.CleanFile++
		}

		dc.collectFindings(client, rel, key, f)
	}
	// Deterministic child order regardless of insertion order.
	subs := make([]FolderNode, len(folder.SubFolders))
	copy(subs, folder.SubFolders)
	sort.Slice(subs, func(i, j int) bool { return subs[i].Name < subs[j].Name })
	for _, sub := range subs {
		if err := deployFolder(scanRoot, client, sub, manifest, st, dc); err != nil {
			return err
		}
	}
	return nil
}

// collectFindings resolves a file's findings (explicit or synthesized) into
// emit-ready FindingRecords, joining file role + asset metadata.
func (dc *deployCtx) collectFindings(client, rel, scanKey string, f FileNode) {
	findings := f.Findings
	if len(findings) == 0 {
		// Synthesize a coarse finding from the file-level ground truth so the
		// legacy file-level agents still populate the DB outputs. Clean files
		// (asset-inventory) produce nothing.
		syn := synthesizeFinding(f.GroundTruth)
		if syn == nil {
			return
		}
		findings = []Finding{*syn}
	}

	relPath := rel
	if relPath != "" {
		relPath += "/"
	}
	relPath += f.FileName
	asset := dc.ws.resolveAsset(relPath)
	role := deriveFileRole(scanKey, f.GroundTruth.Category, extOf(f.FileName))

	for _, fn := range findings {
		dc.seq++
		dc.findings = append(dc.findings, FindingRecord{
			FindingID:            fmt.Sprintf("%s_finding_%04d", client, dc.seq),
			Client:               client,
			Vertical:             dc.ws.Industry,
			Path:                 scanKey,
			FileName:             f.FileName,
			Extension:            extOf(f.FileName),
			FileRole:             role,
			Category:             f.GroundTruth.Category,
			StorageLocation:      storageLocation(asset, scanKey),
			AssetID:              asset.AssetID,
			StorageExposure:      asset.StorageExposure,
			AssetCriticality:     asset.AssetCriticality,
			IsPubliclyAccessible: asset.IsPubliclyAccessible,
			Line:                 fn.Line,
			VariableName:         fn.VariableName,
			DetectedType:         fn.DetectedType,
			MaskedValue:          fn.MaskedValue,
			ValuePrefix:          fn.ValuePrefix,
			ValueSuffix:          fn.ValueSuffix,
			ValueLength:          fn.ValueLength,
			Entropy:              fn.Entropy,
			EntropyLevel:         entropyLevel(fn.Entropy),
			Label:                fn.Label,
			Classification:       fn.Classification,
			Validation:           defaultValidation(fn.Validation),
			RegexConfidence:      regexConfidence(f.GroundTruth),
			StructurallyValid:    fn.StructurallyValid,
			IsKnownTestValue:     fn.IsKnownTestValue,
			IsPublicByDesign:     fn.IsPublicByDesign,
			Reason:               fn.Reason,
		})
	}
}

// synthesizeFinding derives a single coarse finding from a file's file-level
// ground truth (used for legacy agents that don't attach explicit findings).
func synthesizeFinding(gt GroundTruth) *Finding {
	switch {
	case gt.HasRealSecret:
		dt, cls := "secret", ""
		if len(gt.ExpectedClassifications) > 0 {
			cls = gt.ExpectedClassifications[0]
			dt = detectedTypeFor(cls)
		}
		return &Finding{Line: 1, DetectedType: dt, MaskedValue: "********", ValueLength: 32,
			Entropy: 4.5, Label: LabelTrueSecret, Classification: cls, StructurallyValid: true}
	case gt.Category == CatTestFixture:
		return &Finding{Line: 1, DetectedType: "candidate", MaskedValue: "********", ValueLength: 24,
			Entropy: 3.5, Label: LabelTestValue, StructurallyValid: true}
	case gt.Category == CatNoisePII:
		return &Finding{Line: 1, DetectedType: "pii", MaskedValue: "********", ValueLength: 16,
			Entropy: 3.0, Label: LabelFalsePositive, StructurallyValid: true}
	default:
		return nil
	}
}

// resolveAsset returns the asset whose PathPrefix is the longest match for the
// client-relative path, falling back to a synthetic internal asset.
func (w *Workspace) resolveAsset(relPath string) Asset {
	best := Asset{
		AssetID: w.ClientName + "-unclassified", Client: w.ClientName, Type: "host",
		StorageExposure: "internal", AssetCriticality: "low", CloudProvider: "aws",
		ServiceContext: "unclassified",
	}
	bestLen := -1
	for _, a := range w.Assets {
		p := strings.Trim(a.PathPrefix, "/")
		if p == "" {
			if bestLen < 0 {
				best, bestLen = a, 0
			}
			continue
		}
		if relPath == p || strings.HasPrefix(relPath, p+"/") {
			if len(p) > bestLen {
				best, bestLen = a, len(p)
			}
		}
	}
	return best
}

func storageLocation(a Asset, scanKey string) string {
	switch a.Type {
	case "bucket":
		return "s3://" + a.AssetID + "/" + scanKey
	case "repo":
		return "git://" + a.AssetID + "/" + scanKey
	case "workload":
		return "k8s://" + a.AssetID + "/" + scanKey
	default:
		return "file://" + a.AssetID + "/" + scanKey
	}
}

// deriveFileRole maps a path + category + extension to a product-spec file role.
func deriveFileRole(path, category, ext string) string {
	p := strings.ToLower(path)
	switch {
	case strings.Contains(p, "/test/") || strings.Contains(p, "/fixtures/") || strings.Contains(p, "_test."):
		return "test"
	case strings.Contains(p, "/samples/") || strings.Contains(p, "/templates/") || strings.Contains(p, "placeholder"):
		return "sample"
	case strings.Contains(p, "/docs/") || ext == "md":
		return "documentation"
	case ext == "log":
		return "log"
	case ext == "yaml" || ext == "yml" || ext == "tf" || ext == "tfstate":
		return "iac"
	case strings.Contains(p, "/production/") || strings.Contains(p, "/prod/") || strings.Contains(p, "/srv/") || category == CatProdCredential:
		return "production_config"
	case ext == "go" || ext == "py" || ext == "ts" || ext == "tsx" || ext == "rb" || ext == "scala" || ext == "cs":
		return "source_code"
	default:
		return "config"
	}
}

func extOf(name string) string {
	if i := strings.LastIndexByte(name, '.'); i >= 0 && i < len(name)-1 {
		return strings.ToLower(name[i+1:])
	}
	return ""
}

// entropyLevel buckets Shannon entropy into the categorical feature the model uses.
func entropyLevel(h float64) string {
	switch {
	case h >= 4.0:
		return "high"
	case h >= 3.0:
		return "medium"
	default:
		return "low"
	}
}

func defaultValidation(v string) string {
	if v == "" {
		return ValNotValidated
	}
	return v
}

// regexConfidence projects the file-level ground truth onto the regex layer's
// self-reported confidence (the candidate-generation signal, not the verdict).
func regexConfidence(gt GroundTruth) string {
	switch gt.Category {
	case CatProdCredential:
		return "high"
	case CatTestFixture:
		return "medium"
	default:
		return "low"
	}
}

// detectedTypeFor maps a classification label to a coarse detected_type.
func detectedTypeFor(cls string) string {
	switch {
	case strings.Contains(cls, "private-key") || strings.Contains(cls, "ssh"):
		return "private_key"
	case strings.Contains(cls, "aws") || strings.Contains(cls, "gcp") || strings.Contains(cls, "cloud"):
		return "cloud_key"
	case strings.Contains(cls, "db") || strings.Contains(cls, "connection") || strings.Contains(cls, "postgres") || strings.Contains(cls, "snowflake"):
		return "database_password"
	case strings.Contains(cls, "stripe") || strings.Contains(cls, "paypal") || strings.Contains(cls, "adyen") || strings.Contains(cls, "braintree"):
		return "payment_secret"
	case strings.Contains(cls, "card") || strings.Contains(cls, "pan"):
		return "credit_card"
	case strings.Contains(cls, "ssn") || strings.Contains(cls, "pii") || strings.Contains(cls, "phi"):
		return "pii"
	default:
		return "api_key"
	}
}

// countingWriter forwards writes to an underlying writer while tallying total
// bytes and newlines — so a streamed file's manifest Bytes/Lines stay exact
// without the body ever being held whole in memory.
type countingWriter struct {
	w     io.Writer
	bytes int
	lines int
}

func (c *countingWriter) Write(p []byte) (int, error) {
	n, err := c.w.Write(p)
	c.bytes += n
	c.lines += bytes.Count(p[:n], []byte{'\n'})
	return n, err
}

// writeStream creates path and drives stream() through a 64KiB buffered,
// counting writer, returning the byte and line totals for the manifest.
func writeStream(path string, stream func(w io.Writer) error) (int, int, error) {
	file, err := os.Create(path)
	if err != nil {
		return 0, 0, err
	}
	defer file.Close()

	bw := bufio.NewWriterSize(file, 64<<10)
	cw := &countingWriter{w: bw}
	if err := stream(cw); err != nil {
		return 0, 0, err
	}
	if err := bw.Flush(); err != nil {
		return 0, 0, err
	}
	return cw.bytes, cw.lines, nil
}

// WriteManifest serializes the manifest (plus a summary header) to path.
func WriteManifest(path string, manifest map[string]ManifestEntry, summary any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir truth dir: %w", err)
	}
	doc := map[string]any{
		"summary": summary,
		"files":   manifest,
	}
	data, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal manifest: %w", err)
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}
