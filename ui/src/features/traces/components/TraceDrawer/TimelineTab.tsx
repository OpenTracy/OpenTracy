import { useMemo } from 'react';
import { Clock, AlertCircle, Wrench, List } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';

import type { TraceItem } from '@/types/analyticsType';
import { cn } from '@/lib/utils';
import { formatMs } from '@/utils/formatUtils';
import { buildTimelineSpans, type TimelineSpan } from '../../utils/buildTimelineSpans';
import { ExecutionTimeline } from './ExecutionTimeline';

const ROLE_LABELS: Record<string, string> = {
  call: 'Request',
  system: 'System',
  user: 'User',
  assistant: 'Assistant',
  tool_call: 'Tool Call',
  tool_result: 'Tool Result',
  output: 'Response',
  error: 'Error',
};

interface TimelineEventProps {
  span: TimelineSpan;
  callTime?: Date;
  isLast: boolean;
}

function TimelineEvent({ span, isLast }: Omit<TimelineEventProps, 'callTime'>) {
  const roleLabel = ROLE_LABELS[span.role] ?? span.role;

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center pt-0.5">
        <div
          className={cn(
            'size-2.5 rounded-full shrink-0 ring-2 ring-background',
            span.isError ? 'bg-destructive' : 'bg-muted-foreground/60'
          )}
        />
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      <div className={cn('pb-5 min-w-0 flex-1', isLast && 'pb-0')}>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 h-5 shrink-0">
            {roleLabel}
          </Badge>
          <span className="text-sm font-medium truncate">{span.label}</span>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums ml-auto shrink-0">
            {formatMs(span.durationMs)}
          </span>
        </div>

        {span.sublabel && (
          <p className="text-xs text-muted-foreground font-mono mt-1.5 truncate">{span.sublabel}</p>
        )}

        {span.toolCallNames && span.toolCallNames.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {span.toolCallNames.map((name) => (
              <Badge key={name} variant="outline" className="font-mono text-[10px] gap-1">
                <Wrench className="size-2.5" />
                {name}
              </Badge>
            ))}
          </div>
        )}

        {span.content && (
          <pre className="mt-2 rounded-md border border-border bg-muted p-2.5 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-20 overflow-auto">
            {span.content.length > 400 ? span.content.slice(0, 400) + '…' : span.content}
          </pre>
        )}
      </div>
    </div>
  );
}

interface TimelineTabProps {
  trace: TraceItem;
}

export function TimelineTab({ trace }: TimelineTabProps) {
  const hasExecutionTimeline = trace.execution_timeline && trace.execution_timeline.length > 0;

  const { spans } = useMemo(() => buildTimelineSpans(trace), [trace]);

  if (hasExecutionTimeline) {
    return (
      <div className="relative flex-1 min-h-0 flex flex-col">
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 pb-10 pt-2">
            <ExecutionTimeline trace={trace} />
          </div>
        </ScrollArea>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
      </div>
    );
  }

  if (spans.length === 0) {
    return (
      <Empty className="h-64">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Clock />
          </EmptyMedia>
          <EmptyTitle>No timeline events</EmptyTitle>
          <EmptyDescription>This trace does not contain any timeline data.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 pb-10 pt-3">
          <div className="flex items-center gap-2 mb-5">
            <div className="size-6 rounded-md bg-muted flex items-center justify-center">
              <List className="size-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium">{spans.length} events</span>
            {trace.status === 'Error' && (
              <Badge variant="destructive" className="ml-auto text-xs gap-1">
                <AlertCircle className="size-3" />
                Error
              </Badge>
            )}
          </div>

          <div className="space-y-0">
            {spans.map((span, i) => (
              <TimelineEvent key={span.id} span={span} isLast={i === spans.length - 1} />
            ))}
          </div>
        </div>
      </ScrollArea>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
