import { useMemo, useCallback, useState } from 'react';
import { Brain, Wrench, Settings, XCircle, Clock, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import type { TraceItem, ExecutionTimelineStep } from '@/types/analyticsType';
import { cn } from '@/lib/utils';
import { formatMs, formatFullDate } from '@/utils/formatUtils';
import { InfoRow } from '@/components/shared/InfoRow';
import { CodeBlock } from '@/components/shared/CodeBlock';

function formatJson(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Sqrt-scale width to compress extreme ratios while staying readable */
function getBarWidthPct(durationMs: number, totalDurationMs: number): number {
  const rawPct = Math.sqrt(durationMs / totalDurationMs) * 100;
  return Math.max(rawPct, 4);
}

const PHASE_CONFIG = {
  inference: {
    label: 'Inference',
    barBg: 'bg-foreground',
    accentBg: 'bg-foreground',
    iconContainer: 'bg-foreground text-background',
    Icon: Brain,
  },
  tool_execution: {
    label: 'Tool',
    barBg: 'bg-muted-foreground',
    accentBg: 'bg-muted-foreground',
    iconContainer: 'bg-muted text-foreground',
    Icon: Wrench,
  },
  preparation: {
    label: 'Preparation',
    barBg: 'border border-border bg-transparent',
    accentBg: 'bg-border',
    iconContainer: 'border border-border bg-transparent text-muted-foreground',
    Icon: Settings,
  },
} as const;

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'destructive' | 'outline'; Icon: typeof XCircle }
> = {
  failed: { label: 'Failed', variant: 'destructive', Icon: XCircle },
  pending: { label: 'Pending', variant: 'outline', Icon: Clock },
};

interface TimelineLayout {
  steps: ExecutionTimelineStep[];
  totalDurationMs: number;
  startTime: Date;
  endTime: Date;
  inferenceCount: number;
  toolCount: number;
}

function computeLayout(timeline: ExecutionTimelineStep[]): TimelineLayout {
  const sorted = [...timeline].sort((a, b) => a.step - b.step);
  const starts = sorted.map((s) => new Date(s.started_at).getTime());
  const ends = sorted.map((s) => new Date(s.completed_at).getTime());
  const minStart = Math.min(...starts);
  const maxEnd = Math.max(...ends);

  return {
    steps: sorted,
    totalDurationMs: Math.max(maxEnd - minStart, 1),
    startTime: new Date(minStart),
    endTime: new Date(maxEnd),
    inferenceCount: sorted.filter((s) => s.phase === 'inference').length,
    toolCount: sorted.filter((s) => s.phase === 'tool_execution').length,
  };
}

function getBarPosition(step: ExecutionTimelineStep, layout: TimelineLayout) {
  const startMs = new Date(step.started_at).getTime() - layout.startTime.getTime();
  const leftPct = (startMs / layout.totalDurationMs) * 100;
  const widthPct = getBarWidthPct(step.duration_ms, layout.totalDurationMs);
  return { leftPct, widthPct, offsetMs: startMs };
}

function SummarySection({
  layout,
  hasToolCalls,
}: {
  layout: TimelineLayout;
  hasToolCalls: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold tabular-nums tracking-tight">
              {formatMs(layout.totalDurationMs)}
            </span>
            <span className="text-sm text-muted-foreground font-medium">total</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {layout.steps.length} step{layout.steps.length > 1 ? 's' : ''}
            </span>
            {layout.inferenceCount > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">
                  {layout.inferenceCount} inference{layout.inferenceCount > 1 ? 's' : ''}
                </span>
              </>
            )}
            {layout.toolCount > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">
                  {layout.toolCount} tool call{layout.toolCount > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {hasToolCalls && (
          <Badge variant="outline" className="text-[10px] gap-1.5 shrink-0 font-medium">
            <Wrench className="size-3" />
            Function Calling
          </Badge>
        )}
      </div>
    </div>
  );
}

function TimelineBar({
  layout,
  activeStep,
  onStepClick,
}: {
  layout: TimelineLayout;
  activeStep: string | null;
  onStepClick: (step: string) => void;
}) {
  const ticks = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, i) => ({
      pct: (i / count) * 100,
      label: formatMs((i / count) * layout.totalDurationMs),
    }));
  }, [layout.totalDurationMs]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-0.5">
      <TooltipProvider delayDuration={100}>
        {layout.steps.map((step) => {
          const { leftPct, widthPct, offsetMs } = getBarPosition(step, layout);
          const phase = PHASE_CONFIG[step.phase];
          const isPrep = step.phase === 'preparation' && step.status !== 'failed';
          const barColor = step.status === 'failed' ? 'bg-destructive' : isPrep ? '' : phase.barBg;
          const isActive = activeStep === String(step.step);
          const name =
            step.phase === 'tool_execution'
              ? (step.tool_name ?? 'Tool')
              : step.phase === 'inference'
                ? phase.label
                : 'Prep';

          return (
            <Tooltip key={step.step}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-2 w-full h-8 cursor-pointer group rounded-md px-1.5 transition-colors',
                    isActive ? 'bg-muted' : 'hover:bg-muted/50'
                  )}
                  onClick={() => onStepClick(String(step.step))}
                >
                  <div className={cn('w-0.5 h-4 rounded-full shrink-0', phase.accentBg)} />

                  <span className="text-[11px] text-muted-foreground font-medium shrink-0 w-20 truncate text-right">
                    {step.step}. {name}
                  </span>

                  <div className="relative flex-1 h-3 bg-muted/80 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'absolute inset-y-0 rounded-full transition-all',
                        isPrep && step.status !== 'failed'
                          ? 'border border-border bg-transparent'
                          : barColor
                      )}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        minWidth: '8px',
                      }}
                    />
                  </div>

                  {/* Duration */}
                  <span className="text-[11px] text-muted-foreground font-mono tabular-nums shrink-0 w-12 text-right">
                    {formatMs(step.duration_ms)}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs">
                <p className="font-medium">
                  Step {step.step} · {name}
                </p>
                <p className="text-muted-foreground">
                  {formatMs(step.duration_ms)} · at +{formatMs(offsetMs)}
                </p>
                {step.phase === 'inference' &&
                  step.tokens_in != null &&
                  step.tokens_out != null && (
                    <p className="text-muted-foreground">
                      {step.tokens_in} → {step.tokens_out} tokens
                    </p>
                  )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>

      <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
        <div className="flex items-center gap-3">
          {ticks.map((t) => (
            <span key={t.pct} className="text-[10px] text-muted-foreground tabular-nums font-mono">
              {t.label}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {layout.inferenceCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-foreground inline-block" />
              <span className="text-[10px] text-muted-foreground">
                Inference · {layout.inferenceCount}
              </span>
            </div>
          )}
          {layout.toolCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-muted-foreground inline-block" />
              <span className="text-[10px] text-muted-foreground">Tool · {layout.toolCount}</span>
            </div>
          )}
          {layout.steps.some((s) => s.phase === 'preparation') && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full border border-border bg-transparent inline-block" />
              <span className="text-[10px] text-muted-foreground">Prep</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InferenceDetails({ step }: { step: ExecutionTimelineStep }) {
  const metadataContent =
    step.metadata && Object.keys(step.metadata).length > 0 ? formatJson(step.metadata) : null;

  return (
    <div className="rounded-md bg-muted/50 border border-border overflow-hidden mb-3">
      <div className="px-3">
        <InfoRow label="Duration" value={formatMs(step.duration_ms)} />
        {step.provider && <InfoRow label="Provider" value={step.provider} />}
        {step.model && <InfoRow label="Model" value={step.model} />}
        {step.ttft_ms != null && <InfoRow label="TTFT" value={formatMs(step.ttft_ms)} />}
        {step.tokens_in != null && (
          <InfoRow label="Input Tokens" value={step.tokens_in.toLocaleString()} />
        )}
        {step.tokens_out != null && (
          <InfoRow label="Output Tokens" value={step.tokens_out.toLocaleString()} />
        )}
        <InfoRow label="Started" value={formatFullDate(step.started_at)} />
        <InfoRow label="Completed" value={formatFullDate(step.completed_at)} />
      </div>
      {metadataContent && (
        <div className="border-t border-border">
          <CodeBlock label="Metadata" content={metadataContent} flush />
        </div>
      )}
    </div>
  );
}

function ToolDetails({ step }: { step: ExecutionTimelineStep }) {
  return (
    <div className="rounded-md bg-muted/50 border border-border overflow-hidden mb-3">
      <div className="px-3">
        <InfoRow label="Duration" value={formatMs(step.duration_ms)} />
        {step.tool_name && <InfoRow label="Tool Name" value={step.tool_name} />}
        {step.tool_call_id && (
          <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Call ID</span>
            <div className="flex items-center gap-1.5 ml-4 max-w-[60%] justify-end">
              <code className="text-sm font-mono text-foreground truncate">
                {step.tool_call_id}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(step.tool_call_id!);
                  toast.success('Tool Call ID copied');
                }}
              >
                <Copy className="size-3" />
              </Button>
            </div>
          </div>
        )}
        <InfoRow label="Started" value={formatFullDate(step.started_at)} />
        <InfoRow label="Completed" value={formatFullDate(step.completed_at)} />
      </div>

      {step.tool_input && (
        <div className="border-t border-border mt-1">
          <CodeBlock
            label="Input"
            content={formatJson(step.tool_input)}
            meta={`${formatJson(step.tool_input).length} chars`}
            flush
          />
        </div>
      )}

      {step.tool_output && (
        <div className="border-t border-border">
          <CodeBlock
            label="Output"
            content={
              typeof step.tool_output === 'string' ? step.tool_output : formatJson(step.tool_output)
            }
            meta={`${(typeof step.tool_output === 'string' ? step.tool_output : formatJson(step.tool_output)).length} chars`}
            variant="success"
            flush
          />
        </div>
      )}

      {step.tool_error && (
        <div className="border-t border-border">
          <CodeBlock label="Error" content={step.tool_error} variant="error" flush />
        </div>
      )}
    </div>
  );
}

function PreparationDetails({ step }: { step: ExecutionTimelineStep }) {
  const metadataContent =
    step.metadata && Object.keys(step.metadata).length > 0 ? formatJson(step.metadata) : null;

  return (
    <div className="rounded-md bg-muted/50 border border-border overflow-hidden mb-3">
      <div className="px-3">
        <InfoRow label="Duration" value={formatMs(step.duration_ms)} />
        <InfoRow label="Started" value={formatFullDate(step.started_at)} />
        <InfoRow label="Completed" value={formatFullDate(step.completed_at)} />
      </div>
      {metadataContent && (
        <div className="border-t border-border">
          <CodeBlock label="Metadata" content={metadataContent} flush />
        </div>
      )}
    </div>
  );
}

interface ExecutionTimelineProps {
  trace: TraceItem;
}

export function ExecutionTimeline({ trace }: ExecutionTimelineProps) {
  const timeline = trace.execution_timeline;

  const layout = useMemo(() => {
    if (!timeline || timeline.length === 0) return null;
    return computeLayout(timeline);
  }, [timeline]);

  const [activeStep, setActiveStep] = useState<string | null>(null);

  const handleBarClick = useCallback((stepKey: string) => {
    setActiveStep((prev) => (prev === stepKey ? null : stepKey));
  }, []);

  if (!layout) return null;

  return (
    <div className="space-y-3">
      <SummarySection layout={layout} hasToolCalls={trace.has_tool_calls ?? false} />

      <TimelineBar layout={layout} activeStep={activeStep} onStepClick={handleBarClick} />

      <Accordion
        type="single"
        collapsible
        value={activeStep ?? ''}
        onValueChange={(v) => setActiveStep(v || null)}
        className="space-y-1"
      >
        {layout.steps.map((step) => {
          const phase = PHASE_CONFIG[step.phase];
          const status = STATUS_BADGE[step.status];
          const PhaseIcon = phase.Icon;

          const stepName =
            step.phase === 'tool_execution'
              ? (step.tool_name ?? 'Tool')
              : step.phase === 'inference' && step.provider && step.model
                ? `${step.provider}/${step.model}`
                : phase.label;

          const durationPct =
            layout.totalDurationMs > 0 ? (step.duration_ms / layout.totalDurationMs) * 100 : 0;

          const isSignificant = step.duration_ms / layout.totalDurationMs > 0.1;
          const isActive = activeStep === String(step.step);

          return (
            <AccordionItem
              key={step.step}
              value={String(step.step)}
              className={cn(
                'border border-border rounded-lg overflow-hidden transition-colors',
                isActive ? 'bg-card border-foreground/10' : 'bg-card/50'
              )}
            >
              <AccordionTrigger className="text-sm py-3 px-3 hover:no-underline hover:bg-muted/50 transition-colors">
                <span className="flex items-center gap-2.5 min-w-0 w-full">
                  <div
                    className={cn(
                      'size-7 flex items-center justify-center rounded-md shrink-0',
                      step.status === 'failed'
                        ? 'bg-destructive/10 text-destructive'
                        : phase.iconContainer
                    )}
                  >
                    <PhaseIcon className="size-3.5" />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    #{step.step}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">{stepName}</span>
                  {status && (
                    <Badge variant={status.variant} className="shrink-0 gap-0.5 text-[10px]">
                      <status.Icon className="size-3" />
                      {status.label}
                    </Badge>
                  )}
                  <span
                    className={cn(
                      'ml-auto tabular-nums font-mono shrink-0',
                      isSignificant
                        ? 'text-sm font-semibold text-foreground'
                        : 'text-xs text-muted-foreground'
                    )}
                  >
                    {formatMs(step.duration_ms)}
                  </span>
                </span>
              </AccordionTrigger>

              <div className="h-0.5 bg-muted mx-0">
                <div
                  className={cn('h-full rounded-r-full', phase.accentBg)}
                  style={{ width: `${durationPct}%` }}
                />
              </div>
              <AccordionContent className="pb-0 pt-3 px-3">
                {step.phase === 'inference' && <InferenceDetails step={step} />}
                {step.phase === 'tool_execution' && <ToolDetails step={step} />}
                {step.phase === 'preparation' && <PreparationDetails step={step} />}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
