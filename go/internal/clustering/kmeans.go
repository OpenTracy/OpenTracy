package clustering

import (
	"github.com/OpenTracy/opentracy/go/internal/mathutil"
)

// KMeansAssigner assigns embeddings to the nearest centroid.
// Produces one-hot probability distributions.
type KMeansAssigner struct {
	centroids [][]float64 // (K, d)
	k         int
	d         int
}

// NewKMeansAssigner creates a KMeansAssigner from pre-computed centroids.
// centroids must be a (K, d) shaped 2D slice.
func NewKMeansAssigner(centroids [][]float64) *KMeansAssigner {
	k := len(centroids)
	d := 0
	if k > 0 {
		d = len(centroids[0])
	}
	return &KMeansAssigner{
		centroids: centroids,
		k:         k,
		d:         d,
	}
}

// Assign finds the nearest centroid using squared L2 distance
// and returns a one-hot ClusterResult.
func (a *KMeansAssigner) Assign(embedding []float64) *ClusterResult {
	distsSq := mathutil.L2DistancesSq(a.centroids, embedding)
	clusterID := mathutil.Argmin(distsSq)

	probs := make([]float64, a.k)
	probs[clusterID] = 1.0

	return &ClusterResult{
		ClusterID:     clusterID,
		Probabilities: probs,
	}
}

// NumClusters returns K.
func (a *KMeansAssigner) NumClusters() int {
	return a.k
}

// EmbeddingDim returns d.
func (a *KMeansAssigner) EmbeddingDim() int {
	return a.d
}
