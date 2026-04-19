package router

import (
	"math"
	"testing"

	"github.com/OpenTracy/opentracy/go/internal/clustering"
	"github.com/OpenTracy/opentracy/go/internal/weights"
)

const eps = 1e-9

func makeTestRouter() *Router {
	// 3 clusters, 2D embeddings
	centroids := [][]float64{
		{0, 0},
		{5, 5},
		{10, 0},
	}
	assigner := clustering.NewKMeansAssigner(centroids)

	registry := weights.NewRegistry()

	// Model A: good at cluster 0, bad at cluster 1 and 2
	registry.Register(&weights.LLMProfile{
		ModelID:              "model-a",
		PsiVector:            []float64{0.05, 0.8, 0.7},
		CostPer1kTokens:      0.01,
		NumValidationSamples: 100,
		ClusterSampleCounts:  []float64{40, 30, 30},
	})

	// Model B: good at cluster 1, bad at cluster 0 and 2
	registry.Register(&weights.LLMProfile{
		ModelID:              "model-b",
		PsiVector:            []float64{0.7, 0.05, 0.6},
		CostPer1kTokens:      0.05,
		NumValidationSamples: 100,
		ClusterSampleCounts:  []float64{40, 30, 30},
	})

	// Model C: mediocre everywhere, but cheap
	registry.Register(&weights.LLMProfile{
		ModelID:              "model-c",
		PsiVector:            []float64{0.3, 0.3, 0.3},
		CostPer1kTokens:      0.001,
		NumValidationSamples: 100,
		ClusterSampleCounts:  []float64{40, 30, 30},
	})

	return New(assigner, registry, 0.0, false, nil)
}

func TestRouteSelectsBestModel(t *testing.T) {
	r := makeTestRouter()

	// Embedding near cluster 0 → model-a should win (lowest error: 0.05)
	d, err := r.RouteEmbedding([]float64{0.1, 0.1})
	if err != nil {
		t.Fatal(err)
	}
	if d.SelectedModel != "model-a" {
		t.Errorf("near cluster 0: selected %s, want model-a", d.SelectedModel)
	}
	if math.Abs(d.ExpectedError-0.05) > eps {
		t.Errorf("expected error = %v, want 0.05", d.ExpectedError)
	}

	// Embedding near cluster 1 → model-b should win (lowest error: 0.05)
	d, err = r.RouteEmbedding([]float64{5, 5})
	if err != nil {
		t.Fatal(err)
	}
	if d.SelectedModel != "model-b" {
		t.Errorf("near cluster 1: selected %s, want model-b", d.SelectedModel)
	}
}

func TestRouteCostWeight(t *testing.T) {
	r := makeTestRouter()
	r.CostWeight = 0.0

	// Without cost: model-a wins at cluster 0 (error=0.05)
	d, err := r.RouteEmbedding([]float64{0.1, 0.1})
	if err != nil {
		t.Fatal(err)
	}
	if d.SelectedModel != "model-a" {
		t.Errorf("λ=0: selected %s, want model-a", d.SelectedModel)
	}

	// With high cost weight: model-c (cheapest: 0.001) might win
	// model-a: error=0.05 + 100*0.01 = 1.05
	// model-c: error=0.3 + 100*0.001 = 0.4
	d, err = r.RouteEmbedding([]float64{0.1, 0.1}, WithCostWeight(100))
	if err != nil {
		t.Fatal(err)
	}
	if d.SelectedModel != "model-c" {
		t.Errorf("λ=100: selected %s, want model-c", d.SelectedModel)
	}
}

func TestRouteCostWeightOverride(t *testing.T) {
	r := makeTestRouter()
	r.CostWeight = 0.0

	// Override with high cost weight
	d, err := r.RouteEmbedding([]float64{0.1, 0.1}, WithCostWeight(100))
	if err != nil {
		t.Fatal(err)
	}
	if d.SelectedModel != "model-c" {
		t.Errorf("override λ=100: selected %s, want model-c", d.SelectedModel)
	}
}

func TestRouteAvailableModels(t *testing.T) {
	r := makeTestRouter()

	// Restrict to only model-b and model-c
	d, err := r.RouteEmbedding([]float64{0.1, 0.1},
		WithAvailableModels([]string{"model-b", "model-c"}))
	if err != nil {
		t.Fatal(err)
	}
	// model-a excluded. At cluster 0: model-b error=0.7, model-c error=0.3
	// So model-c should win
	if d.SelectedModel != "model-c" {
		t.Errorf("restricted: selected %s, want model-c", d.SelectedModel)
	}
}

func TestRouteNoModelsError(t *testing.T) {
	r := makeTestRouter()
	_, err := r.RouteEmbedding([]float64{0, 0},
		WithAvailableModels([]string{"nonexistent"}))
	if err == nil {
		t.Error("expected error for empty model list")
	}
}

func TestRouteStats(t *testing.T) {
	r := makeTestRouter()

	_, _ = r.RouteEmbedding([]float64{0, 0})
	_, _ = r.RouteEmbedding([]float64{0, 0})
	_, _ = r.RouteEmbedding([]float64{5, 5})

	snap := r.Stats().Snapshot()
	if snap.TotalRequests != 3 {
		t.Errorf("total requests = %d, want 3", snap.TotalRequests)
	}
	if snap.ModelSelections["model-a"] != 2 {
		t.Errorf("model-a selections = %d, want 2", snap.ModelSelections["model-a"])
	}
	if snap.ModelSelections["model-b"] != 1 {
		t.Errorf("model-b selections = %d, want 1", snap.ModelSelections["model-b"])
	}
}

func TestRouteDecisionFields(t *testing.T) {
	r := makeTestRouter()

	d, err := r.RouteEmbedding([]float64{0, 0})
	if err != nil {
		t.Fatal(err)
	}

	if d.SelectedModel == "" {
		t.Error("SelectedModel is empty")
	}
	if len(d.AllScores) != 3 {
		t.Errorf("AllScores has %d entries, want 3", len(d.AllScores))
	}
	if d.ClusterID < 0 || d.ClusterID >= 3 {
		t.Errorf("ClusterID = %d, out of range [0,3)", d.ClusterID)
	}
	if len(d.ClusterProbabilities) != 3 {
		t.Errorf("ClusterProbabilities has %d entries, want 3", len(d.ClusterProbabilities))
	}
	if d.Reasoning == "" {
		t.Error("Reasoning is empty")
	}
}

func TestRouteSoftAssignment(t *testing.T) {
	// Use LearnedMap for soft assignment
	theta := [][]float64{
		{1, 0},
		{0, 1},
		{-1, 0},
	}
	centroids := theta
	assigner := clustering.NewLearnedMapAssigner(centroids, theta, 1.0)

	registry := weights.NewRegistry()
	registry.Register(&weights.LLMProfile{
		ModelID:              "model-a",
		PsiVector:            []float64{0.1, 0.5, 0.9},
		CostPer1kTokens:      0.01,
		NumValidationSamples: 100,
		ClusterSampleCounts:  []float64{40, 30, 30},
	})
	registry.Register(&weights.LLMProfile{
		ModelID:              "model-b",
		PsiVector:            []float64{0.9, 0.1, 0.1},
		CostPer1kTokens:      0.02,
		NumValidationSamples: 100,
		ClusterSampleCounts:  []float64{40, 30, 30},
	})

	r := New(assigner, registry, 0.0, true, nil)

	// Embedding [1, 0] → cluster 0 dominant → model-a error ~0.1 vs model-b ~0.9
	d, err := r.RouteEmbedding([]float64{1, 0})
	if err != nil {
		t.Fatal(err)
	}
	if d.SelectedModel != "model-a" {
		t.Errorf("soft assign: selected %s, want model-a", d.SelectedModel)
	}

	// Embedding [0, 1] → cluster 1 dominant → model-b error ~0.1 vs model-a ~0.5
	d, err = r.RouteEmbedding([]float64{0, 1})
	if err != nil {
		t.Fatal(err)
	}
	if d.SelectedModel != "model-b" {
		t.Errorf("soft assign: selected %s, want model-b", d.SelectedModel)
	}
}
