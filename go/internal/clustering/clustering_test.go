package clustering

import (
	"math"
	"testing"
)

const eps = 1e-9

func TestKMeansAssign(t *testing.T) {
	centroids := [][]float64{
		{0, 0},   // cluster 0: origin
		{10, 10}, // cluster 1: far away
		{1, 0},   // cluster 2: near origin
	}
	assigner := NewKMeansAssigner(centroids)

	if assigner.NumClusters() != 3 {
		t.Errorf("NumClusters() = %d, want 3", assigner.NumClusters())
	}

	// Point at origin should map to cluster 0
	r := assigner.Assign([]float64{0, 0})
	if r.ClusterID != 0 {
		t.Errorf("Assign([0,0]) cluster = %d, want 0", r.ClusterID)
	}
	if r.Probabilities[0] != 1.0 {
		t.Errorf("one-hot[0] = %v, want 1.0", r.Probabilities[0])
	}

	// Point near (10, 10) should map to cluster 1
	r = assigner.Assign([]float64{9, 9})
	if r.ClusterID != 1 {
		t.Errorf("Assign([9,9]) cluster = %d, want 1", r.ClusterID)
	}

	// Point at (0.8, 0) is closer to cluster 2 (1,0) than cluster 0 (0,0)
	r = assigner.Assign([]float64{0.8, 0})
	if r.ClusterID != 2 {
		t.Errorf("Assign([0.8,0]) cluster = %d, want 2", r.ClusterID)
	}
}

func TestKMeansOneHot(t *testing.T) {
	centroids := [][]float64{
		{0, 0},
		{5, 5},
	}
	assigner := NewKMeansAssigner(centroids)
	r := assigner.Assign([]float64{1, 1})

	// Should be one-hot
	var sum float64
	nonZeroCount := 0
	for _, v := range r.Probabilities {
		sum += v
		if v > 0 {
			nonZeroCount++
		}
	}
	if math.Abs(sum-1.0) > eps {
		t.Errorf("probabilities sum = %v, want 1.0", sum)
	}
	if nonZeroCount != 1 {
		t.Errorf("expected exactly 1 non-zero probability, got %d", nonZeroCount)
	}
}

func TestLearnedMapAssign(t *testing.T) {
	// Simple 2D, 3 clusters
	centroids := [][]float64{
		{1, 0},
		{0, 1},
		{-1, 0},
	}
	// Theta that clearly separates: cluster 0 for [1,0], cluster 1 for [0,1]
	theta := [][]float64{
		{10, 0},  // strong signal for dim 0
		{0, 10},  // strong signal for dim 1
		{-10, 0}, // strong signal for -dim 0
	}
	temperature := 1.0

	assigner := NewLearnedMapAssigner(centroids, theta, temperature)

	if assigner.NumClusters() != 3 {
		t.Errorf("NumClusters() = %d, want 3", assigner.NumClusters())
	}

	// Embedding [1, 0] should map strongly to cluster 0
	r := assigner.Assign([]float64{1, 0})
	if r.ClusterID != 0 {
		t.Errorf("Assign([1,0]) cluster = %d, want 0", r.ClusterID)
	}

	// Embedding [0, 1] should map strongly to cluster 1
	r = assigner.Assign([]float64{0, 1})
	if r.ClusterID != 1 {
		t.Errorf("Assign([0,1]) cluster = %d, want 1", r.ClusterID)
	}

	// Embedding [-1, 0] should map to cluster 2
	r = assigner.Assign([]float64{-1, 0})
	if r.ClusterID != 2 {
		t.Errorf("Assign([-1,0]) cluster = %d, want 2", r.ClusterID)
	}
}

func TestLearnedMapSoftProbabilities(t *testing.T) {
	theta := [][]float64{
		{1, 0},
		{0, 1},
	}
	centroids := theta
	temperature := 1.0

	assigner := NewLearnedMapAssigner(centroids, theta, temperature)

	// Equal-ish embedding should give non-trivial probabilities
	r := assigner.Assign([]float64{1, 1})

	var sum float64
	for _, v := range r.Probabilities {
		sum += v
		if v <= 0 || v >= 1 {
			t.Errorf("probability %v should be in (0, 1)", v)
		}
	}
	if math.Abs(sum-1.0) > eps {
		t.Errorf("probabilities sum = %v, want 1.0", sum)
	}
}

func TestLearnedMapTemperature(t *testing.T) {
	theta := [][]float64{
		{1, 0},
		{0, 1},
	}
	centroids := theta
	embedding := []float64{1, 0}

	// Low temperature → sharper distribution
	low := NewLearnedMapAssigner(centroids, theta, 0.1)
	rLow := low.Assign(embedding)

	// High temperature → flatter distribution
	high := NewLearnedMapAssigner(centroids, theta, 10.0)
	rHigh := high.Assign(embedding)

	// Low temperature should give higher max probability
	if rLow.Probabilities[0] <= rHigh.Probabilities[0] {
		t.Errorf("low temp prob[0]=%v should be > high temp prob[0]=%v",
			rLow.Probabilities[0], rHigh.Probabilities[0])
	}
}

func TestClusterResultToOneHot(t *testing.T) {
	r := &ClusterResult{
		ClusterID:     1,
		Probabilities: []float64{0.2, 0.5, 0.3},
	}
	oneHot := r.ToOneHot()
	if oneHot[0] != 0 || oneHot[1] != 1.0 || oneHot[2] != 0 {
		t.Errorf("ToOneHot() = %v, want [0, 1, 0]", oneHot)
	}
}
