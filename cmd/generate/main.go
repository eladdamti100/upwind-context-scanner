// Command generate is the orchestrator. For the demo it commands a single
// customer-profile agent — EvenUp, a hyper-dense AI personal-injury claims
// platform (fintech-legal-hybrid) — which architects a realistic simulated
// filesystem on disk under customer-data/, then writes the DB contract to a
// root-level DB/ folder: the answer key (manifest.json) plus findings.json,
// assets.json, training.csv, and scanner.db — all outside the scan root so the
// scanner never reads them. The legacy clients (wix/agoda/fiverr/insurify/
// omni-corp) still live in pkg/agents but are not registered in main().
//
// Determinism: every agent receives its own seeded *secrets.Gen, so the entire
// corpus is byte-for-byte reproducible across runs.
//
// SAFETY: every "secret" in the generated corpus is randomly synthesized to
// merely WEAR the shape (prefix/checksum) of a real credential. None
// authenticate against any real service. The corpus exists solely to exercise
// Upwind's Cloud Scanner under realistic alert-fatigue conditions.
package main

import (
	"fmt"
	"os"
	"sort"
	"strconv"

	"upwind-context-scanner/pkg/agents/evenup"
	"upwind-context-scanner/pkg/content"
	"upwind-context-scanner/pkg/features"
	"upwind-context-scanner/pkg/fsbuilder"
	"upwind-context-scanner/pkg/secrets"
	"upwind-context-scanner/pkg/store"
)

const (
	scanRoot     = "customer-data"
	truthDir     = "DB"
	manifestPath = "DB/manifest.json"
	findingsPath = "DB/findings.json"
	assetsPath   = "DB/assets.json"
	trainingPath = "DB/training.csv"
	sqlitePath   = "DB/scanner.db"
)

// agentDef binds an agent's Build function to a deterministic seed.
type agentDef struct {
	name  string
	seed  int64
	build func(*secrets.Gen) *fsbuilder.Workspace
}

func main() {
	// CORPUS_SCALE dials the bulk-noise volume (logs, lockfiles, dumps). Default
	// 1 reproduces the ~15MB baseline; e.g. CORPUS_SCALE=8 yields ~100MB+. The
	// streaming write path keeps peak memory low regardless of scale.
	if v := os.Getenv("CORPUS_SCALE"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			content.Scale = n
		} else {
			fatal("invalid CORPUS_SCALE=%q (want a positive integer)", v)
		}
	}

	// Demo isolation: the pipeline runs a single flagship hybrid enterprise.
	// The legacy clients (wix/agoda/fiverr/insurify) remain in pkg/agents but are
	// deliberately not registered here, so the corpus and every _truth/ artifact
	// contain 100% omni-corp context. Re-add their agentDefs to restore them.
	agents := []agentDef{
		{"evenup", 7007, evenup.Build},
	}

	// Clean slate.
	for _, dir := range []string{scanRoot, truthDir} {
		if err := os.RemoveAll(dir); err != nil {
			fatal("clean %s: %v", dir, err)
		}
	}

	manifest := map[string]fsbuilder.ManifestEntry{}
	type clientStat struct {
		Client   string `json:"client"`
		Industry string `json:"industry"`
		Files    int    `json:"files"`
		KB       int    `json:"kb"`
		TruePos  int    `json:"truePositives"`
		FalsePos int    `json:"falsePositives"`
		Clean    int    `json:"cleanFiles"`
	}

	var clientStats []clientStat
	var totFiles, totBytes, totTP, totFP, totClean int
	var allFindings []fsbuilder.FindingRecord
	var allAssets []fsbuilder.Asset

	fmt.Printf("Orchestrator: commanding %d customer-profile agents...\n", len(agents))
	for _, a := range agents {
		g := secrets.New(a.seed)
		ws := a.build(g)
		st, recs, err := fsbuilder.Deploy(scanRoot, ws, manifest)
		if err != nil {
			fatal("deploy %s: %v", a.name, err)
		}
		allFindings = append(allFindings, recs...)
		allAssets = append(allAssets, ws.Assets...)
		clientStats = append(clientStats, clientStat{
			Client: ws.ClientName, Industry: ws.Industry,
			Files: st.Files, KB: st.Bytes / 1024,
			TruePos: st.TruePos, FalsePos: st.FalsePos, Clean: st.CleanFile,
		})
		totFiles += st.Files
		totBytes += st.Bytes
		totTP += st.TruePos
		totFP += st.FalsePos
		totClean += st.CleanFile
		fmt.Printf("  [%-9s] industry=%-17s files=%3d  ~%5dKB  TP=%d  FP=%2d  clean=%3d  findings=%d\n",
			ws.ClientName, ws.Industry, st.Files, st.Bytes/1024, st.TruePos, st.FalsePos, st.CleanFile, len(recs))
	}

	cleanPct := 0.0
	if totFiles > 0 {
		cleanPct = 100 * float64(totFiles-totTP) / float64(totFiles)
	}

	summary := map[string]any{
		"description":      "Ground-truth answer key for the Upwind Cloud Scanner haystack corpus. Lives outside customer-data/ — the scanner must NOT read this.",
		"seedNote":         "Deterministic: per-agent fixed seeds reproduce the corpus byte-for-byte.",
		"corpusScale":      content.Scale,
		"totalFiles":       totFiles,
		"totalFindings":    len(allFindings),
		"totalKB":          totBytes / 1024,
		"truePositives":    totTP,
		"falsePositives":   totFP,
		"cleanFiles":       totClean,
		"nonLeakingPct":    fmt.Sprintf("%.1f%%", cleanPct),
		"clients":          clientStats,
		"classificationVocab": classVocab(manifest),
	}

	if err := fsbuilder.WriteManifest(manifestPath, manifest, summary); err != nil {
		fatal("write manifest: %v", err)
	}

	// DB data contract: per-finding context objects, the cloud-asset inventory,
	// the labeled ML training set, and a ready-to-load SQLite database.
	if err := store.WriteFindingsJSON(findingsPath, allFindings); err != nil {
		fatal("write findings: %v", err)
	}
	if err := store.WriteAssetsJSON(assetsPath, allAssets); err != nil {
		fatal("write assets: %v", err)
	}
	if err := features.WriteCSV(trainingPath, allFindings); err != nil {
		fatal("write training set: %v", err)
	}
	if err := store.WriteSQLite(sqlitePath, allFindings, allAssets, manifest); err != nil {
		fatal("write sqlite: %v", err)
	}

	// Fence the synthetic corpus off as a nested throwaway module so the parent
	// module's tooling (`go build ./...`, `go vet ./...`) never tries to compile
	// the deliberately non-compiling haystack code (many files share a package
	// and redeclare symbols by design). customer-data/ is gitignored, so this
	// marker is never committed.
	fence := "module omni-corp-fixtures\n\ngo 1.25\n"
	if err := os.WriteFile(scanRoot+"/go.mod", []byte(fence), 0o644); err != nil {
		fatal("write fixtures go.mod: %v", err)
	}

	fmt.Printf("\nDeployed %d files (~%d KB) across %d clients to %s/\n",
		totFiles, totBytes/1024, len(agents), scanRoot)
	fmt.Printf("  True positives (real-shaped leaks): %d\n", totTP)
	fmt.Printf("  False positives (benign noise)    : %d\n", totFP)
	fmt.Printf("  Clean inventory                   : %d\n", totClean)
	fmt.Printf("  Non-leaking corpus                : %.1f%%\n", cleanPct)
	fmt.Printf("Answer key   -> %s (%d entries)\n", manifestPath, len(manifest))
	fmt.Printf("DB contract  -> %s (%d findings), %s (%d assets), %s, %s\n",
		findingsPath, len(allFindings), assetsPath, len(allAssets), trainingPath, sqlitePath)
}

// classVocab returns the sorted set of every classification across all TPs,
// so the manifest header documents the full detection target list.
func classVocab(m map[string]fsbuilder.ManifestEntry) []string {
	set := map[string]struct{}{}
	for _, e := range m {
		for _, c := range e.ExpectedClassifications {
			set[c] = struct{}{}
		}
	}
	out := make([]string, 0, len(set))
	for c := range set {
		out = append(out, c)
	}
	sort.Strings(out)
	return out
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "orchestrator: "+format+"\n", args...)
	os.Exit(1)
}
