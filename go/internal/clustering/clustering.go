package clustering

// ClusterResult holds the result of assigning an embedding to clusters.
type ClusterResult struct {
	// ClusterID is the dominant cluster index (argmax of Probabilities).
	ClusterID int
	// Probabilities is the full distribution over K clusters.
	Probabilities []float64
}

// NumClusters returns the number of clusters.
func (r *ClusterResult) NumClusters() int {
	return len(r.Probabilities)
}

// ToOneHot returns a one-hot encoding of the dominant cluster.
func (r *ClusterResult) ToOneHot() []float64 {
	oneHot := make([]float64, len(r.Probabilities))
	oneHot[r.ClusterID] = 1.0
	return oneHot
}

// ClusterAssigner maps an embedding to a cluster assignment.
type ClusterAssigner interface {
	// Assign maps an embedding vector to a ClusterResult.
	Assign(embedding []float64) *ClusterResult
	// NumClusters returns the number of clusters K.
	NumClusters() int
}
