// Command evaluate scores a backend's predictions against the EvenUp ground
// truth in DB/findings.json and reports whether the context-aware backend is
// actually working: precision, recall, F1, and false-positive reduction versus
// the regex-only baseline (which flags every candidate).
//
// Usage:
//
//	go run ./cmd/evaluate [predictionsFile] [threshold]
//
// predictionsFile defaults to DB/predictions.json. threshold (default 0.5) is
// the secret_probability cutoff. The backend should emit a JSON array of:
//
//	[ {"finding_id": "evenup_finding_0001", "secret_probability": 0.93}, ... ]
//
// or, if it decides directly:
//
//	[ {"finding_id": "evenup_finding_0001", "is_secret": true}, ... ]
//
// A finding the backend omits is treated as predicted "not a secret".
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strconv"
)

type finding struct {
	FindingID string `json:"finding_id"`
	Candidate struct {
		DetectedType string `json:"detected_type"`
	} `json:"candidate"`
	GroundTruth struct {
		Label           string `json:"label"`
		IsSecret        bool   `json:"is_secret"`
		StorageExposure string `json:"storage_exposure"`
		Reason          string `json:"reason"`
	} `json:"ground_truth"`
}

type prediction struct {
	FindingID         string   `json:"finding_id"`
	SecretProbability *float64 `json:"secret_probability,omitempty"`
	IsSecret          *bool    `json:"is_secret,omitempty"`
}

func main() {
	predPath := "DB/predictions.json"
	threshold := 0.5
	if len(os.Args) > 1 {
		predPath = os.Args[1]
	}
	if len(os.Args) > 2 {
		if t, err := strconv.ParseFloat(os.Args[2], 64); err == nil {
			threshold = t
		}
	}

	findings := loadFindings("DB/findings.json")
	preds := loadPredictions(predPath)

	predByID := map[string]bool{}
	for _, p := range preds {
		predByID[p.FindingID] = p.predictsSecret(threshold)
	}

	// Confusion matrix at the finding level. "Positive" = predicted real secret.
	var tp, fp, fn, tn, missing int
	byTypeErr := map[string]int{}
	fpByReason := map[string]int{}    // which clever-FP families the backend failed to clear
	clearedByReason := map[string]int{} // which it correctly cleared
	var falseNegatives []finding      // real secrets the backend MISSED — the dangerous ones
	for _, f := range findings {
		pred, ok := predByID[f.FindingID]
		if !ok {
			missing++
		}
		actual := f.GroundTruth.IsSecret
		reason := f.GroundTruth.Reason
		switch {
		case pred && actual:
			tp++
		case pred && !actual:
			fp++
			byTypeErr["FP:"+f.Candidate.DetectedType]++
			if reason != "" {
				fpByReason[reason]++
			}
		case !pred && actual:
			fn++
			byTypeErr["FN:"+f.Candidate.DetectedType]++
			falseNegatives = append(falseNegatives, f)
		default:
			tn++
			if reason != "" {
				clearedByReason[reason]++
			}
		}
	}

	precision := ratio(tp, tp+fp)
	recall := ratio(tp, tp+fn)
	f1 := 0.0
	if precision+recall > 0 {
		f1 = 2 * precision * recall / (precision + recall)
	}

	// Regex-only baseline = flag EVERY candidate as a secret (no context).
	total := len(findings)
	realSecrets := tp + fn
	benign := fp + tn
	basePrecision := ratio(realSecrets, total)         // all flagged → precision = secrets/total
	baseFP := benign                                   // every benign candidate is a false alarm
	fpReduction := ratio(baseFP-fp, baseFP)            // how many benign alarms the backend cleared

	fmt.Println("=== EvenUp backend evaluation (vs DB/findings.json ground truth) ===")
	fmt.Printf("predictions file : %s   (threshold=%.2f)\n", predPath, threshold)
	fmt.Printf("findings scored  : %d   (predictions missing for %d → treated as 'not secret')\n\n", total, missing)

	fmt.Println("--- Finding-level confusion matrix ---")
	fmt.Printf("  TP (real secret, caught)   : %d\n", tp)
	fmt.Printf("  FN (real secret, MISSED)   : %d   <-- must be 0 for the demo\n", fn)
	fmt.Printf("  FP (benign, wrongly flagged): %d   <-- alert fatigue\n", fp)
	fmt.Printf("  TN (benign, correctly cleared): %d\n\n", tn)

	fmt.Printf("  Precision : %.1f%%\n", 100*precision)
	fmt.Printf("  Recall    : %.1f%%\n", 100*recall)
	fmt.Printf("  F1        : %.1f%%\n\n", 100*f1)

	fmt.Println("--- vs regex-only baseline (flags every candidate) ---")
	fmt.Printf("  Baseline precision      : %.1f%%  (real secrets %d / %d candidates)\n", 100*basePrecision, realSecrets, total)
	fmt.Printf("  Backend precision       : %.1f%%\n", 100*precision)
	fmt.Printf("  False-positive reduction: %.1f%%  (cleared %d of %d benign alarms)\n\n", 100*fpReduction, baseFP-fp, baseFP)

	if len(byTypeErr) > 0 {
		fmt.Println("--- errors by detected_type ---")
		keys := make([]string, 0, len(byTypeErr))
		for k := range byTypeErr {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			fmt.Printf("  %-28s %d\n", k, byTypeErr[k])
		}
		fmt.Println()
	}

	// Clever-FP scorecard: of the value-intrinsic / context-mandatory families
	// (the ones regex can't clear), how many did the backend correctly clear?
	if len(fpByReason) > 0 || len(clearedByReason) > 0 {
		fmt.Println("--- clever false-positive families (cleared vs leaked) ---")
		reasons := map[string]bool{}
		for k := range fpByReason {
			reasons[k] = true
		}
		for k := range clearedByReason {
			reasons[k] = true
		}
		keys := make([]string, 0, len(reasons))
		for k := range reasons {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			cleared, leaked := clearedByReason[k], fpByReason[k]
			mark := "OK"
			if leaked > 0 {
				mark = "LEAKED"
			}
			fmt.Printf("  %-34s cleared=%-3d leaked=%-3d %s\n", k, cleared, leaked, mark)
		}
		fmt.Println()
	}

	if len(falseNegatives) > 0 {
		fmt.Printf("--- MISSED real secrets (%d) — investigate these first ---\n", len(falseNegatives))
		for i, f := range falseNegatives {
			if i >= 15 {
				fmt.Printf("  ... and %d more\n", len(falseNegatives)-15)
				break
			}
			fmt.Printf("  %s  type=%s  exposure=%s\n", f.FindingID, f.Candidate.DetectedType, f.GroundTruth.StorageExposure)
		}
		fmt.Println()
	}

	// Verdict.
	switch {
	case fn > 0:
		fmt.Printf("VERDICT: NOT READY — backend missed %d real secret(s). Recall must hit 100%%.\n", fn)
		os.Exit(1)
	case precision < basePrecision:
		fmt.Println("VERDICT: REGRESSION — backend precision is below the regex baseline.")
		os.Exit(1)
	default:
		fmt.Printf("VERDICT: WORKING — no missed secrets, precision improved %.1f%% → %.1f%%.\n", 100*basePrecision, 100*precision)
	}
}

func (p prediction) predictsSecret(threshold float64) bool {
	if p.IsSecret != nil {
		return *p.IsSecret
	}
	if p.SecretProbability != nil {
		return *p.SecretProbability >= threshold
	}
	return false
}

func loadFindings(path string) []finding {
	raw, err := os.ReadFile(path)
	if err != nil {
		fatal("read %s (run `go run ./cmd/generate` first): %v", path, err)
	}
	var fs []finding
	if err := json.Unmarshal(raw, &fs); err != nil {
		fatal("parse %s: %v", path, err)
	}
	return fs
}

func loadPredictions(path string) []prediction {
	raw, err := os.ReadFile(path)
	if err != nil {
		fatal("read predictions %s: %v\n(have your backend write a JSON array of {finding_id, secret_probability})", path, err)
	}
	var ps []prediction
	if err := json.Unmarshal(raw, &ps); err != nil {
		fatal("parse predictions %s: %v", path, err)
	}
	return ps
}

func ratio(num, den int) float64 {
	if den == 0 {
		return 0
	}
	return float64(num) / float64(den)
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "evaluate: "+format+"\n", args...)
	os.Exit(1)
}
