package provider

import (
	"context"
	"encoding/json"
	"io"
	"strings"
)

// Provider forwards LLM requests to upstream APIs.
type Provider interface {
	// Send forwards a non-streaming chat completion request.
	Send(ctx context.Context, req *ChatRequest) (*ChatResponse, error)

	// SendStream forwards a streaming request and returns a reader for SSE events.
	SendStream(ctx context.Context, req *ChatRequest) (io.ReadCloser, error)

	// Name returns the provider name (e.g., "openai", "anthropic").
	Name() string

	// SetAPIKey updates the API key at runtime (for dynamic key management).
	SetAPIKey(key string)

	// HasAPIKey returns true if the provider has a configured API key.
	HasAPIKey() bool
}

// ChatRequest is the OpenAI-compatible chat completion request.
type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Tools       []Tool    `json:"tools,omitempty"`
	ToolChoice  any       `json:"tool_choice,omitempty"` // "auto", "none", "required", or {"type":"function","function":{"name":"..."}}
	MaxTokens   *int      `json:"max_tokens,omitempty"`
	Temperature *float64  `json:"temperature,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
	TopP        *float64  `json:"top_p,omitempty"`
	Stop        any       `json:"stop,omitempty"`

	// Raw JSON body for pass-through (preserves unknown fields)
	RawBody []byte `json:"-"`
}

// --- Tools ---

// Tool defines a tool available to the model.
type Tool struct {
	Type     string        `json:"type"`               // "function", "computer_use_preview"
	Function *FunctionDef  `json:"function,omitempty"`  // for type="function"
	Computer *ComputerTool `json:"computer,omitempty"`  // internal; populated during parsing

	// computer_use_preview fields (OpenAI format, top-level)
	DisplayWidth  *int   `json:"display_width,omitempty"`
	DisplayHeight *int   `json:"display_height,omitempty"`
	Environment   string `json:"environment,omitempty"` // "browser", "mac", "windows", "ubuntu"
}

// FunctionDef describes a function tool.
type FunctionDef struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Parameters  any    `json:"parameters,omitempty"` // JSON Schema
}

// ComputerTool holds parsed computer_use_preview configuration.
type ComputerTool struct {
	DisplayWidth  int    `json:"display_width"`
	DisplayHeight int    `json:"display_height"`
	Environment   string `json:"environment,omitempty"`
}

// IsComputerUse returns true if this tool is a computer use tool.
func (t Tool) IsComputerUse() bool {
	return t.Type == "computer_use_preview"
}

// --- Tool Calls (in assistant responses) ---

// ToolCall represents a tool invocation by the model.
type ToolCall struct {
	ID       string          `json:"id"`
	Type     string          `json:"type"`                // "function", "computer_call"
	Function *FunctionCall   `json:"function,omitempty"`  // for type="function"
	Action   json.RawMessage `json:"action,omitempty"`    // for type="computer_call"
}

// FunctionCall is a function invocation in a tool call.
type FunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON string
}

// --- Messages ---

// Message is an OpenAI-compatible chat message.
// Content is json.RawMessage so it can be either a string or an array
// of content parts (for multimodal messages with images, tool results, etc).
type Message struct {
	Role       string          `json:"role"`
	Content    json.RawMessage `json:"content"`
	ToolCalls  []ToolCall      `json:"tool_calls,omitempty"`   // assistant messages with tool calls
	ToolCallID string          `json:"tool_call_id,omitempty"` // tool result messages (role="tool")
	Name       string          `json:"name,omitempty"`         // tool name for role="tool"
}

func (m *Message) UnmarshalJSON(data []byte) error {
	type messageAlias struct {
		Role         string          `json:"role"`
		Content      json.RawMessage `json:"content"`
		ToolCalls    []ToolCall      `json:"tool_calls,omitempty"`
		ToolCall     *ToolCall       `json:"tool_call,omitempty"`
		FunctionCall *FunctionCall   `json:"function_call,omitempty"`
		ToolCallID   string          `json:"tool_call_id,omitempty"`
		Name         string          `json:"name,omitempty"`
	}

	var aux messageAlias
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	m.Role = aux.Role
	m.ToolCallID = aux.ToolCallID
	m.Name = aux.Name

	if len(aux.Content) == 0 || string(aux.Content) == "null" {
		m.Content = json.RawMessage(`""`)
	} else {
		m.Content = aux.Content
	}

	if len(aux.ToolCalls) > 0 {
		m.ToolCalls = aux.ToolCalls
	} else if aux.ToolCall != nil {
		m.ToolCalls = []ToolCall{*aux.ToolCall}
	} else if aux.FunctionCall != nil {
		m.ToolCalls = []ToolCall{{
			Type:     "function",
			Function: aux.FunctionCall,
		}}
	}

	for i := range m.ToolCalls {
		if m.ToolCalls[i].Type == "" {
			if m.ToolCalls[i].Function != nil {
				m.ToolCalls[i].Type = "function"
			} else {
				m.ToolCalls[i].Type = "function"
			}
		}
	}

	return nil
}

// TextContent extracts the text from content, whether it's a plain string
// or a multimodal array of content parts.
func (m Message) TextContent() string {
	if len(m.Content) == 0 {
		return ""
	}

	// Try plain string first
	var s string
	if json.Unmarshal(m.Content, &s) == nil {
		return s
	}

	// Try multimodal array
	var parts []ContentPart
	if json.Unmarshal(m.Content, &parts) == nil {
		var b strings.Builder
		for _, p := range parts {
			if p.Type == "text" {
				if b.Len() > 0 {
					b.WriteByte('\n')
				}
				b.WriteString(p.Text)
			}
		}
		return b.String()
	}

	return string(m.Content)
}

// Parts parses content as a multimodal content parts array.
// If content is a plain string, returns a single text part.
func (m Message) Parts() []ContentPart {
	if len(m.Content) == 0 {
		return nil
	}

	var parts []ContentPart
	if json.Unmarshal(m.Content, &parts) == nil {
		return parts
	}

	// Plain string → single text part
	var s string
	if json.Unmarshal(m.Content, &s) == nil {
		return []ContentPart{{Type: "text", Text: s}}
	}

	return nil
}

// IsMultimodal returns true if content is an array (not a plain string).
func (m Message) IsMultimodal() bool {
	return len(m.Content) > 0 && m.Content[0] == '['
}

// HasToolCalls returns true if the message contains tool calls.
func (m Message) HasToolCalls() bool {
	return len(m.ToolCalls) > 0
}

// IsToolResult returns true if this is a tool result message.
func (m Message) IsToolResult() bool {
	return m.Role == "tool" && m.ToolCallID != ""
}

// TextMessage creates a Message with plain string content.
func TextMessage(role, text string) Message {
	b, _ := json.Marshal(text)
	return Message{Role: role, Content: b}
}

// MultimodalMessage creates a Message with an array of content parts.
func MultimodalMessage(role string, parts []ContentPart) Message {
	b, _ := json.Marshal(parts)
	return Message{Role: role, Content: b}
}

// --- Content Parts (OpenAI multimodal format) ---

// ContentPart is a single part in a multimodal message.
type ContentPart struct {
	Type     string    `json:"type"`                // "text", "image_url"
	Text     string    `json:"text,omitempty"`      // for type="text"
	ImageURL *ImageURL `json:"image_url,omitempty"` // for type="image_url"
}

// ImageURL references an image by URL or base64 data URI.
type ImageURL struct {
	URL    string `json:"url"`              // "https://..." or "data:image/png;base64,..."
	Detail string `json:"detail,omitempty"` // "low", "high", "auto"
}

// --- Response ---

// ChatResponse is the OpenAI-compatible chat completion response.
type ChatResponse struct {
	ID      string   `json:"id"`
	Object  string   `json:"object"`
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   *Usage   `json:"usage,omitempty"`
}

// Choice is a single completion choice.
type Choice struct {
	Index        int      `json:"index"`
	Message      *Message `json:"message,omitempty"`
	Delta        *Message `json:"delta,omitempty"`
	FinishReason *string  `json:"finish_reason,omitempty"`
}

// Usage contains token usage information.
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ProviderConfig defines how to connect to a provider.
type ProviderConfig struct {
	Name      string `yaml:"name" json:"name"`
	BaseURL   string `yaml:"base_url" json:"base_url"`
	APIKeyEnv string `yaml:"api_key_env" json:"api_key_env"`
	Format    string `yaml:"format" json:"format"` // "openai" or "anthropic"
}
