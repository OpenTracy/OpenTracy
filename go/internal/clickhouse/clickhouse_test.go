package clickhouse

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/lunar-org-ai/lunar-router/go/internal/metrics"
)

// Integration test — requires a running ClickHouse on localhost:9000.
// Run with: LUNAR_CH_ENABLED=true LUNAR_CH_PASSWORD=lunar go test -v -run TestIntegration ./internal/clickhouse/

func testConfig() Config {
	cfg := DefaultConfig()
	cfg.Enabled = true
	cfg.Password = "lunar"
	cfg.BatchSize = 10
	cfg.FlushInterval = 500 * time.Millisecond
	cfg.ApplyEnvOverrides()
	return cfg
}

func skipIfNoCH(t *testing.T) Config {
	t.Helper()
	cfg := testConfig()
	if !cfg.Enabled {
		t.Skip("LUNAR_CH_ENABLED not set — skipping ClickHouse integration test")
	}
	// Quick connectivity check
	conn, err := openConn(cfg)
	if err != nil {
		t.Skipf("Cannot connect to ClickHouse: %v", err)
	}
	conn.Close()
	return cfg
}

func TestIntegrationMigrations(t *testing.T) {
	cfg := skipIfNoCH(t)

	err := RunMigrationsFromConfig(cfg)
	if err != nil {
		t.Fatalf("RunMigrations failed: %v", err)
	}

	// Verify tables exist
	conn, _ := openConn(cfg)
	defer conn.Close()

	for _, table := range []string{"llm_traces", "model_hourly_stats", "cluster_daily_stats"} {
		result, err := conn.Query(
			t.Context(),
			fmt.Sprintf("SELECT count() FROM %s", table),
		)
		if err != nil {
			t.Fatalf("Query %s failed: %v", table, err)
		}
		result.Close()
		t.Logf("Table %s exists and is queryable", table)
	}
}

func TestIntegrationWriterPersistence(t *testing.T) {
	cfg := skipIfNoCH(t)

	// Run migrations first
	if err := RunMigrationsFromConfig(cfg); err != nil {
		t.Fatalf("Migrations failed: %v", err)
	}

	// Clear previous test data
	conn, _ := openConn(cfg)
	conn.Exec(t.Context(), "TRUNCATE TABLE llm_traces")
	conn.Close()

	// Create writer
	w, err := NewWriter(cfg)
	if err != nil {
		t.Fatalf("NewWriter failed: %v", err)
	}

	// Send 25 trace rows with varied data
	models := []string{"gpt-4o", "gpt-4o-mini", "mistral-large-latest", "claude-3-sonnet", "gpt-3.5-turbo"}
	for i := 0; i < 25; i++ {
		m := metrics.RequestMetrics{
			LatencyMs:     float64(100 + i*10),
			TTFTMs:        float64(20 + i*2),
			RoutingMs:     float64(1 + i),
			EmbeddingMs:   float64(5 + i),
			TokensIn:      100 + i*10,
			TokensOut:     50 + i*5,
			TotalTokens:   150 + i*15,
			InputCostUSD:  0.001 * float64(i+1),
			OutputCostUSD: 0.002 * float64(i+1),
			TotalCostUSD:  0.003 * float64(i+1),
			Error:         0,
			Provider:      "openai",
			Model:         models[i%len(models)],
			SelectedModel: models[i%len(models)],
			ClusterID:     i % 10,
			Stream:        i%3 == 0,
			Timestamp:     time.Now().UnixMilli(),
		}

		// Make some errors
		if i%7 == 0 {
			m.Error = 1.0
			m.ErrorCategory = metrics.ErrCategoryRateLimit
			m.ErrorMessage = "rate limit exceeded"
		}

		extra := TraceExtra{
			RequestType:       "chat",
			CacheHit:          i%4 == 0,
			ExpectedError:     0.05 + float64(i)*0.01,
			CostAdjustedScore: 0.1 + float64(i)*0.02,
			AllScores: map[string]float64{
				"gpt-4o":      0.1,
				"gpt-4o-mini": 0.2,
			},
		}

		w.Record(m, extra)
	}

	// Wait for flush (batch=10, so 2 full batches + 5 remaining flushed by timer)
	time.Sleep(2 * time.Second)

	// Check writer stats
	written, dropped, flushErrors := w.Stats()
	t.Logf("Writer stats: written=%d, dropped=%d, flushErrors=%d", written, dropped, flushErrors)

	if written != 25 {
		t.Errorf("Expected 25 written, got %d", written)
	}
	if dropped != 0 {
		t.Errorf("Expected 0 dropped, got %d", dropped)
	}
	if flushErrors != 0 {
		t.Errorf("Expected 0 flushErrors, got %d", flushErrors)
	}

	// Query ClickHouse to verify persistence
	conn2, _ := openConn(cfg)
	defer conn2.Close()

	// Total count
	var totalCount uint64
	row := conn2.QueryRow(t.Context(), "SELECT count() FROM llm_traces")
	if err := row.Scan(&totalCount); err != nil {
		t.Fatalf("Count query failed: %v", err)
	}
	t.Logf("Total rows in llm_traces: %d", totalCount)
	if totalCount != 25 {
		t.Errorf("Expected 25 rows, got %d", totalCount)
	}

	// Count by model
	rows, err := conn2.Query(t.Context(),
		"SELECT selected_model, count() AS cnt FROM llm_traces GROUP BY selected_model ORDER BY cnt DESC")
	if err != nil {
		t.Fatalf("Group by query failed: %v", err)
	}
	defer rows.Close()

	t.Log("--- Traces by model ---")
	for rows.Next() {
		var model string
		var cnt uint64
		if err := rows.Scan(&model, &cnt); err != nil {
			t.Fatalf("Scan failed: %v", err)
		}
		t.Logf("  %s: %d traces", model, cnt)
	}

	// Check error traces
	var errorCount uint64
	row = conn2.QueryRow(t.Context(), "SELECT count() FROM llm_traces WHERE is_error = 1")
	if err := row.Scan(&errorCount); err != nil {
		t.Fatalf("Error count query failed: %v", err)
	}
	t.Logf("Error traces: %d", errorCount)
	if errorCount == 0 {
		t.Error("Expected some error traces")
	}

	// Check latency stats
	var avgLat, p95Lat float64
	row = conn2.QueryRow(t.Context(),
		"SELECT avg(latency_ms), quantile(0.95)(latency_ms) FROM llm_traces")
	if err := row.Scan(&avgLat, &p95Lat); err != nil {
		t.Fatalf("Latency query failed: %v", err)
	}
	t.Logf("Avg latency: %.1fms, P95 latency: %.1fms", avgLat, p95Lat)

	// Check cost aggregation
	var totalCost float64
	row = conn2.QueryRow(t.Context(), "SELECT sum(total_cost_usd) FROM llm_traces")
	if err := row.Scan(&totalCost); err != nil {
		t.Fatalf("Cost query failed: %v", err)
	}
	t.Logf("Total cost: $%.4f", totalCost)
	if totalCost <= 0 {
		t.Error("Expected positive total cost")
	}

	// Check JSON fields persisted
	var scoresJSON string
	row = conn2.QueryRow(t.Context(),
		"SELECT all_scores FROM llm_traces WHERE all_scores != '{}' LIMIT 1")
	if err := row.Scan(&scoresJSON); err != nil {
		t.Fatalf("JSON query failed: %v", err)
	}
	t.Logf("Sample all_scores JSON: %s", scoresJSON)
	if scoresJSON == "{}" || scoresJSON == "" {
		t.Error("Expected non-empty all_scores JSON")
	}

	// Check cache_hit column
	var cacheHitCount uint64
	row = conn2.QueryRow(t.Context(), "SELECT count() FROM llm_traces WHERE cache_hit = 1")
	if err := row.Scan(&cacheHitCount); err != nil {
		t.Fatalf("Cache hit query failed: %v", err)
	}
	t.Logf("Cache hit traces: %d", cacheHitCount)

	// Verify materialized view got populated
	var mvCount uint64
	row = conn2.QueryRow(t.Context(), "SELECT count() FROM model_hourly_stats")
	if err := row.Scan(&mvCount); err != nil {
		t.Fatalf("MV count query failed: %v", err)
	}
	t.Logf("model_hourly_stats rows: %d", mvCount)
	if mvCount == 0 {
		t.Error("Expected model_hourly_stats to have data from materialized view")
	}

	// Query the materialized view with merge combinators
	mvRows, err := conn2.Query(t.Context(), `
		SELECT
			selected_model,
			countMerge(request_count) AS requests,
			sumMerge(error_count) AS errors,
			sumMerge(total_cost_usd) AS cost
		FROM model_hourly_stats
		GROUP BY selected_model
		ORDER BY requests DESC
	`)
	if err != nil {
		t.Fatalf("MV query failed: %v", err)
	}
	defer mvRows.Close()

	t.Log("--- Materialized view (model_hourly_stats) ---")
	for mvRows.Next() {
		var model string
		var reqs, errs uint64
		var cost float64
		if err := mvRows.Scan(&model, &reqs, &errs, &cost); err != nil {
			t.Fatalf("MV scan failed: %v", err)
		}
		t.Logf("  %s: %d requests, %d errors, $%.4f cost", model, reqs, errs, cost)
	}

	// Close writer cleanly
	w.Close()
	t.Log("Writer closed successfully")
}

func TestMain(m *testing.M) {
	// Ensure test uses correct env
	if os.Getenv("LUNAR_CH_ENABLED") == "" {
		os.Setenv("LUNAR_CH_ENABLED", "true")
	}
	if os.Getenv("LUNAR_CH_PASSWORD") == "" {
		os.Setenv("LUNAR_CH_PASSWORD", "lunar")
	}
	os.Exit(m.Run())
}
