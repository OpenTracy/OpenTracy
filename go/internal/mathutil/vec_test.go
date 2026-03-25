package mathutil

import (
	"math"
	"testing"
)

const eps = 1e-9

func TestDot(t *testing.T) {
	tests := []struct {
		name string
		a, b []float64
		want float64
	}{
		{"simple", []float64{1, 2, 3}, []float64{4, 5, 6}, 32},
		{"zeros", []float64{0, 0, 0}, []float64{1, 2, 3}, 0},
		{"ones", []float64{1, 1, 1}, []float64{1, 1, 1}, 3},
		{"negative", []float64{-1, 2, -3}, []float64{4, -5, 6}, -32},
		{"single", []float64{3.5}, []float64{2.0}, 7.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Dot(tt.a, tt.b)
			if math.Abs(got-tt.want) > eps {
				t.Errorf("Dot(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestDotPanicsOnMismatch(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Errorf("expected panic on mismatched lengths")
		}
	}()
	Dot([]float64{1, 2}, []float64{1, 2, 3})
}

func TestSoftmaxInPlace(t *testing.T) {
	// Test basic softmax
	logits := []float64{1.0, 2.0, 3.0}
	SoftmaxInPlace(logits)

	// Should sum to 1
	var sum float64
	for _, v := range logits {
		sum += v
	}
	if math.Abs(sum-1.0) > eps {
		t.Errorf("softmax sum = %v, want 1.0", sum)
	}

	// Largest logit should have largest probability
	if logits[2] <= logits[1] || logits[1] <= logits[0] {
		t.Errorf("softmax ordering wrong: %v", logits)
	}

	// Test numerical stability with large values
	large := []float64{1000, 1001, 1002}
	SoftmaxInPlace(large)
	var sumLarge float64
	for _, v := range large {
		sumLarge += v
		if math.IsNaN(v) || math.IsInf(v, 0) {
			t.Errorf("softmax produced NaN/Inf for large values")
		}
	}
	if math.Abs(sumLarge-1.0) > eps {
		t.Errorf("softmax sum for large values = %v, want 1.0", sumLarge)
	}

	// Test uniform case
	uniform := []float64{0, 0, 0}
	SoftmaxInPlace(uniform)
	for _, v := range uniform {
		if math.Abs(v-1.0/3.0) > eps {
			t.Errorf("softmax of equal values should be uniform, got %v", uniform)
			break
		}
	}

	// Empty slice should not panic
	SoftmaxInPlace([]float64{})
}

func TestArgmin(t *testing.T) {
	tests := []struct {
		name string
		v    []float64
		want int
	}{
		{"first", []float64{1, 2, 3}, 0},
		{"last", []float64{3, 2, 1}, 2},
		{"middle", []float64{3, 1, 2}, 1},
		{"single", []float64{42}, 0},
		{"negative", []float64{-1, -3, -2}, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Argmin(tt.v)
			if got != tt.want {
				t.Errorf("Argmin(%v) = %v, want %v", tt.v, got, tt.want)
			}
		})
	}
}

func TestArgmax(t *testing.T) {
	tests := []struct {
		name string
		v    []float64
		want int
	}{
		{"last", []float64{1, 2, 3}, 2},
		{"first", []float64{3, 2, 1}, 0},
		{"middle", []float64{1, 3, 2}, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Argmax(tt.v)
			if got != tt.want {
				t.Errorf("Argmax(%v) = %v, want %v", tt.v, got, tt.want)
			}
		})
	}
}

func TestL2Distances(t *testing.T) {
	centroids := [][]float64{
		{0, 0},
		{3, 4},
		{1, 0},
	}
	embedding := []float64{0, 0}

	dists := L2Distances(centroids, embedding)

	if math.Abs(dists[0]-0.0) > eps {
		t.Errorf("distance to origin = %v, want 0", dists[0])
	}
	if math.Abs(dists[1]-5.0) > eps {
		t.Errorf("distance to (3,4) = %v, want 5", dists[1])
	}
	if math.Abs(dists[2]-1.0) > eps {
		t.Errorf("distance to (1,0) = %v, want 1", dists[2])
	}
}

func TestL2DistancesSq(t *testing.T) {
	centroids := [][]float64{
		{0, 0},
		{3, 4},
	}
	embedding := []float64{0, 0}

	dists := L2DistancesSq(centroids, embedding)

	if math.Abs(dists[0]-0.0) > eps {
		t.Errorf("sq distance to origin = %v, want 0", dists[0])
	}
	if math.Abs(dists[1]-25.0) > eps {
		t.Errorf("sq distance to (3,4) = %v, want 25", dists[1])
	}
}

func TestMatVecMul(t *testing.T) {
	mat := [][]float64{
		{1, 2},
		{3, 4},
		{5, 6},
	}
	vec := []float64{1, 2}

	result := MatVecMul(mat, vec)

	expected := []float64{5, 11, 17}
	for i, v := range result {
		if math.Abs(v-expected[i]) > eps {
			t.Errorf("MatVecMul[%d] = %v, want %v", i, v, expected[i])
		}
	}
}

func BenchmarkDot384(b *testing.B) {
	a := make([]float64, 384)
	c := make([]float64, 384)
	for i := range a {
		a[i] = float64(i) * 0.01
		c[i] = float64(i) * 0.02
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Dot(a, c)
	}
}

func BenchmarkSoftmax100(b *testing.B) {
	logits := make([]float64, 100)
	for i := range logits {
		logits[i] = float64(i) * 0.1
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		SoftmaxInPlace(logits)
	}
}

func BenchmarkL2Distances100x384(b *testing.B) {
	centroids := make([][]float64, 100)
	for i := range centroids {
		centroids[i] = make([]float64, 384)
		for j := range centroids[i] {
			centroids[i][j] = float64(i*384+j) * 0.001
		}
	}
	embedding := make([]float64, 384)
	for i := range embedding {
		embedding[i] = float64(i) * 0.01
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		L2DistancesSq(centroids, embedding)
	}
}
