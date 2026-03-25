package provider

// ModelPricing holds per-million token pricing for a model.
type ModelPricing struct {
	InputPerMillion  float64 // USD per 1M input tokens
	OutputPerMillion float64 // USD per 1M output tokens
	CacheInputPerMillion float64 // USD per 1M cached input tokens (if applicable)
}

// ComputeCost calculates the total cost for a request.
func (p *ModelPricing) ComputeCost(inputTokens, outputTokens int) (inputCost, outputCost, totalCost float64) {
	inputCost = float64(inputTokens) / 1_000_000.0 * p.InputPerMillion
	outputCost = float64(outputTokens) / 1_000_000.0 * p.OutputPerMillion
	totalCost = inputCost + outputCost
	return
}

// PricingTable maps model names/prefixes to their pricing.
// Prices as of March 2026.
var PricingTable = map[string]ModelPricing{
	// OpenAI
	"gpt-4o":                {InputPerMillion: 2.50, OutputPerMillion: 10.00},
	"gpt-4o-mini":           {InputPerMillion: 0.15, OutputPerMillion: 0.60},
	"gpt-4-turbo":           {InputPerMillion: 10.00, OutputPerMillion: 30.00},
	"gpt-4":                 {InputPerMillion: 30.00, OutputPerMillion: 60.00},
	"gpt-3.5-turbo":         {InputPerMillion: 0.50, OutputPerMillion: 1.50},
	"o1":                    {InputPerMillion: 15.00, OutputPerMillion: 60.00},
	"o1-mini":               {InputPerMillion: 3.00, OutputPerMillion: 12.00},
	"o3":                    {InputPerMillion: 10.00, OutputPerMillion: 40.00},
	"o3-mini":               {InputPerMillion: 1.10, OutputPerMillion: 4.40},
	"o4-mini":               {InputPerMillion: 1.10, OutputPerMillion: 4.40},

	// Anthropic
	"claude-opus-4":         {InputPerMillion: 15.00, OutputPerMillion: 75.00},
	"claude-sonnet-4":       {InputPerMillion: 3.00, OutputPerMillion: 15.00},
	"claude-3-5-sonnet":     {InputPerMillion: 3.00, OutputPerMillion: 15.00},
	"claude-3-5-haiku":      {InputPerMillion: 0.80, OutputPerMillion: 4.00},
	"claude-3-opus":         {InputPerMillion: 15.00, OutputPerMillion: 75.00},
	"claude-3-haiku":        {InputPerMillion: 0.25, OutputPerMillion: 1.25},

	// Groq (hosted)
	"llama-3.3-70b":         {InputPerMillion: 0.59, OutputPerMillion: 0.79},
	"llama-3.1-70b":         {InputPerMillion: 0.59, OutputPerMillion: 0.79},
	"llama-3.1-8b":          {InputPerMillion: 0.05, OutputPerMillion: 0.08},
	"mixtral-8x7b":          {InputPerMillion: 0.24, OutputPerMillion: 0.24},
	"gemma-7b":              {InputPerMillion: 0.07, OutputPerMillion: 0.07},

	// Mistral
	"mistral-large":         {InputPerMillion: 2.00, OutputPerMillion: 6.00},
	"mistral-small":         {InputPerMillion: 0.10, OutputPerMillion: 0.30},
	"ministral-8b":          {InputPerMillion: 0.10, OutputPerMillion: 0.10},
	"ministral-3b":          {InputPerMillion: 0.04, OutputPerMillion: 0.04},
	"codestral":             {InputPerMillion: 0.30, OutputPerMillion: 0.90},
	"pixtral-12b":           {InputPerMillion: 0.15, OutputPerMillion: 0.15},

	// DeepSeek
	"deepseek-chat":         {InputPerMillion: 0.14, OutputPerMillion: 0.28},
	"deepseek-coder":        {InputPerMillion: 0.14, OutputPerMillion: 0.28},
	"deepseek-reasoner":     {InputPerMillion: 0.55, OutputPerMillion: 2.19},
}

// GetPricing returns pricing for a model, matching by prefix.
// Returns nil if no pricing found.
func GetPricing(model string) *ModelPricing {
	// Exact match first
	if p, ok := PricingTable[model]; ok {
		return &p
	}

	// Prefix match (e.g., "claude-sonnet-4-20250514" matches "claude-sonnet-4")
	bestMatch := ""
	for prefix := range PricingTable {
		if len(prefix) > len(bestMatch) && len(model) >= len(prefix) && model[:len(prefix)] == prefix {
			bestMatch = prefix
		}
	}

	if bestMatch != "" {
		p := PricingTable[bestMatch]
		return &p
	}

	return nil
}
