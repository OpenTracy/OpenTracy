package embeddings

import (
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func testAssetsDir() string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "assets")
}

func findONNXRuntime() string {
	if p := os.Getenv("ONNXRUNTIME_LIB_PATH"); p != "" {
		return p
	}
	candidates := []string{
		"/opt/homebrew/lib/libonnxruntime.dylib",
		"/usr/local/lib/libonnxruntime.dylib",
		"/usr/lib/libonnxruntime.so",
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

func TestMiniLMEmbedder(t *testing.T) {
	runtimePath := findONNXRuntime()
	if runtimePath == "" {
		t.Skip("ONNX Runtime not found, skipping MiniLM tests")
	}

	assets := testAssetsDir()
	modelPath := filepath.Join(assets, "model.onnx")
	vocabPath := filepath.Join(assets, "vocab.txt")

	if _, err := os.Stat(modelPath); err != nil {
		t.Skipf("ONNX model not found at %s, skipping", modelPath)
	}

	embedder, err := NewMiniLMEmbedder(modelPath, vocabPath, runtimePath)
	if err != nil {
		t.Fatalf("failed to create MiniLM embedder: %v", err)
	}
	defer embedder.Close()

	t.Run("dimension", func(t *testing.T) {
		if embedder.Dimension() != 384 {
			t.Errorf("Dimension() = %d, want 384", embedder.Dimension())
		}
	})

	t.Run("embed produces correct dimension", func(t *testing.T) {
		emb, err := embedder.Embed("Hello world")
		if err != nil {
			t.Fatalf("Embed error: %v", err)
		}
		if len(emb) != 384 {
			t.Errorf("embedding length = %d, want 384", len(emb))
		}
	})

	t.Run("embedding is normalized", func(t *testing.T) {
		emb, err := embedder.Embed("Test normalization")
		if err != nil {
			t.Fatal(err)
		}
		var norm float64
		for _, v := range emb {
			norm += v * v
		}
		norm = math.Sqrt(norm)
		if math.Abs(norm-1.0) > 1e-4 {
			t.Errorf("embedding L2 norm = %v, want 1.0", norm)
		}
	})

	t.Run("deterministic", func(t *testing.T) {
		emb1, err := embedder.Embed("What is machine learning?")
		if err != nil {
			t.Fatal(err)
		}
		emb2, err := embedder.Embed("What is machine learning?")
		if err != nil {
			t.Fatal(err)
		}
		for i := range emb1 {
			if math.Abs(emb1[i]-emb2[i]) > 1e-6 {
				t.Errorf("embedding[%d] differs: %v vs %v", i, emb1[i], emb2[i])
				break
			}
		}
	})

	t.Run("different texts produce different embeddings", func(t *testing.T) {
		emb1, _ := embedder.Embed("The cat sat on the mat")
		emb2, _ := embedder.Embed("Quantum mechanics explains particle behavior")

		similarity := cosineSim(emb1, emb2)
		if similarity > 0.9 {
			t.Errorf("different texts too similar: cosine=%v", similarity)
		}
	})

	t.Run("similar texts produce similar embeddings", func(t *testing.T) {
		emb1, _ := embedder.Embed("The dog is running in the park")
		emb2, _ := embedder.Embed("A dog runs through the park")

		similarity := cosineSim(emb1, emb2)
		if similarity < 0.7 {
			t.Errorf("similar texts not similar enough: cosine=%v", similarity)
		}
	})
}

func TestBERTTokenizer(t *testing.T) {
	assets := testAssetsDir()
	vocabPath := filepath.Join(assets, "vocab.txt")

	if _, err := os.Stat(vocabPath); err != nil {
		t.Skipf("vocab.txt not found at %s, skipping", vocabPath)
	}

	tok, err := NewBERTTokenizer(vocabPath, 128)
	if err != nil {
		t.Fatalf("failed to create tokenizer: %v", err)
	}

	t.Run("basic tokenization", func(t *testing.T) {
		result := tok.Tokenize("Hello world")
		// Should start with [CLS]=101, end with [SEP]=102
		if result.InputIDs[0] != 101 {
			t.Errorf("first token = %d, want 101 ([CLS])", result.InputIDs[0])
		}
		// Find [SEP] position
		foundSep := false
		for _, id := range result.InputIDs {
			if id == 102 {
				foundSep = true
				break
			}
		}
		if !foundSep {
			t.Error("missing [SEP] token")
		}
	})

	t.Run("attention mask", func(t *testing.T) {
		result := tok.Tokenize("Hi")
		// Attention mask should be 1 for real tokens, 0 for padding
		if result.AttentionMask[0] != 1 {
			t.Error("attention mask[0] should be 1")
		}
		// Last positions should be 0 (padding)
		if result.AttentionMask[127] != 0 {
			t.Error("attention mask[127] should be 0 (padding)")
		}
	})

	t.Run("output length", func(t *testing.T) {
		result := tok.Tokenize("Test")
		if len(result.InputIDs) != 128 {
			t.Errorf("InputIDs length = %d, want 128", len(result.InputIDs))
		}
		if len(result.AttentionMask) != 128 {
			t.Errorf("AttentionMask length = %d, want 128", len(result.AttentionMask))
		}
		if len(result.TokenTypeIDs) != 128 {
			t.Errorf("TokenTypeIDs length = %d, want 128", len(result.TokenTypeIDs))
		}
	})

	t.Run("token type IDs all zero", func(t *testing.T) {
		result := tok.Tokenize("Single sentence")
		for i, v := range result.TokenTypeIDs {
			if v != 0 {
				t.Errorf("TokenTypeIDs[%d] = %d, want 0", i, v)
				break
			}
		}
	})
}

func TestHTTPEmbedder(t *testing.T) {
	mockEmbedding := make([]float64, 384)
	for i := range mockEmbedding {
		mockEmbedding[i] = float64(i) * 0.001
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/embeddings" {
			t.Errorf("expected /embeddings, got %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("missing or wrong authorization header")
		}

		resp := embeddingResponse{
			Data: []struct {
				Embedding []float64 `json:"embedding"`
				Index     int       `json:"index"`
			}{
				{Embedding: mockEmbedding, Index: 0},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	os.Setenv("TEST_EMBED_KEY", "test-key")
	defer os.Unsetenv("TEST_EMBED_KEY")

	embedder := NewHTTPEmbedder(server.URL, "TEST_EMBED_KEY", "test-model", 384)

	t.Run("dimension", func(t *testing.T) {
		if embedder.Dimension() != 384 {
			t.Errorf("Dimension() = %d, want 384", embedder.Dimension())
		}
	})

	t.Run("embed returns correct response", func(t *testing.T) {
		emb, err := embedder.Embed("Hello")
		if err != nil {
			t.Fatalf("Embed error: %v", err)
		}
		if len(emb) != 384 {
			t.Errorf("embedding length = %d, want 384", len(emb))
		}
		if math.Abs(emb[1]-0.001) > 1e-9 {
			t.Errorf("emb[1] = %v, want 0.001", emb[1])
		}
	})
}

func TestHTTPEmbedderError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error": {"message": "invalid api key"}}`))
	}))
	defer server.Close()

	embedder := NewHTTPEmbedder(server.URL, "", "test-model", 384)
	_, err := embedder.Embed("Hello")
	if err == nil {
		t.Error("expected error for 401 response")
	}
}

func cosineSim(a, b []float64) float64 {
	var dot, normA, normB float64
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}
