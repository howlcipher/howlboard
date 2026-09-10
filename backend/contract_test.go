// Black-box contract tests for the HowlBoard mission API.
//
// These drive the real compiled bytecode server as a subprocess under the
// HowlFrame VM, so they exercise the same artifact that `make run` serves
// rather than a Go reimplementation of it.
package backend_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

// The port is a compile-time literal in server.howl; http_server takes no
// runtime port. Tests honour an override so a busy environment can relocate
// both the server and the client, but the .howl source must agree.
func baseURL() string {
	if override := os.Getenv("HOWLBOARD_URL"); override != "" {
		return override
	}
	return "http://localhost:8080"
}

// requireFreePort fails the test if the server port is already in use.
func requireFreePort(t *testing.T) {
	t.Helper()
	address := strings.TrimPrefix(baseURL(), "http://")
	listener, err := net.Listen("tcp", address)
	if err != nil {
		t.Fatalf("port %s is already in use; stop the other server first (%v)", address, err)
	}
	if err := listener.Close(); err != nil {
		t.Fatalf("release probe listener on %s: %v", address, err)
	}
}

func repoRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatalf("resolve repository root: %v", err)
	}
	return root
}

// startServer launches the compiled bytecode server with an explicit capability
// grant and waits for readiness by polling, rather than sleeping a fixed
// interval and hoping.
func startServer(t *testing.T, caps string, wantReady bool) {
	t.Helper()
	root := repoRoot(t)

	for _, name := range []string{"howlboard_missions.json", "howlboard_timeline.json"} {
		if err := os.Remove(filepath.Join(root, name)); err != nil && !os.IsNotExist(err) {
			t.Fatalf("clear store %s: %v", name, err)
		}
	}

	// Refuse to run against somebody else's server. Without this the readiness
	// poll below can be satisfied by a process already holding the port while
	// our own child is still dying on bind, and the suite silently tests the
	// wrong server with the wrong data.
	requireFreePort(t)

	cmd := exec.Command(filepath.Join(root, "howlframe_bin"),
		"-run-bc", "-allow-caps", caps, "backend/server.hfbc")
	cmd.Dir = root
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	output := &bytes.Buffer{}
	cmd.Stdout = output
	cmd.Stderr = output
	if err := cmd.Start(); err != nil {
		t.Fatalf("start bytecode server: %v", err)
	}
	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()

	// Wait for the process to actually die, not just for the signal to be sent.
	// Otherwise the next test's port pre-check races the kernel releasing the
	// port this server still holds.
	t.Cleanup(func() {
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		select {
		case <-exited:
		case <-time.After(5 * time.Second):
			t.Errorf("bytecode server did not exit after SIGKILL")
		}
	})

	// Watch for early exit as well as readiness, so a server that dies during
	// startup reports that rather than timing out.
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case err := <-exited:
			t.Fatalf("bytecode server exited before becoming ready (%v); output:\n%s", err, output.String())
		default:
		}
		resp, err := http.Get(baseURL() + "/api/missions")
		if err == nil {
			resp.Body.Close()
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	if wantReady {
		t.Fatalf("server did not become ready; output:\n%s", output.String())
	}
}

func request(t *testing.T, method, path, payload string) (int, http.Header, []byte) {
	t.Helper()
	var body io.Reader
	if payload != "" {
		body = bytes.NewBufferString(payload)
	}
	req, err := http.NewRequest(method, baseURL()+path, body)
	if err != nil {
		t.Fatalf("build %s %s: %v", method, path, err)
	}
	if payload != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("send %s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read %s %s response: %v", method, path, err)
	}
	return resp.StatusCode, resp.Header, responseBody
}

func post(t *testing.T, path, payload string) (int, map[string]any) {
	t.Helper()
	status, _, body := request(t, http.MethodPost, path, payload)
	return status, decodeObject(t, body)
}

func get(t *testing.T, path string) (int, map[string]any) {
	t.Helper()
	status, _, body := request(t, http.MethodGet, path, "")
	return status, decodeObject(t, body)
}

func decodeObject(t *testing.T, body []byte) map[string]any {
	t.Helper()
	var value map[string]any
	if err := json.Unmarshal(body, &value); err != nil {
		t.Fatalf("decode JSON %q: %v", body, err)
	}
	return value
}

func listOf(t *testing.T, value map[string]any, key string) []any {
	t.Helper()
	raw, exists := value[key]
	if !exists {
		t.Fatalf("response missing %q: %v", key, value)
	}
	if raw == nil {
		return nil
	}
	items, ok := raw.([]any)
	if !ok {
		t.Fatalf("%q is %T, want array", key, raw)
	}
	return items
}

func mission(t *testing.T, id string) map[string]any {
	t.Helper()
	status, body := post(t, "/api/missions/get", fmt.Sprintf(`{"id":%q}`, id))
	if status != http.StatusOK {
		t.Fatalf("get %s = %d: %v", id, status, body)
	}
	return body
}

func seed(t *testing.T) {
	t.Helper()
	status, body := post(t, "/api/seed", "")
	if status != http.StatusOK {
		t.Fatalf("seed = %d: %v", status, body)
	}
	if got := body["missions"]; got != float64(5) {
		t.Fatalf("seeded %v missions, want 5", got)
	}
}

func TestMissionAPIContract(t *testing.T) {
	startServer(t, "network,database,filesystem", true)

	t.Run("empty before seeding", func(t *testing.T) {
		status, body := get(t, "/api/missions")
		if status != http.StatusOK {
			t.Fatalf("list = %d", status)
		}
		if items := listOf(t, body, "missions"); len(items) != 0 {
			t.Fatalf("expected no missions before seeding, got %d", len(items))
		}
	})

	t.Run("CORS headers are present", func(t *testing.T) {
		_, header, _ := request(t, http.MethodGet, "/api/missions", "")
		if got := header.Get("Access-Control-Allow-Origin"); got != "*" {
			t.Fatalf("Access-Control-Allow-Origin = %q, want *", got)
		}
	})

	seed(t)

	// Authority is derived on every read from the approval's expiry, never
	// replayed from storage. All five ecosystem envelope states must be
	// distinguishable in the seeded set.
	t.Run("authority is computed per mission", func(t *testing.T) {
		want := map[string]string{
			"HF-412":    "DELEGATED_AUTHORITY_ALLOW",
			"HP-207":    "DELEGATED_AUTHORITY_ALLOW",
			"CO-118":    "ENVELOPE_ABSENT",
			"HB-051":    "DENIED_BY_ENVELOPE",
			"INFRA-233": "ENVELOPE_EXPIRED",
		}
		_, body := get(t, "/api/missions")
		seen := map[string]string{}
		for _, raw := range listOf(t, body, "missions") {
			m := raw.(map[string]any)
			seen[m["id"].(string)] = m["envelope_status"].(string)
		}
		for id, status := range want {
			if seen[id] != status {
				t.Errorf("%s envelope_status = %q, want %q", id, seen[id], status)
			}
		}
	})

	// A lapsed approval must present as expired even though the stored record
	// still carries the approval that was valid when it was written.
	t.Run("lapsed approval reports ENVELOPE_EXPIRED", func(t *testing.T) {
		m := mission(t, "INFRA-233")
		if got := m["envelope_status"]; got != "ENVELOPE_EXPIRED" {
			t.Fatalf("envelope_status = %v, want ENVELOPE_EXPIRED", got)
		}
		approval := m["authority"].(map[string]any)["approval"].(map[string]any)
		expires, ok := approval["expires_at"].(float64)
		if !ok {
			t.Fatalf("approval has no numeric expires_at: %v", approval)
		}
		if int64(expires) >= time.Now().Unix() {
			t.Fatalf("expires_at %d is not in the past", int64(expires))
		}
	})

	// The ledger distinguishes a verified result from one the agent merely
	// asserted. Collapsing "claimed" into "passed" would make the board lie.
	t.Run("claimed verification stays distinct from passed", func(t *testing.T) {
		m := mission(t, "INFRA-233")
		statuses := map[string]string{}
		for _, raw := range m["verification"].([]any) {
			v := raw.(map[string]any)
			statuses[v["name"].(string)] = v["status"].(string)
		}
		if got := statuses["Artifact signature audit"]; got != "claimed" {
			t.Fatalf("claimed verification reported as %q", got)
		}
		if got := statuses["Signing key age policy check"]; got != "failed" {
			t.Fatalf("failed verification reported as %q", got)
		}
	})

	t.Run("evidence keeps provenance", func(t *testing.T) {
		m := mission(t, "HF-412")
		evidence := m["evidence"].([]any)
		if len(evidence) == 0 {
			t.Fatal("mission has no evidence")
		}
		for _, raw := range evidence {
			e := raw.(map[string]any)
			for _, field := range []string{"type", "ref", "source", "fingerprint", "collected_at"} {
				if e[field] == nil || e[field] == "" {
					t.Errorf("evidence %v missing %s", e["ref"], field)
				}
			}
		}
	})

	t.Run("execution delta records unexpected changes", func(t *testing.T) {
		m := mission(t, "HP-207")
		delta := m["execution"].(map[string]any)["delta"].(map[string]any)
		for _, field := range []string{"files_added", "files_modified", "files_deleted", "unexpected"} {
			if _, ok := delta[field].([]any); !ok {
				t.Errorf("delta.%s is %T, want array", field, delta[field])
			}
		}
	})

	// Authority gates execution: a mission without live delegated authority
	// must not be able to enter EXECUTING, whatever the state machine allows.
	t.Run("authority gates execution", func(t *testing.T) {
		status, body := post(t, "/api/missions/state", `{"id":"INFRA-233","state":"EXECUTING"}`)
		if status != http.StatusForbidden {
			t.Fatalf("expired-authority execute = %d, want 403 (%v)", status, body)
		}
		if body["error"] != "AUTHORITY_DENIED" || body["envelope_status"] != "ENVELOPE_EXPIRED" {
			t.Fatalf("expired-authority execute body = %v", body)
		}

		status, body = post(t, "/api/missions/state", `{"id":"CO-118","state":"EXECUTING"}`)
		if status != http.StatusForbidden || body["envelope_status"] != "ENVELOPE_ABSENT" {
			t.Fatalf("absent-authority execute = %d %v, want 403 ENVELOPE_ABSENT", status, body)
		}
	})

	t.Run("approval unblocks execution and is audited", func(t *testing.T) {
		status, body := post(t, "/api/missions/approve",
			`{"id":"CO-118","approver":"human_operator","ttl_seconds":3600}`)
		if status != http.StatusOK {
			t.Fatalf("approve = %d: %v", status, body)
		}
		if body["envelope_status"] != "DELEGATED_AUTHORITY_ALLOW" {
			t.Fatalf("post-approval envelope_status = %v", body["envelope_status"])
		}

		status, body = post(t, "/api/missions/state", `{"id":"CO-118","state":"EXECUTING"}`)
		if status != http.StatusOK || body["state"] != "EXECUTING" {
			t.Fatalf("approved execute = %d %v", status, body)
		}

		m := mission(t, "CO-118")
		actions := map[string]bool{}
		for _, raw := range m["timeline"].([]any) {
			actions[raw.(map[string]any)["action"].(string)] = true
		}
		for _, want := range []string{"task_created", "human_decision_requested", "human_approval", "state:EXECUTING"} {
			if !actions[want] {
				t.Errorf("timeline missing %q: %v", want, actions)
			}
		}
	})

	t.Run("rejection denies the envelope", func(t *testing.T) {
		status, body := post(t, "/api/missions/reject",
			`{"id":"HP-207","approver":"human_operator","reason":"superseded"}`)
		if status != http.StatusOK {
			t.Fatalf("reject = %d: %v", status, body)
		}
		if body["envelope_status"] != "DENIED_BY_ENVELOPE" {
			t.Fatalf("post-rejection envelope_status = %v", body["envelope_status"])
		}
	})

	// Every transition outside the whitelist must be refused, not just one.
	t.Run("invalid transitions are refused", func(t *testing.T) {
		for _, invalid := range []struct{ from, to string }{
			{"COMPLETED", "EXECUTING"},
			{"COMPLETED", "ROUTED"},
			{"CLOSED", "EXECUTING"},
			{"CLOSED", "VERIFYING"},
		} {
			id := "HF-412"
			if invalid.from == "CLOSED" {
				id = "HB-051"
			}
			status, body := post(t, "/api/missions/state",
				fmt.Sprintf(`{"id":%q,"state":%q}`, id, invalid.to))
			if status != http.StatusBadRequest || body["error"] != "INVALID_TRANSITION" {
				t.Errorf("%s -> %s = %d %v, want 400 INVALID_TRANSITION", invalid.from, invalid.to, status, body)
			}
		}
	})

	t.Run("create validates input", func(t *testing.T) {
		cases := []struct{ payload, wantErr string }{
			{`{"project":"HowlFrame"}`, "MISSING_FIELD"},
			{`{"title":"No project"}`, "MISSING_FIELD"},
			{`{"title":"Bad","project":"HowlFrame","priority":"URGENT"}`, "INVALID_PRIORITY"},
			{`{not json`, "INVALID_JSON"},
		}
		for _, testCase := range cases {
			status, body := post(t, "/api/missions/create", testCase.payload)
			if status != http.StatusBadRequest || body["error"] != testCase.wantErr {
				t.Errorf("create %s = %d %v, want 400 %s", testCase.payload, status, body, testCase.wantErr)
			}
		}
	})

	// store_keys enumerates the store directly, so a delete must disappear from
	// listings with no separate index record to keep in step.
	t.Run("create and delete round-trip through store enumeration", func(t *testing.T) {
		status, created := post(t, "/api/missions/create",
			`{"title":"Probe mission","project":"HowlBoard","priority":"LOW"}`)
		if status != http.StatusCreated {
			t.Fatalf("create = %d: %v", status, created)
		}
		id := created["id"].(string)

		_, body := get(t, "/api/missions")
		if len(listOf(t, body, "missions")) != 6 {
			t.Fatalf("expected 6 missions after create, got %d", len(listOf(t, body, "missions")))
		}

		status, _ = post(t, "/api/missions/delete", fmt.Sprintf(`{"id":%q}`, id))
		if status != http.StatusOK {
			t.Fatalf("delete = %d", status)
		}

		_, body = get(t, "/api/missions")
		for _, raw := range listOf(t, body, "missions") {
			if raw.(map[string]any)["id"] == id {
				t.Fatalf("deleted mission %s still enumerated", id)
			}
		}
		if len(listOf(t, body, "missions")) != 5 {
			t.Fatalf("expected 5 missions after delete, got %d", len(listOf(t, body, "missions")))
		}

		status, notFound := post(t, "/api/missions/get", fmt.Sprintf(`{"id":%q}`, id))
		if status != http.StatusNotFound || notFound["error"] != "MISSION_NOT_FOUND" {
			t.Fatalf("get deleted mission = %d %v", status, notFound)
		}
	})

	t.Run("dashboard aggregates verification failures and expiry", func(t *testing.T) {
		_, body := get(t, "/api/dashboard")
		if body["total"] != float64(5) {
			t.Fatalf("dashboard total = %v, want 5", body["total"])
		}
		if body["verification_failures"].(float64) < 2 {
			t.Fatalf("verification_failures = %v, want at least 2", body["verification_failures"])
		}
		if body["expired_authority"].(float64) < 1 {
			t.Fatalf("expired_authority = %v, want at least 1", body["expired_authority"])
		}
		if _, ok := body["counts"].(map[string]any); !ok {
			t.Fatalf("counts is %T, want object", body["counts"])
		}
	})

	// Returned as a list of records rather than a keyed object: the language
	// has no map_keys primitive, so a client cannot enumerate a dict's keys.
	t.Run("projects are derived, not hard-coded", func(t *testing.T) {
		_, body := get(t, "/api/projects")
		counts := map[string]float64{}
		for _, raw := range listOf(t, body, "projects") {
			row := raw.(map[string]any)
			counts[row["name"].(string)] = row["count"].(float64)
		}
		for _, want := range []string{"HowlFrame", "HowlPlane", "HowlChangeOps", "HowlBoard"} {
			if _, ok := counts[want]; !ok {
				t.Errorf("projects missing %q: %v", want, counts)
			}
		}
		if counts["HowlPlane"] != 2 {
			t.Errorf("HowlPlane count = %v, want 2", counts["HowlPlane"])
		}
	})

	t.Run("timeline is chronological and attributed", func(t *testing.T) {
		_, body := get(t, "/api/timeline")
		events := listOf(t, body, "events")
		if len(events) < 35 {
			t.Fatalf("timeline has %d events, want at least 35", len(events))
		}
		previous := 0.0
		for _, raw := range events {
			e := raw.(map[string]any)
			if e["actor"] == nil || e["actor"] == "" {
				t.Errorf("event %v has no actor", e["action"])
			}
			at := e["timestamp"].(float64)
			if at < previous {
				t.Errorf("timeline out of order at %v", e["action"])
			}
			previous = at
		}
	})
}

// A denied capability must reach the client as a failure. Before the VM was
// made to fail closed this returned 200 with an empty body, so a blocked store
// access was indistinguishable from a completed request.
func TestDeniedCapabilityFailsClosed(t *testing.T) {
	startServer(t, "network", true)

	status, _, body := request(t, http.MethodGet, "/api/missions", "")
	if status != http.StatusInternalServerError {
		t.Fatalf("database-denied request = %d %q, want 500", status, body)
	}
	failure := decodeObject(t, body)
	if failure["code"] != "CAPABILITY_DENIED" {
		t.Fatalf("failure code = %v, want CAPABILITY_DENIED (%s)", failure["code"], body)
	}
}
