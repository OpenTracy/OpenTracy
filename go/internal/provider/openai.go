package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// OpenAIProvider forwards requests to OpenAI-compatible APIs.
// Works for: OpenAI, Groq, DeepSeek, Perplexity, Cerebras, SambaNova, Mistral, Together.
type OpenAIProvider struct {
	name    string
	baseURL string
	apiKey  string
	client  *http.Client
}

// NewOpenAIProvider creates a provider for any OpenAI-compatible API.
func NewOpenAIProvider(cfg ProviderConfig) *OpenAIProvider {
	apiKey := os.Getenv(cfg.APIKeyEnv)
	return &OpenAIProvider{
		name:    cfg.Name,
		baseURL: cfg.BaseURL,
		apiKey:  apiKey,
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (p *OpenAIProvider) Name() string        { return p.name }
func (p *OpenAIProvider) SetAPIKey(key string) { p.apiKey = key }
func (p *OpenAIProvider) HasAPIKey() bool      { return p.apiKey != "" }

func (p *OpenAIProvider) Send(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	req.Stream = false

	body, err := p.buildBody(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	p.setHeaders(httpReq)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("provider %s error (status %d): %s", p.name, resp.StatusCode, respBody)
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	return &chatResp, nil
}

func (p *OpenAIProvider) SendStream(ctx context.Context, req *ChatRequest) (io.ReadCloser, error) {
	req.Stream = true

	body, err := p.buildBody(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	p.setHeaders(httpReq)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("provider %s error (status %d): %s", p.name, resp.StatusCode, body)
	}

	return resp.Body, nil
}

func (p *OpenAIProvider) buildBody(req *ChatRequest) ([]byte, error) {
	// If we have raw body, use it (preserves unknown fields) but override stream
	if req.RawBody != nil {
		var m map[string]any
		if err := json.Unmarshal(req.RawBody, &m); err == nil {
			m["stream"] = req.Stream
			return json.Marshal(m)
		}
	}
	return json.Marshal(req)
}

func (p *OpenAIProvider) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}
}
