package embeddings

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// HTTPEmbedder calls an OpenAI-compatible /v1/embeddings endpoint.
type HTTPEmbedder struct {
	baseURL   string
	apiKey    string
	model     string
	dimension int
	client    *http.Client
}

// NewHTTPEmbedder creates an HTTP-based embedder.
// baseURL should be like "https://api.openai.com/v1" (without trailing slash).
// apiKeyEnv is the environment variable name containing the API key.
func NewHTTPEmbedder(baseURL, apiKeyEnv, model string, dimension int) *HTTPEmbedder {
	apiKey := os.Getenv(apiKeyEnv)
	return &HTTPEmbedder{
		baseURL:   baseURL,
		apiKey:    apiKey,
		model:     model,
		dimension: dimension,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type embeddingRequest struct {
	Input string `json:"input"`
	Model string `json:"model"`
}

type embeddingResponse struct {
	Data []struct {
		Embedding []float64 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Embed calls the remote embedding API.
func (e *HTTPEmbedder) Embed(text string) ([]float64, error) {
	reqBody, err := json.Marshal(embeddingRequest{
		Input: text,
		Model: e.model,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := e.baseURL + "/embeddings"
	req, err := http.NewRequest("POST", url, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if e.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+e.apiKey)
	}

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("embedding API error (status %d): %s", resp.StatusCode, body)
	}

	var embResp embeddingResponse
	if err := json.Unmarshal(body, &embResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	if embResp.Error != nil {
		return nil, fmt.Errorf("embedding API error: %s", embResp.Error.Message)
	}

	if len(embResp.Data) == 0 {
		return nil, fmt.Errorf("empty embedding response")
	}

	return embResp.Data[0].Embedding, nil
}

// Dimension returns the configured dimension.
func (e *HTTPEmbedder) Dimension() int {
	return e.dimension
}

// Close is a no-op for the HTTP embedder.
func (e *HTTPEmbedder) Close() error {
	return nil
}
