package server

type ExecutionTimelineStep struct {
	Step        int                    `json:"step"`
	Phase       string                 `json:"phase"`        // "inference", "tool_execution", "preparation"
	StartedAt   string                 `json:"started_at"`
	CompletedAt string                 `json:"completed_at"`
	DurationMs  float64                `json:"duration_ms"`
	Status      string                 `json:"status"`       // "completed", "failed", "pending"
	Provider    *string                `json:"provider"`
	Model       *string                `json:"model"`
	TokensIn    *int                   `json:"tokens_in"`
	TokensOut   *int                   `json:"tokens_out"`
	TTFTMs      *float64               `json:"ttft_ms"`
	ToolName    *string                `json:"tool_name"`
	ToolCallID  *string                `json:"tool_call_id"`
	ToolInput   map[string]interface{} `json:"tool_input"`
	ToolOutput  *string                `json:"tool_output"`
	ToolError   *string                `json:"tool_error"`
	Metadata    map[string]interface{} `json:"metadata"`
}
