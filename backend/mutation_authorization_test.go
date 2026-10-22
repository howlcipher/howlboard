package backend_test

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// Synthetic fixture only; never use this as a deployment credential.
const syntheticWriteToken = "1111111111111111111111111111111111111111111111111111111111111111"

type storeSnapshot struct {
	exists bool
	data   string
}

func snapshotStores(t *testing.T) map[string]storeSnapshot {
	t.Helper()
	out := map[string]storeSnapshot{}
	for _, name := range []string{"howlboard_missions.json", "howlboard_timeline.json"} {
		data, err := os.ReadFile(filepath.Join(repoRoot(t), name))
		if err != nil && !os.IsNotExist(err) {
			t.Fatal("cannot snapshot synthetic state")
		}
		out[name] = storeSnapshot{exists: err == nil, data: string(data)}
	}
	return out
}

func assertStoresUnchanged(t *testing.T, before map[string]storeSnapshot) {
	t.Helper()
	after := snapshotStores(t)
	for name, original := range before {
		if original != after[name] {
			t.Fatalf("denied operation changed synthetic state: %s", name)
		}
	}
}

func explicitRequest(t *testing.T, method, path string, headers map[string]string) int {
	t.Helper()
	req, err := http.NewRequest(method, baseURL()+path, bytes.NewBufferString("{}"))
	if err != nil {
		t.Fatal("cannot construct local contract request")
	}
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal("local contract request failed")
	}
	defer resp.Body.Close()
	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		t.Fatal("cannot consume local contract response")
	}
	return resp.StatusCode
}

// HTTP protocol tests only. This is not the restricted Chromium reproduction.
func TestMutationAuthorizationAndNoEffect(t *testing.T) {
	startServer(t, "network,database,filesystem,environment", true)
	seed(t)
	paths := []string{"/api/seed", "/api/missions/create", "/api/missions/state",
		"/api/missions/approve", "/api/missions/reject", "/api/missions/delete"}
	for _, path := range paths {
		for _, method := range []string{"GET", "HEAD", "PUT", "DELETE", "PATCH"} {
			t.Run(path+"/"+method, func(t *testing.T) {
				before := snapshotStores(t)
				if got := explicitRequest(t, method, path, map[string]string{
					"Authorization": "Bearer " + syntheticWriteToken,
				}); got != http.StatusMethodNotAllowed {
					t.Errorf("unsupported method status=%d; want 405", got)
				}
				assertStoresUnchanged(t, before)
			})
		}
		for _, test := range []struct {
			name    string
			headers map[string]string
			status  int
		}{
			{"missing-origin-no-credential", nil, 401},
			{"allowed-origin-no-credential", map[string]string{"Origin": "http://localhost:3000"}, 401},
			{"incorrect-credential", map[string]string{"Authorization": "Bearer synthetic-invalid"}, 401},
			{"foreign-origin-with-credential", map[string]string{"Origin": "https://untrusted.invalid", "Authorization": "Bearer " + syntheticWriteToken}, 403},
			{"opaque-origin-with-credential", map[string]string{"Origin": "null", "Authorization": "Bearer " + syntheticWriteToken}, 403},
		} {
			t.Run(path+"/"+test.name, func(t *testing.T) {
				before := snapshotStores(t)
				if got := explicitRequest(t, "POST", path, test.headers); got != test.status {
					t.Errorf("unauthorized operation status=%d; want %d", got, test.status)
				}
				assertStoresUnchanged(t, before)
			})
		}
		before := snapshotStores(t)
		if got := explicitRequest(t, "OPTIONS", path, nil); got != 200 {
			t.Errorf("preflight status=%d; want 200", got)
		}
		assertStoresUnchanged(t, before)
	}
	for _, origin := range []string{"", "http://localhost:3000"} {
		if got := explicitRequest(t, "POST", "/api/seed", map[string]string{
			"Authorization": "Bearer " + syntheticWriteToken, "Origin": origin,
		}); got != 200 {
			t.Errorf("authorized client status=%d; want 200", got)
		}
	}
}

func TestMissingWriteConfigurationRefuses(t *testing.T) {
	for name, token := range map[string]string{"missing": "", "malformed": "synthetic-not-random"} {
		t.Run(name, func(t *testing.T) {
			launchServerWithWriteToken(t, "network,database,filesystem,environment", true, true, token)
			before := snapshotStores(t)
			if got := explicitRequest(t, "POST", "/api/seed", map[string]string{
				"Authorization": "Bearer " + syntheticWriteToken,
			}); got != 401 {
				t.Errorf("unconfigured write status=%d; want 401", got)
			}
			assertStoresUnchanged(t, before)
		})
	}
}

func TestFrontendAuthorizationResponseErrors(t *testing.T) {
	// Pure compiled response interpretation; no browser or network activity.
	dir := t.TempDir()
	module, err := os.ReadFile(filepath.Join(repoRoot(t), "frontend", "api_response.howl"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "api_response.howl"), module, 0600); err != nil {
		t.Fatal(err)
	}
	source := `(web_app (use "api_response.howl" as response)
  (print (call response/error_message "{\"error\":\"AUTHORIZATION_REQUIRED\"}"))
  (print (call response/error_message "{\"error\":\"ORIGIN_NOT_ALLOWED\"}"))
  (print (call response/error_message "{\"status\":\"seeded\"}"))
  (print (call response/error_message "invalid JSON")))`
	file := filepath.Join(dir, "responses.howl")
	if err := os.WriteFile(file, []byte(source), 0600); err != nil {
		t.Fatal(err)
	}
	if output, err := exec.Command(resolveHowlFrameBin(repoRoot(t)), "build", file, "--target=js", "-o", dir).CombinedOutput(); err != nil {
		t.Fatalf("compile pure response harness: %v %s", err, output)
	}
	output, err := exec.Command("node", filepath.Join(dir, "app.js")).CombinedOutput()
	if err != nil {
		t.Fatalf("execute pure response harness: %v", err)
	}
	if string(output) != "AUTHORIZATION_REQUIRED\nORIGIN_NOT_ALLOWED\n\nInvalid API response\n" {
		t.Fatal("frontend did not distinguish authorization errors from successful responses")
	}
}
