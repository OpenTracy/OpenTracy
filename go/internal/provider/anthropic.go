package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// AnthropicProvider translates OpenAI-format requests to Anthropic's Messages API.
type AnthropicProvider struct {
	name    string
	baseURL string
	apiKey  string
	client  *http.Client
}

// NewAnthropicProvider creates an Anthropic provider.
func NewAnthropicProvider(cfg ProviderConfig) *AnthropicProvider {
	apiKey := os.Getenv(cfg.APIKeyEnv)
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://api.anthropic.com"
	}
	return &AnthropicProvider{
		name:    cfg.Name,
		baseURL: baseURL,
		apiKey:  apiKey,
		client:  &http.Client{Timeout: 120 * time.Second},
	}
}

func (p *AnthropicProvider) Name() string        { return p.name }
func (p *AnthropicProvider) SetAPIKey(key string) { p.apiKey = key }
func (p *AnthropicProvider) HasAPIKey() bool      { return p.apiKey != "" }

// --- Anthropic native types ---

type anthropicRequest struct {
	Model     string             `json:"model"`
	Messages  []anthropicMessage `json:"messages"`
	Tools     []anthropicTool    `json:"tools,omitempty"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system,omitempty"`
	Stream    bool               `json:"stream,omitempty"`
}

type anthropicTool struct {
	// Function tool fields
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
	InputSchema any    `json:"input_schema,omitempty"`

	// Computer use tool fields
	Type           string `json:"type,omitempty"`             // "computer_20250124"
	DisplayWidthPx *int   `json:"display_width_px,omitempty"`
	DisplayHeightPx *int  `json:"display_height_px,omitempty"`
}

type anthropicMessage struct {
	Role    string             `json:"role"`
	Content []anthropicContent `json:"content"`
}

type anthropicContent struct {
	Type   string                `json:"type"`                  // "text", "image", "tool_use", "tool_result"
	Text   string                `json:"text,omitempty"`        // for type="text"
	Source *anthropicImageSource `json:"source,omitempty"`      // for type="image"
	ID     string                `json:"id,omitempty"`          // for type="tool_use"
	Name   string                `json:"name,omitempty"`        // for type="tool_use"
	Input  json.RawMessage       `json:"input,omitempty"`       // for type="tool_use"
	ToolUseID string             `json:"tool_use_id,omitempty"` // for type="tool_result"
	Content_ json.RawMessage     `json:"content,omitempty"`     // for type="tool_result" (nested content)
}

type anthropicImageSource struct {
	Type      string `json:"type"`           // "base64" or "url"
	MediaType string `json:"media_type"`     // e.g. "image/png"
	Data      string `json:"data,omitempty"` // base64 data (for type="base64")
	URL       string `json:"url,omitempty"`  // URL (for type="url")
}

type anthropicResponse struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Role    string `json:"role"`
	Content []anthropicResponseContent `json:"content"`
	Model      string `json:"model"`
	StopReason string `json:"stop_reason"`
	Usage      struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

type anthropicResponseContent struct {
	Type   string          `json:"type"`             // "text", "image", "tool_use"
	Text   string          `json:"text,omitempty"`
	ID     string          `json:"id,omitempty"`     // tool_use ID
	Name   string          `json:"name,omitempty"`   // tool_use name
	Input  json.RawMessage `json:"input,omitempty"`  // tool_use input
	Source *struct {
		Type      string `json:"type"`
		MediaType string `json:"media_type"`
		Data      string `json:"data"`
	} `json:"source,omitempty"` // image source
}

// --- Send ---

func (p *AnthropicProvider) Send(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	anthReq := p.translateRequest(req)
	anthReq.Stream = false

	body, err := json.Marshal(anthReq)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/v1/messages", bytes.NewReader(body))
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
		return nil, fmt.Errorf("anthropic error (status %d): %s", resp.StatusCode, respBody)
	}

	var anthResp anthropicResponse
	if err := json.Unmarshal(respBody, &anthResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	return p.translateResponse(&anthResp), nil
}

func (p *AnthropicProvider) SendStream(ctx context.Context, req *ChatRequest) (io.ReadCloser, error) {
	anthReq := p.translateRequest(req)
	anthReq.Stream = true

	body, err := json.Marshal(anthReq)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/v1/messages", bytes.NewReader(body))
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
		return nil, fmt.Errorf("anthropic error (status %d): %s", resp.StatusCode, body)
	}

	// Translate Anthropic SSE → OpenAI SSE on the fly
	return NewAnthropicStreamAdapter(resp.Body, req.Model), nil
}

// --- Request Translation ---

func (p *AnthropicProvider) translateRequest(req *ChatRequest) *anthropicRequest {
	anthReq := &anthropicRequest{
		Model:     req.Model,
		MaxTokens: 1024,
	}

	if req.MaxTokens != nil {
		anthReq.MaxTokens = *req.MaxTokens
	}

	// Translate tools
	anthReq.Tools = p.translateTools(req.Tools)

	// Translate messages
	for _, m := range req.Messages {
		if m.Role == "system" {
			anthReq.System = m.TextContent()
			continue
		}

		// Tool result messages (OpenAI role="tool") → Anthropic tool_result content block
		if m.IsToolResult() {
			anthReq.Messages = append(anthReq.Messages, anthropicMessage{
				Role: "user",
				Content: []anthropicContent{{
					Type:      "tool_result",
					ToolUseID: m.ToolCallID,
					Content_:  m.Content,
				}},
			})
			continue
		}

		am := anthropicMessage{Role: m.Role}

		// Assistant message with tool calls → tool_use content blocks
		if m.HasToolCalls() {
			// Include any text content
			text := m.TextContent()
			if text != "" {
				am.Content = append(am.Content, anthropicContent{
					Type: "text",
					Text: text,
				})
			}
			// Translate each tool call
			for _, tc := range m.ToolCalls {
				ac := p.translateToolCallToContent(tc)
				am.Content = append(am.Content, ac)
			}
			anthReq.Messages = append(anthReq.Messages, am)
			continue
		}

		// Regular message (text or multimodal)
		if m.IsMultimodal() {
			for _, part := range m.Parts() {
				switch part.Type {
				case "text":
					am.Content = append(am.Content, anthropicContent{
						Type: "text",
						Text: part.Text,
					})
				case "image_url":
					if part.ImageURL != nil {
						ac := translateImageToAnthropic(part.ImageURL)
						am.Content = append(am.Content, ac)
					}
				}
			}
		} else {
			am.Content = []anthropicContent{{
				Type: "text",
				Text: m.TextContent(),
			}}
		}

		anthReq.Messages = append(anthReq.Messages, am)
	}

	// Anthropic requires at least one non-system message
	if len(anthReq.Messages) == 0 {
		anthReq.Messages = []anthropicMessage{{
			Role:    "user",
			Content: []anthropicContent{{Type: "text", Text: ""}},
		}}
	}

	return anthReq
}

// translateTools converts OpenAI tool definitions to Anthropic format.
func (p *AnthropicProvider) translateTools(tools []Tool) []anthropicTool {
	if len(tools) == 0 {
		return nil
	}

	var result []anthropicTool
	for _, t := range tools {
		switch t.Type {
		case "computer_use_preview":
			// OpenAI computer_use_preview → Anthropic computer_20250124
			at := anthropicTool{
				Type: "computer_20250124",
				Name: "computer",
			}
			if t.DisplayWidth != nil {
				at.DisplayWidthPx = t.DisplayWidth
			}
			if t.DisplayHeight != nil {
				at.DisplayHeightPx = t.DisplayHeight
			}
			result = append(result, at)

		case "function":
			if t.Function != nil {
				result = append(result, anthropicTool{
					Name:        t.Function.Name,
					Description: t.Function.Description,
					InputSchema: t.Function.Parameters,
				})
			}
		}
	}
	return result
}

// translateToolCallToContent converts an OpenAI tool call to an Anthropic tool_use content block.
func (p *AnthropicProvider) translateToolCallToContent(tc ToolCall) anthropicContent {
	ac := anthropicContent{
		Type: "tool_use",
		ID:   tc.ID,
	}

	switch tc.Type {
	case "function":
		if tc.Function != nil {
			ac.Name = tc.Function.Name
			ac.Input = json.RawMessage(tc.Function.Arguments)
		}
	case "computer_call":
		// OpenAI computer_call → Anthropic tool_use with name="computer"
		ac.Name = "computer"
		ac.Input = tc.Action
	}

	return ac
}

// --- Image Translation ---

func translateImageToAnthropic(img *ImageURL) anthropicContent {
	ac := anthropicContent{Type: "image"}

	if strings.HasPrefix(img.URL, "data:") {
		mediaType, data, ok := parseDataURI(img.URL)
		if ok {
			ac.Source = &anthropicImageSource{
				Type:      "base64",
				MediaType: mediaType,
				Data:      data,
			}
			return ac
		}
	}

	ac.Source = &anthropicImageSource{
		Type:      "url",
		MediaType: "image/jpeg",
		URL:       img.URL,
	}
	return ac
}

func parseDataURI(uri string) (mediaType, data string, ok bool) {
	rest := strings.TrimPrefix(uri, "data:")
	idx := strings.Index(rest, ",")
	if idx < 0 {
		return "", "", false
	}
	meta := rest[:idx]
	data = rest[idx+1:]

	parts := strings.Split(meta, ";")
	if len(parts) < 2 || parts[len(parts)-1] != "base64" {
		return "", "", false
	}
	mediaType = parts[0]

	if data == "" {
		return "", "", false
	}

	return mediaType, data, true
}

// --- Response Translation ---

func (p *AnthropicProvider) translateResponse(anthResp *anthropicResponse) *ChatResponse {
	var contentParts []ContentPart
	var toolCalls []ToolCall
	hasImages := false

	for _, c := range anthResp.Content {
		switch c.Type {
		case "text":
			contentParts = append(contentParts, ContentPart{
				Type: "text",
				Text: c.Text,
			})

		case "image":
			if c.Source != nil {
				dataURI := "data:" + c.Source.MediaType + ";base64," + c.Source.Data
				contentParts = append(contentParts, ContentPart{
					Type:     "image_url",
					ImageURL: &ImageURL{URL: dataURI},
				})
				hasImages = true
			}

		case "tool_use":
			// Anthropic tool_use → OpenAI tool_call
			tc := ToolCall{
				ID: c.ID,
			}
			if c.Name == "computer" {
				// Computer use tool call
				tc.Type = "computer_call"
				tc.Action = c.Input
			} else {
				// Regular function call
				tc.Type = "function"
				tc.Function = &FunctionCall{
					Name:      c.Name,
					Arguments: string(c.Input),
				}
			}
			toolCalls = append(toolCalls, tc)
		}
	}

	// Build response message
	var msg Message
	if hasImages {
		msg = MultimodalMessage("assistant", contentParts)
	} else {
		var text strings.Builder
		for _, cp := range contentParts {
			if cp.Type == "text" {
				text.WriteString(cp.Text)
			}
		}
		msg = TextMessage("assistant", text.String())
	}
	msg.ToolCalls = toolCalls

	finishReason := "stop"
	if anthResp.StopReason == "max_tokens" {
		finishReason = "length"
	} else if anthResp.StopReason == "tool_use" {
		finishReason = "tool_calls"
	}

	return &ChatResponse{
		ID:      anthResp.ID,
		Object:  "chat.completion",
		Model:   anthResp.Model,
		Choices: []Choice{{
			Index:        0,
			Message:      &msg,
			FinishReason: &finishReason,
		}},
		Usage: &Usage{
			PromptTokens:     anthResp.Usage.InputTokens,
			CompletionTokens: anthResp.Usage.OutputTokens,
			TotalTokens:      anthResp.Usage.InputTokens + anthResp.Usage.OutputTokens,
		},
	}
}

func (p *AnthropicProvider) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
}
