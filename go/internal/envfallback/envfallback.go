// Package envfallback resolves OPENTRACY_* env vars with a legacy LUNAR_*
// fallback, so deployments migrating from lunar-router keep working.
package envfallback

import (
	"fmt"
	"os"
	"sync"
)

var (
	mu     sync.Mutex
	warned = map[string]bool{}
)

// Get returns the value of OPENTRACY_<name>. If unset, it returns the value of
// LUNAR_<name> with a one-time stderr deprecation warning for that legacy name.
// Returns "" if neither env var is set.
func Get(name string) string {
	if v := os.Getenv("OPENTRACY_" + name); v != "" {
		return v
	}
	legacy := "LUNAR_" + name
	if v := os.Getenv(legacy); v != "" {
		mu.Lock()
		if !warned[legacy] {
			fmt.Fprintf(os.Stderr, "[opentracy] %s is deprecated; use OPENTRACY_%s instead\n", legacy, name)
			warned[legacy] = true
		}
		mu.Unlock()
		return v
	}
	return ""
}
