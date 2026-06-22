// Command generate is the orchestrator. It commands the four customer-profile
// agents (Wix, Agoda, Fiverr, Insurify), each of which architects a
// hyper-realistic simulated filesystem on disk under customer-data/, then
// writes a single ground-truth answer key to _truth/manifest.json — outside
// the scan root so the scanner never reads it.
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

	"upwind-context-scanner/pkg/agents/agoda"
	"upwind-context-scanner/pkg/agents/fiverr"
	"upwind-context-scanner/pkg/agents/insurify"
	"upwind-context-scanner/pkg/agents/wix"
	"upwind-context-scanner/pkg/content"
	"upwind-context-scanner/pkg/fsbuilder"
	"upwind-context-scanner/pkg/secrets"
)

const (
	scanRoot     = "customer-data"
	truthDir     = "_truth"
	manifestPath = "_truth/manifest.json"
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

	// Distinct, fixed seeds keep each agent independent yet reproducible.
	agents := []agentDef{
		{"wix", 1001, wix.Build},
		{"agoda", 2002, agoda.Build},
		{"fiverr", 3003, fiverr.Build},
		{"insurify", 4004, insurify.Build},
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

	fmt.Println("Orchestrator: commanding 4 customer-profile agents...")
	for _, a := range agents {
		g := secrets.New(a.seed)
		ws := a.build(g)
		st, err := fsbuilder.Deploy(scanRoot, ws, manifest)
		if err != nil {
			fatal("deploy %s: %v", a.name, err)
		}
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
		fmt.Printf("  [%-8s] industry=%-14s files=%3d  ~%4dKB  TP=%d  FP=%2d  clean=%3d\n",
			ws.ClientName, ws.Industry, st.Files, st.Bytes/1024, st.TruePos, st.FalsePos, st.CleanFile)
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

	fmt.Printf("\nDeployed %d files (~%d KB) across %d clients to %s/\n",
		totFiles, totBytes/1024, len(agents), scanRoot)
	fmt.Printf("  True positives (real-shaped leaks): %d\n", totTP)
	fmt.Printf("  False positives (benign noise)    : %d\n", totFP)
	fmt.Printf("  Clean inventory                   : %d\n", totClean)
	fmt.Printf("  Non-leaking corpus                : %.1f%%\n", cleanPct)
	fmt.Printf("Answer key -> %s (%d entries)\n", manifestPath, len(manifest))
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
