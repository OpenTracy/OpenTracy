package server

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/lunar-org-ai/lunar-router/go/internal/provider"
)

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

type BuiltinTool struct {
	Definition provider.Tool
	Execute    func(args map[string]interface{}) (string, error)
}

type BuiltinToolRegistry struct {
	tools map[string]*BuiltinTool
}

func NewBuiltinToolRegistry() *BuiltinToolRegistry {
	r := &BuiltinToolRegistry{tools: make(map[string]*BuiltinTool)}
	r.registerDefaults()
	return r
}

func (r *BuiltinToolRegistry) Get(name string) *BuiltinTool {
	return r.tools[name]
}

func (r *BuiltinToolRegistry) Definitions() []provider.Tool {
	out := make([]provider.Tool, 0, len(r.tools))
	for _, t := range r.tools {
		out = append(out, t.Definition)
	}
	return out
}

func (r *BuiltinToolRegistry) ToolNames() []string {
	names := make([]string, 0, len(r.tools))
	for k := range r.tools {
		names = append(names, k)
	}
	return names
}

func (r *BuiltinToolRegistry) register(t *BuiltinTool) {
	r.tools[t.Definition.Function.Name] = t
}

func (r *BuiltinToolRegistry) registerDefaults() {
	//
	// get_current_time — returns UTC timestamp
	//
	r.register(&BuiltinTool{
		Definition: provider.Tool{
			Type: "function",
			Function: &provider.FunctionDef{
				Name:        "get_current_time",
				Description: "Returns the current date and time in UTC.",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
					"required":   []string{},
				},
			},
		},
		Execute: func(_ map[string]interface{}) (string, error) {
			return time.Now().UTC().Format(time.RFC3339), nil
		},
	})

	//
	// calculate — evaluates simple arithmetic expressions
	//
	r.register(&BuiltinTool{
		Definition: provider.Tool{
			Type: "function",
			Function: &provider.FunctionDef{
				Name:        "calculate",
				Description: "Evaluates a simple arithmetic expression (supports +, -, *, /, ^, parentheses).",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"expression": map[string]interface{}{
							"type":        "string",
							"description": "A mathematical expression to evaluate, e.g. '(3 + 5) * 2'.",
						},
					},
					"required": []string{"expression"},
				},
			},
		},
		Execute: func(args map[string]interface{}) (string, error) {
			expr, _ := args["expression"].(string)
			if expr == "" {
				return "", fmt.Errorf("expression is required")
			}
			result, err := evalExpr(expr)
			if err != nil {
				return "", err
			}
			// Format cleanly — avoid scientific notation for small numbers
			if result == math.Trunc(result) {
				return strconv.FormatInt(int64(result), 10), nil
			}
			return strconv.FormatFloat(result, 'f', -1, 64), nil
		},
	})

	//
	// get_weather — returns synthetic weather data for a location
	//
	r.register(&BuiltinTool{
		Definition: provider.Tool{
			Type: "function",
			Function: &provider.FunctionDef{
				Name:        "get_weather",
				Description: "Returns current weather conditions for a city. (Demo: returns synthetic data.)",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"location": map[string]interface{}{
							"type":        "string",
							"description": "City name, e.g. 'São Paulo' or 'New York, NY'.",
						},
						"unit": map[string]interface{}{
							"type":        "string",
							"enum":        []string{"celsius", "fahrenheit"},
							"description": "Temperature unit. Defaults to 'celsius'.",
						},
					},
					"required": []string{"location"},
				},
			},
		},
		Execute: func(args map[string]interface{}) (string, error) {
			location, _ := args["location"].(string)
			if location == "" {
				return "", fmt.Errorf("location is required")
			}
			unit, _ := args["unit"].(string)
			if unit == "" {
				unit = "celsius"
			}

			// Deterministic pseudo-random based on location string
			seed := 0
			for _, c := range location {
				seed += int(c)
			}
			tempC := 15.0 + float64(seed%20)
			humidity := 40 + (seed % 50)
			conditions := []string{"Sunny", "Partly cloudy", "Overcast", "Light rain", "Clear"}
			condition := conditions[seed%len(conditions)]

			temp := tempC
			unitLabel := "°C"
			if unit == "fahrenheit" {
				temp = tempC*9/5 + 32
				unitLabel = "°F"
			}

			result := map[string]interface{}{
				"location":    location,
				"temperature": fmt.Sprintf("%.1f%s", temp, unitLabel),
				"humidity":    fmt.Sprintf("%d%%", humidity),
				"condition":   condition,
				"wind":        fmt.Sprintf("%d km/h", 10+(seed%30)),
				"note":        "Synthetic data — for demo purposes only.",
			}
			b, _ := json.Marshal(result)
			return string(b), nil
		},
	})

	//
	// list_builtin_tools — meta-tool: lists all available built-in tools
	//
	r.register(&BuiltinTool{
		Definition: provider.Tool{
			Type: "function",
			Function: &provider.FunctionDef{
				Name:        "list_builtin_tools",
				Description: "Lists all built-in tools available in this Lunar Router gateway.",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
					"required":   []string{},
				},
			},
		},
		Execute: func(_ map[string]interface{}) (string, error) {
			names := r.ToolNames()
			b, _ := json.Marshal(map[string]interface{}{"tools": names})
			return string(b), nil
		},
	})
}


type exprParser struct {
	input []rune
	pos   int
}

func evalExpr(expr string) (float64, error) {
	p := &exprParser{input: []rune(strings.TrimSpace(expr))}
	v, err := p.parseAddSub()
	if err != nil {
		return 0, err
	}
	// consume trailing whitespace
	for p.pos < len(p.input) && unicode.IsSpace(p.input[p.pos]) {
		p.pos++
	}
	if p.pos != len(p.input) {
		return 0, fmt.Errorf("unexpected character at position %d: %q", p.pos, string(p.input[p.pos:]))
	}
	return v, nil
}

func (p *exprParser) skipSpace() {
	for p.pos < len(p.input) && unicode.IsSpace(p.input[p.pos]) {
		p.pos++
	}
}

func (p *exprParser) parseAddSub() (float64, error) {
	left, err := p.parseMulDiv()
	if err != nil {
		return 0, err
	}
	for {
		p.skipSpace()
		if p.pos >= len(p.input) {
			break
		}
		op := p.input[p.pos]
		if op != '+' && op != '-' {
			break
		}
		p.pos++
		right, err := p.parseMulDiv()
		if err != nil {
			return 0, err
		}
		if op == '+' {
			left += right
		} else {
			left -= right
		}
	}
	return left, nil
}

func (p *exprParser) parseMulDiv() (float64, error) {
	left, err := p.parsePow()
	if err != nil {
		return 0, err
	}
	for {
		p.skipSpace()
		if p.pos >= len(p.input) {
			break
		}
		op := p.input[p.pos]
		if op != '*' && op != '/' {
			break
		}
		p.pos++
		right, err := p.parsePow()
		if err != nil {
			return 0, err
		}
		if op == '*' {
			left *= right
		} else {
			if right == 0 {
				return 0, fmt.Errorf("division by zero")
			}
			left /= right
		}
	}
	return left, nil
}

func (p *exprParser) parsePow() (float64, error) {
	base, err := p.parseUnary()
	if err != nil {
		return 0, err
	}
	p.skipSpace()
	if p.pos < len(p.input) && p.input[p.pos] == '^' {
		p.pos++
		exp, err := p.parseUnary()
		if err != nil {
			return 0, err
		}
		return math.Pow(base, exp), nil
	}
	return base, nil
}

func (p *exprParser) parseUnary() (float64, error) {
	p.skipSpace()
	if p.pos < len(p.input) && p.input[p.pos] == '-' {
		p.pos++
		v, err := p.parseAtom()
		if err != nil {
			return 0, err
		}
		return -v, nil
	}
	if p.pos < len(p.input) && p.input[p.pos] == '+' {
		p.pos++
	}
	return p.parseAtom()
}

func (p *exprParser) parseAtom() (float64, error) {
	p.skipSpace()
	if p.pos >= len(p.input) {
		return 0, fmt.Errorf("unexpected end of expression")
	}
	if p.input[p.pos] == '(' {
		p.pos++
		v, err := p.parseAddSub()
		if err != nil {
			return 0, err
		}
		p.skipSpace()
		if p.pos >= len(p.input) || p.input[p.pos] != ')' {
			return 0, fmt.Errorf("expected closing parenthesis")
		}
		p.pos++
		return v, nil
	}
	// Number
	start := p.pos
	for p.pos < len(p.input) && (unicode.IsDigit(p.input[p.pos]) || p.input[p.pos] == '.') {
		p.pos++
	}
	if start == p.pos {
		return 0, fmt.Errorf("expected number at position %d, got %q", p.pos, string(p.input[p.pos:]))
	}
	return strconv.ParseFloat(string(p.input[start:p.pos]), 64)
}
