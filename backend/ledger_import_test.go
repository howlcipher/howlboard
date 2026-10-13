package backend_test

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

type ledgerTruthEntry struct {
	Schema              string         `json:"schema"`
	TaskID              string         `json:"task_id"`
	AgentID             string         `json:"agent_id"`
	Action              string         `json:"action"`
	Result              string         `json:"result"`
	Timestamp           string         `json:"timestamp,omitempty"`
	Artifact            string         `json:"artifact,omitempty"`
	VerificationSummary any            `json:"verification_summary"`
	Metadata            map[string]any `json:"metadata"`
}

func TestLedgerImportTruth(t *testing.T) {
	root := repoRoot(t)
	bin := resolveHowlFrameBin(root)
	dir := t.TempDir()
	artifact := filepath.Join(dir, "import.hfbc")
	cmd := exec.Command(bin, "-compile-bc", filepath.Join(root, "tools/ledger_import/ledger_import.howl"), "-o", artifact)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("compile importer: %v: %s", err, out)
	}
	stamp := "2026-10-12T15:21:01.772056+00:00"
	manual := "manual coordinator projection after executing/reviewing recorded evidence; not automatic telemetry"
	entries := []ledgerTruthEntry{
		{TaskID: "repair", Action: "verification_completed", Result: "passed", Timestamp: stamp, VerificationSummary: map[string]any{"scope": "actual check"}},
		{TaskID: "repair", Action: "verification_completed", Result: "claimed", VerificationSummary: map[string]any{"scope": "agent claim", "exit_code": 0}},
		{TaskID: "repair", Action: "verification_completed", Result: "failed", VerificationSummary: map[string]any{"scope": "failed check", "exit_code": 7}},
		{TaskID: "repair", Action: "task_completed", Result: "accepted"},
		{TaskID: "active", Action: "implementation_started", Result: "running", Timestamp: stamp},
		{TaskID: "release", Action: "human_boundary_triggered", Result: "owner_action_required"},
		{TaskID: "no-summary", Action: "verification_completed", Result: "passed"},
		{TaskID: "non-verification", Action: "task_completed", Result: "accepted", VerificationSummary: map[string]any{"scope": "summary of execution"}},
		{TaskID: "empty-summary", Action: "verification_completed", Result: "passed", VerificationSummary: map[string]any{}},
	}
	var content []byte
	for index := range entries {
		entries[index].Schema = "ai.evidence_entry/v1"
		entries[index].AgentID = "test_coordinator"
		entries[index].Artifact = "local-proof.log"
		entries[index].Metadata = map[string]any{"recording_mode": manual}
		line, err := json.Marshal(entries[index])
		if err != nil {
			t.Fatal(err)
		}
		if entries[index].TaskID == "no-summary" {
			var item map[string]any
			if err := json.Unmarshal(line, &item); err != nil {
				t.Fatal(err)
			}
			delete(item, "verification_summary")
			line, err = json.Marshal(item)
			if err != nil {
				t.Fatal(err)
			}
		}
		content = append(content, line...)
		content = append(content, '\n')
	}
	ledger := filepath.Join(dir, "ledger.jsonl")
	if err := os.WriteFile(ledger, content, 0600); err != nil {
		t.Fatal(err)
	}
	cmd = exec.Command(bin, "-run-bc", "-allow-caps", "filesystem,database", artifact, ledger, "20")
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("run native importer: %v: %s", err, out)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "howlboard_missions.json"))
	if err != nil {
		t.Fatal(err)
	}
	var store map[string]map[string]any
	if err := json.Unmarshal(raw, &store); err != nil {
		t.Fatal(err)
	}
	checks := store["mission:repair"]["verification"].([]any)
	if len(checks) != 3 {
		t.Errorf("repair has %d checks, want only 3 genuine verification events: %v", len(checks), checks)
	}
	if len(checks) >= 3 {
		for index, status := range []string{"passed", "claimed", "failed"} {
			check := checks[index].(map[string]any)
			if check["status"] != status {
				t.Errorf("status%d=%v, want%s", index, check["status"], status)
			}
			if _, ok := check["summary"].(map[string]any); !ok {
				t.Errorf("original summary not retained: %v", check)
			}
		}
		if _, exists := checks[0].(map[string]any)["exit_code"]; exists {
			t.Error("missing exit code fabricated")
		}
		if checks[1].(map[string]any)["exit_code"] != float64(0) || checks[2].(map[string]any)["exit_code"] != float64(7) {
			t.Error("explicit exit codes not preserved")
		}
	}
	for _, id := range []string{"active", "release", "no-summary", "non-verification"} {
		if got := store["mission:"+id]["verification"].([]any); len(got) != 0 {
			t.Errorf("%s null summary produced fabricated verification: %v", id, got)
		}
	}
	active := store["mission:active"]
	if active["recording_mode"] != manual || active["ledger_recorded_at"] != stamp {
		t.Errorf("ledger provenance/time not retained: %v", active)
	}
	execution := active["execution"].(map[string]any)
	if execution["start_recorded"] != true {
		t.Error("observed implementation start lost")
	}
	if _, exists := execution["started_at"]; exists {
		t.Error("execution start time invented from record timestamp")
	}
	if store["mission:release"]["state"] != "AWAITING_APPROVAL" || active["state"] != "EXECUTING" {
		t.Error("mission states drifted")
	}
	if active["authority"].(map[string]any)["decision"] != "REQUIRE_APPROVAL" {
		t.Error("approval invented")
	}
	jsDir := filepath.Join(dir, "js")
	if err := os.Mkdir(jsDir, 0700); err != nil {
		t.Fatal(err)
	}
	cmd = exec.Command(bin, "build", filepath.Join(root, "frontend/render_harness.howl"), "--target=js", "-o", jsDir)
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("compile truth renderer: %v: %s", err, output)
	}
	script := `
const fs = require("fs");
global.window = global;
eval(fs.readFileSync(process.argv[1], "utf8"));
const store = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
(async () => {
 const result = {};
 for (const id of ["repair", "active", "release", "no-summary"]) {
   result[id] = await render_detail_html(store["mission:" + id]);
 }
 console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exit(1); });`
	cmd = exec.Command("node", "-e", script, filepath.Join(jsDir, "app.js"), filepath.Join(dir, "howlboard_missions.json"))
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("render imported records: %v: %s", err, output)
	}
	var rendered map[string]string
	if err := json.Unmarshal(output, &rendered); err != nil {
		t.Fatalf("parse rendered records: %v: %s", err, output)
	}
	if !strings.Contains(rendered["active"], "Start event recorded; start time not recorded.") || strings.Contains(rendered["active"], "Never started") {
		t.Error("observed start rendered as never started")
	}
	if !strings.Contains(rendered["active"], "No verification details recorded.") || strings.Contains(rendered["active"], "(exit 0)") {
		t.Error("active execution rendered as verification")
	}
	if !strings.Contains(rendered["no-summary"], "No verification details recorded.") || strings.Contains(rendered["no-summary"], "No verification has run") {
		t.Error("missing summary rendered as absent verification execution")
	}
	if !strings.Contains(rendered["repair"], "(exit not recorded)") || !strings.Contains(rendered["repair"], "(exit 7)") {
		t.Error("renderer invents or loses exit codes")
	}
	if !strings.Contains(rendered["release"], "not recorded") || strings.Contains(rendered["release"], "d ago") {
		t.Error("absent timestamps rendered as epoch ages")
	}
	if !strings.Contains(rendered["active"], manual) || !strings.Contains(rendered["active"], stamp) {
		t.Error("recording provenance/time not visible")
	}

}
