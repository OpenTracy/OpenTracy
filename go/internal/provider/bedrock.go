package provider

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
)

// BedrockProvider routes requests through AWS Bedrock's Converse API.
// Translates OpenAI format to/from Bedrock Converse and signs with SigV4.
type BedrockProvider struct {
	name         string
	region       string
	accessKey    string
	secretKey    string
	sessionToken string
	client       *http.Client
}

// NewBedrockProvider creates a Bedrock provider.
// Reads AWS credentials from environment: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
// AWS_SESSION_TOKEN (optional), AWS_REGION or AWS_DEFAULT_REGION.
func NewBedrockProvider(cfg ProviderConfig) *BedrockProvider {
	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = os.Getenv("AWS_DEFAULT_REGION")
	}
	if region == "" {
		region = "us-east-1"
	}
	return &BedrockProvider{
		name:         cfg.Name,
		region:       region,
		accessKey:    os.Getenv("AWS_ACCESS_KEY_ID"),
		secretKey:    os.Getenv("AWS_SECRET_ACCESS_KEY"),
		sessionToken: os.Getenv("AWS_SESSION_TOKEN"),
		client:       &http.Client{Timeout: 120 * time.Second},
	}
}

func (p *BedrockProvider) Name() string   { return p.name }
func (p *BedrockProvider) HasAPIKey() bool { return p.accessKey != "" && p.secretKey != "" }

// SetAPIKey accepts a composite key: ACCESS_KEY:SECRET_KEY[:REGION]
func (p *BedrockProvider) SetAPIKey(key string) {
	parts := strings.SplitN(key, ":", 3)
	if len(parts) >= 2 {
		p.accessKey = parts[0]
		p.secretKey = parts[1]
		if len(parts) == 3 && parts[2] != "" {
			p.region = parts[2]
		}
	}
}

// --- Bedrock Converse types ---

type bedrockConverseRequest struct {
	Messages        []bedrockMessage        `json:"messages"`
	System          []bedrockSystemContent  `json:"system,omitempty"`
	InferenceConfig *bedrockInferenceConfig `json:"inferenceConfig,omitempty"`
	ToolConfig      *bedrockToolConfig      `json:"toolConfig,omitempty"`
}

type bedrockMessage struct {
	Role    string           `json:"role"`
	Content []bedrockContent `json:"content"`
}

type bedrockContent struct {
	Text       string             `json:"text,omitempty"`
	Image      *bedrockImage      `json:"image,omitempty"`
	ToolUse    *bedrockToolUse    `json:"toolUse,omitempty"`
	ToolResult *bedrockToolResult `json:"toolResult,omitempty"`
}

type bedrockSystemContent struct {
	Text string `json:"text"`
}

type bedrockImage struct {
	Format string             `json:"format"`
	Source bedrockImageSource `json:"source"`
}

type bedrockImageSource struct {
	Bytes string `json:"bytes"`
}

type bedrockToolUse struct {
	ToolUseID string          `json:"toolUseId"`
	Name      string          `json:"name"`
	Input     json.RawMessage `json:"input"`
}

type bedrockToolResult struct {
	ToolUseID string           `json:"toolUseId"`
	Content   []bedrockContent `json:"content"`
}

type bedrockInferenceConfig struct {
	MaxTokens     *int     `json:"maxTokens,omitempty"`
	Temperature   *float64 `json:"temperature,omitempty"`
	TopP          *float64 `json:"topP,omitempty"`
	StopSequences []string `json:"stopSequences,omitempty"`
}

type bedrockToolConfig struct {
	Tools []bedrockToolDef `json:"tools"`
}

type bedrockToolDef struct {
	ToolSpec *bedrockToolSpec `json:"toolSpec"`
}

type bedrockToolSpec struct {
	Name        string             `json:"name"`
	Description string             `json:"description,omitempty"`
	InputSchema bedrockInputSchema `json:"inputSchema"`
}

type bedrockInputSchema struct {
	JSON any `json:"json"`
}

// Response types

type bedrockConverseResponse struct {
	Output     bedrockOutput `json:"output"`
	StopReason string        `json:"stopReason"`
	Usage      bedrockUsage  `json:"usage"`
}

type bedrockOutput struct {
	Message bedrockMessage `json:"message"`
}

type bedrockUsage struct {
	InputTokens  int `json:"inputTokens"`
	OutputTokens int `json:"outputTokens"`
	TotalTokens  int `json:"totalTokens"`
}

// --- Send ---

func (p *BedrockProvider) Send(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	bReq := p.translateRequest(req)

	body, err := json.Marshal(bReq)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	endpoint := fmt.Sprintf("https://bedrock-runtime.%s.amazonaws.com/model/%s/converse",
		p.region, url.PathEscape(req.Model))

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	p.signRequest(httpReq, body)

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
		return nil, fmt.Errorf("bedrock error (status %d): %s", resp.StatusCode, respBody)
	}

	var bResp bedrockConverseResponse
	if err := json.Unmarshal(respBody, &bResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	return p.translateResponse(req.Model, &bResp), nil
}

func (p *BedrockProvider) SendStream(ctx context.Context, req *ChatRequest) (io.ReadCloser, error) {
	bReq := p.translateRequest(req)

	body, err := json.Marshal(bReq)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	endpoint := fmt.Sprintf("https://bedrock-runtime.%s.amazonaws.com/model/%s/converse-stream",
		p.region, url.PathEscape(req.Model))

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	p.signRequest(httpReq, body)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("bedrock error (status %d): %s", resp.StatusCode, respBody)
	}

	// Translate Bedrock event-stream → OpenAI SSE on the fly
	return NewBedrockStreamAdapter(resp.Body, req.Model), nil
}

// --- Request Translation (OpenAI -> Bedrock Converse) ---

func (p *BedrockProvider) translateRequest(req *ChatRequest) *bedrockConverseRequest {
	bReq := &bedrockConverseRequest{}

	// Inference config
	if req.MaxTokens != nil || req.Temperature != nil || req.TopP != nil {
		bReq.InferenceConfig = &bedrockInferenceConfig{
			MaxTokens:   req.MaxTokens,
			Temperature: req.Temperature,
			TopP:        req.TopP,
		}
	}

	// Tools
	if len(req.Tools) > 0 {
		var tools []bedrockToolDef
		for _, t := range req.Tools {
			if t.Type == "function" && t.Function != nil {
				tools = append(tools, bedrockToolDef{
					ToolSpec: &bedrockToolSpec{
						Name:        t.Function.Name,
						Description: t.Function.Description,
						InputSchema: bedrockInputSchema{JSON: t.Function.Parameters},
					},
				})
			}
		}
		if len(tools) > 0 {
			bReq.ToolConfig = &bedrockToolConfig{Tools: tools}
		}
	}

	// Messages
	for _, m := range req.Messages {
		if m.Role == "system" {
			bReq.System = append(bReq.System, bedrockSystemContent{Text: m.TextContent()})
			continue
		}

		// Tool result messages
		if m.IsToolResult() {
			bReq.Messages = append(bReq.Messages, bedrockMessage{
				Role: "user",
				Content: []bedrockContent{{
					ToolResult: &bedrockToolResult{
						ToolUseID: m.ToolCallID,
						Content:   []bedrockContent{{Text: m.TextContent()}},
					},
				}},
			})
			continue
		}

		bm := bedrockMessage{Role: m.Role}

		// Assistant with tool calls
		if m.HasToolCalls() {
			if text := m.TextContent(); text != "" {
				bm.Content = append(bm.Content, bedrockContent{Text: text})
			}
			for _, tc := range m.ToolCalls {
				if tc.Type == "function" && tc.Function != nil {
					bm.Content = append(bm.Content, bedrockContent{
						ToolUse: &bedrockToolUse{
							ToolUseID: tc.ID,
							Name:      tc.Function.Name,
							Input:     json.RawMessage(tc.Function.Arguments),
						},
					})
				}
			}
			bReq.Messages = append(bReq.Messages, bm)
			continue
		}

		// Regular or multimodal message
		if m.IsMultimodal() {
			for _, part := range m.Parts() {
				switch part.Type {
				case "text":
					bm.Content = append(bm.Content, bedrockContent{Text: part.Text})
				case "image_url":
					if part.ImageURL != nil {
						if img := translateImageToBedrock(part.ImageURL); img != nil {
							bm.Content = append(bm.Content, bedrockContent{Image: img})
						}
					}
				}
			}
		} else {
			bm.Content = []bedrockContent{{Text: m.TextContent()}}
		}

		bReq.Messages = append(bReq.Messages, bm)
	}

	return bReq
}

func translateImageToBedrock(img *ImageURL) *bedrockImage {
	if !strings.HasPrefix(img.URL, "data:") {
		return nil // Bedrock requires base64, not URLs
	}
	mediaType, data, ok := parseDataURI(img.URL)
	if !ok {
		return nil
	}
	format := "jpeg"
	switch {
	case strings.Contains(mediaType, "png"):
		format = "png"
	case strings.Contains(mediaType, "gif"):
		format = "gif"
	case strings.Contains(mediaType, "webp"):
		format = "webp"
	}
	return &bedrockImage{
		Format: format,
		Source: bedrockImageSource{Bytes: data},
	}
}

// --- Response Translation (Bedrock Converse -> OpenAI) ---

func (p *BedrockProvider) translateResponse(model string, bResp *bedrockConverseResponse) *ChatResponse {
	var toolCalls []ToolCall
	var textParts []string

	for _, c := range bResp.Output.Message.Content {
		if c.Text != "" {
			textParts = append(textParts, c.Text)
		}
		if c.ToolUse != nil {
			toolCalls = append(toolCalls, ToolCall{
				ID:   c.ToolUse.ToolUseID,
				Type: "function",
				Function: &FunctionCall{
					Name:      c.ToolUse.Name,
					Arguments: string(c.ToolUse.Input),
				},
			})
		}
	}

	msg := TextMessage("assistant", strings.Join(textParts, ""))
	msg.ToolCalls = toolCalls

	finishReason := "stop"
	switch bResp.StopReason {
	case "max_tokens":
		finishReason = "length"
	case "tool_use":
		finishReason = "tool_calls"
	}

	return &ChatResponse{
		ID:     fmt.Sprintf("bedrock-%d", time.Now().UnixNano()),
		Object: "chat.completion",
		Model:  model,
		Choices: []Choice{{
			Index:        0,
			Message:      &msg,
			FinishReason: &finishReason,
		}},
		Usage: &Usage{
			PromptTokens:     bResp.Usage.InputTokens,
			CompletionTokens: bResp.Usage.OutputTokens,
			TotalTokens:      bResp.Usage.TotalTokens,
		},
	}
}

// --- AWS SigV4 Signing ---

func (p *BedrockProvider) signRequest(req *http.Request, payload []byte) {
	now := time.Now().UTC()
	datestamp := now.Format("20060102")
	amzdate := now.Format("20060102T150405Z")

	payloadHash := sha256Hex(payload)

	req.Header.Set("x-amz-date", amzdate)
	req.Header.Set("x-amz-content-sha256", payloadHash)
	if p.sessionToken != "" {
		req.Header.Set("x-amz-security-token", p.sessionToken)
	}

	host := req.URL.Host

	// Build signed headers (sorted)
	headerMap := map[string]string{
		"content-type":          req.Header.Get("Content-Type"),
		"host":                  host,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date":           amzdate,
	}
	if p.sessionToken != "" {
		headerMap["x-amz-security-token"] = p.sessionToken
	}

	headerNames := make([]string, 0, len(headerMap))
	for k := range headerMap {
		headerNames = append(headerNames, k)
	}
	sort.Strings(headerNames)

	var canonicalHeaders strings.Builder
	for _, h := range headerNames {
		canonicalHeaders.WriteString(h + ":" + headerMap[h] + "\n")
	}
	signedHeaders := strings.Join(headerNames, ";")

	// Canonical request
	canonicalURI := req.URL.EscapedPath()
	if canonicalURI == "" {
		canonicalURI = "/"
	}

	canonicalRequest := strings.Join([]string{
		"POST",
		canonicalURI,
		"", // no query string
		canonicalHeaders.String(),
		signedHeaders,
		payloadHash,
	}, "\n")

	// String to sign
	service := "bedrock"
	credentialScope := datestamp + "/" + p.region + "/" + service + "/aws4_request"
	stringToSign := "AWS4-HMAC-SHA256\n" + amzdate + "\n" + credentialScope + "\n" + sha256Hex([]byte(canonicalRequest))

	// Signature
	signingKey := deriveSigningKey(p.secretKey, datestamp, p.region, service)
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	req.Header.Set("Authorization", fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		p.accessKey, credentialScope, signedHeaders, signature))
}

func deriveSigningKey(secretKey, datestamp, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secretKey), []byte(datestamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	return hmacSHA256(kService, []byte("aws4_request"))
}

func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}
