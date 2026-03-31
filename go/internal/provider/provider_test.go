package provider

import (
	"encoding/json"
	"testing"
)

func TestTextMessage(t *testing.T) {
	m := TextMessage("user", "Hello world")
	if m.Role != "user" {
		t.Errorf("role = %q, want user", m.Role)
	}
	if m.TextContent() != "Hello world" {
		t.Errorf("text = %q, want Hello world", m.TextContent())
	}
	if m.IsMultimodal() {
		t.Error("plain text should not be multimodal")
	}
}

func TestMultimodalMessage(t *testing.T) {
	parts := []ContentPart{
		{Type: "text", Text: "What's in this image?"},
		{Type: "image_url", ImageURL: &ImageURL{URL: "data:image/png;base64,abc123"}},
	}
	m := MultimodalMessage("user", parts)

	if !m.IsMultimodal() {
		t.Error("should be multimodal")
	}

	text := m.TextContent()
	if text != "What's in this image?" {
		t.Errorf("text = %q, want 'What's in this image?'", text)
	}

	parsed := m.Parts()
	if len(parsed) != 2 {
		t.Fatalf("parts = %d, want 2", len(parsed))
	}
	if parsed[0].Type != "text" {
		t.Errorf("part[0].type = %q, want text", parsed[0].Type)
	}
	if parsed[1].Type != "image_url" {
		t.Errorf("part[1].type = %q, want image_url", parsed[1].Type)
	}
	if parsed[1].ImageURL.URL != "data:image/png;base64,abc123" {
		t.Errorf("image url wrong: %q", parsed[1].ImageURL.URL)
	}
}

func TestMessageJSONRoundtrip(t *testing.T) {
	// Text message roundtrip
	m := TextMessage("assistant", "Hi there")
	b, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	var m2 Message
	if err := json.Unmarshal(b, &m2); err != nil {
		t.Fatal(err)
	}
	if m2.TextContent() != "Hi there" {
		t.Errorf("roundtrip text = %q", m2.TextContent())
	}

	// Multimodal message roundtrip
	parts := []ContentPart{
		{Type: "text", Text: "Describe this"},
		{Type: "image_url", ImageURL: &ImageURL{URL: "https://example.com/img.jpg", Detail: "high"}},
	}
	mm := MultimodalMessage("user", parts)
	b, err = json.Marshal(mm)
	if err != nil {
		t.Fatal(err)
	}
	var mm2 Message
	if err := json.Unmarshal(b, &mm2); err != nil {
		t.Fatal(err)
	}
	if !mm2.IsMultimodal() {
		t.Error("should still be multimodal after roundtrip")
	}
	p := mm2.Parts()
	if len(p) != 2 {
		t.Fatalf("parts = %d after roundtrip", len(p))
	}
	if p[1].ImageURL.Detail != "high" {
		t.Errorf("detail = %q, want high", p[1].ImageURL.Detail)
	}
}

func TestParseIncomingMultimodalJSON(t *testing.T) {
	// Simulate what a client would send (OpenAI multimodal format)
	raw := `{
		"role": "user",
		"content": [
			{"type": "text", "text": "What animal is this?"},
			{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,/9j/4AAQ"}}
		]
	}`

	var m Message
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		t.Fatal(err)
	}

	if m.Role != "user" {
		t.Errorf("role = %q", m.Role)
	}
	if !m.IsMultimodal() {
		t.Error("should be multimodal")
	}
	if m.TextContent() != "What animal is this?" {
		t.Errorf("text = %q", m.TextContent())
	}

	parts := m.Parts()
	if len(parts) != 2 {
		t.Fatalf("parts = %d", len(parts))
	}
	if parts[1].ImageURL == nil {
		t.Fatal("image_url is nil")
	}
	if parts[1].ImageURL.URL != "data:image/jpeg;base64,/9j/4AAQ" {
		t.Errorf("url = %q", parts[1].ImageURL.URL)
	}
}

func TestParseDataURI(t *testing.T) {
	tests := []struct {
		uri       string
		mediaType string
		data      string
		ok        bool
	}{
		{"data:image/png;base64,iVBOR", "image/png", "iVBOR", true},
		{"data:image/jpeg;base64,/9j/4AAQ", "image/jpeg", "/9j/4AAQ", true},
		{"data:image/webp;base64,UklG", "image/webp", "UklG", true},
		{"https://example.com/img.jpg", "", "", false},
		{"data:text/plain,hello", "", "", false}, // no base64
		{"data:image/png;base64,", "", "", false}, // empty data
	}

	for _, tt := range tests {
		mediaType, data, ok := parseDataURI(tt.uri)
		if ok != tt.ok {
			t.Errorf("parseDataURI(%q): ok = %v, want %v", tt.uri, ok, tt.ok)
			continue
		}
		if ok {
			if mediaType != tt.mediaType {
				t.Errorf("mediaType = %q, want %q", mediaType, tt.mediaType)
			}
			if data != tt.data {
				t.Errorf("data = %q, want %q", data, tt.data)
			}
		}
	}
}

func TestPlainStringPartsReturnsTextPart(t *testing.T) {
	m := TextMessage("user", "Just text")
	parts := m.Parts()
	if len(parts) != 1 {
		t.Fatalf("parts = %d, want 1", len(parts))
	}
	if parts[0].Type != "text" || parts[0].Text != "Just text" {
		t.Errorf("part = %+v, want text:'Just text'", parts[0])
	}
}

func TestParseAssistantMessageWithSingularToolCall(t *testing.T) {
	raw := `{
		"role": "assistant",
		"content": null,
		"tool_call": {
			"id": "call_123",
			"type": "function",
			"function": {
				"name": "get_weather",
				"arguments": "{\"city\":\"Lisbon\"}"
			}
		}
	}`

	var m Message
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		t.Fatal(err)
	}

	if !m.HasToolCalls() {
		t.Fatal("expected tool calls")
	}
	if len(m.ToolCalls) != 1 {
		t.Fatalf("tool_calls = %d, want 1", len(m.ToolCalls))
	}
	if m.ToolCalls[0].ID != "call_123" {
		t.Errorf("id = %q, want call_123", m.ToolCalls[0].ID)
	}
	if m.ToolCalls[0].Function == nil || m.ToolCalls[0].Function.Name != "get_weather" {
		t.Fatalf("unexpected function: %+v", m.ToolCalls[0].Function)
	}
	if m.TextContent() != "" {
		t.Errorf("text = %q, want empty", m.TextContent())
	}
}

func TestParseAssistantMessageWithLegacyFunctionCall(t *testing.T) {
	raw := `{
		"role": "assistant",
		"content": null,
		"function_call": {
			"name": "get_weather",
			"arguments": "{\"city\":\"Porto\"}"
		}
	}`

	var m Message
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		t.Fatal(err)
	}

	if !m.HasToolCalls() {
		t.Fatal("expected tool calls")
	}
	if len(m.ToolCalls) != 1 {
		t.Fatalf("tool_calls = %d, want 1", len(m.ToolCalls))
	}
	if m.ToolCalls[0].Type != "function" {
		t.Errorf("type = %q, want function", m.ToolCalls[0].Type)
	}
	if m.ToolCalls[0].Function == nil || m.ToolCalls[0].Function.Name != "get_weather" {
		t.Fatalf("unexpected function: %+v", m.ToolCalls[0].Function)
	}
	if m.TextContent() != "" {
		t.Errorf("text = %q, want empty", m.TextContent())
	}
}
