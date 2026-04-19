package config

import (
	"fmt"
	"os"

	"github.com/OpenTracy/opentracy/go/internal/clickhouse"
	"github.com/OpenTracy/opentracy/go/internal/envfallback"
	"gopkg.in/yaml.v3"
)

// Config holds the application configuration.
type Config struct {
	Server     ServerConfig      `yaml:"server"`
	Weights    WeightsConfig     `yaml:"weights"`
	Embeddings EmbeddingsConfig  `yaml:"embeddings"`
	Routing    RoutingConfig     `yaml:"routing"`
	Logging    LoggingConfig     `yaml:"logging"`
	ClickHouse clickhouse.Config `yaml:"clickhouse"`
}

// ServerConfig holds HTTP server settings.
type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

// WeightsConfig holds weight loading settings.
type WeightsConfig struct {
	Path string `yaml:"path"`
}

// RoutingConfig holds routing settings.
type RoutingConfig struct {
	CostWeight     float64  `yaml:"cost_weight"`
	SoftAssignment bool     `yaml:"soft_assignment"`
	AllowedModels  []string `yaml:"allowed_models,omitempty"`
}

// EmbeddingsConfig holds embedding settings.
type EmbeddingsConfig struct {
	Backend     string `yaml:"backend"`       // "minilm" or "http"
	ModelPath   string `yaml:"model_path"`    // ONNX model file path (for minilm)
	VocabPath   string `yaml:"vocab_path"`    // vocab.txt path (for minilm)
	RuntimePath string `yaml:"runtime_path"`  // ONNX Runtime library path
	HTTPURL     string `yaml:"http_url"`      // base URL (for http backend)
	HTTPKeyEnv  string `yaml:"http_key_env"`  // env var for API key (for http backend)
	HTTPModel   string `yaml:"http_model"`    // model name (for http backend)
}

// LoggingConfig holds logging settings.
type LoggingConfig struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
}

// DefaultConfig returns a config with sensible defaults.
func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Host: "0.0.0.0",
			Port: 8080,
		},
		Weights: WeightsConfig{
			Path: "./weights",
		},
		Embeddings: EmbeddingsConfig{
			Backend: "minilm",
		},
		Routing: RoutingConfig{
			CostWeight:     0.0,
			SoftAssignment: true,
		},
		Logging: LoggingConfig{
			Level:  "info",
			Format: "text",
		},
		ClickHouse: clickhouse.DefaultConfig(),
	}
}

// LoadConfig reads a YAML config file. Missing fields use defaults.
func LoadConfig(path string) (*Config, error) {
	cfg := DefaultConfig()

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %s: %w", path, err)
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config %s: %w", path, err)
	}

	return cfg, nil
}

// ApplyEnvOverrides overrides config values with environment variables. Reads
// OPENTRACY_* first and falls back to LUNAR_* (with a one-time warning) so
// existing deployments keep working across the rebrand.
func (c *Config) ApplyEnvOverrides() {
	if v := envfallback.Get("HOST"); v != "" {
		c.Server.Host = v
	}
	if v := envfallback.Get("PORT"); v != "" {
		var port int
		if _, err := fmt.Sscanf(v, "%d", &port); err == nil {
			c.Server.Port = port
		}
	}
	if v := envfallback.Get("WEIGHTS_PATH"); v != "" {
		c.Weights.Path = v
	}
	if v := envfallback.Get("LOG_LEVEL"); v != "" {
		c.Logging.Level = v
	}
	c.ClickHouse.ApplyEnvOverrides()
}
