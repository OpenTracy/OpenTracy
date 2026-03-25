package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/lunar-org-ai/lunar-router/go/internal/metrics"
	"github.com/lunar-org-ai/lunar-router/go/internal/provider"
	"github.com/lunar-org-ai/lunar-router/go/internal/router"
)

func (s *Server) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /v1/models", s.handleListModels)
	mux.HandleFunc("GET /v1/models/{id}", s.handleGetModel)
	mux.HandleFunc("POST /v1/route", s.handleRoute)
	mux.HandleFunc("GET /v1/metrics", s.handleMetrics)
	mux.HandleFunc("GET /v1/metrics/recent", s.handleMetricsRecent)
	mux.HandleFunc("POST /v1/metrics/reset", s.handleMetricsReset)
	mux.HandleFunc("POST /v1/chat/completions", s.handleChatCompletions)
	mux.HandleFunc("GET /v1/cache", s.handleCacheStats)
	mux.HandleFunc("POST /v1/cache/clear", s.handleCacheClear)
	mux.HandleFunc("GET /stats", s.handleStats)
	mux.HandleFunc("POST /stats/reset", s.handleStatsReset)
}

// --- Health ---

type healthResponse struct {
	Status            string `json:"status"`
	RouterInitialized bool   `json:"router_initialized"`
	NumModels         int    `json:"num_models"`
	NumClusters       int    `json:"num_clusters"`
	EmbedderReady     bool   `json:"embedder_ready"`
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	resp := healthResponse{
		Status:            "healthy",
		RouterInitialized: s.Router != nil,
		NumModels:         s.Registry.Len(),
		NumClusters:       s.Router.ClusterAssigner.NumClusters(),
		EmbedderReady:     s.Router.Embedder != nil,
	}
	writeJSON(w, http.StatusOK, resp)
}

// --- Route ---

type routeRequest struct {
	Prompt          string    `json:"prompt,omitempty"`
	Embedding       []float64 `json:"embedding,omitempty"`
	AvailableModels []string  `json:"available_models,omitempty"`
	CostWeight      *float64  `json:"cost_weight,omitempty"`
}

type routeResponse struct {
	*router.RoutingDecision
	CacheHit bool       `json:"cache_hit"`
	Usage    *usageInfo `json:"usage,omitempty"`
}

type usageInfo struct {
	RoutingMs   float64 `json:"routing_ms"`
	EmbeddingMs float64 `json:"embedding_ms,omitempty"`
}

type costInfo struct {
	InputCostUSD  float64 `json:"input_cost_usd"`
	OutputCostUSD float64 `json:"output_cost_usd"`
	TotalCostUSD  float64 `json:"total_cost_usd"`
}

func (s *Server) handleRoute(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req routeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if len(req.Embedding) == 0 && req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "either 'prompt' or 'embedding' is required")
		return
	}

	var opts []router.RouteOption
	if req.AvailableModels != nil {
		opts = append(opts, router.WithAvailableModels(req.AvailableModels))
	}
	if req.CostWeight != nil {
		opts = append(opts, router.WithCostWeight(*req.CostWeight))
	}

	var decision *router.RoutingDecision
	var err error
	var embeddingMs float64

	var cacheHit bool

	if len(req.Embedding) > 0 {
		decision, err = s.Router.RouteEmbedding(req.Embedding, opts...)
	} else {
		hitsBefore := s.Router.Cache().Stats().Hits
		embStart := time.Now()
		decision, err = s.Router.Route(req.Prompt, opts...)
		embeddingMs = float64(time.Since(embStart).Microseconds()) / 1000.0
		cacheHit = s.Router.Cache().Stats().Hits > hitsBefore
	}

	routingMs := float64(time.Since(start).Microseconds()) / 1000.0

	if err != nil {
		// Record failed routing request
		s.Metrics.Record(metrics.RequestMetrics{
			LatencyMs:     routingMs,
			EmbeddingMs:   embeddingMs,
			RoutingMs:     routingMs,
			Error:         1.0,
			ErrorCategory: metrics.ErrCategoryInvalidReq,
			ErrorMessage:  err.Error(),
		})
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Record successful routing request
	tokensIn := 0
	if req.Prompt != "" {
		tokensIn = metrics.EstimateTokensIn(req.Prompt)
	}

	s.Metrics.Record(metrics.RequestMetrics{
		LatencyMs:     routingMs,
		EmbeddingMs:   embeddingMs,
		RoutingMs:     routingMs,
		TokensIn:      tokensIn,
		Error:         0,
		SelectedModel: decision.SelectedModel,
		ClusterID:     decision.ClusterID,
	})

	writeJSON(w, http.StatusOK, routeResponse{
		RoutingDecision: decision,
		CacheHit:        cacheHit,
		Usage: &usageInfo{
			RoutingMs:   routingMs,
			EmbeddingMs: embeddingMs,
		},
	})
}

// --- Models ---

type modelInfo struct {
	ModelID         string  `json:"model_id"`
	CostPer1kTokens float64 `json:"cost_per_1k_tokens"`
	NumClusters     int     `json:"num_clusters"`
	OverallAccuracy float64 `json:"overall_accuracy"`
}

type modelListResponse struct {
	Models       []modelInfo `json:"models"`
	DefaultModel string      `json:"default_model"`
}

func (s *Server) handleListModels(w http.ResponseWriter, r *http.Request) {
	profiles := s.Registry.GetAll()
	models := make([]modelInfo, len(profiles))
	for i, p := range profiles {
		models[i] = modelInfo{
			ModelID:         p.ModelID,
			CostPer1kTokens: p.CostPer1kTokens,
			NumClusters:     p.NumClusters(),
			OverallAccuracy: p.OverallAccuracy(),
		}
	}
	writeJSON(w, http.StatusOK, modelListResponse{
		Models:       models,
		DefaultModel: s.Registry.DefaultModelID(),
	})
}

func (s *Server) handleGetModel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p := s.Registry.Get(id)
	if p == nil {
		writeError(w, http.StatusNotFound, "model not found: "+id)
		return
	}
	writeJSON(w, http.StatusOK, modelInfo{
		ModelID:         p.ModelID,
		CostPer1kTokens: p.CostPer1kTokens,
		NumClusters:     p.NumClusters(),
		OverallAccuracy: p.OverallAccuracy(),
	})
}

// --- Metrics ---

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.Metrics.Summary())
}

func (s *Server) handleMetricsRecent(w http.ResponseWriter, r *http.Request) {
	n := 20
	if v := r.URL.Query().Get("n"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			n = parsed
		}
	}
	writeJSON(w, http.StatusOK, s.Metrics.RecentRequests(n))
}

func (s *Server) handleMetricsReset(w http.ResponseWriter, r *http.Request) {
	s.Metrics.Reset()
	writeJSON(w, http.StatusOK, map[string]string{"message": "metrics reset"})
}

// --- Cache ---

func (s *Server) handleCacheStats(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.Router.Cache().Stats())
}

func (s *Server) handleCacheClear(w http.ResponseWriter, r *http.Request) {
	s.Router.Cache().Clear()
	writeJSON(w, http.StatusOK, map[string]string{"message": "cache cleared"})
}

// --- Stats (legacy, kept for backwards compat) ---

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	snap := s.Router.Stats().Snapshot()
	clusterDist := make(map[string]int, len(snap.ClusterDistributions))
	for k, v := range snap.ClusterDistributions {
		clusterDist[strconv.Itoa(k)] = v
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"total_requests":        snap.TotalRequests,
		"model_selections":      snap.ModelSelections,
		"cluster_distributions": clusterDist,
		"avg_expected_error":    snap.AvgExpectedError,
		"avg_cost_score":        snap.AvgCostScore,
	})
}

func (s *Server) handleStatsReset(w http.ResponseWriter, r *http.Request) {
	s.Router.Stats().Reset()
	s.Router.Cache().Clear()
	s.Metrics.Reset()
	writeJSON(w, http.StatusOK, map[string]string{"message": "statistics reset"})
}

// --- Chat Completions (Gateway / Proxy) ---

func (s *Server) handleChatCompletions(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	// Read raw body (for pass-through)
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	var req provider.ChatRequest
	if err := json.Unmarshal(rawBody, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	req.RawBody = rawBody

	if len(req.Messages) == 0 {
		writeError(w, http.StatusBadRequest, "messages is required")
		return
	}

	selectedModel := req.Model
	var routingMs float64

	// model="auto" → use semantic router to pick best model
	if req.Model == "auto" || req.Model == "" {
		if s.Router == nil || s.Router.Embedder == nil {
			writeError(w, http.StatusBadRequest, "semantic routing not available; specify a model name")
			return
		}

		// Use last user message for routing
		prompt := lastUserMessage(req.Messages)
		routeStart := time.Now()
		decision, err := s.Router.Route(prompt)
		routingMs = float64(time.Since(routeStart).Microseconds()) / 1000.0
		if err != nil {
			writeError(w, http.StatusInternalServerError, "routing failed: "+err.Error())
			return
		}
		selectedModel = decision.SelectedModel
		req.Model = selectedModel

		// Set routing headers
		w.Header().Set("X-Lunar-Selected-Model", selectedModel)
		w.Header().Set("X-Lunar-Cluster-ID", strconv.Itoa(decision.ClusterID))
		w.Header().Set("X-Lunar-Expected-Error", fmt.Sprintf("%.4f", decision.ExpectedError))
		w.Header().Set("X-Lunar-Routing-Ms", fmt.Sprintf("%.2f", routingMs))
	}

	// Find provider for the model
	if s.Providers == nil {
		writeError(w, http.StatusServiceUnavailable, "no providers configured")
		return
	}

	prov, err := s.Providers.ForModel(selectedModel)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Forward request
	if req.Stream {
		s.handleStreamingProxy(w, r, prov, &req, start, routingMs)
	} else {
		s.handleNonStreamingProxy(w, prov, &req, start, routingMs)
	}
}

func (s *Server) handleNonStreamingProxy(
	w http.ResponseWriter,
	prov provider.Provider,
	req *provider.ChatRequest,
	start time.Time,
	routingMs float64,
) {
	ctx := context.Background()
	resp, err := prov.Send(ctx, req)
	latencyMs := float64(time.Since(start).Microseconds()) / 1000.0

	if err != nil {
		s.Metrics.Record(metrics.RequestMetrics{
			LatencyMs:     latencyMs,
			RoutingMs:     routingMs,
			Error:         1.0,
			ErrorCategory: metrics.ErrCategoryServer,
			ErrorMessage:  err.Error(),
			Provider:      prov.Name(),
			Model:         req.Model,
		})
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	// Record metrics with cost
	tokensIn, tokensOut, totalTokens := 0, 0, 0
	if resp.Usage != nil {
		tokensIn = resp.Usage.PromptTokens
		tokensOut = resp.Usage.CompletionTokens
		totalTokens = resp.Usage.TotalTokens
	}

	var inputCost, outputCost, totalCost float64
	pricing := provider.GetPricing(req.Model)
	if pricing != nil {
		inputCost, outputCost, totalCost = pricing.ComputeCost(tokensIn, tokensOut)
	}

	s.Metrics.Record(metrics.RequestMetrics{
		LatencyMs:     latencyMs,
		TTFTMs:        latencyMs,
		RoutingMs:     routingMs,
		TokensIn:      tokensIn,
		TokensOut:     tokensOut,
		TotalTokens:   totalTokens,
		InputCostUSD:  inputCost,
		OutputCostUSD: outputCost,
		TotalCostUSD:  totalCost,
		Error:         0,
		Provider:      prov.Name(),
		Model:         req.Model,
	})

	// Inject cost into response
	type costAwareResponse struct {
		*provider.ChatResponse
		Cost *costInfo `json:"cost,omitempty"`
	}
	var costField *costInfo
	if pricing != nil {
		costField = &costInfo{
			InputCostUSD:  inputCost,
			OutputCostUSD: outputCost,
			TotalCostUSD:  totalCost,
		}
	}

	writeJSON(w, http.StatusOK, costAwareResponse{
		ChatResponse: resp,
		Cost:         costField,
	})
}

func (s *Server) handleStreamingProxy(
	w http.ResponseWriter,
	r *http.Request,
	prov provider.Provider,
	req *provider.ChatRequest,
	start time.Time,
	routingMs float64,
) {
	ctx := r.Context()
	stream, err := prov.SendStream(ctx, req)
	if err != nil {
		latencyMs := float64(time.Since(start).Microseconds()) / 1000.0
		s.Metrics.Record(metrics.RequestMetrics{
			LatencyMs:     latencyMs,
			RoutingMs:     routingMs,
			Error:         1.0,
			ErrorCategory: metrics.ErrCategoryServer,
			ErrorMessage:  err.Error(),
			Provider:      prov.Name(),
			Model:         req.Model,
		})
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	defer stream.Close()

	// Stream SSE response
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	ttftRecorded := false
	var ttftMs float64
	buf := make([]byte, 4096)

	for {
		n, err := stream.Read(buf)
		if n > 0 {
			if !ttftRecorded {
				ttftMs = float64(time.Since(start).Microseconds()) / 1000.0
				ttftRecorded = true
			}
			w.Write(buf[:n])
			flusher.Flush()
		}
		if err != nil {
			break
		}
	}

	latencyMs := float64(time.Since(start).Microseconds()) / 1000.0
	s.Metrics.Record(metrics.RequestMetrics{
		LatencyMs: latencyMs,
		TTFTMs:    ttftMs,
		RoutingMs: routingMs,
		Error:     0,
		Provider:  prov.Name(),
		Model:     req.Model,
		Stream:    true,
	})
}

func lastUserMessage(messages []provider.Message) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			return messages[i].TextContent()
		}
	}
	if len(messages) > 0 {
		return messages[len(messages)-1].TextContent()
	}
	return ""
}

// --- Helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
