package mathutil

import "math"

// Dot computes the dot product of two float64 slices.
// Panics if lengths differ.
func Dot(a, b []float64) float64 {
	if len(a) != len(b) {
		panic("mathutil.Dot: mismatched lengths")
	}
	var sum float64
	for i := range a {
		sum += a[i] * b[i]
	}
	return sum
}

// SoftmaxInPlace applies numerically stable softmax in-place.
// logits is modified to contain the resulting probabilities.
func SoftmaxInPlace(logits []float64) {
	if len(logits) == 0 {
		return
	}
	// Subtract max for numerical stability
	maxVal := logits[0]
	for _, v := range logits[1:] {
		if v > maxVal {
			maxVal = v
		}
	}
	var sum float64
	for i, v := range logits {
		logits[i] = math.Exp(v - maxVal)
		sum += logits[i]
	}
	for i := range logits {
		logits[i] /= sum
	}
}

// Argmin returns the index of the minimum value in v.
// Panics if v is empty.
func Argmin(v []float64) int {
	if len(v) == 0 {
		panic("mathutil.Argmin: empty slice")
	}
	minIdx := 0
	minVal := v[0]
	for i, val := range v[1:] {
		if val < minVal {
			minVal = val
			minIdx = i + 1
		}
	}
	return minIdx
}

// Argmax returns the index of the maximum value in v.
// Panics if v is empty.
func Argmax(v []float64) int {
	if len(v) == 0 {
		panic("mathutil.Argmax: empty slice")
	}
	maxIdx := 0
	maxVal := v[0]
	for i, val := range v[1:] {
		if val > maxVal {
			maxVal = val
			maxIdx = i + 1
		}
	}
	return maxIdx
}

// L2Distances computes the L2 (Euclidean) distance from a single embedding
// to each row of centroids. centroids is K rows of d dimensions.
// Returns a slice of K distances.
func L2Distances(centroids [][]float64, embedding []float64) []float64 {
	k := len(centroids)
	distances := make([]float64, k)
	for i, centroid := range centroids {
		var sumSq float64
		for j := range centroid {
			diff := centroid[j] - embedding[j]
			sumSq += diff * diff
		}
		distances[i] = math.Sqrt(sumSq)
	}
	return distances
}

// L2DistancesSq computes squared L2 distances (avoids sqrt for argmin use).
func L2DistancesSq(centroids [][]float64, embedding []float64) []float64 {
	k := len(centroids)
	distances := make([]float64, k)
	for i, centroid := range centroids {
		var sumSq float64
		for j := range centroid {
			diff := centroid[j] - embedding[j]
			sumSq += diff * diff
		}
		distances[i] = sumSq
	}
	return distances
}

// MatVecMul computes matrix-vector multiplication: result[i] = sum_j(mat[i][j] * vec[j]).
// mat is (K, d), vec is (d,), result is (K,).
func MatVecMul(mat [][]float64, vec []float64) []float64 {
	result := make([]float64, len(mat))
	for i, row := range mat {
		var sum float64
		for j := range row {
			sum += row[j] * vec[j]
		}
		result[i] = sum
	}
	return result
}
