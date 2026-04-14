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
			if req.Stream {
				// Ensure usage is included in the final stream chunk so we can
				// record full trace metrics (tokens, cost) for streaming requests.
				opts, _ := m["stream_options"].(map[string]any)
				if opts == nil {
					opts = map[string]any{}
				}
				opts["include_usage"] = true
				m["stream_options"] = opts
			}
			return json.Marshal(m)
		}
	}
	if req.Stream {
		m := map[string]any{
			"model":          req.Model,
			"messages":       req.Messages,
			"stream":         true,
			"stream_options": map[string]any{"include_usage": true},
		}
		if req.MaxTokens != nil {
			m["max_tokens"] = *req.MaxTokens
		}
		if req.Temperature != nil {
			m["temperature"] = *req.Temperature
		}
		if req.TopP != nil {
			m["top_p"] = *req.TopP
		}
		if len(req.Tools) > 0 {
			m["tools"] = req.Tools
		}
		if req.ToolChoice != nil {
			m["tool_choice"] = req.ToolChoice
		}
		if req.Stop != nil {
			m["stop"] = req.Stop
		}
		return json.Marshal(m)
	}
	return json.Marshal(req)
}

func (p *OpenAIProvider) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}
}
