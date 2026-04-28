package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/OpenTracy/opentracy/go/internal/config"
	"github.com/OpenTracy/opentracy/go/internal/embeddings"
	"github.com/OpenTracy/opentracy/go/internal/envfallback"
	"github.com/OpenTracy/opentracy/go/internal/provider"
	"github.com/OpenTracy/opentracy/go/internal/router"
	"github.com/OpenTracy/opentracy/go/internal/server"
	"github.com/OpenTracy/opentracy/go/internal/weights"
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
		gateway     bool
	)

	flag.StringVar(&configPath, "config", "", "path to config file (YAML)")
	flag.StringVar(&weightsPath, "weights", "", "path to weights directory")
	flag.IntVar(&port, "port", 0, "server port (overrides config)")
	flag.StringVar(&host, "host", "", "server host (overrides config)")
	flag.BoolVar(&showVersion, "version", false, "show version")
	flag.BoolVar(&noEmbedder, "no-embedder", false, "disable embedder (embedding-only mode)")
	flag.BoolVar(&gateway, "gateway", false, "gateway-only mode: proxy to providers without semantic routing (no weights needed)")
	flag.Parse()

	if showVersion {
		fmt.Printf("opentracy-engine %s\n", version)
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

	// Initialize providers
	providers := provider.NewRegistry(provider.DefaultProviders())
	loadSecretsFile(providers)
	log.Printf("Providers: %v (configured: %v)", providers.ProviderNames(), providers.ConfiguredProviders())

	var r *router.Router
	var reg *weights.Registry

	if gateway {
		// Gateway mode: proxy-only, no semantic routing
		log.Println("Starting in gateway mode (no weights, no semantic routing)")
		r = router.NewEmpty()
		reg = weights.NewRegistry()
	} else {
		// Full mode: load weights for semantic routing
		log.Printf("Loading weights from: %s", cfg.Weights.Path)
		loaded, err := weights.LoadWeights(cfg.Weights.Path)
		if err != nil {
			log.Printf("WARNING: failed to load weights: %v", err)
			log.Printf("Falling back to gateway mode (proxy-only, no semantic routing).")
			log.Printf("To enable routing, mount a valid weights directory and pass --weights <path>.")
			r = router.NewEmpty()
			reg = weights.NewRegistry()
		} else {
			log.Printf("Loaded %d models, %d clusters",
				loaded.Registry.Len(),
				loaded.ClusterAssigner.NumClusters())

			r = router.New(
				loaded.ClusterAssigner,
				loaded.Registry,
				cfg.Routing.CostWeight,
				cfg.Routing.SoftAssignment,
				cfg.Routing.AllowedModels,
			)
			reg = loaded.Registry

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
		}
	}

	// Start server
	srv := server.New(r, reg, providers, cfg)
	if err := srv.Run(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// loadSecretsFile reads API keys from ~/.opentracy/secrets.json (written by the UI/Python API)
// and injects them into the provider registry.
func loadSecretsFile(providers *provider.Registry) {
	secretsPath := envfallback.Get("SECRETS_FILE")
	if secretsPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return
		}
		secretsPath = filepath.Join(home, ".opentracy", "secrets.json")
	}

	data, err := os.ReadFile(secretsPath)
	if err != nil {
		return // file doesn't exist yet, that's fine
	}

	var secrets map[string]string
	if err := json.Unmarshal(data, &secrets); err != nil {
		log.Printf("WARNING: could not parse %s: %v", secretsPath, err)
		return
	}

	loaded := 0
	for providerName, apiKey := range secrets {
		if apiKey == "" {
			continue
		}
		if err := providers.SetProviderKey(providerName, apiKey); err == nil {
			loaded++
		}
	}
	if loaded > 0 {
		log.Printf("Loaded %d API keys from %s", loaded, secretsPath)
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
