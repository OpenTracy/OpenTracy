package clickhouse

import (
	"fmt"
	"os"
	"time"
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
		Database:      "lunar_router",
		Username:      "default",
		Password:      "",
		BatchSize:     500,
		FlushInterval: 5 * time.Second,
		MaxRetries:    3,
	}
}

// ApplyEnvOverrides overrides config values with LUNAR_CH_* environment variables.
func (c *Config) ApplyEnvOverrides() {
	if v := os.Getenv("LUNAR_CH_ENABLED"); v == "true" || v == "1" {
		c.Enabled = true
	}
	if v := os.Getenv("LUNAR_CH_HOST"); v != "" {
		c.Host = v
	}
	if v := os.Getenv("LUNAR_CH_PORT"); v != "" {
		var port int
		if _, err := fmt.Sscanf(v, "%d", &port); err == nil {
			c.Port = port
		}
	}
	if v := os.Getenv("LUNAR_CH_DATABASE"); v != "" {
		c.Database = v
	}
	if v := os.Getenv("LUNAR_CH_USERNAME"); v != "" {
		c.Username = v
	}
	if v := os.Getenv("LUNAR_CH_PASSWORD"); v != "" {
		c.Password = v
	}
	if v := os.Getenv("LUNAR_CH_BATCH_SIZE"); v != "" {
		var bs int
		if _, err := fmt.Sscanf(v, "%d", &bs); err == nil && bs > 0 {
			c.BatchSize = bs
		}
	}
	if v := os.Getenv("LUNAR_CH_FLUSH_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			c.FlushInterval = d
		}
	}
	if v := os.Getenv("LUNAR_CH_MAX_RETRIES"); v != "" {
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
