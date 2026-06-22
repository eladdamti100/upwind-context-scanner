// Command legacy-scan is the "dumb" baseline scanner: it walks the physical data/
// tree produced by generate.go and runs a broad, high-recall regex pass over every
// file's bytes — exactly the behavior that causes Upwind's legacy alert fatigue.
//
// It then scores itself against the _truth/manifest.json answer key (file-level
// precision/recall) so the Phase 2 context-aware engine has a baseline to beat.
// The manifest lives outside data/, so the scanner never reads the answer key.
//
//	go run ./cmd/legacy-scan
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// scanRoot is the physical directory the scanner walks (must match generate.go).
const scanRoot = "customer-data"

// manifestEntry mirrors _truth/manifest.json values; keys are client-relative
// paths like "agoda/srv/secure/v2/config/prod.env".
type manifestEntry struct {
	HasRealSecret bool   `json:"hasRealSecret"`
	Category      string `json:"category"`
}

// --- The legacy rule set: broad patterns, tuned for recall, not precision ---

type rule struct {
	id string
	re *regexp.Regexp
}

func rules() []rule {
	mk := func(id, pat string) rule { return rule{id: id, re: regexp.MustCompile(pat)} }
	return []rule{
		mk("aws-access-key-id", `AKIA[0-9A-Z]{16}`),
		mk("aws-secret-key", `(?i)aws_secret[^\n]{0,40}[A-Za-z0-9/+]{40}`),
		mk("stripe-key", `sk_(live|test)_[A-Za-z0-9]{24}`), // also flags test keys -> FP
		mk("github-token", `ghp_[A-Za-z0-9]{36}`),
		mk("slack-webhook", `hooks\.slack\.com/services`),
		mk("private-key-block", `-----BEGIN [A-Z ]*PRIVATE KEY-----`),
		mk("jwt", `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`),
		mk("credit-card-16", `\b\d{16}\b`),                            // flags every txn_id log line -> FP storm
		mk("generic-hex-key", `\b[a-f0-9]{32,}\b`),                    // flags build hashes / subjectHash -> FP
		mk("ipv6-addr", `\b([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b`), // flags netplan inventory -> FP
		mk("mac-addr", `\b([0-9a-f]{2}:){5}[0-9a-f]{2}\b`),            // flags netplan inventory -> FP
		mk("pii-json-key", `"(ssn|phone|zip|city|email)"\s*:`),        // flags clinic placeholder configs -> FP
		mk("ssn", `\b\d{3}-\d{2}-\d{4}\b`),
		mk("email", `[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`), // flags public support docs -> FP
	}
}

type finding struct {
	path  string
	rules []string
}

func main() {
	// Load the answer key (kept outside data/).
	raw, err := os.ReadFile(filepath.Join("DB", "manifest.json"))
	if err != nil {
		fmt.Fprintln(os.Stderr, "read DB/manifest.json (run generate.go first):", err)
		os.Exit(1)
	}
	// manifest.json is wrapped as {"summary": {...}, "files": {path: entry}}.
	var doc struct {
		Files map[string]manifestEntry `json:"files"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		fmt.Fprintln(os.Stderr, "parse manifest.json:", err)
		os.Exit(1)
	}
	manifest := doc.Files
	// Key ground truth by on-disk path: customer-data/<client-relative-key>.
	truth := make(map[string]manifestEntry, len(manifest))
	for rel, e := range manifest {
		truth[filepath.Join(scanRoot, filepath.FromSlash(rel))] = e
	}

	rs := rules()

	// Walk the physical tree and run the high-recall regex pass.
	flagged := map[string][]string{} // path -> matched rule ids
	ruleHits := map[string]int{}
	totalAlerts := 0
	scanned := 0
	err = filepath.WalkDir(scanRoot, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		scanned++
		var matched []string
		for _, r := range rs {
			hits := r.re.FindAllString(string(content), -1)
			if len(hits) > 0 {
				matched = append(matched, r.id)
				ruleHits[r.id] += len(hits)
				totalAlerts += len(hits)
			}
		}
		if len(matched) > 0 {
			flagged[path] = matched
		}
		return nil
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "walk customer-data/ (run generate.go first):", err)
		os.Exit(1)
	}

	// Score at file level against ground truth.
	var tp, fp, fn, tn int
	var falsePositives []finding
	var falseNegatives []string
	for path, gt := range truth {
		isFlagged := len(flagged[path]) > 0
		switch {
		case gt.HasRealSecret && isFlagged:
			tp++
		case gt.HasRealSecret && !isFlagged:
			fn++
			falseNegatives = append(falseNegatives, path)
		case !gt.HasRealSecret && isFlagged:
			fp++
			falsePositives = append(falsePositives, finding{path: path, rules: flagged[path]})
		default:
			tn++
		}
	}

	precision := ratio(tp, tp+fp)
	recall := ratio(tp, tp+fn)
	f1 := 0.0
	if precision+recall > 0 {
		f1 = 2 * precision * recall / (precision + recall)
	}

	fmt.Println("=== LEGACY REGEX SCANNER (high-recall baseline) ===")
	fmt.Printf("Files scanned on disk : %d\n", scanned)
	fmt.Printf("Raw regex alerts      : %d  (every match = one analyst ping)\n", totalAlerts)
	fmt.Printf("Files flagged         : %d / %d\n", len(flagged), scanned)
	fmt.Println()
	fmt.Println("--- File-level confusion matrix (vs ground truth) ---")
	fmt.Printf("  TP (real secret, flagged)   : %d\n", tp)
	fmt.Printf("  FN (real secret, missed)    : %d\n", fn)
	fmt.Printf("  FP (benign noise, flagged)  : %d   <-- alert fatigue\n", fp)
	fmt.Printf("  TN (benign noise, ignored)  : %d\n", tn)
	fmt.Println()
	fmt.Printf("  Precision : %.1f%%   Recall : %.1f%%   F1 : %.1f%%\n", precision*100, recall*100, f1*100)
	fmt.Println()

	fmt.Println("--- Alerts per rule (sorted) ---")
	for _, kv := range sortedCounts(ruleHits) {
		fmt.Printf("  %-20s %d\n", kv.k, kv.v)
	}
	fmt.Println()

	fmt.Printf("--- Top false-positive sources (%d benign files wrongly flagged) ---\n", fp)
	sort.Slice(falsePositives, func(i, j int) bool { return falsePositives[i].path < falsePositives[j].path })
	shown := 0
	for _, f := range falsePositives {
		if shown >= 10 {
			fmt.Printf("  ... and %d more\n", fp-shown)
			break
		}
		fmt.Printf("  %s  [%s]\n", trimData(f.path), strings.Join(f.rules, ","))
		shown++
	}
	if fn > 0 {
		fmt.Printf("\n--- Missed real secrets (%d) ---\n", fn)
		sort.Strings(falseNegatives)
		for _, p := range falseNegatives {
			fmt.Printf("  %s\n", trimData(p))
		}
	}
}

func ratio(a, b int) float64 {
	if b == 0 {
		return 0
	}
	return float64(a) / float64(b)
}

func trimData(p string) string { return strings.TrimPrefix(p, scanRoot+"/") }

type kv struct {
	k string
	v int
}

func sortedCounts(m map[string]int) []kv {
	out := make([]kv, 0, len(m))
	for k, v := range m {
		out = append(out, kv{k, v})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].v != out[j].v {
			return out[i].v > out[j].v
		}
		return out[i].k < out[j].k
	})
	return out
}
