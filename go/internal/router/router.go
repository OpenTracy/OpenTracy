package router

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"golang.org/x/sync/singleflight"

	"github.com/lunar-org-ai/lunar-router/go/internal/clustering"
	"github.com/lunar-org-ai/lunar-router/go/internal/embeddings"
	"github.com/lunar-org-ai/lunar-router/go/internal/weights"
)

// RouteOption configures a single routing call.
type RouteOption func(*routeOpts)

type routeOpts struct {
	availableModels   []string
	costWeightOverride *float64
}

// WithAvailableModels restricts routing to the given model IDs.
func WithAvailableModels(models []string) RouteOption {
	return func(o *routeOpts) {
		o.availableModels = models
	}
}

// WithCostWeight overrides the default cost weight for this request.
func WithCostWeight(w float64) RouteOption {
	return func(o *routeOpts) {
		o.costWeightOverride = &w
	}
}

// Router implements the UniRoute routing logic:
//
//	h* = argmin_h [γ(x, h) + λ·c(h)]
//
// where γ(x, h) = Φ(x)ᵀ · Ψ(h)
type Router struct {
	Embedder        embeddings.Embedder // nil if prompt-based routing not needed
	ClusterAssigner clustering.ClusterAssigner
	Registry        *weights.Registry
	CostWeight      float64
	UseSoftAssign   bool
	AllowedModels   []string

	cache *Cache
	sf    singleflight.Group
	stats *RoutingStats
}

// New creates a new Router.
func New(
	assigner clustering.ClusterAssigner,
	registry *weights.Registry,
	costWeight float64,
	useSoftAssign bool,
	allowedModels []string,
) *Router {
	return &Router{
		ClusterAssigner: assigner,
		Registry:        registry,
		CostWeight:      costWeight,
		UseSoftAssign:   useSoftAssign,
		AllowedModels:   allowedModels,
		cache:           NewCache(defaultCacheMaxSize),
		stats:           NewRoutingStats(),
	}
}

// NewEmpty creates a Router with no semantic routing (gateway-only mode).
func NewEmpty() *Router {
	return &Router{
		ClusterAssigner: &nullAssigner{},
		Registry:        weights.NewRegistry(),
		cache:           NewCache(defaultCacheMaxSize),
		stats:           NewRoutingStats(),
	}
}

// nullAssigner is a no-op cluster assigner for gateway mode.
type nullAssigner struct{}

func (n *nullAssigner) Assign(embedding []float64) *clustering.ClusterResult {
	return &clustering.ClusterResult{ClusterID: 0, Probabilities: []float64{1.0}}
}
func (n *nullAssigner) NumClusters() int { return 0 }

// Cache returns the routing cache.
func (r *Router) Cache() *Cache {
	return r.cache
}

// Stats returns the routing statistics.
func (r *Router) Stats() *RoutingStats {
	return r.stats
}

// Route routes a text prompt to the best model.
// Requires the Embedder to be set.
// Uses LRU cache with TTL, and singleflight to collapse concurrent
// identical requests into a single computation.
func (r *Router) Route(prompt string, opts ...RouteOption) (*RoutingDecision, error) {
	if r.Embedder == nil {
		return nil, fmt.Errorf("embedder not configured; use RouteEmbedding for pre-computed embeddings")
	}

	// Resolve options for cache key
	o := &routeOpts{}
	for _, opt := range opts {
		opt(o)
	}
	costWeight := r.CostWeight
	if o.costWeightOverride != nil {
		costWeight = *o.costWeightOverride
	}
	key := CacheKey(prompt, costWeight, o.availableModels)

	// Check cache
	if cached := r.cache.Get(key); cached != nil {
		r.stats.Update(cached)
		return cached, nil
	}

	// Singleflight: collapse concurrent identical requests into one computation
	v, err, _ := r.sf.Do(key, func() (any, error) {
		// Double-check cache (another goroutine in the same flight may have filled it)
		if cached := r.cache.Get(key); cached != nil {
			return cached, nil
		}

		embedding, err := r.Embedder.Embed(prompt)
		if err != nil {
			return nil, fmt.Errorf("embed prompt: %w", err)
		}
		decision, err := r.RouteEmbedding(embedding, opts...)
		if err != nil {
			return nil, err
		}

		r.cache.Put(key, decision)
		return decision, nil
	})
	if err != nil {
		return nil, err
	}

	decision := v.(*RoutingDecision).clone()
	r.stats.Update(decision)
	return decision, nil
}

// RouteEmbedding routes a pre-computed embedding to the best model.
// This is the core routing function — embedding generation is handled
// separately (will be ONNX in Phase 2).
func (r *Router) RouteEmbedding(embedding []float64, opts ...RouteOption) (*RoutingDecision, error) {
	o := &routeOpts{}
	for _, opt := range opts {
		opt(o)
	}

	// Step 1: Cluster assignment
	clusterResult := r.ClusterAssigner.Assign(embedding)

	// Step 2: Get Φ vector (soft or hard)
	var phi []float64
	if r.UseSoftAssign {
		phi = clusterResult.Probabilities
	} else {
		phi = clusterResult.ToOneHot()
	}

	// Step 3: Get available profiles
	modelsToUse := o.availableModels
	if modelsToUse == nil {
		modelsToUse = r.AllowedModels
	}
	profiles := r.Registry.GetAvailable(modelsToUse)
	if len(profiles) == 0 {
		return nil, fmt.Errorf("no models available for routing")
	}

	// Step 4: Score each model
	lambda := r.CostWeight
	if o.costWeightOverride != nil {
		lambda = *o.costWeightOverride
	}

	scores := make(map[string]float64, len(profiles))
	var bestModel string
	bestScore := math.Inf(1)
	bestError := math.Inf(1)

	for _, profile := range profiles {
		expectedError := profile.ExpectedError(phi)
		score := expectedError + lambda*profile.CostPer1kTokens

		scores[profile.ModelID] = score

		if score < bestScore {
			bestScore = score
			bestError = expectedError
			bestModel = profile.ModelID
		}
	}

	// Build reasoning
	reasoning := buildReasoning(clusterResult, phi, profiles, scores, bestModel, lambda)

	decision := &RoutingDecision{
		SelectedModel:        bestModel,
		ExpectedError:        bestError,
		CostAdjustedScore:    bestScore,
		AllScores:            scores,
		ClusterID:            clusterResult.ClusterID,
		ClusterProbabilities: clusterResult.Probabilities,
		Reasoning:            reasoning,
	}

	r.stats.Update(decision)

	return decision, nil
}

func buildReasoning(
	cr *clustering.ClusterResult,
	phi []float64,
	profiles []*weights.LLMProfile,
	scores map[string]float64,
	selected string,
	lambda float64,
) string {
	var b strings.Builder

	confidence := 0.0
	if cr.ClusterID < len(phi) {
		confidence = phi[cr.ClusterID]
	}
	fmt.Fprintf(&b, "Cluster: %d (confidence: %.2f%%)\n", cr.ClusterID, confidence*100)
	fmt.Fprintf(&b, "Cost weight (λ): %g\n", lambda)
	b.WriteString("Model scores:\n")

	// Sort profiles by score
	sorted := make([]*weights.LLMProfile, len(profiles))
	copy(sorted, profiles)
	sort.Slice(sorted, func(i, j int) bool {
		return scores[sorted[i].ModelID] < scores[sorted[j].ModelID]
	})

	for _, p := range sorted {
		error_ := p.ExpectedError(phi)
		costTerm := lambda * p.CostPer1kTokens
		marker := ""
		if p.ModelID == selected {
			marker = " <- selected"
		}
		fmt.Fprintf(&b, "  %s: error=%.4f + cost=%.4f = %.4f%s\n",
			p.ModelID, error_, costTerm, scores[p.ModelID], marker)
	}

	return b.String()
}
