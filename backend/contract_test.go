package backend_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

const apiURL = "http://localhost:8080/api/tasks"

func request(t *testing.T, method, url, payload string) (int, http.Header, []byte) {
	t.Helper()

	var body io.Reader
	if payload != "" {
		body = bytes.NewBufferString(payload)
	}
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		t.Fatalf("build %s %s request: %v", method, url, err)
	}
	if payload != "" {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("send %s %s request: %v", method, url, err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read %s %s response: %v", method, url, err)
	}
	return resp.StatusCode, resp.Header, responseBody
}

func decodeObject(t *testing.T, body []byte) map[string]any {
	t.Helper()

	var value map[string]any
	if err := json.Unmarshal(body, &value); err != nil {
		t.Fatalf("decode JSON response %q: %v", body, err)
	}
	return value
}

func collectionLength(t *testing.T, value map[string]any, key string) int {
	t.Helper()

	item, exists := value[key]
	if !exists {
		t.Fatalf("response is missing %q: %v", key, value)
	}
	if item == nil {
		return 0
	}
	items, ok := item.([]any)
	if !ok {
		t.Fatalf("response field %q is not a collection: %v", key, value)
	}
	return len(items)
}

func TestContracts(t *testing.T) {
	for _, stateFile := range []string{"howlboard.json", "howlboard_activity.json"} {
		if err := os.Remove(stateFile); err != nil && !os.IsNotExist(err) {
			t.Fatalf("remove stale %s: %v", stateFile, err)
		}
		t.Cleanup(func() { _ = os.Remove(stateFile) })
	}

	repoRoot, err := filepath.Abs("..")
	if err != nil {
		t.Fatalf("resolve repository root: %v", err)
	}
	cmd := exec.Command(
		filepath.Join(repoRoot, "howlframe_bin"),
		"-run-bc", "-allow-caps", "network,database", "server.hfbc",
	)
	cmd.Dir = filepath.Join(repoRoot, "backend")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		t.Fatalf("start bytecode server: %v", err)
	}
	t.Cleanup(func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = cmd.Wait()
	})

	time.Sleep(time.Second)

	status, headers, body := request(t, http.MethodGet, apiURL, "")
	if status != http.StatusOK {
		t.Fatalf("empty task list: expected 200, got %d: %s", status, body)
	}
	if got := headers.Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("CORS origin header: got %q, want %q", got, "*")
	}
	if tasks := collectionLength(t, decodeObject(t, body), "tasks"); tasks != 0 {
		t.Fatalf("empty task list: got %s", body)
	}

	status, _, body = request(t, http.MethodPost, apiURL+"/create", `{"title":"Test Task","description":"Test Desc","priority":"HIGH","labels":"bug"}`)
	if status != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", status, body)
	}
	created := decodeObject(t, body)
	if created["title"] != "Test Task" || created["status"] != "BACKLOG" || created["priority"] != "HIGH" {
		t.Fatalf("unexpected created task: %v", created)
	}
	id, ok := created["id"].(string)
	if !ok || id == "" {
		t.Fatalf("created task has invalid id: %v", created)
	}
	if _, err := os.Stat("howlboard.json"); err != nil {
		t.Fatalf("persistent task store was not written: %v", err)
	}

	status, _, body = request(t, http.MethodPost, apiURL+"/create", `{"description":"Test Desc"}`)
	if status != http.StatusBadRequest {
		t.Errorf("missing title: expected 400, got %d: %s", status, body)
	}
	status, _, body = request(t, http.MethodPost, apiURL+"/create", `{"title":"T","priority":"SUPERHIGH"}`)
	if status != http.StatusBadRequest {
		t.Errorf("invalid priority: expected 400, got %d: %s", status, body)
	}

	status, _, body = request(t, http.MethodPost, apiURL+"/status", `{"id":"`+id+`","status":"DONE"}`)
	if status != http.StatusBadRequest {
		t.Errorf("invalid transition: expected 400, got %d: %s", status, body)
	}
	status, _, body = request(t, http.MethodPost, apiURL+"/status", `{"id":"`+id+`","status":"READY"}`)
	if status != http.StatusOK {
		t.Fatalf("valid transition: expected 200, got %d: %s", status, body)
	}
	if updated := decodeObject(t, body); updated["status"] != "READY" {
		t.Fatalf("valid transition did not update task: %v", updated)
	}

	status, _, body = request(t, http.MethodGet, apiURL, "")
	if status != http.StatusOK || collectionLength(t, decodeObject(t, body), "tasks") != 1 {
		t.Fatalf("persisted task list is invalid: status=%d body=%s", status, body)
	}

	status, _, body = request(t, http.MethodPost, apiURL+"/delete", `{"id":"`+id+`"}`)
	if status != http.StatusOK {
		t.Fatalf("delete task: expected 200, got %d: %s", status, body)
	}

	status, _, body = request(t, http.MethodGet, "http://localhost:8080/api/activity", "")
	if status != http.StatusOK {
		t.Fatalf("activity list: expected 200, got %d: %s", status, body)
	}
	if activities := collectionLength(t, decodeObject(t, body), "activities"); activities != 3 {
		t.Fatalf("activity list: expected create, transition, and delete events; got %s", body)
	}

	status, _, body = request(t, http.MethodGet, apiURL, "")
	if status != http.StatusOK || collectionLength(t, decodeObject(t, body), "tasks") != 0 {
		t.Fatalf("deleted task remains in list: status=%d body=%s", status, body)
	}
}
