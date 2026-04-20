package envfallback

import (
	"os"
	"strings"
	"sync"
	"testing"
)

// resetWarned clears the internal warned set so each test sees a fresh state.
// Without this, one test's warning trips the "once per process" logic and the
// next test can't observe the warning.
func resetWarned(t *testing.T) {
	t.Helper()
	mu.Lock()
	warned = map[string]bool{}
	mu.Unlock()
}

func clearEnv(t *testing.T, keys ...string) {
	t.Helper()
	for _, k := range keys {
		if err := os.Unsetenv(k); err != nil {
			t.Fatalf("unsetenv %s: %v", k, err)
		}
	}
}

func TestGet_ReturnsEmptyWhenNeitherIsSet(t *testing.T) {
	resetWarned(t)
	clearEnv(t, "OPENTRACY_FOO", "LUNAR_FOO")

	if got := Get("FOO"); got != "" {
		t.Fatalf("Get(FOO) with no env set = %q, want empty string", got)
	}
}

func TestGet_PrefersNewPrefixOverLegacy(t *testing.T) {
	resetWarned(t)
	t.Setenv("OPENTRACY_API_KEY", "new-secret")
	t.Setenv("LUNAR_API_KEY", "legacy-secret")

	got := Get("API_KEY")
	if got != "new-secret" {
		t.Fatalf("Get(API_KEY) = %q, want %q (new prefix must win)", got, "new-secret")
	}
}

func TestGet_FallsBackToLegacyWhenNewIsUnset(t *testing.T) {
	resetWarned(t)
	clearEnv(t, "OPENTRACY_DATA_DIR")
	t.Setenv("LUNAR_DATA_DIR", "/tmp/legacy")

	// Redirect stderr so we can observe the deprecation warning format.
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	orig := os.Stderr
	os.Stderr = w
	got := Get("DATA_DIR")
	w.Close()
	os.Stderr = orig

	if got != "/tmp/legacy" {
		t.Fatalf("Get(DATA_DIR) = %q, want %q (should fall back to LUNAR_*)", got, "/tmp/legacy")
	}

	buf := make([]byte, 4096)
	n, _ := r.Read(buf)
	stderr := string(buf[:n])
	if !strings.Contains(stderr, "LUNAR_DATA_DIR is deprecated") {
		t.Fatalf("stderr did not include deprecation warning: %q", stderr)
	}
	if !strings.Contains(stderr, "OPENTRACY_DATA_DIR") {
		t.Fatalf("deprecation warning must name the replacement key: %q", stderr)
	}
}

func TestGet_LegacyEmptyIsTreatedAsUnset(t *testing.T) {
	// Empty string in the legacy var should NOT count as "set" — otherwise a
	// user who cleared LUNAR_X="" to migrate would get an empty fallback value
	// instead of falling through to default.
	resetWarned(t)
	clearEnv(t, "OPENTRACY_HOST")
	t.Setenv("LUNAR_HOST", "")

	if got := Get("HOST"); got != "" {
		t.Fatalf("Get(HOST) with empty legacy = %q, want empty string", got)
	}
}

func TestGet_DeprecationWarningFiresOncePerKeyPerProcess(t *testing.T) {
	resetWarned(t)
	clearEnv(t, "OPENTRACY_TOKEN")
	t.Setenv("LUNAR_TOKEN", "x")

	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	orig := os.Stderr
	os.Stderr = w

	for i := 0; i < 5; i++ {
		Get("TOKEN")
	}
	w.Close()
	os.Stderr = orig

	buf := make([]byte, 4096)
	n, _ := r.Read(buf)
	stderr := string(buf[:n])
	got := strings.Count(stderr, "LUNAR_TOKEN is deprecated")
	if got != 1 {
		t.Fatalf("expected 1 warning for LUNAR_TOKEN across 5 lookups, got %d. stderr=%q", got, stderr)
	}
}

func TestGet_ConcurrentCallsAreRaceFree(t *testing.T) {
	resetWarned(t)
	clearEnv(t, "OPENTRACY_PARALLEL")
	t.Setenv("LUNAR_PARALLEL", "yes")

	const workers = 32
	var wg sync.WaitGroup
	wg.Add(workers)
	for i := 0; i < workers; i++ {
		go func() {
			defer wg.Done()
			if got := Get("PARALLEL"); got != "yes" {
				t.Errorf("concurrent Get = %q, want %q", got, "yes")
			}
		}()
	}
	wg.Wait()
}
