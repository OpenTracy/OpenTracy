package clickhouse

import (
	"fmt"
	"time"

	"github.com/OpenTracy/opentracy/go/internal/envfallback"
)

// Config holds ClickHouse connection and writer settings.
type Config struct {
	Enabled       bool          `yaml:"enabled"`
	Host          string        `yaml:"host"`
	Port          int           `yaml:"port"`
	Database      string        `yaml:"database"`
	Username      string        `yaml:"username"`
	Password      string        `yaml:"password"`
	BatchSize     int           `yaml:"batch_size"`
	FlushInterval time.Duration `yaml:"flush_interval"`
	MaxRetries    int           `yaml:"max_retries"`
}

// DefaultConfig returns a Config with sensible defaults (disabled).
func DefaultConfig() Config {
	return Config{
		Enabled:       false,
		Host:          "localhost",
		Port:          9000,
		Database:      "opentracy",
		Username:      "default",
		Password:      "",
		BatchSize:     500,
		FlushInterval: 5 * time.Second,
		MaxRetries:    3,
	}
}

// ApplyEnvOverrides overrides config values with OPENTRACY_CH_* environment
// variables, falling back to the legacy LUNAR_CH_* names for compatibility.
func (c *Config) ApplyEnvOverrides() {
	if v := envfallback.Get("CH_ENABLED"); v == "true" || v == "1" {
		c.Enabled = true
	}
	if v := envfallback.Get("CH_HOST"); v != "" {
		c.Host = v
	}
	if v := envfallback.Get("CH_PORT"); v != "" {
		var port int
		if _, err := fmt.Sscanf(v, "%d", &port); err == nil {
			c.Port = port
		}
	}
	if v := envfallback.Get("CH_DATABASE"); v != "" {
		c.Database = v
	}
	if v := envfallback.Get("CH_USERNAME"); v != "" {
		c.Username = v
	}
	if v := envfallback.Get("CH_PASSWORD"); v != "" {
		c.Password = v
	}
	if v := envfallback.Get("CH_BATCH_SIZE"); v != "" {
		var bs int
		if _, err := fmt.Sscanf(v, "%d", &bs); err == nil && bs > 0 {
			c.BatchSize = bs
		}
	}
	if v := envfallback.Get("CH_FLUSH_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			c.FlushInterval = d
		}
	}
	if v := envfallback.Get("CH_MAX_RETRIES"); v != "" {
		var mr int
		if _, err := fmt.Sscanf(v, "%d", &mr); err == nil && mr >= 0 {
			c.MaxRetries = mr
		}
	}
}

// DSN returns the ClickHouse connection string for the native protocol.
func (c *Config) DSN() string {
	return fmt.Sprintf("clickhouse://%s:%s@%s:%d/%s",
		c.Username, c.Password, c.Host, c.Port, c.Database)
}
