import { cn } from '@/lib/utils';
import { formatPct, scorePillClasses } from './utils';

interface ScorePillProps {
  score: number;
  className?: string;
}

export function ScorePill({ score, className }: ScorePillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums',
        scorePillClasses(score),
        className
      )}
    >
      {formatPct(score)}
    </span>
  );
}
