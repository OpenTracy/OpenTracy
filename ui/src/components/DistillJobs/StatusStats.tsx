import { Badge } from '@/components/ui/badge';

interface JobStats {
  running: number;
  completed: number;
  total: number;
}

interface StatusStatsProps {
  stats: JobStats;
}

export function StatusStats({ stats }: StatusStatsProps) {
  return (
    <div className="flex items-center gap-2 ml-auto shrink-0">
      <Badge variant="secondary" className="px-3 py-2 text-sm">
        <span className="font-medium">{stats.running}</span>
        <span className="text-muted-foreground">Running</span>
      </Badge>
      <Badge variant="secondary" className="px-3 py-2 text-sm">
        <span className="font-medium">{stats.completed}</span>
        <span className="text-muted-foreground">Completed</span>
      </Badge>
      <Badge variant="secondary" className="px-3 py-2 text-sm">
        <span className="font-medium">{stats.total}</span>
        <span className="text-muted-foreground">Total</span>
      </Badge>
    </div>
  );
}
