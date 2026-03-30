package provider

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"
)

// AnthropicStreamAdapter translates Anthropic SSE events to OpenAI SSE format.
// Anthropic emits: message_start, content_block_start, content_block_delta,
//
//	content_block_stop, message_delta, message_stop
//
// OpenAI expects: data: {"choices":[{"delta":{"content":"..."}}]} per chunk.
type AnthropicStreamAdapter struct {
	reader *io.PipeReader
	closer io.Closer
}

// NewAnthropicStreamAdapter wraps an Anthropic SSE stream and emits OpenAI-format SSE.
func NewAnthropicStreamAdapter(upstream io.ReadCloser, model string) *AnthropicStreamAdapter {
	pr, pw := io.Pipe()
	adapter := &AnthropicStreamAdapter{reader: pr, closer: upstream}

	go func() {
		defer pw.Close()
		defer upstream.Close()

		scanner := bufio.NewScanner(upstream)
		// Increase buffer for large events
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

		var msgID string
		created := time.Now().Unix()

		for scanner.Scan() {
			line := scanner.Text()

			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := line[6:]

			var event map[string]any
			if err := json.Unmarshal([]byte(data), &event); err != nil {
				continue
			}

			eventType, _ := event["type"].(string)

			switch eventType {
			case "message_start":
				// Extract message ID
				if msg, ok := event["message"].(map[string]any); ok {
					msgID, _ = msg["id"].(string)
				}
				// Emit initial chunk with role
				chunk := openAIStreamChunk{
					ID:      msgID,
					Object:  "chat.completion.chunk",
					Created: created,
					Model:   model,
					Choices: []openAIStreamChoice{{
						Index: 0,
						Delta: &openAIStreamDelta{Role: "assistant"},
					}},
				}
				writeSSE(pw, chunk)

			case "content_block_delta":
				delta, _ := event["delta"].(map[string]any)
				deltaType, _ := delta["type"].(string)

				switch deltaType {
				case "text_delta":
					text, _ := delta["text"].(string)
					chunk := openAIStreamChunk{
						ID:      msgID,
						Object:  "chat.completion.chunk",
						Created: created,
						Model:   model,
						Choices: []openAIStreamChoice{{
							Index: 0,
							Delta: &openAIStreamDelta{Content: text},
						}},
					}
					writeSSE(pw, chunk)

				case "input_json_delta":
					// Tool call argument streaming
					partial, _ := delta["partial_json"].(string)
					chunk := openAIStreamChunk{
						ID:      msgID,
						Object:  "chat.completion.chunk",
						Created: created,
						Model:   model,
						Choices: []openAIStreamChoice{{
							Index: 0,
							Delta: &openAIStreamDelta{
								ToolCalls: []openAIStreamToolCall{{
									Index: 0,
									Function: &openAIStreamFunction{
										Arguments: partial,
									},
								}},
							},
						}},
					}
					writeSSE(pw, chunk)
				}

			case "content_block_start":
				// Check if it's a tool_use block
				block, _ := event["content_block"].(map[string]any)
				blockType, _ := block["type"].(string)
				if blockType == "tool_use" {
					id, _ := block["id"].(string)
					name, _ := block["name"].(string)
					chunk := openAIStreamChunk{
						ID:      msgID,
						Object:  "chat.completion.chunk",
						Created: created,
						Model:   model,
						Choices: []openAIStreamChoice{{
							Index: 0,
							Delta: &openAIStreamDelta{
								ToolCalls: []openAIStreamToolCall{{
									Index: 0,
									ID:    id,
									Type:  "function",
									Function: &openAIStreamFunction{
										Name: name,
									},
								}},
							},
						}},
					}
					writeSSE(pw, chunk)
				}

			case "message_delta":
				delta, _ := event["delta"].(map[string]any)
				stopReason, _ := delta["stop_reason"].(string)
				finishReason := translateAnthropicStop(stopReason)
				chunk := openAIStreamChunk{
					ID:      msgID,
					Object:  "chat.completion.chunk",
					Created: created,
					Model:   model,
					Choices: []openAIStreamChoice{{
						Index:        0,
						Delta:        &openAIStreamDelta{},
						FinishReason: &finishReason,
					}},
				}
				// Include usage if available
				if usage, ok := event["usage"].(map[string]any); ok {
					outTokens := intFromAny(usage["output_tokens"])
					chunk.Usage = &openAIStreamUsage{
						CompletionTokens: outTokens,
					}
				}
				writeSSE(pw, chunk)

			case "message_stop":
				fmt.Fprintf(pw, "data: [DONE]\n\n")
			}
		}
	}()

	return adapter
}

func (a *AnthropicStreamAdapter) Read(p []byte) (int, error) {
	return a.reader.Read(p)
}

func (a *AnthropicStreamAdapter) Close() error {
	a.reader.Close()
	return a.closer.Close()
}

// --- OpenAI streaming types ---

type openAIStreamChunk struct {
	ID      string               `json:"id"`
	Object  string               `json:"object"`
	Created int64                `json:"created"`
	Model   string               `json:"model"`
	Choices []openAIStreamChoice `json:"choices"`
	Usage   *openAIStreamUsage   `json:"usage,omitempty"`
}

type openAIStreamChoice struct {
	Index        int                `json:"index"`
	Delta        *openAIStreamDelta `json:"delta"`
	FinishReason *string            `json:"finish_reason"`
}

type openAIStreamDelta struct {
	Role      string                 `json:"role,omitempty"`
	Content   string                 `json:"content,omitempty"`
	ToolCalls []openAIStreamToolCall `json:"tool_calls,omitempty"`
}

type openAIStreamToolCall struct {
	Index    int                   `json:"index"`
	ID       string                `json:"id,omitempty"`
	Type     string                `json:"type,omitempty"`
	Function *openAIStreamFunction `json:"function,omitempty"`
}

type openAIStreamFunction struct {
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

type openAIStreamUsage struct {
	PromptTokens     int `json:"prompt_tokens,omitempty"`
	CompletionTokens int `json:"completion_tokens,omitempty"`
	TotalTokens      int `json:"total_tokens,omitempty"`
}

func writeSSE(w io.Writer, chunk openAIStreamChunk) {
	data, err := json.Marshal(chunk)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "data: %s\n\n", data)
}

func translateAnthropicStop(reason string) string {
	switch reason {
	case "max_tokens":
		return "length"
	case "tool_use":
		return "tool_calls"
	case "end_turn", "stop_sequence":
		return "stop"
	default:
		return "stop"
	}
}

func intFromAny(v any) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	default:
		return 0
	}
}
