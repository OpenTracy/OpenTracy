package router

import "sync"

// RoutingDecision is the result of routing an embedding to a model.
type RoutingDecision struct {
	SelectedModel        string             `json:"selected_model"`
	ExpectedError        float64            `json:"expected_error"`
	CostAdjustedScore    float64            `json:"cost_adjusted_score"`
	AllScores            map[string]float64 `json:"all_scores"`
	ClusterID            int                `json:"cluster_id"`
	ClusterProbabilities []float64          `json:"cluster_probabilities"`
	Reasoning            string             `json:"reasoning,omitempty"`
}

// RoutingStats tracks aggregate routing statistics.
type RoutingStats struct {
	mu                   sync.RWMutex
	TotalRequests        int            `json:"total_requests"`
	ModelSelections      map[string]int `json:"model_selections"`
	ClusterDistributions map[int]int    `json:"cluster_distributions"`
	AvgExpectedError     float64        `json:"avg_expected_error"`
	AvgCostScore         float64        `json:"avg_cost_score"`
}

// NewRoutingStats creates a new RoutingStats.
func NewRoutingStats() *RoutingStats {
	return &RoutingStats{
		ModelSelections:      make(map[string]int),
		ClusterDistributions: make(map[int]int),
	}
}

// Update records a routing decision in the statistics.
func (s *RoutingStats) Update(d *RoutingDecision) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.TotalRequests++
	s.ModelSelections[d.SelectedModel]++
	s.ClusterDistributions[d.ClusterID]++

	n := float64(s.TotalRequests)
	s.AvgExpectedError = (s.AvgExpectedError*(n-1) + d.ExpectedError) / n
	s.AvgCostScore = (s.AvgCostScore*(n-1) + d.CostAdjustedScore) / n
}

// Reset clears all statistics.
func (s *RoutingStats) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.TotalRequests = 0
	s.ModelSelections = make(map[string]int)
	s.ClusterDistributions = make(map[int]int)
	s.AvgExpectedError = 0
	s.AvgCostScore = 0
}

// Snapshot returns a copy of the current stats (thread-safe read).
func (s *RoutingStats) Snapshot() RoutingStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	modelSel := make(map[string]int, len(s.ModelSelections))
	for k, v := range s.ModelSelections {
		modelSel[k] = v
	}
	clusterDist := make(map[int]int, len(s.ClusterDistributions))
	for k, v := range s.ClusterDistributions {
		clusterDist[k] = v
	}

	return RoutingStats{
		TotalRequests:        s.TotalRequests,
		ModelSelections:      modelSel,
		ClusterDistributions: clusterDist,
		AvgExpectedError:     s.AvgExpectedError,
		AvgCostScore:         s.AvgCostScore,
	}
}
