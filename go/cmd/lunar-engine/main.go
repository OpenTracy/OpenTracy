package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/lunar-org-ai/lunar-router/go/internal/config"
	"github.com/lunar-org-ai/lunar-router/go/internal/embeddings"
	"github.com/lunar-org-ai/lunar-router/go/internal/provider"
	"github.com/lunar-org-ai/lunar-router/go/internal/router"
	"github.com/lunar-org-ai/lunar-router/go/internal/server"
	"github.com/lunar-org-ai/lunar-router/go/internal/weights"
)

var version = "dev"

func main() {
	var (
		configPath  string
		weightsPath string
		port        int
		host        string
		showVersion bool
		noEmbedder  bool
	)

	flag.StringVar(&configPath, "config", "", "path to config file (YAML)")
	flag.StringVar(&weightsPath, "weights", "", "path to weights directory")
	flag.IntVar(&port, "port", 0, "server port (overrides config)")
	flag.StringVar(&host, "host", "", "server host (overrides config)")
	flag.BoolVar(&showVersion, "version", false, "show version")
	flag.BoolVar(&noEmbedder, "no-embedder", false, "disable embedder (embedding-only mode)")
	flag.Parse()

	if showVersion {
		fmt.Printf("lunar-engine %s\n", version)
		os.Exit(0)
	}

	// Load config
	cfg := config.DefaultConfig()
	if configPath != "" {
		var err error
		cfg, err = config.LoadConfig(configPath)
		if err != nil {
			log.Fatalf("failed to load config: %v", err)
		}
	}
	cfg.ApplyEnvOverrides()

	// CLI flags override config
	if weightsPath != "" {
		cfg.Weights.Path = weightsPath
	}
	if port != 0 {
		cfg.Server.Port = port
	}
	if host != "" {
		cfg.Server.Host = host
	}

	// Load weights
	log.Printf("Loading weights from: %s", cfg.Weights.Path)
	loaded, err := weights.LoadWeights(cfg.Weights.Path)
	if err != nil {
		log.Fatalf("failed to load weights: %v", err)
	}
	log.Printf("Loaded %d models, %d clusters",
		loaded.Registry.Len(),
		loaded.ClusterAssigner.NumClusters())

	// Create router
	r := router.New(
		loaded.ClusterAssigner,
		loaded.Registry,
		cfg.Routing.CostWeight,
		cfg.Routing.SoftAssignment,
		cfg.Routing.AllowedModels,
	)

	// Initialize embedder
	if !noEmbedder {
		embedder, err := initEmbedder(cfg)
		if err != nil {
			log.Printf("WARNING: embedder init failed: %v", err)
			log.Printf("Prompt-based routing disabled. Use --no-embedder to suppress this warning.")
		} else {
			r.Embedder = embedder
			log.Printf("Embedder initialized: %s (dim=%d)", cfg.Embeddings.Backend, embedder.Dimension())
		}
	}

	// Initialize providers
	providers := provider.NewRegistry(provider.DefaultProviders())
	log.Printf("Providers: %v", providers.ProviderNames())

	// Start server
	srv := server.New(r, loaded.Registry, providers, cfg.Server.Host, cfg.Server.Port)
	if err := srv.Run(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func initEmbedder(cfg *config.Config) (embeddings.Embedder, error) {
	switch cfg.Embeddings.Backend {
	case "minilm", "":
		modelPath := cfg.Embeddings.ModelPath
		vocabPath := cfg.Embeddings.VocabPath

		// Default paths relative to weights dir
		if modelPath == "" {
			modelPath = filepath.Join(cfg.Weights.Path, "onnx", "model.onnx")
		}
		if vocabPath == "" {
			vocabPath = filepath.Join(cfg.Weights.Path, "onnx", "vocab.txt")
		}

		return embeddings.NewMiniLMEmbedder(modelPath, vocabPath, cfg.Embeddings.RuntimePath)

	case "http":
		if cfg.Embeddings.HTTPURL == "" {
			return nil, fmt.Errorf("embeddings.http_url is required for http backend")
		}
		dim := 384 // default
		return embeddings.NewHTTPEmbedder(
			cfg.Embeddings.HTTPURL,
			cfg.Embeddings.HTTPKeyEnv,
			cfg.Embeddings.HTTPModel,
			dim,
		), nil

	default:
		return nil, fmt.Errorf("unknown embeddings backend: %q", cfg.Embeddings.Backend)
	}
}
