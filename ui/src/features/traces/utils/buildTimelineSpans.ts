import type { TraceItem, TraceMessage, TraceToolCall } from '@/types/analyticsType';

export interface TimelineSpan {
  id: string;
  label: string;
  sublabel?: string;
  role: 'call' | 'system' | 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'output' | 'error';
  startPct: number;
  widthPct: number;
  durationMs: number;
  offsetMs: number;
  content: string | null;
  toolCallNames?: string[];
  toolCallId?: string;
  toolCallArgs?: string;
  isError?: boolean;
}

interface ToolEvent {
  kind: 'tool_call' | 'tool_result';
  toolCall?: TraceToolCall;
  msg: TraceMessage;
  msgIdx: number;
}

interface BuildSpansResult {
  spans: TimelineSpan[];
  totalMs: number;
}

function formatArgs(args: string): string {
  try {
    return JSON.stringify(JSON.parse(args), null, 2);
  } catch {
    return args;
  }
}

function collectToolEvents(messages: TraceMessage[]): ToolEvent[] {
  const events: ToolEvent[] = [];

  messages.forEach((msg, i) => {
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        events.push({ kind: 'tool_call', toolCall: tc, msg, msgIdx: i });
      }
    }
    if (msg.role === 'tool') {
      events.push({ kind: 'tool_result', msg, msgIdx: i });
    }
  });

  return events;
}

function buildAgenticSpans(
  trace: TraceItem,
  messages: TraceMessage[],
  toolEvents: ToolEvent[],
  totalMs: number,
  ttftMs: number
): TimelineSpan[] {
  const spans: TimelineSpan[] = [];
  const toolWindow = ttftMs > 0 ? ttftMs : totalMs * 0.7;
  const slotCount = toolEvents.length + 2;
  const slotDuration = toolWindow / slotCount;
  let currentOffset = 0;

  spans.push({
    id: 'request',
    label: 'Request',
    role: 'call',
    startPct: 0,
    widthPct: Math.max((slotDuration / totalMs) * 100, 1),
    durationMs: slotDuration,
    offsetMs: 0,
    content: messages.find((m) => m.role === 'user')?.content ?? trace.input_preview ?? null,
  });
  currentOffset = slotDuration;

  for (const te of toolEvents) {
    if (te.kind === 'tool_call' && te.toolCall) {
      const tc = te.toolCall;
      const args = formatArgs(tc.function.arguments);
      spans.push({
        id: `tc-${tc.id || te.msgIdx}`,
        label: 'Tool Call',
        sublabel: tc.function.name,
        role: 'tool_call',
        startPct: (currentOffset / totalMs) * 100,
        widthPct: Math.max((slotDuration / totalMs) * 100, 1),
        durationMs: slotDuration,
        offsetMs: currentOffset,
        content: args,
        toolCallNames: [tc.function.name],
        toolCallId: tc.id,
        toolCallArgs: args,
      });
    } else {
      const resultName = te.msg.name ?? te.msg.tool_call_id ?? 'unknown';
      spans.push({
        id: `tr-${te.msg.tool_call_id || te.msgIdx}`,
        label: 'Tool Result',
        sublabel: resultName,
        role: 'tool_result',
        startPct: (currentOffset / totalMs) * 100,
        widthPct: Math.max((slotDuration / totalMs) * 100, 1),
        durationMs: slotDuration,
        offsetMs: currentOffset,
        content: typeof te.msg.content === 'string' ? te.msg.content : null,
        toolCallId: te.msg.tool_call_id,
      });
    }
    currentOffset += slotDuration;
  }

  const genDuration = totalMs - currentOffset;
  const outputToolCalls = trace.output_message?.tool_calls;
  const outputToolNames = outputToolCalls?.map((tc) => tc.function.name);

  spans.push({
    id: 'response',
    label:
      trace.status === 'Error'
        ? 'Error'
        : outputToolNames && outputToolNames.length > 0
          ? 'Response (Tool Calls)'
          : 'Response',
    sublabel: outputToolNames?.join(', '),
    role: trace.status === 'Error' ? 'error' : 'output',
    startPct: (currentOffset / totalMs) * 100,
    widthPct: Math.max((genDuration / totalMs) * 100, 1),
    durationMs: genDuration,
    offsetMs: currentOffset,
    content: trace.output_text ?? trace.output_message?.content ?? trace.output_preview ?? null,
    toolCallNames: outputToolNames,
    isError: trace.status === 'Error',
  });

  return spans;
}

function buildSimpleSpans(
  trace: TraceItem,
  messages: TraceMessage[],
  totalMs: number,
  ttftMs: number
): TimelineSpan[] {
  const spans: TimelineSpan[] = [];
  const ttftPct = (ttftMs / totalMs) * 100;

  const outputToolCalls = trace.output_message?.tool_calls;
  const hasOutputToolCalls = outputToolCalls && outputToolCalls.length > 0;

  spans.push({
    id: 'request',
    label: 'Request',
    role: 'call',
    startPct: 0,
    widthPct: Math.max(ttftPct || 2, 1),
    durationMs: ttftMs || totalMs * 0.1,
    offsetMs: 0,
    content: messages.find((m) => m.role === 'user')?.content ?? trace.input_preview ?? null,
  });

  if (ttftMs > 0) {
    spans.push({
      id: 'ttft',
      label: 'Time to First Token',
      role: 'system',
      startPct: 0,
      widthPct: ttftPct,
      durationMs: ttftMs,
      offsetMs: 0,
      content: null,
    });
  }

  const genStartMs = ttftMs || totalMs * 0.1;
  const genDuration = totalMs - genStartMs;
  const outputToolNames = outputToolCalls?.map((tc) => tc.function.name);

  spans.push({
    id: 'response',
    label:
      trace.status === 'Error'
        ? 'Error'
        : hasOutputToolCalls
          ? 'Response (Tool Calls)'
          : 'Response',
    sublabel: outputToolNames?.join(', '),
    role: trace.status === 'Error' ? 'error' : 'output',
    startPct: (genStartMs / totalMs) * 100,
    widthPct: Math.max((genDuration / totalMs) * 100, 1),
    durationMs: genDuration,
    offsetMs: genStartMs,
    content: trace.output_text ?? trace.output_message?.content ?? trace.output_preview ?? null,
    toolCallNames: outputToolNames,
    isError: trace.status === 'Error',
  });

  if (hasOutputToolCalls) {
    for (const tc of outputToolCalls) {
      const args = formatArgs(tc.function.arguments);
      spans.push({
        id: `out-tc-${tc.id}`,
        label: 'Output Tool Call',
        sublabel: tc.function.name,
        role: 'tool_call',
        startPct: (genStartMs / totalMs) * 100,
        widthPct: Math.max((genDuration / totalMs) * 100, 1),
        durationMs: genDuration,
        offsetMs: genStartMs,
        content: args,
        toolCallNames: [tc.function.name],
        toolCallId: tc.id,
        toolCallArgs: args,
      });
    }
  }

  return spans;
}

export function buildTimelineSpans(trace: TraceItem): BuildSpansResult {
  const totalMs = Math.max((trace.latency_s || 0) * 1000, 1);
  const ttftMs = (trace.ttft_s || 0) * 1000;
  const messages = trace.input_messages ?? [];
  const toolEvents = collectToolEvents(messages);

  const spans =
    toolEvents.length > 0
      ? buildAgenticSpans(trace, messages, toolEvents, totalMs, ttftMs)
      : buildSimpleSpans(trace, messages, totalMs, ttftMs);

  return { spans, totalMs };
}
