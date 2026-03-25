package metrics

import (
	"math"
	"testing"
)

const eps = 1e-6

func TestCollectorRecord(t *testing.T) {
	c := NewCollector(100)

	c.Record(RequestMetrics{
		LatencyMs:     100,
		TTFTMs:        20,
		TokensIn:      50,
		TokensOut:     100,
		TotalCostUSD:  0.005,
		Error:         0,
		Provider:      "openai",
		Model:         "gpt-4o",
		SelectedModel: "gpt-4o",
	})

	c.Record(RequestMetrics{
		LatencyMs:     200,
		TTFTMs:        40,
		TokensIn:      30,
		TokensOut:     80,
		TotalCostUSD:  0.003,
		Error:         0,
		Provider:      "openai",
		Model:         "gpt-4o-mini",
		SelectedModel: "gpt-4o-mini",
	})

	c.Record(RequestMetrics{
		LatencyMs:     500,
		TokensIn:      100,
		Error:         1.0,
		ErrorCategory: ErrCategoryRateLimit,
		ErrorMessage:  "rate limit exceeded",
		Provider:      "openai",
		Model:         "gpt-4o",
	})

	s := c.Summary()

	if s.TotalRequests != 3 {
		t.Errorf("TotalRequests = %d, want 3", s.TotalRequests)
	}
	if s.TotalErrors != 1 {
		t.Errorf("TotalErrors = %d, want 1", s.TotalErrors)
	}
	if math.Abs(s.ErrorRate-1.0/3.0) > eps {
		t.Errorf("ErrorRate = %v, want 0.333", s.ErrorRate)
	}
	if s.TotalTokensIn != 180 {
		t.Errorf("TotalTokensIn = %d, want 180", s.TotalTokensIn)
	}
	if s.TotalTokensOut != 180 {
		t.Errorf("TotalTokensOut = %d, want 180", s.TotalTokensOut)
	}
}

func TestCollectorProviderBreakdown(t *testing.T) {
	c := NewCollector(100)

	c.Record(RequestMetrics{LatencyMs: 100, Provider: "openai", Error: 0})
	c.Record(RequestMetrics{LatencyMs: 200, Provider: "openai", Error: 0})
	c.Record(RequestMetrics{LatencyMs: 300, Provider: "anthropic", Error: 0})
	c.Record(RequestMetrics{
		LatencyMs:     500,
		Provider:      "openai",
		Error:         1.0,
		ErrorCategory: ErrCategoryServer,
	})

	s := c.Summary()

	openai := s.ByProvider["openai"]
	if openai == nil {
		t.Fatal("missing openai provider stats")
	}
	if openai.Requests != 3 {
		t.Errorf("openai requests = %d, want 3", openai.Requests)
	}
	if openai.Errors != 1 {
		t.Errorf("openai errors = %d, want 1", openai.Errors)
	}
	if openai.ErrorTypes[ErrCategoryServer] != 1 {
		t.Errorf("openai SERVER_ERROR count = %d, want 1", openai.ErrorTypes[ErrCategoryServer])
	}

	anthropic := s.ByProvider["anthropic"]
	if anthropic == nil {
		t.Fatal("missing anthropic provider stats")
	}
	if anthropic.Requests != 1 {
		t.Errorf("anthropic requests = %d, want 1", anthropic.Requests)
	}
}

func TestCollectorModelBreakdown(t *testing.T) {
	c := NewCollector(100)

	c.Record(RequestMetrics{LatencyMs: 100, Model: "gpt-4o", TokensIn: 50, TokensOut: 100})
	c.Record(RequestMetrics{LatencyMs: 200, Model: "gpt-4o", TokensIn: 60, TokensOut: 120})
	c.Record(RequestMetrics{LatencyMs: 50, Model: "gpt-4o-mini", TokensIn: 30, TokensOut: 80})

	s := c.Summary()

	gpt4o := s.ByModel["gpt-4o"]
	if gpt4o == nil {
		t.Fatal("missing gpt-4o model stats")
	}
	if gpt4o.Requests != 2 {
		t.Errorf("gpt-4o requests = %d, want 2", gpt4o.Requests)
	}
	if gpt4o.TotalTokens != 330 {
		t.Errorf("gpt-4o total_tokens = %d, want 330", gpt4o.TotalTokens)
	}
}

func TestCollectorPercentiles(t *testing.T) {
	c := NewCollector(1000)

	// Add 100 requests with latencies 1..100
	for i := 1; i <= 100; i++ {
		c.Record(RequestMetrics{
			LatencyMs: float64(i),
			TTFTMs:    float64(i) * 0.2,
		})
	}

	s := c.Summary()

	if math.Abs(s.P50LatencyMs-50.5) > 1.0 {
		t.Errorf("P50 latency = %v, want ~50.5", s.P50LatencyMs)
	}
	if s.P95LatencyMs < 90 || s.P95LatencyMs > 100 {
		t.Errorf("P95 latency = %v, want ~95", s.P95LatencyMs)
	}
	if s.P99LatencyMs < 95 {
		t.Errorf("P99 latency = %v, want ~99", s.P99LatencyMs)
	}
	if s.P50TTFTMs < 9 || s.P50TTFTMs > 11 {
		t.Errorf("P50 TTFT = %v, want ~10", s.P50TTFTMs)
	}
}

func TestCollectorRingBuffer(t *testing.T) {
	c := NewCollector(5)

	for i := 0; i < 10; i++ {
		c.Record(RequestMetrics{LatencyMs: float64(i)})
	}

	recent := c.RecentRequests(10)
	if len(recent) != 5 {
		t.Errorf("recent requests = %d, want 5 (ring buffer)", len(recent))
	}
	// Should have requests 5..9
	if recent[0].LatencyMs != 5 {
		t.Errorf("oldest recent = %v, want 5", recent[0].LatencyMs)
	}

	// Total requests should still be 10 (counter not limited)
	s := c.Summary()
	if s.TotalRequests != 10 {
		t.Errorf("total requests = %d, want 10", s.TotalRequests)
	}
}

func TestCollectorReset(t *testing.T) {
	c := NewCollector(100)
	c.Record(RequestMetrics{LatencyMs: 100, Provider: "openai", Model: "gpt-4o"})

	c.Reset()

	s := c.Summary()
	if s.TotalRequests != 0 {
		t.Errorf("after reset: total = %d, want 0", s.TotalRequests)
	}
	if len(s.ByProvider) != 0 {
		t.Errorf("after reset: providers = %d, want 0", len(s.ByProvider))
	}
}

func TestEstimateTokens(t *testing.T) {
	text := "Hello world this is a test"
	tokIn := EstimateTokensIn(text)
	tokOut := EstimateTokensOut(text)

	// 6 words * 1.25 = 7.5 -> 7
	if tokIn < 7 || tokIn > 8 {
		t.Errorf("EstimateTokensIn = %d, want ~7", tokIn)
	}
	// 6 words * 1.3 = 7.8 -> 7
	if tokOut < 7 || tokOut > 8 {
		t.Errorf("EstimateTokensOut = %d, want ~7", tokOut)
	}

	if EstimateTokensIn("") != 0 {
		t.Error("empty string should estimate 0 tokens")
	}
}

func TestCollectorTotalTokensAutoCompute(t *testing.T) {
	c := NewCollector(100)
	c.Record(RequestMetrics{TokensIn: 50, TokensOut: 100})

	recent := c.RecentRequests(1)
	if recent[0].TotalTokens != 150 {
		t.Errorf("TotalTokens = %d, want 150 (auto-computed)", recent[0].TotalTokens)
	}
}
