import { AlertCircle, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TraceIssue } from '../../types/evaluationsTypes';

interface StatItemProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tooltip: string;
  muted?: boolean;
}

function StatItem({ label, value, icon, tooltip, muted }: StatItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 min-w-0 flex-1 cursor-default',
            muted && 'opacity-40'
          )}
        >
          <div className="text-muted-foreground shrink-0">{icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-none truncate">{label}</p>
            <p className="text-lg font-semibold tabular-nums leading-tight mt-0.5">{value}</p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface IssueSummaryCardsProps {
  issues: TraceIssue[];
}

export function IssueSummaryCards({ issues }: IssueSummaryCardsProps) {
  const open = issues.filter((i) => !i.resolved).length;
  const high = issues.filter((i) => !i.resolved && i.severity === 'high').length;
  const resolved = issues.filter((i) => i.resolved).length;

  const typeCounts: Record<string, number> = {};
  for (const issue of issues.filter((i) => !i.resolved)) {
    typeCounts[issue.type] = (typeCounts[issue.type] || 0) + 1;
  }

  const topType =
    Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0]
      ?.replace(/_/g, ' ') || '—';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-wrap rounded-lg border bg-card divide-x overflow-hidden">
        <StatItem
          label="Open Issues"
          value={open}
          icon={<AlertCircle className="size-4" />}
          tooltip="Total unresolved issues"
          muted={open === 0}
        />
        <StatItem
          label="High Severity"
          value={high}
          icon={<AlertTriangle className={cn('size-4', high > 0 && 'text-destructive')} />}
          tooltip="Unresolved high-severity issues"
          muted={high === 0}
        />
        <StatItem
          label="Top Type"
          value={topType}
          icon={<TrendingUp className="size-4" />}
          tooltip="Most frequent unresolved issue type"
          muted={open === 0}
        />
        <StatItem
          label="Resolved"
          value={`${resolved}/${issues.length}`}
          icon={<CheckCircle2 className="size-4" />}
          tooltip="Resolved vs total issues"
          muted={issues.length === 0}
        />
      </div>
    </TooltipProvider>
  );
}
