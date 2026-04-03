import { Progress } from '@/components/ui/progress';
import type { DistillationStatus } from '@/types/distillationTypes';
import { ItemContent, ItemDescription } from '@/components/ui/item';

interface JobMetricsProps {
  status: DistillationStatus;
  progress?: number;
}

export function JobMetrics({ status, progress }: JobMetricsProps) {
  return (
    <div className="flex items-center gap-4">
      <ItemContent className="flex-col items-end gap-1">
        {status === 'running' && progress !== undefined && (
          <div className="w-24">
            <Progress value={progress} className="h-1.5" />
            <span className="text-[10px] text-muted-foreground mt-0.5 block text-right tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </ItemContent>
    </div>
  );
}
