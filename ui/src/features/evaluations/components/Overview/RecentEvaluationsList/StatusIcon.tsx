import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import type { Evaluation } from './types';

interface StatusIconProps {
  status: Evaluation['status'];
}

export function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case 'running':
    case 'starting':
      return (
        <span className="relative flex size-2 shrink-0">
          <span className="animate-ping absolute inline-flex size-full rounded-full bg-primary/50" />
          <span className="relative inline-flex rounded-full size-2 bg-primary" />
        </span>
      );
    case 'queued':
      return <Loader2 className="size-3.5 text-muted-foreground animate-spin shrink-0" />;
    case 'completed':
      return <CheckCircle className="size-3.5 text-chart-2 shrink-0" />;
    case 'failed':
      return <XCircle className="size-3.5 text-destructive shrink-0" />;
    default:
      return <Clock className="size-3.5 text-muted-foreground shrink-0" />;
  }
}
