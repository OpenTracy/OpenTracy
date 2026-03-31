import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { TraceItem } from '@/types/analyticsType';
import { formatLatency, formatCost } from '@/utils/formatUtils';
import { InfoRow } from '@/components/shared/InfoRow';
import { CodeBlock } from '@/components/shared/CodeBlock';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/*  StatCell — dense metric display                                   */
/* ------------------------------------------------------------------ */

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold font-mono tabular-nums">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SectionHeader                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
      {title}
    </h3>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

interface OverviewTabProps {
  trace: TraceItem;
}

export function OverviewTab({ trace }: OverviewTabProps) {
  const inputContent = trace.input_preview || '';
  const outputContent =
    trace.output_text || trace.output_message?.content || trace.output_preview || '';

  return (
    <div className="relative h-full">
      <ScrollArea className="h-full">
        <div className="space-y-5 px-4 pb-10 pt-3">
          {/* Contextual chips — replaces MODEL section */}
          <div className="flex items-center gap-1.5 flex-wrap py-1">
            <Badge variant="outline" className="font-mono text-xs">
              {trace.backend}
            </Badge>
            {trace.deployment_id && (
              <Badge variant="outline" className="font-mono text-xs">
                {trace.deployment_id}
              </Badge>
            )}
          </div>

          {/* Key metrics — 3-col stat row */}
          <div className="grid grid-cols-3 divide-x divide-border rounded-md border border-border bg-muted">
            <StatCell label="Latency" value={formatLatency(trace.latency_s)} />
            <StatCell label="Tokens" value={trace.total_tokens.toLocaleString()} />
            <StatCell label="Cost" value={formatCost(trace.cost_usd)} />
          </div>

          {/* Secondary metrics — 2-col stat row */}
          <div className="grid grid-cols-2 divide-x divide-border rounded-md border border-border bg-muted mt-2">
            <StatCell label="TTFT" value={trace.ttft_s ? formatLatency(trace.ttft_s) : '—'} />
            <StatCell label="Throughput" value={`${trace.tokens_per_s.toFixed(1)} tok/s`} />
          </div>

          {/* Usage — only tokens (no throughput/cost duplicates) */}
          <div>
            <SectionHeader title="Usage" />
            <div className="rounded-md border border-border bg-muted px-3">
              <InfoRow
                label="Input Tokens"
                value={
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <ArrowDownToLine className="size-3 text-muted-foreground" />
                    {trace.input_tokens.toLocaleString()}
                  </span>
                }
              />
              <InfoRow
                label="Output Tokens"
                value={
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <ArrowUpFromLine className="size-3 text-muted-foreground" />
                    {trace.output_tokens.toLocaleString()}
                  </span>
                }
              />
              <InfoRow
                label="Total"
                value={<span className="tabular-nums">{trace.total_tokens.toLocaleString()}</span>}
              />
            </div>
          </div>

          {/* Request details */}
          <div>
            <SectionHeader title="Request" />
            <div className="rounded-md border border-border bg-muted px-3">
              <InfoRow
                label="Status"
                value={
                  <Badge variant={trace.status === 'Success' ? 'secondary' : 'destructive'}>
                    {trace.status === 'Success' ? 'Success' : 'Error'}
                  </Badge>
                }
              />
              <InfoRow
                label="Stream"
                value={<Badge variant="outline">{trace.is_stream ? 'Yes' : 'No'}</Badge>}
              />
              <InfoRow
                label="Created"
                value={trace.created_at ? formatDate(trace.created_at) : '—'}
              />
              {trace.finish_reason && trace.finish_reason !== 'stop' && (
                <InfoRow label="Finish Reason" value={trace.finish_reason} />
              )}
              {trace.error_code && (
                <InfoRow
                  label="Error Code"
                  value={<Badge variant="destructive">{trace.error_code}</Badge>}
                />
              )}
            </div>
          </div>

          {/* Input / Output content */}
          <div className="space-y-4">
            <SectionHeader title="Input & Output" />
            <CodeBlock
              label="Input"
              content={inputContent}
              meta={`${trace.input_tokens.toLocaleString()} tokens · ${inputContent.length.toLocaleString()} chars`}
            />
            <CodeBlock
              label="Output"
              content={outputContent}
              meta={`${trace.output_tokens.toLocaleString()} tokens · ${outputContent.length.toLocaleString()} chars`}
            />
          </div>
        </div>
      </ScrollArea>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
