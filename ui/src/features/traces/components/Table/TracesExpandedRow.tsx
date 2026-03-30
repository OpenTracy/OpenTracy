import { Wrench, ChevronsUpDown, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatLatency, formatCost } from '@/utils/formatUtils';
import type { TraceItem } from '@/types/analyticsType';
import { TraceMessagesView } from '@/components/TraceMessages';

interface TracesExpandedRowProps {
  trace: TraceItem;
  onViewDetails: () => void;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

export function TracesExpandedRow({ trace, onViewDetails }: TracesExpandedRowProps) {
  const hasStructuredMessages = !!(trace.input_messages || trace.output_message);
  const hasToolCalls = !!(
    trace.output_message?.tool_calls?.length ||
    trace.input_messages?.some((m) => m.tool_calls?.length || m.role === 'tool')
  );

  const outputContent = trace.output_text || trace.output_message?.content || trace.output_preview;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Sidebar — metrics */}
      <div className="lg:col-span-3 space-y-3">
        <div className="rounded-md border bg-background p-3 space-y-0.5">
          <InfoRow label="Input Tokens" value={trace.input_tokens.toLocaleString()} />
          <InfoRow label="Output Tokens" value={trace.output_tokens.toLocaleString()} />
          <Separator className="my-1.5!" />
          <InfoRow
            label="TTFT"
            value={<span className="font-mono">{formatLatency(trace.ttft_s)}</span>}
          />
          <InfoRow label="Tok/s" value={trace.tokens_per_s.toFixed(2)} />
          <InfoRow label="Cost" value={`$${formatCost(trace.cost_usd)}`} />
          {trace.finish_reason && (
            <>
              <Separator className="my-1.5!" />
              <InfoRow
                label="Finish"
                value={
                  <div className="flex items-center gap-1">
                    {trace.finish_reason}
                    {hasToolCalls && (
                      <Badge variant="secondary">
                        <Wrench className="size-3" />
                      </Badge>
                    )}
                  </div>
                }
              />
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
        >
          <ExternalLink className="size-3.5 mr-1.5" />
          View details
        </Button>
      </div>

      {/* Content */}
      <div className="lg:col-span-9 space-y-3">
        <div className="rounded-md border bg-background p-3 space-y-2">
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Input
            </span>
            <p className="text-xs font-mono text-foreground truncate">
              {trace.input_preview || 'No content available'}
            </p>
          </div>

          <Separator />

          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Output
            </span>
            {outputContent ? (
              <p className="text-xs font-mono text-foreground truncate">{outputContent}</p>
            ) : (
              <p className="text-xs font-mono text-destructive">
                No output — an error may have occurred
              </p>
            )}
          </div>
        </div>

        {hasStructuredMessages && (
          <Collapsible className="rounded-md border bg-background">
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between p-2.5 text-left hover:bg-muted/50 transition-colors rounded-md">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Structured Messages
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {(trace.input_messages?.length || 0) + (trace.output_message ? 1 : 0)} msgs
                  </Badge>
                  {hasToolCalls && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Wrench className="size-3" />
                      Tools
                    </Badge>
                  )}
                </div>
                <ChevronsUpDown className="size-4 text-muted-foreground" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Separator />
              <div className="p-2.5">
                <TraceMessagesView
                  inputMessages={trace.input_messages}
                  outputMessage={trace.output_message}
                  finishReason={trace.finish_reason}
                  requestTools={trace.request_tools}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
