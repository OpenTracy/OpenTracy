import { useState } from 'react';
import {
  Copy,
  ChevronDown,
  ChevronRight,
  Wrench,
  User,
  Bot,
  Settings,
  Terminal,
  ChevronsUpDown,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { toast } from 'sonner';
import type {
  TraceMessage,
  TraceOutputMessage,
  TraceToolCall,
  TraceToolDef,
} from '../types/analyticsType';

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard`);
};

const ROLE_CONFIG: Record<string, { icon: typeof User; label: string }> = {
  system: { icon: Settings, label: 'System' },
  user: { icon: User, label: 'User' },
  assistant: { icon: Bot, label: 'Assistant' },
  tool: { icon: Terminal, label: 'Tool Result' },
};

function ToolCallCard({ toolCall }: { toolCall: TraceToolCall }) {
  const [expanded, setExpanded] = useState(false);

  let parsedArgs: string;
  try {
    parsedArgs = JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2);
  } catch {
    parsedArgs = toolCall.function.arguments;
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors"
      >
        <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <code className="text-xs font-semibold text-foreground">{toolCall.function.name}</code>
        <span className="text-xs text-muted-foreground font-mono truncate ml-1">{toolCall.id}</span>
        <span className="ml-auto">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border">
          <div className="flex justify-between items-center px-3 py-1.5 bg-muted">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Arguments
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5"
              onClick={() => copyToClipboard(parsedArgs, 'Arguments')}
            >
              <Copy className="w-2.5 h-2.5 mr-1" />
              Copy
            </Button>
          </div>
          <pre className="p-3 text-xs font-mono text-foreground bg-muted whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
            {parsedArgs}
          </pre>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, index }: { message: TraceMessage; index: number }) {
  const config = ROLE_CONFIG[message.role] || ROLE_CONFIG.user;
  const Icon = config.icon;

  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
  const isToolResult = message.role === 'tool';

  let contentPreview: string | null = null;
  if (typeof message.content === 'string' && message.content) {
    contentPreview = message.content;
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted">
        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-foreground">{config.label}</span>
        {isToolResult && message.tool_call_id && (
          <span className="text-[10px] font-mono text-muted-foreground truncate">
            {message.tool_call_id}
          </span>
        )}
        {isToolResult && message.name && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {message.name}
          </Badge>
        )}
        {hasToolCalls && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
            <Wrench className="w-2.5 h-2.5 mr-0.5" />
            {message.tool_calls!.length} tool call{message.tool_calls!.length > 1 ? 's' : ''}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">#{index + 1}</span>
      </div>

      <div className="px-3 py-2 space-y-2">
        {contentPreview && (
          <div className="relative group">
            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
              {contentPreview}
            </pre>
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => copyToClipboard(contentPreview!, 'Content')}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        )}

        {!contentPreview && !hasToolCalls && (
          <span className="text-xs text-muted-foreground italic">No content</span>
        )}

        {hasToolCalls && (
          <div className="space-y-2">
            {message.tool_calls!.map((tc, i) => (
              <ToolCallCard key={tc.id || i} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TraceMessagesView({
  inputMessages,
  outputMessage,
  finishReason,
  requestTools,
}: {
  inputMessages: TraceMessage[] | null;
  outputMessage: TraceOutputMessage | null;
  finishReason: string | null;
  requestTools: TraceToolDef[] | null;
}) {
  if (!inputMessages && !outputMessage) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No structured messages available for this trace.
      </p>
    );
  }

  const allMessages: TraceMessage[] = [
    ...(inputMessages || []),
    ...(outputMessage ? [outputMessage as TraceMessage] : []),
  ];

  const hasToolCalls = allMessages.some((m) => m.tool_calls && m.tool_calls.length > 0);
  const hasToolRole = allMessages.some((m) => m.role === 'tool');
  const isAgentic = hasToolCalls || hasToolRole;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {allMessages.length} message{allMessages.length !== 1 ? 's' : ''}
        </Badge>
        {isAgentic && (
          <Badge variant="secondary" className="text-xs">
            <Wrench className="w-3 h-3 mr-1" />
            Agentic
          </Badge>
        )}
        {finishReason && (
          <Badge
            variant={finishReason === 'tool_calls' ? 'secondary' : 'outline'}
            className="text-xs"
          >
            finish: {finishReason}
          </Badge>
        )}
        {requestTools && requestTools.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2 gap-1">
                <Settings className="w-3 h-3" />
                {requestTools.length} tool{requestTools.length > 1 ? 's' : ''} defined
                <ChevronsUpDown className="w-3 h-3" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-border rounded-lg p-3 bg-muted">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Tool Definitions
                  </h5>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[10px] px-1.5"
                    onClick={() =>
                      copyToClipboard(JSON.stringify(requestTools, null, 2), 'Tool definitions')
                    }
                  >
                    <Copy className="w-2.5 h-2.5 mr-1" />
                    Copy JSON
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {requestTools.map((tool, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-xs px-2 py-1.5 rounded bg-background"
                    >
                      <Wrench className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <code className="font-semibold text-foreground">{tool.function.name}</code>
                        {tool.function.description && (
                          <p className="text-muted-foreground mt-0.5">
                            {tool.function.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <div className="space-y-2">
        {allMessages.map((msg, i) => (
          <MessageBubble key={i} message={msg} index={i} />
        ))}
      </div>
    </div>
  );
}

export function ToolCallsBadge({ outputMessage }: { outputMessage: TraceOutputMessage | null }) {
  const toolCalls = outputMessage?.tool_calls;
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
      <Wrench className="w-2.5 h-2.5 mr-0.5" />
      {toolCalls.map((tc) => tc.function.name).join(', ')}
    </Badge>
  );
}
