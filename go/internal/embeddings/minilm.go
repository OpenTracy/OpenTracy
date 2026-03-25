package embeddings

import (
	"container/list"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"math"
	"os"
	"sync"

	ort "github.com/yalue/onnxruntime_go"
)

type embCacheEntry struct {
	key       string
	embedding []float64
}

const miniLMDimension = 384
const miniLMMaxSeqLen = 128

// MiniLMEmbedder uses all-MiniLM-L6-v2 via ONNX Runtime for local embeddings.
// Produces 384-dimensional vectors, matching the Python SentenceTransformerProvider.
// Features dynamic sequence length and LRU caching for performance.
type MiniLMEmbedder struct {
	session   *ort.DynamicAdvancedSession
	tokenizer *BERTTokenizer

	// LRU embedding cache (MD5 of text -> embedding)
	cacheMu    sync.Mutex
	cacheItems map[string]*list.Element
	cacheOrder *list.List
	cacheMax   int
}

// NewMiniLMEmbedder creates a MiniLM embedder.
func NewMiniLMEmbedder(modelPath, vocabPath, runtimePath string) (*MiniLMEmbedder, error) {
	// Resolve ONNX Runtime library path
	if runtimePath == "" {
		runtimePath = os.Getenv("ONNXRUNTIME_LIB_PATH")
	}
	if runtimePath == "" {
		candidates := []string{
			"/opt/homebrew/lib/libonnxruntime.dylib",
			"/usr/local/lib/libonnxruntime.dylib",
			"/usr/lib/libonnxruntime.so",
			"/usr/local/lib/libonnxruntime.so",
		}
		for _, p := range candidates {
			if _, err := os.Stat(p); err == nil {
				runtimePath = p
				break
			}
		}
	}
	if runtimePath == "" {
		return nil, fmt.Errorf("ONNX Runtime library not found; set ONNXRUNTIME_LIB_PATH or install via 'brew install onnxruntime'")
	}

	// Load tokenizer
	tokenizer, err := NewBERTTokenizer(vocabPath, miniLMMaxSeqLen)
	if err != nil {
		return nil, fmt.Errorf("load tokenizer: %w", err)
	}

	// Initialize ONNX Runtime
	ort.SetSharedLibraryPath(runtimePath)
	if err := ort.InitializeEnvironment(); err != nil {
		return nil, fmt.Errorf("init ONNX Runtime: %w", err)
	}

	// Load model
	modelData, err := os.ReadFile(modelPath)
	if err != nil {
		return nil, fmt.Errorf("read ONNX model: %w", err)
	}

	inputNames := []string{"input_ids", "attention_mask", "token_type_ids"}
	outputNames := []string{"last_hidden_state"}

	session, err := ort.NewDynamicAdvancedSessionWithONNXData(modelData, inputNames, outputNames, nil)
	if err != nil {
		return nil, fmt.Errorf("create ONNX session: %w", err)
	}

	e := &MiniLMEmbedder{
		session:    session,
		tokenizer:  tokenizer,
		cacheItems: make(map[string]*list.Element, 1024),
		cacheOrder: list.New(),
		cacheMax:   10000,
	}

	// Warm up the session with a dummy inference
	_, _ = e.embedRaw("warmup")

	return e, nil
}

// Embed generates a 384-dim embedding for the given text.
// Uses LRU cache — frequently used prompts stay cached, least-recently-used are evicted.
func (e *MiniLMEmbedder) Embed(text string) ([]float64, error) {
	key := cacheKey(text)

	// Check cache
	e.cacheMu.Lock()
	if el, ok := e.cacheItems[key]; ok {
		e.cacheOrder.MoveToFront(el)
		cached := el.Value.(*embCacheEntry).embedding
		result := make([]float64, len(cached))
		copy(result, cached)
		e.cacheMu.Unlock()
		return result, nil
	}
	e.cacheMu.Unlock()

	// Compute embedding
	embedding, err := e.embedRaw(text)
	if err != nil {
		return nil, err
	}

	// Store in cache with LRU eviction
	stored := make([]float64, len(embedding))
	copy(stored, embedding)

	e.cacheMu.Lock()
	// Check again in case another goroutine inserted while we computed
	if el, ok := e.cacheItems[key]; ok {
		e.cacheOrder.MoveToFront(el)
		el.Value.(*embCacheEntry).embedding = stored
	} else {
		// Evict LRU if full
		for e.cacheOrder.Len() >= e.cacheMax {
			tail := e.cacheOrder.Back()
			if tail == nil {
				break
			}
			evicted := e.cacheOrder.Remove(tail).(*embCacheEntry)
			delete(e.cacheItems, evicted.key)
		}
		entry := &embCacheEntry{key: key, embedding: stored}
		el := e.cacheOrder.PushFront(entry)
		e.cacheItems[key] = el
	}
	e.cacheMu.Unlock()

	return embedding, nil
}

// embedRaw runs ONNX inference without caching.
// Uses dynamic sequence length — only processes actual tokens, not full 128 padding.
func (e *MiniLMEmbedder) embedRaw(text string) ([]float64, error) {
	tokens := e.tokenizer.Tokenize(text)

	// Use actual sequence length instead of fixed 128
	seqLen := int64(tokens.SeqLen)
	shape := ort.Shape{1, seqLen}

	// Trim slices to actual length (avoid processing padding tokens)
	inputIDsTensor, err := ort.NewTensor(shape, tokens.InputIDs[:seqLen])
	if err != nil {
		return nil, fmt.Errorf("create input_ids tensor: %w", err)
	}
	defer inputIDsTensor.Destroy()

	attMaskTensor, err := ort.NewTensor(shape, tokens.AttentionMask[:seqLen])
	if err != nil {
		return nil, fmt.Errorf("create attention_mask tensor: %w", err)
	}
	defer attMaskTensor.Destroy()

	tokenTypeTensor, err := ort.NewTensor(shape, tokens.TokenTypeIDs[:seqLen])
	if err != nil {
		return nil, fmt.Errorf("create token_type_ids tensor: %w", err)
	}
	defer tokenTypeTensor.Destroy()

	// Output tensor with actual seqLen
	outputShape := ort.Shape{1, seqLen, int64(miniLMDimension)}
	outputTensor, err := ort.NewEmptyTensor[float32](outputShape)
	if err != nil {
		return nil, fmt.Errorf("create output tensor: %w", err)
	}
	defer outputTensor.Destroy()

	// Run inference
	inputs := []ort.ArbitraryTensor{inputIDsTensor, attMaskTensor, tokenTypeTensor}
	outputs := []ort.ArbitraryTensor{outputTensor}

	if err := e.session.Run(inputs, outputs); err != nil {
		return nil, fmt.Errorf("ONNX inference: %w", err)
	}

	// Mean pooling over actual tokens only
	rawOutput := outputTensor.GetData()
	embedding := meanPool(rawOutput, tokens.AttentionMask[:seqLen], int(seqLen), miniLMDimension)

	// L2 normalize
	normalize(embedding)

	return embedding, nil
}

// CacheLen returns the current cache size.
func (e *MiniLMEmbedder) CacheLen() int {
	e.cacheMu.Lock()
	defer e.cacheMu.Unlock()
	return e.cacheOrder.Len()
}

// ClearCache empties the embedding cache.
func (e *MiniLMEmbedder) ClearCache() {
	e.cacheMu.Lock()
	e.cacheItems = make(map[string]*list.Element, 1024)
	e.cacheOrder.Init()
	e.cacheMu.Unlock()
}

func cacheKey(text string) string {
	h := md5.Sum([]byte(text))
	return hex.EncodeToString(h[:])
}

// meanPool computes mean pooling over token embeddings, weighted by attention mask.
func meanPool(output []float32, mask []int64, seqLen, dim int) []float64 {
	result := make([]float64, dim)
	var totalMask float64

	for i := 0; i < seqLen; i++ {
		if mask[i] == 0 {
			continue
		}
		totalMask += float64(mask[i])
		for j := 0; j < dim; j++ {
			result[j] += float64(output[i*dim+j]) * float64(mask[i])
		}
	}

	if totalMask > 0 {
		for j := range result {
			result[j] /= totalMask
		}
	}

	return result
}

// normalize applies L2 normalization in-place.
func normalize(v []float64) {
	var norm float64
	for _, x := range v {
		norm += x * x
	}
	norm = math.Sqrt(norm)
	if norm > 0 {
		for i := range v {
			v[i] /= norm
		}
	}
}

// Dimension returns 384.
func (e *MiniLMEmbedder) Dimension() int {
	return miniLMDimension
}

// Close releases the ONNX Runtime session.
func (e *MiniLMEmbedder) Close() error {
	if e.session != nil {
		e.session.Destroy()
	}
	return nil
}
