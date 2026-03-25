package provider

import (
	"encoding/json"
	"testing"
)

func TestTranslateImageToAnthropicBase64(t *testing.T) {
	img := &ImageURL{URL: "data:image/png;base64,iVBORw0KGgo="}
	ac := translateImageToAnthropic(img)

	if ac.Type != "image" {
		t.Errorf("type = %q, want image", ac.Type)
	}
	if ac.Source == nil {
		t.Fatal("source is nil")
	}
	if ac.Source.Type != "base64" {
		t.Errorf("source.type = %q, want base64", ac.Source.Type)
	}
	if ac.Source.MediaType != "image/png" {
		t.Errorf("media_type = %q, want image/png", ac.Source.MediaType)
	}
	if ac.Source.Data != "iVBORw0KGgo=" {
		t.Errorf("data = %q", ac.Source.Data)
	}
}

func TestTranslateImageToAnthropicURL(t *testing.T) {
	img := &ImageURL{URL: "https://example.com/photo.jpg"}
	ac := translateImageToAnthropic(img)

	if ac.Source == nil {
		t.Fatal("source is nil")
	}
	if ac.Source.Type != "url" {
		t.Errorf("source.type = %q, want url", ac.Source.Type)
	}
	if ac.Source.URL != "https://example.com/photo.jpg" {
		t.Errorf("url = %q", ac.Source.URL)
	}
}

func TestAnthropicTranslateRequestMultimodal(t *testing.T) {
	p := &AnthropicProvider{}

	req := &ChatRequest{
		Model: "claude-sonnet-4-20250514",
		Messages: []Message{
			TextMessage("system", "You are a helpful assistant."),
			MultimodalMessage("user", []ContentPart{
				{Type: "text", Text: "What's in this image?"},
				{Type: "image_url", ImageURL: &ImageURL{URL: "data:image/jpeg;base64,/9j/4AAQ"}},
			}),
		},
	}

	anthReq := p.translateRequest(req)

	if anthReq.System != "You are a helpful assistant." {
		t.Errorf("system = %q", anthReq.System)
	}
	if len(anthReq.Messages) != 1 {
		t.Fatalf("messages = %d, want 1", len(anthReq.Messages))
	}

	msg := anthReq.Messages[0]
	if msg.Role != "user" {
		t.Errorf("role = %q", msg.Role)
	}
	if len(msg.Content) != 2 {
		t.Fatalf("content parts = %d, want 2", len(msg.Content))
	}

	if msg.Content[0].Type != "text" || msg.Content[0].Text != "What's in this image?" {
		t.Errorf("content[0] = %+v", msg.Content[0])
	}
	if msg.Content[1].Type != "image" {
		t.Errorf("content[1].type = %q, want image", msg.Content[1].Type)
	}
	if msg.Content[1].Source.Type != "base64" {
		t.Errorf("source.type = %q, want base64", msg.Content[1].Source.Type)
	}
	if msg.Content[1].Source.MediaType != "image/jpeg" {
		t.Errorf("media_type = %q, want image/jpeg", msg.Content[1].Source.MediaType)
	}
}

func TestAnthropicTranslateRequestPlainText(t *testing.T) {
	p := &AnthropicProvider{}

	req := &ChatRequest{
		Model: "claude-sonnet-4-20250514",
		Messages: []Message{
			TextMessage("user", "Hello"),
		},
	}

	anthReq := p.translateRequest(req)
	if len(anthReq.Messages) != 1 {
		t.Fatalf("messages = %d", len(anthReq.Messages))
	}
	if len(anthReq.Messages[0].Content) != 1 {
		t.Fatalf("content = %d", len(anthReq.Messages[0].Content))
	}
	if anthReq.Messages[0].Content[0].Text != "Hello" {
		t.Errorf("text = %q", anthReq.Messages[0].Content[0].Text)
	}
}

func TestAnthropicTranslateResponseWithImages(t *testing.T) {
	p := &AnthropicProvider{}

	anthResp := &anthropicResponse{
		ID:    "msg_123",
		Model: "claude-sonnet-4-20250514",
		Content: []anthropicResponseContent{
			{Type: "text", Text: "Here's the image:"},
			{Type: "image", Source: &struct {
				Type      string `json:"type"`
				MediaType string `json:"media_type"`
				Data      string `json:"data"`
			}{
				Type:      "base64",
				MediaType: "image/png",
				Data:      "iVBOR",
			}},
		},
		StopReason: "end_turn",
		Usage: struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		}{InputTokens: 100, OutputTokens: 50},
	}

	resp := p.translateResponse(anthResp)

	if len(resp.Choices) != 1 {
		t.Fatalf("choices = %d", len(resp.Choices))
	}
	msg := resp.Choices[0].Message
	if !msg.IsMultimodal() {
		t.Error("response with images should be multimodal")
	}

	parts := msg.Parts()
	if len(parts) != 2 {
		t.Fatalf("parts = %d, want 2", len(parts))
	}
	if parts[0].Type != "text" || parts[0].Text != "Here's the image:" {
		t.Errorf("part[0] = %+v", parts[0])
	}
	if parts[1].Type != "image_url" || parts[1].ImageURL == nil {
		t.Errorf("part[1] = %+v", parts[1])
	}
	if parts[1].ImageURL.URL != "data:image/png;base64,iVBOR" {
		t.Errorf("image url = %q", parts[1].ImageURL.URL)
	}
}

// --- Computer Use Tests ---

func TestAnthropicTranslateComputerUseTool(t *testing.T) {
	p := &AnthropicProvider{}

	w, h := 1024, 768
	req := &ChatRequest{
		Model: "claude-sonnet-4-20250514",
		Tools: []Tool{
			{
				Type:          "computer_use_preview",
				DisplayWidth:  &w,
				DisplayHeight: &h,
				Environment:   "browser",
			},
		},
		Messages: []Message{
			TextMessage("user", "Click the submit button"),
		},
	}

	anthReq := p.translateRequest(req)

	if len(anthReq.Tools) != 1 {
		t.Fatalf("tools = %d, want 1", len(anthReq.Tools))
	}
	tool := anthReq.Tools[0]
	if tool.Type != "computer_20250124" {
		t.Errorf("tool.type = %q, want computer_20250124", tool.Type)
	}
	if tool.Name != "computer" {
		t.Errorf("tool.name = %q, want computer", tool.Name)
	}
	if tool.DisplayWidthPx == nil || *tool.DisplayWidthPx != 1024 {
		t.Errorf("display_width_px = %v, want 1024", tool.DisplayWidthPx)
	}
	if tool.DisplayHeightPx == nil || *tool.DisplayHeightPx != 768 {
		t.Errorf("display_height_px = %v, want 768", tool.DisplayHeightPx)
	}
}

func TestAnthropicTranslateFunctionTool(t *testing.T) {
	p := &AnthropicProvider{}

	req := &ChatRequest{
		Model: "claude-sonnet-4-20250514",
		Tools: []Tool{
			{
				Type: "function",
				Function: &FunctionDef{
					Name:        "get_weather",
					Description: "Get the weather",
					Parameters:  map[string]any{"type": "object"},
				},
			},
		},
		Messages: []Message{TextMessage("user", "What's the weather?")},
	}

	anthReq := p.translateRequest(req)
	if len(anthReq.Tools) != 1 {
		t.Fatalf("tools = %d", len(anthReq.Tools))
	}
	if anthReq.Tools[0].Name != "get_weather" {
		t.Errorf("name = %q", anthReq.Tools[0].Name)
	}
	if anthReq.Tools[0].Description != "Get the weather" {
		t.Errorf("description = %q", anthReq.Tools[0].Description)
	}
}

func TestAnthropicTranslateResponseWithToolUse(t *testing.T) {
	p := &AnthropicProvider{}

	anthResp := &anthropicResponse{
		ID:    "msg_123",
		Model: "claude-sonnet-4-20250514",
		Content: []anthropicResponseContent{
			{Type: "text", Text: "I'll click the button."},
			{
				Type:  "tool_use",
				ID:    "toolu_456",
				Name:  "computer",
				Input: json.RawMessage(`{"action":"click","coordinate":[100,200]}`),
			},
		},
		StopReason: "tool_use",
	}

	resp := p.translateResponse(anthResp)

	msg := resp.Choices[0].Message
	if msg.TextContent() != "I'll click the button." {
		t.Errorf("text = %q", msg.TextContent())
	}
	if len(msg.ToolCalls) != 1 {
		t.Fatalf("tool_calls = %d, want 1", len(msg.ToolCalls))
	}

	tc := msg.ToolCalls[0]
	if tc.ID != "toolu_456" {
		t.Errorf("id = %q", tc.ID)
	}
	if tc.Type != "computer_call" {
		t.Errorf("type = %q, want computer_call", tc.Type)
	}
	if string(tc.Action) != `{"action":"click","coordinate":[100,200]}` {
		t.Errorf("action = %s", string(tc.Action))
	}

	// finish_reason should be "tool_calls" for tool_use stop
	if *resp.Choices[0].FinishReason != "tool_calls" {
		t.Errorf("finish_reason = %q, want tool_calls", *resp.Choices[0].FinishReason)
	}
}

func TestAnthropicTranslateResponseWithFunctionToolUse(t *testing.T) {
	p := &AnthropicProvider{}

	anthResp := &anthropicResponse{
		ID:    "msg_789",
		Model: "claude-sonnet-4-20250514",
		Content: []anthropicResponseContent{
			{
				Type:  "tool_use",
				ID:    "toolu_abc",
				Name:  "get_weather",
				Input: json.RawMessage(`{"city":"London"}`),
			},
		},
		StopReason: "tool_use",
	}

	resp := p.translateResponse(anthResp)
	msg := resp.Choices[0].Message

	if len(msg.ToolCalls) != 1 {
		t.Fatalf("tool_calls = %d", len(msg.ToolCalls))
	}
	tc := msg.ToolCalls[0]
	if tc.Type != "function" {
		t.Errorf("type = %q, want function", tc.Type)
	}
	if tc.Function == nil {
		t.Fatal("function is nil")
	}
	if tc.Function.Name != "get_weather" {
		t.Errorf("name = %q", tc.Function.Name)
	}
	if tc.Function.Arguments != `{"city":"London"}` {
		t.Errorf("arguments = %q", tc.Function.Arguments)
	}
}

func TestAnthropicTranslateToolResultMessage(t *testing.T) {
	p := &AnthropicProvider{}

	// Simulate tool result message in OpenAI format
	resultContent, _ := json.Marshal("screenshot captured")
	msg := Message{
		Role:       "tool",
		Content:    resultContent,
		ToolCallID: "toolu_456",
	}

	req := &ChatRequest{
		Model:    "claude-sonnet-4-20250514",
		Messages: []Message{TextMessage("user", "Click it"), msg},
	}

	anthReq := p.translateRequest(req)

	// Should have 2 messages: user text + user with tool_result
	if len(anthReq.Messages) != 2 {
		t.Fatalf("messages = %d, want 2", len(anthReq.Messages))
	}

	toolResultMsg := anthReq.Messages[1]
	if toolResultMsg.Role != "user" {
		t.Errorf("role = %q, want user", toolResultMsg.Role)
	}
	if len(toolResultMsg.Content) != 1 {
		t.Fatalf("content = %d", len(toolResultMsg.Content))
	}
	if toolResultMsg.Content[0].Type != "tool_result" {
		t.Errorf("type = %q, want tool_result", toolResultMsg.Content[0].Type)
	}
	if toolResultMsg.Content[0].ToolUseID != "toolu_456" {
		t.Errorf("tool_use_id = %q", toolResultMsg.Content[0].ToolUseID)
	}
}

func TestAnthropicRequestMarshal(t *testing.T) {
	p := &AnthropicProvider{}

	w, h := 1024, 768
	req := &ChatRequest{
		Model: "claude-sonnet-4-20250514",
		Tools: []Tool{
			{
				Type:          "computer_use_preview",
				DisplayWidth:  &w,
				DisplayHeight: &h,
			},
		},
		Messages: []Message{
			MultimodalMessage("user", []ContentPart{
				{Type: "text", Text: "Describe"},
				{Type: "image_url", ImageURL: &ImageURL{URL: "data:image/png;base64,abc"}},
			}),
		},
	}

	anthReq := p.translateRequest(req)
	b, err := json.Marshal(anthReq)
	if err != nil {
		t.Fatal(err)
	}

	var raw map[string]any
	json.Unmarshal(b, &raw)

	// Verify tools
	tools := raw["tools"].([]any)
	if len(tools) != 1 {
		t.Fatalf("tools = %d", len(tools))
	}
	tool := tools[0].(map[string]any)
	if tool["type"] != "computer_20250124" {
		t.Errorf("tool.type = %v", tool["type"])
	}

	// Verify messages
	msgs := raw["messages"].([]any)
	msg := msgs[0].(map[string]any)
	content := msg["content"].([]any)
	if len(content) != 2 {
		t.Fatalf("content = %d", len(content))
	}
}

func TestComputerUseToolJSON(t *testing.T) {
	// Test that Tool struct serializes correctly for OpenAI format
	w, h := 1024, 768
	tool := Tool{
		Type:          "computer_use_preview",
		DisplayWidth:  &w,
		DisplayHeight: &h,
		Environment:   "browser",
	}

	b, err := json.Marshal(tool)
	if err != nil {
		t.Fatal(err)
	}

	var raw map[string]any
	json.Unmarshal(b, &raw)

	if raw["type"] != "computer_use_preview" {
		t.Errorf("type = %v", raw["type"])
	}
	if raw["display_width"] != float64(1024) {
		t.Errorf("display_width = %v", raw["display_width"])
	}
	if raw["display_height"] != float64(768) {
		t.Errorf("display_height = %v", raw["display_height"])
	}
	if raw["environment"] != "browser" {
		t.Errorf("environment = %v", raw["environment"])
	}
}
