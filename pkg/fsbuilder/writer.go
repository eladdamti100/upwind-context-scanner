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
}

// NewWorkspace returns an empty workspace for a client.
func NewWorkspace(name, industry string) *Workspace {
	return &Workspace{
		ClientName: name,
		Industry:   industry,
		Root:       FolderNode{Name: name, SubFolders: []FolderNode{}, Files: []FileNode{}},
	}
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
// file in manifest (keyed by client-relative-or-absolute scan path).
func Deploy(scanRoot string, w *Workspace, manifest map[string]ManifestEntry) (Stats, error) {
	var st Stats
	err := deployFolder(scanRoot, w.ClientName, w.Root, manifest, &st)
	return st, err
}

func deployFolder(scanRoot, client string, folder FolderNode, manifest map[string]ManifestEntry, st *Stats) error {
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

		key := client
		if folder.RelativePath != "" {
			key += "/" + folder.RelativePath
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
	}
	// Deterministic child order regardless of insertion order.
	subs := make([]FolderNode, len(folder.SubFolders))
	copy(subs, folder.SubFolders)
	sort.Slice(subs, func(i, j int) bool { return subs[i].Name < subs[j].Name })
	for _, sub := range subs {
		if err := deployFolder(scanRoot, client, sub, manifest, st); err != nil {
			return err
		}
	}
	return nil
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
