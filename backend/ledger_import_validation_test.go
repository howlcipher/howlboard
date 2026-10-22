package backend_test

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
)

var importStores = []string{"howlboard_missions.json", "howlboard_timeline.json"}

// compileImporter builds tools/ledger_import exactly as `make build` does.
func compileImporter(t *testing.T) string {
	t.Helper()
	root := repoRoot(t)
	artifact := filepath.Join(t.TempDir(), "ledger_import.hfbc")
	cmd := exec.Command(resolveHowlFrameBin(root), "-compile-bc", filepath.Join(root, "tools/ledger_import/ledger_import.howl"), "-o", artifact)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("compile importer: %v: %s", err, out)
	}
	return artifact
}

// runImporter runs the importer in dir with `make import`'s grants and budgets
// unless caps overrides the grants. It returns the exit status and output.
func runImporter(t *testing.T, artifact, dir, caps string, args ...string) (int, string, string) {
	t.Helper()
	if caps == "" {
		caps = "filesystem,database"
	}
	argv := append([]string{"-run-bc", "-allow-caps", caps, "-max-instructions", "200000000",
		"-max-memory-bytes", "268435456", artifact}, args...)
	cmd := exec.Command(resolveHowlFrameBin(repoRoot(t)), argv...)
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	err := cmd.Run()
	var exit *exec.ExitError
	if errors.As(err, &exit) {
		return exit.ExitCode(), stdout.String(), stderr.String()
	}
	if err != nil {
		t.Fatalf("run importer: %v", err)
	}
	return 0, stdout.String(), stderr.String()
}

func storeBytes(t *testing.T, dir string) map[string][]byte {
	t.Helper()
	out := map[string][]byte{}
	for _, name := range importStores {
		raw, err := os.ReadFile(filepath.Join(dir, name))
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			t.Fatal(err)
		}
		out[name] = raw
	}
	return out
}

func ledgerLine(t *testing.T, fields map[string]any) string {
	t.Helper()
	entry := map[string]any{"schema": "ai.evidence_entry/v1", "agent_id": "test", "action": "task_created",
		"timestamp": "2026-10-01T00:00:00+00:00", "metadata": map[string]any{}}
	for key, value := range fields {
		if value == nil {
			delete(entry, key)
		} else {
			entry[key] = value
		}
	}
	raw, err := json.Marshal(entry)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw) + "\n"
}

func writeLedger(t *testing.T, dir, content string) string {
	t.Helper()
	path := filepath.Join(dir, "ledger.jsonl")
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

// On valid input the importer must reproduce the previous importer's stores
// exactly; the golden file was produced by that importer.
func TestLedgerImportMatchesRecordedProjection(t *testing.T) {
	root := repoRoot(t)
	artifact := compileImporter(t)
	raw, err := os.ReadFile(filepath.Join(root, "data/fixtures/ledger_sample.import.golden.json"))
	if err != nil {
		t.Fatal(err)
	}
	var golden map[string]any
	if err := json.Unmarshal(raw, &golden); err != nil {
		t.Fatal(err)
	}
	for _, args := range [][]string{{"2000"}, {}} {
		dir := t.TempDir()
		code, stdout, stderr := runImporter(t, artifact, dir, "", append([]string{filepath.Join(root, "data/fixtures/ledger_sample.jsonl")}, args...)...)
		if code != 0 || stdout != "entries=72\nmissions=16\n" {
			t.Fatalf("args %v: exit %d stdout %q stderr %q", args, code, stdout, stderr)
		}
		for name, content := range storeBytes(t, dir) {
			var got any
			if err := json.Unmarshal(content, &got); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, golden[name]) {
				t.Errorf("args %v: %s differs from the recorded projection", args, name)
			}
		}
	}
}

// Every invalid ledger fails before anything is written: a prior import's
// stores stay byte-identical, and the diagnostic names the line.
func TestLedgerImportRejectsInvalidLedgerWithoutWriting(t *testing.T) {
	artifact := compileImporter(t)
	valid := func(id, task string) map[string]any { return map[string]any{"entry_id": id, "task_id": task} }
	cases := []struct {
		name, content, max string
		exit               int
		diagnostic         string
	}{
		{"malformed json", ledgerLine(t, valid("a", "T")) + "{not json\n", "10", 3, "invalid_ledger at line 2: Malformed JSON"},
		{"truncated last line", ledgerLine(t, valid("a", "T")) + ledgerLine(t, valid("b", "T"))[:30], "10", 3, "invalid_ledger at line 2: Malformed JSON"},
		{"non-object line", "[1,2]\n", "10", 3, "invalid_ledger at line 1: Expected an object"},
		{"wrong schema", ledgerLine(t, map[string]any{"entry_id": "a", "task_id": "T", "schema": "other/v9"}), "10", 3, "invalid_ledger at line 1: Wrong schema"},
		{"missing task_id", ledgerLine(t, map[string]any{"entry_id": "a"}), "10", 3, "invalid_ledger at line 1: task_id must be a string"},
		{"empty agent_id", ledgerLine(t, map[string]any{"entry_id": "a", "task_id": "T", "agent_id": ""}), "10", 3, "invalid_ledger at line 1: agent_id must not be empty"},
		{"duplicate entry_id", ledgerLine(t, valid("a", "T")) + ledgerLine(t, valid("a", "U")), "10", 3, "invalid_ledger at line 2: Duplicate entry_id"},
		{"empty file", "", "10", 3, "invalid_ledger: Ledger has no records"},
		{"blank lines only", "\n  \n", "10", 3, "invalid_ledger: Ledger has no records"},
		{"over entry limit", ledgerLine(t, valid("a", "T")) + ledgerLine(t, valid("b", "T")) + ledgerLine(t, valid("c", "T")), "2", 3, "payload_too_large at line 3: Nonblank entry limit exceeded"},
		{"over byte ceiling", strings.Repeat(" ", 3145729), "10", 3, "payload_too_large: Ledger exceeds 3145728 bytes"},
		{"zero limit", ledgerLine(t, valid("a", "T")), "0", 2, "max_entries is a positive integer"},
		{"negative limit", ledgerLine(t, valid("a", "T")), "-5", 2, "max_entries is a positive integer"},
		{"non-numeric limit", ledgerLine(t, valid("a", "T")), "abc", 2, "max_entries is a positive integer"},
	}
	prior := t.TempDir()
	if code, _, stderr := runImporter(t, artifact, prior, "", writeLedger(t, prior, ledgerLine(t, valid("p", "PRIOR"))), "10"); code != 0 {
		t.Fatalf("prior import: %d %s", code, stderr)
	}
	before := storeBytes(t, prior)
	if len(before) != 2 {
		t.Fatalf("prior import wrote %d stores", len(before))
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ledger := writeLedger(t, t.TempDir(), c.content)
			code, stdout, stderr := runImporter(t, artifact, prior, "", ledger, c.max)
			if code != c.exit || stdout != "" || !strings.Contains(stderr, c.diagnostic) {
				t.Fatalf("exit %d stdout %q stderr %q; want exit %d with %q", code, stdout, stderr, c.exit, c.diagnostic)
			}
			if strings.Contains(stderr, `"phase"`) {
				t.Errorf("raw runtime error instead of a diagnostic: %s", stderr)
			}
			if c.exit == 3 && !strings.Contains(stderr, "nothing was imported") {
				t.Errorf("diagnostic does not say the import was refused: %s", stderr)
			}
			if !reflect.DeepEqual(storeBytes(t, prior), before) {
				t.Fatal("a rejected import changed the existing stores")
			}
		})
	}
	if code, _, stderr := runImporter(t, artifact, prior, "", filepath.Join(prior, "missing.jsonl"), "10"); code != 3 || !strings.Contains(stderr, "Failed to read ledger file") {
		t.Fatalf("missing file: exit %d %s", code, stderr)
	}
	if code, _, stderr := runImporter(t, artifact, prior, ""); code != 2 || !strings.Contains(stderr, "usage:") {
		t.Fatalf("no arguments: exit %d %s", code, stderr)
	}
	if !reflect.DeepEqual(storeBytes(t, prior), before) {
		t.Fatal("a refused invocation changed the existing stores")
	}
}

// MAX is an exact ceiling: MAX entries import, blank lines do not count, and
// metadata is optional in the schema.
func TestLedgerImportEntryLimitAndOptionalMetadata(t *testing.T) {
	artifact := compileImporter(t)
	var content strings.Builder
	for i := 0; i < 5; i++ {
		content.WriteString(ledgerLine(t, map[string]any{"entry_id": fmt.Sprintf("e%d", i), "task_id": fmt.Sprintf("T%d", i)}))
		content.WriteString("\n")
	}
	dir := t.TempDir()
	if code, stdout, stderr := runImporter(t, artifact, dir, "", writeLedger(t, dir, content.String()), "5"); code != 0 || stdout != "entries=5\nmissions=5\n" {
		t.Fatalf("exact limit: exit %d %q %q", code, stdout, stderr)
	}
	for _, metadata := range []any{nil, "not an object"} {
		dir := t.TempDir()
		line := ledgerLine(t, map[string]any{"entry_id": "a", "task_id": "T", "metadata": metadata})
		code, stdout, stderr := runImporter(t, artifact, dir, "", writeLedger(t, dir, line), "5")
		if code != 0 || stdout != "entries=1\nmissions=1\n" {
			t.Fatalf("metadata %v: exit %d %q %q", metadata, code, stdout, stderr)
		}
		var timeline map[string]map[string][]map[string]any
		if err := json.Unmarshal(storeBytes(t, dir)["howlboard_timeline.json"], &timeline); err != nil {
			t.Fatal(err)
		}
		if got := timeline["feed"]["events"][0]["recording_mode"]; got != "" {
			t.Errorf("metadata %v: recording_mode %v, want empty", metadata, got)
		}
	}
}

// Without its grants the importer fails and writes nothing.
func TestLedgerImportDeniedCapabilities(t *testing.T) {
	root := repoRoot(t)
	artifact := compileImporter(t)
	fixture := filepath.Join(root, "data/fixtures/ledger_sample.jsonl")
	for _, caps := range []string{"database", "filesystem"} {
		dir := t.TempDir()
		code, stdout, stderr := runImporter(t, artifact, dir, caps, fixture, "2000")
		if code == 0 || stdout != "" {
			t.Fatalf("caps %s: exit %d stdout %q stderr %q", caps, code, stdout, stderr)
		}
		if caps == "database" && !strings.Contains(stderr, "Failed to read ledger file") {
			t.Errorf("caps %s: %s", caps, stderr)
		}
		if caps == "filesystem" && !strings.Contains(stderr, "CAPABILITY_DENIED") {
			t.Errorf("caps %s: %s", caps, stderr)
		}
		if got := storeBytes(t, dir); len(got) != 0 {
			t.Errorf("caps %s: wrote %d stores", caps, len(got))
		}
	}
}

// The real consumer: `make import` output served by the compiled server.
func TestLedgerImportServedByBoard(t *testing.T) {
	root := repoRoot(t)
	artifact := compileImporter(t)
	for _, name := range importStores {
		if err := os.Remove(filepath.Join(root, name)); err != nil && !os.IsNotExist(err) {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = os.Remove(filepath.Join(root, name)) })
	}
	fixture := filepath.Join(root, "data/fixtures/ledger_sample.jsonl")
	if code, stdout, stderr := runImporter(t, artifact, root, "", fixture, "2000"); code != 0 {
		t.Fatalf("import: %d %q %q", code, stdout, stderr)
	}
	launchServer(t, "network,database,filesystem,environment", true, true)

	status, body := get(t, "/api/missions")
	if status != http.StatusOK {
		t.Fatalf("missions = %d", status)
	}
	missions := listOf(t, body, "missions")
	if len(missions) != 16 {
		t.Fatalf("served %d missions, want 16", len(missions))
	}
	for _, item := range missions {
		if m := item.(map[string]any); m["provenance"] != "LEDGER" {
			t.Errorf("mission %v provenance %v", m["id"], m["provenance"])
		}
	}
	status, body = get(t, "/api/timeline")
	if status != http.StatusOK || len(listOf(t, body, "events")) != 72 {
		t.Fatalf("timeline = %d with %d events, want 72", status, len(listOf(t, body, "events")))
	}
	counts := map[string]int{}
	raw, err := os.ReadFile(fixture)
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
		var entry map[string]any
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			t.Fatal(err)
		}
		counts[entry["task_id"].(string)]++
	}
	for id, want := range counts {
		detail := mission(t, id)
		if got := len(listOf(t, detail, "timeline")); got != want {
			t.Errorf("mission %s timeline has %d events, want %d", id, got, want)
		}
	}
}

// evidence_ledger.howl is vendored from HowlFrame; VENDORED.md records its hash.
func TestVendoredLedgerModuleUnchanged(t *testing.T) {
	root := repoRoot(t)
	raw, err := os.ReadFile(filepath.Join(root, "tools/ledger_import/evidence_ledger.howl"))
	if err != nil {
		t.Fatal(err)
	}
	record, err := os.ReadFile(filepath.Join(root, "tools/ledger_import/VENDORED.md"))
	if err != nil {
		t.Fatal(err)
	}
	match := regexp.MustCompile("SHA-256 \\| `([0-9a-f]{64})`").FindSubmatch(record)
	if match == nil {
		t.Fatal("VENDORED.md records no SHA-256")
	}
	sum := sha256.Sum256(raw)
	if got := hex.EncodeToString(sum[:]); got != string(match[1]) {
		t.Fatalf("evidence_ledger.howl SHA-256 %s, VENDORED.md records %s; re-vendor from upstream instead of editing", got, match[1])
	}
}
