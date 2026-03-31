import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { TraceItem } from '@/types/analyticsType';
import { getProviderIconByBackend } from '@/utils/modelUtils';
import { formatLatency } from '@/utils/formatUtils';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface TraceDrawerHeaderProps {
  trace: TraceItem;
}

export function TraceDrawerHeader({ trace }: TraceDrawerHeaderProps) {
  const providerIcon = getProviderIconByBackend(trace.backend, trace.model_id);

  const statusVariant = trace.status === 'Success' ? 'secondary' : 'destructive';
  const statusLabel = trace.status === 'Success' ? 'Success' : 'Error';

  return (
    <DrawerHeader className="gap-3 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-9 shrink-0 rounded-lg border border-border bg-card p-1.5">
            <img src={providerIcon} alt={trace.provider} className="size-full object-contain" />
          </div>

          <div className="min-w-0">
            <DrawerTitle className="text-base font-semibold">{trace.model_id}</DrawerTitle>
            <p className="text-sm text-muted-foreground">{trace.provider}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant={statusVariant} className="text-xs">
            {statusLabel}
          </Badge>
          <span className="text-sm font-mono font-medium text-foreground tabular-nums">
            {formatLatency(trace.latency_s)}
          </span>
        </div>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-muted-foreground self-start"
              onClick={() => {
                navigator.clipboard.writeText(trace.id);
                toast.success('Trace ID copied');
              }}
            >
              <code className="text-xs font-mono truncate max-w-48">{trace.id}</code>
              <Copy className="size-3 shrink-0" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {trace.created_at ? `Created ${formatDate(trace.created_at)}` : 'Copy trace ID'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </DrawerHeader>
  );
}
