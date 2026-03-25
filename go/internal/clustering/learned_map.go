package clustering

import (
	"github.com/lunar-org-ai/lunar-router/go/internal/mathutil"
)

// LearnedMapAssigner uses a learned parameter matrix theta for soft
// cluster assignments via softmax(theta · embedding / temperature).
type LearnedMapAssigner struct {
	centroids   [][]float64 // (K, d) — original K-Means centroids (reference)
	theta       [][]float64 // (K, d) — learned parameter matrix
	temperature float64
	k           int
	d           int
}

// NewLearnedMapAssigner creates a LearnedMapAssigner.
func NewLearnedMapAssigner(centroids, theta [][]float64, temperature float64) *LearnedMapAssigner {
	k := len(theta)
	d := 0
	if k > 0 {
		d = len(theta[0])
	}
	return &LearnedMapAssigner{
		centroids:   centroids,
		theta:       theta,
		temperature: temperature,
		k:           k,
		d:           d,
	}
}

// Assign computes Φ(x; θ) = softmax(θ · φ(x) / τ).
func (a *LearnedMapAssigner) Assign(embedding []float64) *ClusterResult {
	// logits = theta @ embedding / temperature
	logits := mathutil.MatVecMul(a.theta, embedding)
	for i := range logits {
		logits[i] /= a.temperature
	}

	// softmax in-place
	mathutil.SoftmaxInPlace(logits)

	clusterID := mathutil.Argmax(logits)

	return &ClusterResult{
		ClusterID:     clusterID,
		Probabilities: logits,
	}
}

// NumClusters returns K.
func (a *LearnedMapAssigner) NumClusters() int {
	return a.k
}

// EmbeddingDim returns d.
func (a *LearnedMapAssigner) EmbeddingDim() int {
	return a.d
}
