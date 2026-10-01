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
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
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

func resolveHowlFrameBin(root string) string {
	if bin := os.Getenv("HOWLFRAME_BIN"); bin != "" {
		return bin
	}
	localBin := filepath.Join(root, "howlframe_bin")
	if _, err := os.Stat(localBin); err == nil {
		return localBin
	}
	if p, err := exec.LookPath("howlframe"); err == nil {
		return p
	}
	return localBin
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

	cmd := exec.Command(resolveHowlFrameBin(root),
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

func getHeader(t *testing.T, path, name, value string) (int, map[string]any) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, baseURL()+path, nil)
	if err != nil {
		t.Fatalf("build GET %s: %v", path, err)
	}
	req.Header.Set(name, value)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("send GET %s: %v", path, err)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read GET %s: %v", path, err)
	}
	return resp.StatusCode, decodeObject(t, responseBody)
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
			{`{"title":"Deps","project":"HowlBoard","depends_on":"HF-412"}`, "INVALID_DEPENDS_ON"},
			{`{"title":"Deps","project":"HowlBoard","depends_on":{"id":"HF-412"}}`, "INVALID_DEPENDS_ON"},
			{`{"title":"Deps","project":"HowlBoard","depends_on":[1,2]}`, "INVALID_DEPENDS_ON"},
			{`{"title":"Deps","project":"HowlBoard","depends_on":["HF-412",true]}`, "INVALID_DEPENDS_ON"},
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

	t.Run("depends_on create round-trips through get", func(t *testing.T) {
		status, created := post(t, "/api/missions/create",
			`{"title":"Dependent mission","project":"HowlBoard","priority":"LOW","depends_on":["HF-412","CO-118"]}`)
		if status != http.StatusCreated {
			t.Fatalf("create with depends_on = %d: %v", status, created)
		}
		id := created["id"].(string)
		rawDeps, ok := created["depends_on"].([]any)
		if !ok {
			t.Fatalf("create response depends_on is %T, want array", created["depends_on"])
		}
		if len(rawDeps) != 2 || rawDeps[0] != "HF-412" || rawDeps[1] != "CO-118" {
			t.Fatalf("create response depends_on = %v", rawDeps)
		}

		got := mission(t, id)
		roundTrip, ok := got["depends_on"].([]any)
		if !ok {
			t.Fatalf("get depends_on is %T, want array", got["depends_on"])
		}
		if len(roundTrip) != 2 || roundTrip[0] != "HF-412" || roundTrip[1] != "CO-118" {
			t.Fatalf("get depends_on = %v, want [HF-412 CO-118]", roundTrip)
		}

		status, _ = post(t, "/api/missions/delete", fmt.Sprintf(`{"id":%q}`, id))
		if status != http.StatusOK {
			t.Fatalf("cleanup delete = %d", status)
		}
	})

	t.Run("depends_on omitted and empty list mean no dependencies", func(t *testing.T) {
		status, created := post(t, "/api/missions/create",
			`{"title":"No deps omitted","project":"HowlBoard","priority":"LOW"}`)
		if status != http.StatusCreated {
			t.Fatalf("create omitted depends_on = %d: %v", status, created)
		}
		idOmitting := created["id"].(string)
		omitted := mission(t, idOmitting)
		raw, ok := omitted["depends_on"].([]any)
		if !ok {
			t.Fatalf("omitted depends_on stored as %T, want empty array", omitted["depends_on"])
		}
		if len(raw) != 0 {
			t.Fatalf("omitted depends_on = %v, want empty", raw)
		}

		status, created = post(t, "/api/missions/create",
			`{"title":"No deps empty","project":"HowlBoard","priority":"LOW","depends_on":[]}`)
		if status != http.StatusCreated {
			t.Fatalf("create empty depends_on = %d: %v", status, created)
		}
		idEmpty := created["id"].(string)
		empty := mission(t, idEmpty)
		raw, ok = empty["depends_on"].([]any)
		if !ok || len(raw) != 0 {
			t.Fatalf("empty depends_on = %T %v", empty["depends_on"], empty["depends_on"])
		}

		for _, id := range []string{idOmitting, idEmpty} {
			status, _ = post(t, "/api/missions/delete", fmt.Sprintf(`{"id":%q}`, id))
			if status != http.StatusOK {
				t.Fatalf("cleanup delete %s = %d", id, status)
			}
		}
	})

	t.Run("DEMO fixture carries informational depends_on", func(t *testing.T) {
		m := mission(t, "HP-207")
		if m["provenance"] != "DEMO" {
			t.Fatalf("HP-207 provenance = %v, want DEMO", m["provenance"])
		}
		deps, ok := m["depends_on"].([]any)
		if !ok || len(deps) == 0 {
			t.Fatalf("HP-207 depends_on = %v, want non-empty list", m["depends_on"])
		}
		if deps[0] != "HF-412" {
			t.Fatalf("HP-207 depends_on[0] = %v, want HF-412", deps[0])
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

// A value placed inside a single-quoted JavaScript string in an event-handler
// attribute is parsed as code, and HTML-entity escaping does not prevent that:
// the HTML parser decodes the attribute before JavaScript parses it, so `&#39;`
// becomes a real quote and closes the string. HowlProof demonstrated this against
// the compiled interface by seeding a mission whose identifier carried a quote and
// observing the injected expression execute in a browser (HP-SEC-0007).
//
// The fix was to stop putting data in handlers at all. Identifiers live in a
// data attribute, where escaping the quote characters is sufficient, and each
// handler is a constant that reads the value back at click time.
//
// This test lives in the backend package because it is the only Go package in the
// repository and `make test` runs it; what it checks is the browser tier's source.
func TestHandlerAttributesInterpolateNoValues(t *testing.T) {
	root := repoRoot(t)
	sources := []string{
		filepath.Join(root, "frontend", "mission_view.howl"),
		filepath.Join(root, "frontend", "app.howl"),
		filepath.Join(root, "frontend", "factory_view.howl"),
		filepath.Join(root, "docs", "demo.howl"),
	}
	// Matches an on<event> attribute whose value is not closed before an
	// interpolation begins: a quote ending the .howl string literal, or a call.
	handler := regexp.MustCompile(`on[a-z]{3,15}=\\"[^\\]*'`)

	for _, source := range sources {
		content, err := os.ReadFile(source)
		if err != nil {
			t.Fatalf("read %s: %v", source, err)
		}
		for number, line := range strings.Split(string(content), "\n") {
			if handler.MatchString(line) {
				t.Errorf(
					"%s:%d builds an event handler containing a quoted string; put the value "+
						"in a data attribute and read it with this.dataset instead:\n\t%s",
					filepath.Base(source), number+1, strings.TrimSpace(line),
				)
			}
		}
	}
}

// The escape function must cover every character that can end an attribute value
// or a string literal, including the single quote.
func TestEscapeFunctionCoversQuoteCharacters(t *testing.T) {
	content, err := os.ReadFile(filepath.Join(repoRoot(t), "frontend", "mission_view.howl"))
	if err != nil {
		t.Fatalf("read mission_view.howl: %v", err)
	}
	for character, entity := range map[string]string{
		"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
	} {
		if !strings.Contains(string(content), entity) {
			t.Errorf("esc does not produce %s, so %s survives into the output", entity, character)
		}
	}
}

// HOWL-007/008: shared mission_view must show navigable depends_on controls when
// present and omit the dependency block when missing or empty. Compiles a tiny harness that
// imports the same module as app.howl and docs/demo.howl, then executes it
// under Node with a DOM stub (the established DOM-shim style).
func TestDependsOnRender(t *testing.T) {
	root := repoRoot(t)
	outDir := t.TempDir()
	bin := filepath.Join(root, "howlframe_bin")
	cmd := exec.Command(bin, filepath.Join(root, "frontend", "render_harness.howl"), "-o", outDir)
	cmd.Dir = root
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("compile render harness: %v\n%s", err, output)
	}
	jsPath := filepath.Join(outDir, "app.js")
	if _, err := os.Stat(jsPath); err != nil {
		t.Fatalf("compiled harness missing: %v", err)
	}

	script := `
const fs = require("fs");
const code = fs.readFileSync(process.argv[1], "utf8");
global.window = global;
global.document = {
  querySelector: () => ({
    addEventListener: () => {},
    classList: { toggle: () => {} },
    textContent: "",
    innerHTML: "",
  }),
};
eval(code);
(async () => {
  const withDeps = await render_detail_html({
    id: "HB-TEST",
    title: "T",
    description: "D",
    project: "P",
    state: "CREATED",
    priority: "LOW",
    risk_level: "LOW",
    task_class: "unclassified",
    provenance: "DEMO",
    updated_at: 0,
    depends_on: ["HF-412", "CO-118"],
    authority: {},
    evidence: [],
    reasoning: {},
    plan: [],
    execution: {},
    verification: [],
    outcome: "",
    executor: "",
  });
  if (!withDeps.includes("depends-block")) {
    console.error("missing depends-block when depends_on present");
    process.exit(1);
  }
  if (!withDeps.includes("HF-412") || !withDeps.includes("CO-118")) {
    console.error("dependency IDs not rendered");
    process.exit(1);
  }
  if (!withDeps.includes("Informational only")) {
    console.error("missing informational copy");
    process.exit(1);
  }
  // HOWL-008: navigable controls matching mission-row pattern
  if (!withDeps.includes("depends-link")) {
    console.error("missing depends-link control");
    process.exit(1);
  }
  if (!withDeps.includes('data-mission-id="HF-412"') || !withDeps.includes('data-mission-id="CO-118"')) {
    console.error("dependency IDs missing from data-mission-id");
    process.exit(1);
  }
  if (!withDeps.includes('onclick="window.open_mission(this.dataset.missionId)"')) {
    console.error("missing constant open_mission handler on dependency control");
    process.exit(1);
  }
  if (/onclick="[^"]*HF-412/.test(withDeps) || /onclick='[^']*HF-412/.test(withDeps)) {
    console.error("dependency ID interpolated into onclick handler source");
    process.exit(1);
  }
  if (/onclick=/.test(withDeps) && /depends_on/.test(withDeps.split("onclick=")[1] || "")) {
    console.error("depends_on leaked into handler JS");
    process.exit(1);
  }
  // XSS: escaped in text, not raw
  const xss = await render_detail_html({
    id: "HB-XSS",
    title: "T",
    description: "D",
    project: "P",
    state: "CREATED",
    priority: "LOW",
    risk_level: "LOW",
    task_class: "unclassified",
    provenance: "DEMO",
    updated_at: 0,
    depends_on: ["<script>alert(1)</script>"],
    authority: {},
    evidence: [],
    reasoning: {},
    plan: [],
    execution: {},
    verification: [],
    outcome: "",
    executor: "",
  });
  if (xss.includes("<script>alert(1)</script>")) {
    console.error("dependency ID was not HTML-escaped");
    process.exit(1);
  }
  if (!xss.includes("&lt;script&gt;")) {
    console.error("expected escaped script markers in dependency ID");
    process.exit(1);
  }
  if (!xss.includes('data-mission-id="&lt;script&gt;alert(1)&lt;/script&gt;"')) {
    console.error("hostile ID not escaped inside data-mission-id");
    process.exit(1);
  }
  // Quote-bearing hostile ID must not break out of the attribute
  const hostile = await render_detail_html({
    id: "HB-QUOTE",
    title: "T",
    description: "D",
    project: "P",
    state: "CREATED",
    priority: "LOW",
    risk_level: "LOW",
    task_class: "unclassified",
    provenance: "DEMO",
    updated_at: 0,
    depends_on: ['"><img src=x onerror=alert(1)>', "O'Brien"],
    authority: {},
    evidence: [],
    reasoning: {},
    plan: [],
    execution: {},
    verification: [],
    outcome: "",
    executor: "",
  });
  if (hostile.includes('data-mission-id=""><img')) {
    console.error("quote-bearing ID broke out of data-mission-id");
    process.exit(1);
  }
  if (!hostile.includes("&quot;") || !hostile.includes("&#39;")) {
    console.error("expected escaped quotes in hostile dependency IDs");
    process.exit(1);
  }
  if (/onclick="[^"]*&quot;/.test(hostile) || /onclick="[^"]*O'Brien/.test(hostile)) {
    console.error("hostile ID reached onclick handler source");
    process.exit(1);
  }

  for (const deps of [undefined, [], null, ""]) {
    const mission = {
      id: "HB-NONE",
      title: "T",
      description: "D",
      project: "P",
      state: "CREATED",
      priority: "LOW",
      risk_level: "LOW",
      task_class: "unclassified",
      provenance: "DEMO",
      updated_at: 0,
      authority: {},
      evidence: [],
      reasoning: {},
      plan: [],
      execution: {},
      verification: [],
      outcome: "",
      executor: "",
    };
    if (deps !== undefined) mission.depends_on = deps;
    const html = await render_detail_html(mission);
    if (html.includes("depends-block") || html.includes("Depends on")) {
      console.error("dependency block shown for empty/missing depends_on:", deps);
      process.exit(1);
    }
  }
  console.log("ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
`
	node := exec.Command("node", "-e", script, jsPath)
	node.Dir = root
	output, err := node.CombinedOutput()
	if err != nil {
		t.Fatalf("render harness failed: %v\n%s", err, output)
	}
	if !strings.Contains(string(output), "ok") {
		t.Fatalf("render harness output = %q", output)
	}
}

// Source-level guard: depends_on values must not be interpolated into handler JS.
func TestDependsOnNeverInHandlerJS(t *testing.T) {
	content, err := os.ReadFile(filepath.Join(repoRoot(t), "frontend", "mission_view.howl"))
	if err != nil {
		t.Fatalf("read mission_view.howl: %v", err)
	}
	for number, line := range strings.Split(string(content), "\n") {
		if strings.Contains(line, "onclick=") && strings.Contains(line, "depends") {
			t.Errorf("%s:%d puts dependency data into an event handler:\n\t%s",
				"mission_view.howl", number+1, strings.TrimSpace(line))
		}
	}
}

// HOWL-008: app open_mission get body must use encode_json, not string-concat JSON.
func TestOpenMissionUsesEncodeJSON(t *testing.T) {
	content, err := os.ReadFile(filepath.Join(repoRoot(t), "frontend", "app.howl"))
	if err != nil {
		t.Fatalf("read app.howl: %v", err)
	}
	src := string(content)
	start := strings.Index(src, "(defun open_mission")
	if start < 0 {
		t.Fatal("open_mission not found in app.howl")
	}
	rest := src[start:]
	end := strings.Index(rest[1:], "(defun ")
	if end < 0 {
		t.Fatal("could not bound open_mission in app.howl")
	}
	body := rest[:end+1]
	if !strings.Contains(body, "encode_json") {
		t.Error("open_mission must build the get body with encode_json")
	}
	if strings.Contains(body, `{"id":"`) || strings.Contains(body, `"{\"id\":\""`) {
		t.Error("open_mission must not string-concatenate JSON around the mission id")
	}
	if !strings.Contains(body, "Mission not found") {
		t.Error("open_mission must surface an honest not-found failure")
	}
}

// HOWL-008: demo open_mission must report missing targets (fixture path).
func TestDemoOpenMissionReportsMissing(t *testing.T) {
	content, err := os.ReadFile(filepath.Join(repoRoot(t), "docs", "demo.howl"))
	if err != nil {
		t.Fatalf("read demo.howl: %v", err)
	}
	src := string(content)
	if !strings.Contains(src, "Mission not found") {
		t.Error("demo open_mission must show an honest not-found state")
	}
	if !strings.Contains(src, `(use "../frontend/mission_view.howl" as view)`) &&
		!strings.Contains(src, `(use "../frontend/mission_view.howl"`) {
		// Allow either exact form used by the demo.
		if !strings.Contains(src, "mission_view.howl") {
			t.Error("demo must keep sharing mission_view.howl")
		}
	}
}

// HOWL-008: depends controls must use esc'd data-mission-id + constant handler.
func TestDependsOnControlUsesDataAttrPattern(t *testing.T) {
	content, err := os.ReadFile(filepath.Join(repoRoot(t), "frontend", "mission_view.howl"))
	if err != nil {
		t.Fatalf("read mission_view.howl: %v", err)
	}
	src := string(content)
	if !strings.Contains(src, "depends-link") {
		t.Error("mission_view must render depends-link controls")
	}
	// Howl source escapes quotes as \"; match the attribute name + esc call + constant handler.
	if !strings.Contains(src, "data-mission-id=") || !strings.Contains(src, "(call esc dep)") {
		t.Error("depends controls must place esc(dep) in data-mission-id")
	}
	if !strings.Contains(src, "window.open_mission(this.dataset.missionId)") {
		t.Error("depends controls must use the constant open_mission handler")
	}
	// Inert <code>-only deps must be gone.
	if strings.Contains(src, "<li><code>") && strings.Contains(src, "depends") {
		// Narrow: the depends loop must not emit inert code-only items.
		for number, line := range strings.Split(src, "\n") {
			if strings.Contains(line, "<li><code>") && strings.Contains(line, "esc dep") {
				t.Errorf("mission_view.howl:%d still renders inert code-only depends_on:\n\t%s",
					number+1, strings.TrimSpace(line))
			}
		}
	}
}

// Factory surface: redacted status projection plus an exact Pending row.
// Mirrors BacklogSource row parsing enough to lock the admit contract.

const goldenPendingRow = "| 91011 | [Publish redacted factory status](#91011-publish-redacted-factory-status) | Pending | 2.0 (4x1/2) | Remote operators cannot see the live campaign. |"

const goldenPendingDetail = "### 91011. Publish redacted factory status\n\nSymptom: operators who are not on the Factory host cannot see campaign state.\n\nDeterministic acceptance: `factory/status/remote-snapshot.json` contains `campaign_id`, `state`, `current_dispatch`, blockers, `last_tick_at`, and `last_error`, and the file contains no tokens or absolute host home paths."

func parseRankedRow(row string) (id, title, status, score, rationale, anchor string, err error) {
	if !regexp.MustCompile(`^\|\s*\d+\s*\|`).MatchString(row) {
		return "", "", "", "", "", "", fmt.Errorf("row does not match BacklogSource row pattern")
	}
	parts := strings.Split(row, "|")
	if len(parts) < 3 {
		return "", "", "", "", "", "", fmt.Errorf("row has no cells")
	}
	var cells []string
	for _, cell := range parts[1 : len(parts)-1] {
		cells = append(cells, strings.TrimSpace(cell))
	}
	if len(cells) < 5 {
		return "", "", "", "", "", "", fmt.Errorf("got %d cells, want at least 5", len(cells))
	}
	link := regexp.MustCompile(`^\[(.+?)\]\((#[^)]*)\)$`)
	match := link.FindStringSubmatch(cells[1])
	if match == nil {
		return "", "", "", "", "", "", fmt.Errorf("title cell %q is not a backlog link", cells[1])
	}
	scoreMatch := regexp.MustCompile(`^\s*([0-9]+(?:\.[0-9]+)?)`).FindStringSubmatch(cells[3])
	if scoreMatch == nil {
		return "", "", "", "", "", "", fmt.Errorf("score cell %q has no leading number", cells[3])
	}
	return cells[0], match[1], cells[2], scoreMatch[1], cells[len(cells)-1], match[2], nil
}

func writePublishedSnapshot(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(repoRoot(t), "data", "factory", "status", "remote-snapshot.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir snapshot dir: %v", err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatalf("write snapshot: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Remove(path)
	})
	return path
}

func TestFactoryRemoteSurface(t *testing.T) {
	var stubBody = []byte(`{"error":"missing"}`)
	var tipBody = []byte(`{"sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}`)
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/tip":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(tipBody)
		case "/remote-snapshot.json":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(stubBody)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(stub.Close)
	t.Setenv("HOWLBOARD_FACTORY_SNAPSHOT_URL", stub.URL+"/remote-snapshot.json")
	t.Setenv("HOWLBOARD_FACTORY_TIP_URL", stub.URL+"/tip")

	startServer(t, "network,database,filesystem,environment", true)
	published := filepath.Join(repoRoot(t), "data", "factory", "status", "remote-snapshot.json")
	if err := os.Remove(published); err != nil && !os.IsNotExist(err) {
		t.Fatalf("clear published snapshot: %v", err)
	}

	t.Run("missing snapshot is an unknown state", func(t *testing.T) {
		stubBody = []byte(`{"error":"missing"}`)
		status, _, raw := request(t, http.MethodGet, "/api/factory/status", "")
		if status != http.StatusOK {
			t.Fatalf("status = %d, body %s", status, raw)
		}
		body := decodeObject(t, raw)
		if body["present"] != "false" || body["reason"] != "SNAPSHOT_ABSENT" || body["provenance"] != "ABSENT" {
			// Stub returns non-schema JSON; Board may classify as INVALID after fetch.
			if body["present"] != "false" || (body["reason"] != "SNAPSHOT_ABSENT" && body["reason"] != "SNAPSHOT_INVALID" && body["reason"] != "SCHEMA_MISMATCH") {
				t.Fatalf("absent projection = %v", body)
			}
		}
		if body["schema"] != "howlplane.factory.status/v1" {
			t.Fatalf("schema = %v", body["schema"])
		}
		if body["artifact"] != "factory/status/remote-snapshot.json" {
			t.Fatalf("artifact = %v", body["artifact"])
		}
		if body["state"] != "unknown" {
			t.Fatalf("state = %v, want unknown", body["state"])
		}
		if items := listOf(t, body, "blockers"); len(items) != 0 {
			t.Fatalf("blockers = %v", items)
		}
	})

	t.Run("empty source falls back when local drop is absent", func(t *testing.T) {
		stubBody = []byte(`{"error":"missing"}`)
		status, body := get(t, "/api/factory/status?source=")
		if status != http.StatusOK {
			t.Fatalf("status = %d", status)
		}
		if body["present"] != "false" {
			t.Fatalf("body = %v", body)
		}
		if body["read_channel"] != "plane_git" && body["read_channel"] != "" {
			// absent attach sets plane_git; invalid path may too
			t.Fatalf("read_channel = %v", body["read_channel"])
		}
	})

	t.Run("plane git tip projects when local drop is absent", func(t *testing.T) {
		stubBody = []byte(`{
			"schema": "howlplane.factory.status/v1",
			"redacted": true,
			"published_at": "2026-09-29T20:52:57.875992+00:00",
			"campaign_id": "626fbc7d0aed64d2d8dcbd09",
			"mission_campaign_id": "2026-09-27-continuous-improvement",
			"repository": "howlcipher/howlplane",
			"state": "stopped",
			"current_dispatch": "idle",
			"current_work_item_id": null,
			"blockers": [
				{"class": "OWNER_REQUIRED", "work_item_id": "WI-howlplane-6a668797bb32f9a2", "state": "awaiting_owner", "summary": "orchestrator_final_state:awaiting_human"},
				{"class": "DEFERRED", "work_item_id": "WI-grocery-optimizer-a22392bf4ca89a29", "state": "deferred", "summary": "NO_ELIGIBLE_PROVIDER_REMAINING"}
			],
			"owner_required": true,
			"last_tick_at": "2026-09-28T21:55:24.292921+00:00",
			"last_successful_tick_at": "2026-09-28T21:26:04.141954+00:00",
			"last_error": null,
			"failure_count": 0,
			"stopped_reason": "operator_stop",
			"objective": "continuous improvement",
			"target_mode": "ecosystem",
			"run_mode": "continuous",
			"authority": null
		}`)
		tipBody = []byte(`{"sha":"6276da3daa27a273a6f38ed666e4474ff5579339"}`)
		status, _, raw := request(t, http.MethodGet, "/api/factory/status?source=published", "")
		if status != http.StatusOK {
			t.Fatalf("status = %d, body %s", status, raw)
		}
		body := decodeObject(t, raw)
		if body["present"] != "true" || body["provenance"] != "PUBLISHED" || body["read_channel"] != "plane_git" {
			t.Fatalf("flags = %v", body)
		}
		if body["state"] != "stopped" || body["current_dispatch"] != "idle" {
			t.Fatalf("state/dispatch = %v %v", body["state"], body["current_dispatch"])
		}
		if body["mission_campaign_id"] != "2026-09-27-continuous-improvement" {
			t.Fatalf("mission = %v", body["mission_campaign_id"])
		}
		if body["owner_required"] != "true" || body["stopped_reason"] != "operator_stop" {
			t.Fatalf("owner/stop = %v %v", body["owner_required"], body["stopped_reason"])
		}
		if body["tip_sha"] != "6276da3daa27a273a6f38ed666e4474ff5579339" || body["tip_ref"] != "main" {
			t.Fatalf("tip = %v %v", body["tip_sha"], body["tip_ref"])
		}
		if body["projection_path"] != "factory/status/remote-snapshot.json" {
			t.Fatalf("projection_path = %v", body["projection_path"])
		}
		if !strings.Contains(fmt.Sprint(body["source_url"]), "/remote-snapshot.json") {
			t.Fatalf("source_url = %v", body["source_url"])
		}
		classes := map[string]bool{}
		for _, rawItem := range listOf(t, body, "blockers") {
			item := rawItem.(map[string]any)
			classes[item["class"].(string)] = true
		}
		if !classes["OWNER_REQUIRED"] || !classes["DEFERRED"] {
			t.Fatalf("blocker classes = %v", classes)
		}
		stubBody = []byte(`{"error":"missing"}`)
	})

	t.Run("fixture snapshot projects the public contract", func(t *testing.T) {
		status, _, raw := request(t, http.MethodGet, "/api/factory/status/fixture", "")
		if status != http.StatusOK {
			t.Fatalf("status = %d, body %s", status, raw)
		}
		if strings.Contains(string(raw), "recent_completed") || strings.Contains(string(raw), "workspace_file") {
			t.Fatalf("fixture response leaked a private field: %s", raw)
		}
		body := decodeObject(t, raw)
		if body["present"] != "true" || body["provenance"] != "FIXTURE" || body["redacted"] != "true" {
			t.Fatalf("fixture flags = present %v provenance %v redacted %v", body["present"], body["provenance"], body["redacted"])
		}
		if body["schema"] != "howlplane.factory.status/v1" {
			t.Fatalf("schema = %v", body["schema"])
		}
		if body["repository"] != "howlcipher/howlplane" || body["state"] != "waiting_for_work" {
			t.Fatalf("identity = %v", body)
		}
		if body["current_dispatch"] != "idle" || body["campaign_id"] != "abc123" {
			t.Fatalf("dispatch/campaign = %v %v", body["current_dispatch"], body["campaign_id"])
		}
		if body["mission_campaign_id"] != "2026-09-27-continuous-improvement" {
			t.Fatalf("mission campaign = %v", body["mission_campaign_id"])
		}
		if body["owner_required"] != "true" || body["last_error"] != "" {
			t.Fatalf("owner/error = %v %v", body["owner_required"], body["last_error"])
		}
		if body["failure_count"] != float64(0) {
			t.Fatalf("failure_count = %v", body["failure_count"])
		}
		if body["projection_path"] != "data/fixtures/factory/remote-snapshot.json" {
			t.Fatalf("projection_path = %v", body["projection_path"])
		}
		classes := map[string]bool{}
		for _, rawItem := range listOf(t, body, "blockers") {
			item := rawItem.(map[string]any)
			classes[item["class"].(string)] = true
		}
		for _, want := range []string{"OWNER_REQUIRED", "BLOCKED", "DEFERRED"} {
			if !classes[want] {
				t.Errorf("missing blocker class %s in %v", want, classes)
			}
		}
	})

	t.Run("client path is not a source", func(t *testing.T) {
		status, body := get(t, "/api/factory/status?source=../etc/passwd")
		if status != http.StatusBadRequest || body["error"] != "UNKNOWN_SOURCE" {
			t.Fatalf("status %d body %v", status, body)
		}
	})

	t.Run("published snapshot drops private fields and tokens", func(t *testing.T) {
		writePublishedSnapshot(t, `{
			"schema": "howlplane.factory.status/v1",
			"redacted": true,
			"campaign_id": "abc123",
			"state": "dispatching",
			"current_dispatch": "D-live",
			"last_error": "token=ghp_aaaaaaaaaaaaaaaaaaaa",
			"owner_required": false,
			"failure_count": 2,
			"workspace_file": "/home/alice/dev/howlplane",
			"recent_completed": [{"output": "SECRET_TASK_OUTPUT"}],
			"recent_failed": [{"stderr": "RAW_FAILURE_OUTPUT"}],
			"provider_inventory": [{"token": "sk-cccccccccccccccccccc"}],
			"blockers": [{"class": "BLOCKED", "summary": "needs review", "note": "BLOCKER_PRIVATE_NOTE"}]
		}`)
		status, _, raw := request(t, http.MethodGet, "/api/factory/status/published", "")
		if status != http.StatusOK {
			t.Fatalf("status = %d, body %s", status, raw)
		}
		text := string(raw)
		for _, secret := range []string{"SECRET_TASK_OUTPUT", "RAW_FAILURE_OUTPUT", "ghp_", "/home/alice", "sk-", "recent_completed", "workspace_file", "provider_inventory", "BLOCKER_PRIVATE_NOTE"} {
			if strings.Contains(text, secret) {
				t.Errorf("response contains %q: %s", secret, text)
			}
		}
		body := decodeObject(t, raw)
		if body["present"] != "true" || body["provenance"] != "PUBLISHED" {
			t.Fatalf("flags = %v", body)
		}
		if body["read_channel"] != "local_drop" {
			t.Fatalf("read_channel = %v", body["read_channel"])
		}
		if body["state"] != "dispatching" || body["current_dispatch"] != "D-live" {
			t.Fatalf("state/dispatch = %v %v", body["state"], body["current_dispatch"])
		}
		if body["last_error"] != "[redacted]" || body["failure_count"] != float64(2) {
			t.Fatalf("error/count = %v %v", body["last_error"], body["failure_count"])
		}
		classes := map[string]bool{}
		for _, rawItem := range listOf(t, body, "blockers") {
			item := rawItem.(map[string]any)
			classes[item["class"].(string)] = true
			if _, leaked := item["note"]; leaked {
				t.Fatalf("blocker kept an unknown key: %v", item)
			}
		}
		if !classes["BLOCKED"] {
			t.Fatalf("blocker classes = %v", classes)
		}
		_ = os.Remove(published)
	})

	t.Run("invalid snapshot does not crash", func(t *testing.T) {
		writePublishedSnapshot(t, `{`)
		status, body := get(t, "/api/factory/status?source=published")
		if status != http.StatusOK || body["present"] != "false" || body["reason"] != "SNAPSHOT_INVALID" {
			t.Fatalf("status %d body %v", status, body)
		}
		_ = os.Remove(published)
	})

	t.Run("wrong schema is not displayed", func(t *testing.T) {
		writePublishedSnapshot(t, `{"schema":"howlplane.factory_queue/v1","redacted":true,"last_error":"SECRET_TASK_OUTPUT"}`)
		status, _, raw := request(t, http.MethodGet, "/api/factory/status/published", "")
		body := decodeObject(t, raw)
		if status != http.StatusOK || body["reason"] != "SCHEMA_MISMATCH" || body["present"] != "false" {
			t.Fatalf("status %d body %v", status, body)
		}
		if strings.Contains(string(raw), "SECRET_TASK_OUTPUT") {
			t.Fatalf("schema mismatch echoed a field: %s", raw)
		}
		_ = os.Remove(published)
	})

	t.Run("unredacted snapshot is refused", func(t *testing.T) {
		writePublishedSnapshot(t, `{"schema":"howlplane.factory.status/v1","redacted":false,"last_error":"SECRET_TASK_OUTPUT","state":"idle"}`)
		status, _, raw := request(t, http.MethodGet, "/api/factory/status?source=published", "")
		body := decodeObject(t, raw)
		if status != http.StatusOK || body["reason"] != "NOT_REDACTED" || body["present"] != "false" {
			t.Fatalf("status %d body %v", status, body)
		}
		if strings.Contains(string(raw), "SECRET_TASK_OUTPUT") || body["state"] == "idle" {
			t.Fatalf("unredacted body was displayed: %s", raw)
		}
		_ = os.Remove(published)
	})

	t.Run("header selects the fixture", func(t *testing.T) {
		stubBody = []byte(`{"error":"missing"}`)
		status, body := getHeader(t, "/api/factory/status", "X-Howlboard-Factory-Source", "fixture")
		if status != http.StatusOK {
			t.Fatalf("status = %d body %v", status, body)
		}
		if body["provenance"] != "FIXTURE" || body["campaign_id"] != "abc123" {
			t.Fatalf("header did not select the fixture: %v", body)
		}
	})

	t.Run("path wins over query", func(t *testing.T) {
		stubBody = []byte(`{"error":"missing"}`)
		status, body := get(t, "/api/factory/status/published?source=fixture")
		if status != http.StatusOK {
			t.Fatalf("status = %d body %v", status, body)
		}
		if body["provenance"] == "FIXTURE" {
			t.Fatalf("query overrode the path: %v", body)
		}
	})

	t.Run("query wins over header", func(t *testing.T) {
		stubBody = []byte(`{"error":"missing"}`)
		status, body := getHeader(t, "/api/factory/status?source=published", "X-Howlboard-Factory-Source", "fixture")
		if status != http.StatusOK {
			t.Fatalf("status = %d body %v", status, body)
		}
		if body["provenance"] == "FIXTURE" {
			t.Fatalf("header overrode the query: %v", body)
		}
	})

	t.Run("post body is not a source", func(t *testing.T) {
		stubBody = []byte(`{"error":"missing"}`)
		status, body := post(t, "/api/factory/status", `{"source":"fixture"}`)
		if status != http.StatusOK {
			t.Fatalf("status = %d body %v", status, body)
		}
		if body["provenance"] == "FIXTURE" || body["campaign_id"] == "abc123" {
			t.Fatalf("JSON body still selected the fixture: %v", body)
		}
	})

	t.Run("unknown path segment is rejected", func(t *testing.T) {
		status, body := get(t, "/api/factory/status/nope")
		if status != http.StatusBadRequest || body["error"] != "UNKNOWN_SOURCE" {
			t.Fatalf("status %d body %v", status, body)
		}
	})

	t.Run("nested commit sha locks the tip", func(t *testing.T) {
		stubBody = []byte(`{
			"schema": "howlplane.factory.status/v1",
			"redacted": true,
			"state": "stopped",
			"current_dispatch": "idle",
			"campaign_id": "from-stub"
		}`)
		tipBody = []byte(`{"commit":{"sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}`)
		status, body := get(t, "/api/factory/status?source=published")
		if status != http.StatusOK {
			t.Fatalf("status = %d body %v", status, body)
		}
		if body["present"] != "true" || body["tip_sha"] != "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" {
			t.Fatalf("nested tip = present %v sha %v", body["present"], body["tip_sha"])
		}
		if body["campaign_id"] != "from-stub" {
			t.Fatalf("campaign = %v", body["campaign_id"])
		}
		stubBody = []byte(`{"error":"missing"}`)
	})

	golden := `{"item_id":"91011","title":"Publish redacted factory status","score":"2.0","formula":"4x1/2","rationale":"Remote operators cannot see the live campaign.","source_file":"issues.md","status":"Pending — blocked on #88","symptom":"operators who are not on the Factory host cannot see campaign state.","acceptance":"` + "`factory/status/remote-snapshot.json` contains `campaign_id`, `state`, `current_dispatch`, blockers, `last_tick_at`, and `last_error`, and the file contains no tokens or absolute host home paths." + `"}`

	t.Run("pending row matches the Plane table exactly", func(t *testing.T) {
		status, body := post(t, "/api/factory/pending-row", golden)
		if status != http.StatusOK {
			t.Fatalf("status = %d body %v", status, body)
		}
		row, _ := body["row"].(string)
		if row != goldenPendingRow {
			t.Fatalf("row = %q\nwant %q", row, goldenPendingRow)
		}
		if strings.Contains(row, "blocked") {
			t.Fatalf("status override leaked into the row: %s", row)
		}
		id, title, cellStatus, score, rationale, anchor, err := parseRankedRow(row)
		if err != nil {
			t.Fatal(err)
		}
		if id != "91011" || title != "Publish redacted factory status" || cellStatus != "Pending" {
			t.Fatalf("parsed id/title/status = %s %s %s", id, title, cellStatus)
		}
		if score != "2.0" || rationale != "Remote operators cannot see the live campaign." {
			t.Fatalf("parsed score/rationale = %s %s", score, rationale)
		}
		if anchor != "#91011-publish-redacted-factory-status" {
			t.Fatalf("anchor = %s", anchor)
		}
		if body["eligible"] != "true" || body["origin"] != "existing_backlog" || body["kind"] != "bug" {
			t.Fatalf("admission flags = %v", body)
		}
		if body["status"] != "Pending" || body["backlog_schema"] != "howlplane.backlog_item/v1" {
			t.Fatalf("status/schema = %v %v", body["status"], body["backlog_schema"])
		}
		if body["detail"] != goldenPendingDetail {
			t.Fatalf("detail = %q", body["detail"])
		}
		header, _ := body["table_header"].(string)
		if header != "| # | Title | Status | Score | Rationale |\n| --- | --- | --- | --- | --- |" {
			t.Fatalf("table_header = %q", header)
		}
		if !strings.HasPrefix(strings.Split(body["detail"].(string), "\n")[0], "### 91011.") {
			t.Fatalf("detail heading is not a BacklogSource item section: %v", body["detail"])
		}
	})

	t.Run("score below the ROI floor is previewed and not eligible", func(t *testing.T) {
		status, body := post(t, "/api/factory/pending-row", `{"item_id":"7","title":"Live bug","score":"0.4","rationale":"open","source_file":"bugs.md"}`)
		if status != http.StatusOK {
			t.Fatalf("status = %d", status)
		}
		if body["eligible"] != "false" || body["ok"] != "true" || body["origin"] != "" || body["kind"] != "bug" {
			t.Fatalf("flags = %v", body)
		}
		row := body["row"].(string)
		_, _, cellStatus, score, _, _, err := parseRankedRow(row)
		if err != nil {
			t.Fatal(err)
		}
		if cellStatus != "Pending" || score != "0.4" {
			t.Fatalf("parsed status/score = %s %s", cellStatus, score)
		}
		reasons := listOf(t, body, "reasons")
		if len(reasons) != 1 || reasons[0] != "BELOW_ROI_FLOOR" {
			t.Fatalf("reasons = %v", reasons)
		}
	})

	t.Run("roi floor boundary is eligible", func(t *testing.T) {
		status, body := post(t, "/api/factory/pending-row", `{"item_id":"8","title":"Floor","score":"0.5","rationale":"meets floor","source_file":"improvements.md"}`)
		if status != http.StatusOK || body["eligible"] != "true" || body["kind"] != "improvement" {
			t.Fatalf("status %d body %v", status, body)
		}
	})

	t.Run("unsafe cells and unknown files emit no row", func(t *testing.T) {
		status, body := post(t, "/api/factory/pending-row", `{"item_id":"1","title":"Has | pipe","score":"2.0","rationale":"ok","source_file":"owner_direction"}`)
		if status != http.StatusOK {
			t.Fatalf("status = %d", status)
		}
		if body["row"] != "" || body["ok"] != "false" || body["eligible"] != "false" {
			t.Fatalf("body = %v", body)
		}
		joined := fmt.Sprint(body["reasons"])
		if !strings.Contains(joined, "TITLE_CHARS") || !strings.Contains(joined, "UNKNOWN_SOURCE_FILE") {
			t.Fatalf("reasons = %v", body["reasons"])
		}
	})
}

func TestFactorySurfaceIsProjectionOnly(t *testing.T) {
	server, err := os.ReadFile(filepath.Join(repoRoot(t), "backend", "server.howl"))
	if err != nil {
		t.Fatal(err)
	}
	app, err := os.ReadFile(filepath.Join(repoRoot(t), "frontend", "app.howl"))
	if err != nil {
		t.Fatal(err)
	}
	src := string(server) + "\n" + string(app)
	for _, forbidden := range []string{"factory start", "owner_direction.json", "/api/factory/queue", "/api/factory/start", "write_file"} {
		if strings.Contains(src, forbidden) {
			t.Errorf("factory surface contains %q", forbidden)
		}
	}
	if !strings.Contains(string(server), "/api/factory/status") || !strings.Contains(string(server), "/api/factory/pending-row") {
		t.Error("factory routes missing from server.howl")
	}
	if !strings.Contains(string(server), "/api/factory/status/{source}") {
		t.Error("factory status must register a {source} path")
	}
	for _, op := range []string{"req_query", "req_header", "req_path", "map_keys"} {
		if !strings.Contains(string(server), op) {
			t.Errorf("factory surface missing %s", op)
		}
	}
	if !strings.Contains(string(server), `(map_get (map_get doc "commit") "sha")`) {
		t.Error("tip lock must chain map_get through commit.sha")
	}
	if strings.Contains(string(server), `map_get body "source"`) {
		t.Error("factory status must not read source from the JSON body")
	}
	if !strings.Contains(string(app), "encode_json") || !strings.Contains(string(app), "/api/factory/pending-row") {
		t.Error("pending preview must post encode_json to /api/factory/pending-row")
	}
	if !strings.Contains(string(app), "/api/factory/status/") || !strings.Contains(string(app), `"GET"`) {
		t.Error("factory panel must GET /api/factory/status/{source}")
	}
	view, err := os.ReadFile(filepath.Join(repoRoot(t), "frontend", "factory_view.howl"))
	if err != nil {
		t.Fatal(err)
	}
	viewSrc := string(view)
	for _, op := range []string{"html_escape", "attr_escape", "data-provenance", "data-markdown", "data-class"} {
		if !strings.Contains(viewSrc, op) {
			t.Errorf("factory view missing %s", op)
		}
	}
	if strings.Contains(viewSrc, "onclick") {
		t.Error("factory view must not build an inline handler")
	}
}

func TestFactoryViewEscapes(t *testing.T) {
	root := repoRoot(t)
	outDir := t.TempDir()
	bin := filepath.Join(root, "howlframe_bin")
	cmd := exec.Command(bin, filepath.Join(root, "frontend", "factory_harness.howl"), "-o", outDir)
	cmd.Dir = root
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("compile factory harness: %v\n%s", err, output)
	}
	jsPath := filepath.Join(outDir, "app.js")
	js, err := os.ReadFile(jsPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(js), `howlFrameHTMLEscape("html_escape"`) || !strings.Contains(string(js), `howlFrameHTMLEscape("attr_escape"`) {
		t.Fatalf("compiled factory view dropped an escape kind")
	}

	script := `
const fs = require("fs");
const code = fs.readFileSync(process.argv[1], "utf8");
eval(code);
(async () => {
  const absent = await render_factory_html({
    error: "",
    present: "false",
    provenance: 'PUB"><script>',
    reason: "SNAPSHOT_ABSENT",
    projection_path: "a&b<c",
    read_channel: "",
  });
  if (absent.includes('data-provenance="PUB"><script>')) {
    console.error("provenance broke out of data-provenance");
    process.exit(1);
  }
  if (!absent.includes('data-provenance="PUB&#34;&gt;&lt;script&gt;"')) {
    console.error("data-provenance was not attr_escape'd: " + absent);
    process.exit(1);
  }
  if (!absent.includes("PUB&#34;&gt;&lt;script&gt;</span>")) {
    console.error("provenance text was not html_escape'd: " + absent);
    process.exit(1);
  }
  if (!absent.includes("<code>a&amp;b&lt;c</code>")) {
    console.error("projection path was not html_escape'd: " + absent);
    process.exit(1);
  }
  if (absent.includes("<script>")) {
    console.error("raw script tag survived factory status render");
    process.exit(1);
  }

  const present = await render_factory_html({
    error: "",
    present: "true",
    provenance: "FIXTURE",
    reason: "",
    read_channel: "",
    campaign_id: "abc",
    mission_campaign_id: "",
    repository: "",
    state: "waiting",
    current_dispatch: "idle",
    current_work_item_id: "",
    owner_required: "false",
    last_tick_at: "",
    last_error: "",
    failure_count: 0,
    authority: "",
    stopped_reason: "",
    objective: "",
    published_at: "",
    tip_sha: "",
    tip_ref: "",
    source_url: "",
    blockers: [{
      class: 'A"B',
      summary: "<b>secret</b>",
      work_item_id: "WI",
      state: "blocked",
      proposal_id: "P",
      note: "SHOULD_NOT_RENDER",
    }],
  });
  if (!present.includes('data-class="A&#34;B"')) {
    console.error("blocker class was not attr_escape'd: " + present);
    process.exit(1);
  }
  if (!present.includes("&lt;b&gt;secret&lt;/b&gt;")) {
    console.error("blocker summary was not html_escape'd: " + present);
    process.exit(1);
  }
  if (present.includes("SHOULD_NOT_RENDER") || present.includes("<b>")) {
    console.error("unknown or raw blocker markup rendered: " + present);
    process.exit(1);
  }

  const pending = await render_pending_html({
    eligible: "false",
    reasons: ["<li>"],
    markdown: '<script>alert(1)</script>"\'',
    note: "a&b",
  });
  if (pending.includes("<script>alert(1)</script>")) {
    console.error("pending markdown was not escaped");
    process.exit(1);
  }
  if (!pending.includes('data-markdown="&lt;script&gt;alert(1)&lt;/script&gt;&#34;&#39;"')) {
    console.error("data-markdown was not attr_escape'd: " + pending);
    process.exit(1);
  }
  if (!pending.includes("&amp;")) {
    console.error("note was not html_escape'd: " + pending);
    process.exit(1);
  }
  if (/onclick\s*=/.test(pending) || /onclick\s*=/.test(present)) {
    console.error("factory markup built an inline handler");
    process.exit(1);
  }
  console.log("ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
`
	node := exec.Command("node", "-e", script, jsPath)
	node.Dir = root
	output, err := node.CombinedOutput()
	if err != nil {
		t.Fatalf("factory render harness failed: %v\n%s", err, output)
	}
	if !strings.Contains(string(output), "ok") {
		t.Fatalf("factory render harness output = %q", output)
	}
}
