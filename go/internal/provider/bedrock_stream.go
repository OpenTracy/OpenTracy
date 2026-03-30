package provider

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"time"
)

// BedrockStreamAdapter translates AWS Bedrock converse-stream event-stream
// binary format to OpenAI SSE format.
//
// Bedrock event-stream uses a binary framing protocol:
// [total_length:4][headers_length:4][prelude_crc:4][headers...][payload...][message_crc:4]
//
// Event types: contentBlockStart, contentBlockDelta, contentBlockStop,
// messageStart, messageStop, metadata.
type BedrockStreamAdapter struct {
	reader *io.PipeReader
	closer io.Closer
}

// NewBedrockStreamAdapter wraps a Bedrock event-stream and emits OpenAI SSE.
func NewBedrockStreamAdapter(upstream io.ReadCloser, model string) *BedrockStreamAdapter {
	pr, pw := io.Pipe()
	adapter := &BedrockStreamAdapter{reader: pr, closer: upstream}

	go func() {
		defer pw.Close()
		defer upstream.Close()

		created := time.Now().Unix()
		msgID := fmt.Sprintf("bedrock-%d", created)
		br := bufio.NewReaderSize(upstream, 64*1024)

		// Emit initial role chunk
		writeSSE(pw, openAIStreamChunk{
			ID: msgID, Object: "chat.completion.chunk", Created: created, Model: model,
			Choices: []openAIStreamChoice{{
				Index: 0, Delta: &openAIStreamDelta{Role: "assistant"},
			}},
		})

		for {
			event, err := readBedrockEvent(br)
			if err != nil {
				break
			}

			switch event.eventType {
			case "contentBlockDelta":
				var delta struct {
					Delta struct {
						Text string `json:"text"`
					} `json:"delta"`
					ContentBlockIndex int `json:"contentBlockIndex"`
				}
				if json.Unmarshal(event.payload, &delta) != nil {
					continue
				}
				if delta.Delta.Text != "" {
					writeSSE(pw, openAIStreamChunk{
						ID: msgID, Object: "chat.completion.chunk", Created: created, Model: model,
						Choices: []openAIStreamChoice{{
							Index: 0, Delta: &openAIStreamDelta{Content: delta.Delta.Text},
						}},
					})
				}

			case "contentBlockStart":
				var block struct {
					Start struct {
						ToolUse *struct {
							ToolUseID string `json:"toolUseId"`
							Name      string `json:"name"`
						} `json:"toolUse"`
					} `json:"start"`
				}
				if json.Unmarshal(event.payload, &block) != nil {
					continue
				}
				if block.Start.ToolUse != nil {
					writeSSE(pw, openAIStreamChunk{
						ID: msgID, Object: "chat.completion.chunk", Created: created, Model: model,
						Choices: []openAIStreamChoice{{
							Index: 0,
							Delta: &openAIStreamDelta{
								ToolCalls: []openAIStreamToolCall{{
									Index: 0,
									ID:    block.Start.ToolUse.ToolUseID,
									Type:  "function",
									Function: &openAIStreamFunction{
										Name: block.Start.ToolUse.Name,
									},
								}},
							},
						}},
					})
				}

			case "metadata":
				var meta struct {
					Usage struct {
						InputTokens  int `json:"inputTokens"`
						OutputTokens int `json:"outputTokens"`
						TotalTokens  int `json:"totalTokens"`
					} `json:"usage"`
				}
				if json.Unmarshal(event.payload, &meta) != nil {
					continue
				}
				finish := "stop"
				writeSSE(pw, openAIStreamChunk{
					ID: msgID, Object: "chat.completion.chunk", Created: created, Model: model,
					Choices: []openAIStreamChoice{{
						Index: 0, Delta: &openAIStreamDelta{}, FinishReason: &finish,
					}},
					Usage: &openAIStreamUsage{
						PromptTokens:     meta.Usage.InputTokens,
						CompletionTokens: meta.Usage.OutputTokens,
						TotalTokens:      meta.Usage.TotalTokens,
					},
				})

			case "messageStop":
				var stop struct {
					StopReason string `json:"stopReason"`
				}
				if json.Unmarshal(event.payload, &stop) == nil {
					finish := "stop"
					switch stop.StopReason {
					case "max_tokens":
						finish = "length"
					case "tool_use":
						finish = "tool_calls"
					}
					writeSSE(pw, openAIStreamChunk{
						ID: msgID, Object: "chat.completion.chunk", Created: created, Model: model,
						Choices: []openAIStreamChoice{{
							Index: 0, Delta: &openAIStreamDelta{}, FinishReason: &finish,
						}},
					})
				}
				fmt.Fprintf(pw, "data: [DONE]\n\n")
			}
		}
	}()

	return adapter
}

func (a *BedrockStreamAdapter) Read(p []byte) (int, error) {
	return a.reader.Read(p)
}

func (a *BedrockStreamAdapter) Close() error {
	a.reader.Close()
	return a.closer.Close()
}

// --- AWS event-stream binary parser ---

type bedrockEvent struct {
	eventType string
	payload   []byte
}

// readBedrockEvent reads one AWS event-stream message.
// Wire format: [total_len:4][headers_len:4][prelude_crc:4][headers][payload][msg_crc:4]
func readBedrockEvent(r *bufio.Reader) (*bedrockEvent, error) {
	// Read prelude (12 bytes: total_len + headers_len + prelude_crc)
	prelude := make([]byte, 12)
	if _, err := io.ReadFull(r, prelude); err != nil {
		return nil, err
	}

	totalLen := binary.BigEndian.Uint32(prelude[0:4])
	headersLen := binary.BigEndian.Uint32(prelude[4:8])
	// prelude_crc at [8:12] - skip validation for simplicity

	if totalLen < 16 || totalLen > 16*1024*1024 {
		return nil, fmt.Errorf("invalid event-stream frame length: %d", totalLen)
	}

	// Read remaining bytes (total - 12 prelude bytes)
	remaining := make([]byte, totalLen-12)
	if _, err := io.ReadFull(r, remaining); err != nil {
		return nil, err
	}

	// Parse headers
	headers := remaining[:headersLen]
	payloadLen := totalLen - 12 - headersLen - 4 // subtract prelude + headers + msg_crc
	payload := remaining[headersLen : headersLen+payloadLen]

	eventType := parseEventStreamHeaders(headers)

	return &bedrockEvent{
		eventType: eventType,
		payload:   payload,
	}, nil
}

// parseEventStreamHeaders extracts the :event-type header value.
// Header format: [name_len:1][name][type:1][value_len:2][value]
func parseEventStreamHeaders(data []byte) string {
	r := bytes.NewReader(data)
	for r.Len() > 0 {
		// Name length (1 byte)
		nameLen, err := r.ReadByte()
		if err != nil {
			break
		}
		name := make([]byte, nameLen)
		if _, err := io.ReadFull(r, name); err != nil {
			break
		}

		// Value type (1 byte)
		valType, err := r.ReadByte()
		if err != nil {
			break
		}

		switch valType {
		case 7: // String type
			var valLen uint16
			if err := binary.Read(r, binary.BigEndian, &valLen); err != nil {
				return ""
			}
			val := make([]byte, valLen)
			if _, err := io.ReadFull(r, val); err != nil {
				return ""
			}
			if string(name) == ":event-type" {
				return string(val)
			}
		default:
			// Skip unknown header types - read value length and skip
			// Most header types have 2-byte length prefix
			var valLen uint16
			if err := binary.Read(r, binary.BigEndian, &valLen); err != nil {
				return ""
			}
			r.Seek(int64(valLen), io.SeekCurrent)
		}
	}
	return ""
}
