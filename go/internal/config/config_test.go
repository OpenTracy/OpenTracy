package config

import (
	"os"
	"testing"
)

// clearCHEnv wipes every ClickHouse-related env var in both prefixes so each
// test starts from a known zero state. Without this, a LUNAR_CH_* var left
// over from a previous test can leak into the current one and give a false
// pass.
func clearCHEnv(t *testing.T) {
	t.Helper()
	keys := []string{
		"OPENTRACY_HOST", "LUNAR_HOST",
		"OPENTRACY_PORT", "LUNAR_PORT",
		"OPENTRACY_WEIGHTS_PATH", "LUNAR_WEIGHTS_PATH",
		"OPENTRACY_LOG_LEVEL", "LUNAR_LOG_LEVEL",
		"OPENTRACY_CH_ENABLED", "LUNAR_CH_ENABLED",
		"OPENTRACY_CH_HOST", "LUNAR_CH_HOST",
		"OPENTRACY_CH_PORT", "LUNAR_CH_PORT",
		"OPENTRACY_CH_DATABASE", "LUNAR_CH_DATABASE",
		"OPENTRACY_CH_PASSWORD", "LUNAR_CH_PASSWORD",
	}
	for _, k := range keys {
		_ = os.Unsetenv(k)
	}
}

func TestDefaultConfig_ServerAndDatabase(t *testing.T) {
	cfg := DefaultConfig()

	// These defaults are load-bearing: docker-compose, Makefile and the Python
	// API all assume "opentracy" is the ClickHouse DB name. If someone changes
	// the default here, it must be paired with a schema migration plan — see
	// CHANGELOG "Rebrand" section.
	if cfg.ClickHouse.Database != "opentracy" {
		t.Fatalf("DefaultConfig().ClickHouse.Database = %q, want %q", cfg.ClickHouse.Database, "opentracy")
	}
}

func TestApplyEnvOverrides_NewPrefixWins(t *testing.T) {
	clearCHEnv(t)
	t.Setenv("OPENTRACY_HOST", "new.host")
	t.Setenv("LUNAR_HOST", "legacy.host")
	t.Setenv("OPENTRACY_CH_DATABASE", "new_db")
	t.Setenv("LUNAR_CH_DATABASE", "legacy_db")

	cfg := DefaultConfig()
	cfg.ApplyEnvOverrides()

	if cfg.Server.Host != "new.host" {
		t.Fatalf("Server.Host = %q, want %q (OPENTRACY_HOST must take precedence)", cfg.Server.Host, "new.host")
	}
	if cfg.ClickHouse.Database != "new_db" {
		t.Fatalf("ClickHouse.Database = %q, want %q (OPENTRACY_CH_DATABASE must take precedence)", cfg.ClickHouse.Database, "new_db")
	}
}

func TestApplyEnvOverrides_LegacyFallbackStillWorks(t *testing.T) {
	clearCHEnv(t)
	t.Setenv("LUNAR_HOST", "legacy.host")
	t.Setenv("LUNAR_CH_DATABASE", "legacy_db")
	t.Setenv("LUNAR_CH_PASSWORD", "legacy_pw")

	cfg := DefaultConfig()
	cfg.ApplyEnvOverrides()

	if cfg.Server.Host != "legacy.host" {
		t.Fatalf("Server.Host = %q, want %q (LUNAR_HOST fallback)", cfg.Server.Host, "legacy.host")
	}
	if cfg.ClickHouse.Database != "legacy_db" {
		t.Fatalf("ClickHouse.Database = %q, want %q (LUNAR_CH_DATABASE fallback)", cfg.ClickHouse.Database, "legacy_db")
	}
	if cfg.ClickHouse.Password != "legacy_pw" {
		t.Fatalf("ClickHouse.Password = %q, want %q (LUNAR_CH_PASSWORD fallback)", cfg.ClickHouse.Password, "legacy_pw")
	}
}

func TestApplyEnvOverrides_NoEnvLeavesDefaults(t *testing.T) {
	clearCHEnv(t)

	cfg := DefaultConfig()
	cfg.ApplyEnvOverrides()

	if cfg.ClickHouse.Database != "opentracy" {
		t.Fatalf("ClickHouse.Database = %q, want %q (no env should leave default)", cfg.ClickHouse.Database, "opentracy")
	}
}
