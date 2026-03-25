package metrics

import (
	"sort"
	"sync"
	"time"
)

// RequestMetrics captures metrics for a single LLM request.
// Mirrors what LiteLLM and the Python adapters return.
type RequestMetrics struct {
	// Timing
	TTFTMs    float64 `json:"ttft_ms"`    // Time to first token (ms)
	LatencyMs float64 `json:"latency_ms"` // Total request latency (ms)

	// Tokens
	TokensIn    int `json:"tokens_in"`    // Input/prompt tokens
	TokensOut   int `json:"tokens_out"`   // Output/completion tokens
	TotalTokens int `json:"total_tokens"` // tokens_in + tokens_out

	// Cost
	InputCostUSD      float64 `json:"input_cost_usd,omitempty"`
	OutputCostUSD     float64 `json:"output_cost_usd,omitempty"`
	CacheInputCostUSD float64 `json:"cache_input_cost_usd,omitempty"`
	TotalCostUSD      float64 `json:"total_cost_usd,omitempty"`

	// Status
	Error         float64 `json:"error"`                    // 0.0 = success, 1.0 = failure
	ErrorCategory string  `json:"error_category,omitempty"` // AUTH_ERROR, RATE_LIMIT, SERVER_ERROR, etc.
	ErrorMessage  string  `json:"error_message,omitempty"`

	// Context
	RequestID string `json:"request_id,omitempty"`
	Provider  string `json:"provider,omitempty"`
	Model     string `json:"model,omitempty"`
	Timestamp int64  `json:"timestamp"` // Unix ms

	// Routing
	SelectedModel string  `json:"selected_model,omitempty"`
	ClusterID     int     `json:"cluster_id,omitempty"`
	RoutingMs     float64 `json:"routing_ms,omitempty"` // Time spent on routing decision
	EmbeddingMs   float64 `json:"embedding_ms,omitempty"` // Time spent generating embedding

	// Streaming
	Stream bool `json:"stream,omitempty"`

	// Fallback
	FallbackCount    int               `json:"fallback_count,omitempty"`
	ProviderAttempts []ProviderAttempt  `json:"provider_attempts,omitempty"`
}

// ProviderAttempt records a single provider attempt in a fallback chain.
type ProviderAttempt struct {
	Provider      string  `json:"provider"`
	Success       bool    `json:"success"`
	ErrorCategory string  `json:"error_category,omitempty"`
	ErrorMessage  string  `json:"error_message,omitempty"`
	LatencyMs     float64 `json:"latency_ms"`
	Timestamp     int64   `json:"timestamp"`
}

// ErrorCategory constants matching the Python ErrorCategory enum.
const (
	ErrCategoryAuth       = "AUTH_ERROR"
	ErrCategoryRateLimit  = "RATE_LIMIT"
	ErrCategoryServer     = "SERVER_ERROR"
	ErrCategoryModel      = "MODEL_ERROR"
	ErrCategoryInvalidReq = "INVALID_REQUEST"
	ErrCategoryDeployment = "DEPLOYMENT_ERROR"
	ErrCategoryTimeout    = "TIMEOUT"
	ErrCategoryNetwork    = "NETWORK_ERROR"
	ErrCategoryUnknown    = "UNKNOWN"
)

// EstimateTokensIn estimates input tokens from text using word count heuristic (1.25x).
func EstimateTokensIn(text string) int {
	words := countWords(text)
	return int(float64(words) * 1.25)
}

// EstimateTokensOut estimates output tokens from text using word count heuristic (1.3x).
func EstimateTokensOut(text string) int {
	words := countWords(text)
	return int(float64(words) * 1.3)
}

func countWords(text string) int {
	if text == "" {
		return 0
	}
	count := 0
	inWord := false
	for _, r := range text {
		if r == ' ' || r == '\n' || r == '\t' || r == '\r' {
			inWord = false
		} else if !inWord {
			inWord = true
			count++
		}
	}
	return count
}

// Collector aggregates request metrics and computes summaries.
// Thread-safe.
type Collector struct {
	mu       sync.RWMutex
	requests []RequestMetrics
	maxSize  int

	// Aggregated counters (fast path for common queries)
	totalRequests int64
	totalErrors   int64
	totalTokensIn int64
	totalTokensOut int64
	totalCostUSD  float64

	// Per-provider aggregates
	providerStats map[string]*ProviderStats

	// Per-model aggregates
	modelStats map[string]*ModelStats
}

// ProviderStats holds aggregated stats for a single provider.
type ProviderStats struct {
	Requests     int64   `json:"requests"`
	Errors       int64   `json:"errors"`
	TotalTokens  int64   `json:"total_tokens"`
	TotalCostUSD float64 `json:"total_cost_usd"`
	latencies    []float64
	ttfts        []float64
	errorTypes   map[string]int
}

// ModelStats holds aggregated stats for a single model.
type ModelStats struct {
	Requests     int64   `json:"requests"`
	Errors       int64   `json:"errors"`
	TotalTokens  int64   `json:"total_tokens"`
	TotalCostUSD float64 `json:"total_cost_usd"`
	latencies    []float64
}

// NewCollector creates a new metrics collector.
// maxSize limits the number of raw requests kept in memory (ring buffer).
func NewCollector(maxSize int) *Collector {
	return &Collector{
		requests:      make([]RequestMetrics, 0, maxSize),
		maxSize:       maxSize,
		providerStats: make(map[string]*ProviderStats),
		modelStats:    make(map[string]*ModelStats),
	}
}

// Record adds a request's metrics to the collector.
func (c *Collector) Record(m RequestMetrics) {
	if m.Timestamp == 0 {
		m.Timestamp = time.Now().UnixMilli()
	}
	if m.TotalTokens == 0 {
		m.TotalTokens = m.TokensIn + m.TokensOut
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	// Ring buffer for raw requests
	if len(c.requests) >= c.maxSize {
		c.requests = c.requests[1:]
	}
	c.requests = append(c.requests, m)

	// Update counters
	c.totalRequests++
	c.totalTokensIn += int64(m.TokensIn)
	c.totalTokensOut += int64(m.TokensOut)
	c.totalCostUSD += m.TotalCostUSD
	if m.Error > 0 {
		c.totalErrors++
	}

	// Provider stats
	if m.Provider != "" {
		ps, ok := c.providerStats[m.Provider]
		if !ok {
			ps = &ProviderStats{errorTypes: make(map[string]int)}
			c.providerStats[m.Provider] = ps
		}
		ps.Requests++
		ps.TotalTokens += int64(m.TotalTokens)
		ps.TotalCostUSD += m.TotalCostUSD
		ps.latencies = append(ps.latencies, m.LatencyMs)
		if m.TTFTMs > 0 {
			ps.ttfts = append(ps.ttfts, m.TTFTMs)
		}
		if m.Error > 0 {
			ps.Errors++
			if m.ErrorCategory != "" {
				ps.errorTypes[m.ErrorCategory]++
			}
		}
	}

	// Model stats
	model := m.Model
	if model == "" {
		model = m.SelectedModel
	}
	if model != "" {
		ms, ok := c.modelStats[model]
		if !ok {
			ms = &ModelStats{}
			c.modelStats[model] = ms
		}
		ms.Requests++
		ms.TotalTokens += int64(m.TotalTokens)
		ms.TotalCostUSD += m.TotalCostUSD
		ms.latencies = append(ms.latencies, m.LatencyMs)
		if m.Error > 0 {
			ms.Errors++
		}
	}
}

// Summary returns an aggregated summary of all collected metrics.
type Summary struct {
	TotalRequests  int64   `json:"total_requests"`
	TotalErrors    int64   `json:"total_errors"`
	ErrorRate      float64 `json:"error_rate"`
	TotalTokensIn  int64   `json:"total_tokens_in"`
	TotalTokensOut int64   `json:"total_tokens_out"`
	TotalTokens    int64   `json:"total_tokens"`
	TotalCostUSD   float64 `json:"total_cost_usd"`

	// Latency percentiles (from recent requests)
	P50LatencyMs float64 `json:"p50_latency_ms"`
	P95LatencyMs float64 `json:"p95_latency_ms"`
	P99LatencyMs float64 `json:"p99_latency_ms"`

	// TTFT percentiles
	P50TTFTMs float64 `json:"p50_ttft_ms"`
	P95TTFTMs float64 `json:"p95_ttft_ms"`

	// Breakdowns
	ByProvider map[string]*ProviderSummary `json:"by_provider"`
	ByModel    map[string]*ModelSummary    `json:"by_model"`
}

// ProviderSummary is the per-provider breakdown.
type ProviderSummary struct {
	Requests     int64            `json:"requests"`
	Errors       int64            `json:"errors"`
	ErrorRate    float64          `json:"error_rate"`
	TotalTokens  int64            `json:"total_tokens"`
	TotalCostUSD float64          `json:"total_cost_usd"`
	P50LatencyMs float64          `json:"p50_latency_ms"`
	P95LatencyMs float64          `json:"p95_latency_ms"`
	P50TTFTMs    float64          `json:"p50_ttft_ms"`
	ErrorTypes   map[string]int   `json:"error_types,omitempty"`
}

// ModelSummary is the per-model breakdown.
type ModelSummary struct {
	Requests     int64   `json:"requests"`
	Errors       int64   `json:"errors"`
	ErrorRate    float64 `json:"error_rate"`
	TotalTokens  int64   `json:"total_tokens"`
	TotalCostUSD float64 `json:"total_cost_usd"`
	P50LatencyMs float64 `json:"p50_latency_ms"`
	P95LatencyMs float64 `json:"p95_latency_ms"`
}

// Summary computes an aggregated summary of all metrics.
func (c *Collector) Summary() *Summary {
	c.mu.RLock()
	defer c.mu.RUnlock()

	s := &Summary{
		TotalRequests:  c.totalRequests,
		TotalErrors:    c.totalErrors,
		TotalTokensIn:  c.totalTokensIn,
		TotalTokensOut: c.totalTokensOut,
		TotalTokens:    c.totalTokensIn + c.totalTokensOut,
		TotalCostUSD:   c.totalCostUSD,
		ByProvider:     make(map[string]*ProviderSummary),
		ByModel:        make(map[string]*ModelSummary),
	}

	if s.TotalRequests > 0 {
		s.ErrorRate = float64(s.TotalErrors) / float64(s.TotalRequests)
	}

	// Overall latency percentiles from recent requests
	var latencies, ttfts []float64
	for _, r := range c.requests {
		latencies = append(latencies, r.LatencyMs)
		if r.TTFTMs > 0 {
			ttfts = append(ttfts, r.TTFTMs)
		}
	}
	s.P50LatencyMs = percentile(latencies, 50)
	s.P95LatencyMs = percentile(latencies, 95)
	s.P99LatencyMs = percentile(latencies, 99)
	s.P50TTFTMs = percentile(ttfts, 50)
	s.P95TTFTMs = percentile(ttfts, 95)

	// Provider breakdowns
	for name, ps := range c.providerStats {
		errorTypes := make(map[string]int, len(ps.errorTypes))
		for k, v := range ps.errorTypes {
			errorTypes[k] = v
		}
		var errRate float64
		if ps.Requests > 0 {
			errRate = float64(ps.Errors) / float64(ps.Requests)
		}
		s.ByProvider[name] = &ProviderSummary{
			Requests:     ps.Requests,
			Errors:       ps.Errors,
			ErrorRate:    errRate,
			TotalTokens:  ps.TotalTokens,
			TotalCostUSD: ps.TotalCostUSD,
			P50LatencyMs: percentile(ps.latencies, 50),
			P95LatencyMs: percentile(ps.latencies, 95),
			P50TTFTMs:    percentile(ps.ttfts, 50),
			ErrorTypes:   errorTypes,
		}
	}

	// Model breakdowns
	for name, ms := range c.modelStats {
		var errRate float64
		if ms.Requests > 0 {
			errRate = float64(ms.Errors) / float64(ms.Requests)
		}
		s.ByModel[name] = &ModelSummary{
			Requests:     ms.Requests,
			Errors:       ms.Errors,
			ErrorRate:    errRate,
			TotalTokens:  ms.TotalTokens,
			TotalCostUSD: ms.TotalCostUSD,
			P50LatencyMs: percentile(ms.latencies, 50),
			P95LatencyMs: percentile(ms.latencies, 95),
		}
	}

	return s
}

// Reset clears all collected metrics.
func (c *Collector) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.requests = c.requests[:0]
	c.totalRequests = 0
	c.totalErrors = 0
	c.totalTokensIn = 0
	c.totalTokensOut = 0
	c.totalCostUSD = 0
	c.providerStats = make(map[string]*ProviderStats)
	c.modelStats = make(map[string]*ModelStats)
}

// RecentRequests returns the last N raw request metrics.
func (c *Collector) RecentRequests(n int) []RequestMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if n > len(c.requests) {
		n = len(c.requests)
	}
	result := make([]RequestMetrics, n)
	copy(result, c.requests[len(c.requests)-n:])
	return result
}

// percentile computes the p-th percentile of a sorted float64 slice.
func percentile(data []float64, p float64) float64 {
	if len(data) == 0 {
		return 0
	}
	sorted := make([]float64, len(data))
	copy(sorted, data)
	sort.Float64s(sorted)

	rank := (p / 100.0) * float64(len(sorted)-1)
	lower := int(rank)
	upper := lower + 1
	if upper >= len(sorted) {
		return sorted[len(sorted)-1]
	}
	frac := rank - float64(lower)
	return sorted[lower]*(1-frac) + sorted[upper]*frac
}
