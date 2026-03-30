import { Item, ItemMedia, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getScoreColor } from './utils';
import type { ModelRanking } from './types';

interface LeaderboardRowProps {
  entry: ModelRanking;
  rank: number;
  topScore: number;
}

export function LeaderboardRow({ entry, rank, topScore }: LeaderboardRowProps) {
  const scorePercent = entry.avgScore * 100;
  const relativeWidth = (entry.avgScore / topScore) * 100;
  const isTop = rank === 1;

  return (
    <Item
      size="sm"
      className={cn('rounded-md py-2 px-3 hover:bg-muted/50', isTop && 'bg-muted/30')}
    >
      <ItemMedia
        className={cn(
          'text-xs tabular-nums w-4 text-right',
          isTop ? 'text-foreground font-semibold' : 'text-muted-foreground/60'
        )}
      >
        {rank}
      </ItemMedia>

      <ItemContent className="min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <ItemTitle
            className={cn(
              'text-xs truncate',
              isTop ? 'font-semibold' : 'font-normal text-muted-foreground'
            )}
          >
            {entry.model}
          </ItemTitle>
          <span
            className={cn(
              'text-xs font-semibold tabular-nums shrink-0',
              getScoreColor(entry.avgScore)
            )}
          >
            {scorePercent.toFixed(1)}%
          </span>
        </div>
        <Progress
          value={relativeWidth}
          className={cn('h-1', !isTop && '[&>div]:bg-muted-foreground/30')}
        />
      </ItemContent>

      <ItemActions className="text-xs text-muted-foreground w-10 text-right tabular-nums">
        {entry.evalCount} eval{entry.evalCount !== 1 ? 's' : ''}
      </ItemActions>
    </Item>
  );
}
