package provider

import (
	"fmt"
	"strings"
)

// DefaultProviders returns the built-in provider configurations.
// API keys are read from environment variables at runtime.
func DefaultProviders() []ProviderConfig {
	return []ProviderConfig{
		{Name: "openai", BaseURL: "https://api.openai.com/v1", APIKeyEnv: "OPENAI_API_KEY", Format: "openai"},
		{Name: "anthropic", BaseURL: "https://api.anthropic.com", APIKeyEnv: "ANTHROPIC_API_KEY", Format: "anthropic"},
		{Name: "groq", BaseURL: "https://api.groq.com/openai/v1", APIKeyEnv: "GROQ_API_KEY", Format: "openai"},
		{Name: "mistral", BaseURL: "https://api.mistral.ai/v1", APIKeyEnv: "MISTRAL_API_KEY", Format: "openai"},
		{Name: "deepseek", BaseURL: "https://api.deepseek.com/v1", APIKeyEnv: "DEEPSEEK_API_KEY", Format: "openai"},
		{Name: "perplexity", BaseURL: "https://api.perplexity.ai", APIKeyEnv: "PERPLEXITY_API_KEY", Format: "openai"},
		{Name: "cerebras", BaseURL: "https://api.cerebras.ai/v1", APIKeyEnv: "CEREBRAS_API_KEY", Format: "openai"},
		{Name: "sambanova", BaseURL: "https://api.sambanova.ai/v1", APIKeyEnv: "SAMBANOVA_API_KEY", Format: "openai"},
		{Name: "together", BaseURL: "https://api.together.xyz/v1", APIKeyEnv: "TOGETHER_API_KEY", Format: "openai"},
		{Name: "fireworks", BaseURL: "https://api.fireworks.ai/inference/v1", APIKeyEnv: "FIREWORKS_API_KEY", Format: "openai"},
	}
}

// ModelProviderMap maps model prefixes/names to provider names.
var ModelProviderMap = map[string]string{
	// OpenAI
	"gpt-4":      "openai",
	"gpt-3.5":    "openai",
	"o1":         "openai",
	"o3":         "openai",
	"o4":         "openai",

	// Anthropic
	"claude":     "anthropic",

	// Groq
	"llama":      "groq",
	"mixtral":    "groq",
	"gemma":      "groq",

	// Mistral
	"mistral":    "mistral",
	"ministral":  "mistral",
	"codestral":  "mistral",
	"pixtral":    "mistral",

	// DeepSeek
	"deepseek":   "deepseek",
}

// Registry holds provider instances and routes models to providers.
type Registry struct {
	providers map[string]Provider
	// Custom model → provider overrides
	modelOverrides map[string]string
}

// NewRegistry creates a provider registry from configs.
func NewRegistry(configs []ProviderConfig) *Registry {
	r := &Registry{
		providers:      make(map[string]Provider),
		modelOverrides: make(map[string]string),
	}

	for _, cfg := range configs {
		var p Provider
		switch cfg.Format {
		case "anthropic":
			p = NewAnthropicProvider(cfg)
		default:
			p = NewOpenAIProvider(cfg)
		}
		r.providers[cfg.Name] = p
	}

	return r
}

// Get returns a provider by name.
func (r *Registry) Get(name string) Provider {
	return r.providers[name]
}

// SetModelProvider explicitly maps a model to a provider.
func (r *Registry) SetModelProvider(model, providerName string) {
	r.modelOverrides[model] = providerName
}

// ForModel finds the provider for a given model name.
// Checks: 1) explicit overrides, 2) prefix matching.
func (r *Registry) ForModel(model string) (Provider, error) {
	// Check explicit overrides
	if pName, ok := r.modelOverrides[model]; ok {
		if p, ok := r.providers[pName]; ok {
			return p, nil
		}
	}

	// Check prefix map
	for prefix, pName := range ModelProviderMap {
		if strings.HasPrefix(model, prefix) {
			if p, ok := r.providers[pName]; ok {
				return p, nil
			}
			return nil, fmt.Errorf("provider %q for model %q not configured", pName, model)
		}
	}

	return nil, fmt.Errorf("no provider found for model %q", model)
}

// ProviderNames returns all registered provider names.
func (r *Registry) ProviderNames() []string {
	names := make([]string, 0, len(r.providers))
	for name := range r.providers {
		names = append(names, name)
	}
	return names
}
