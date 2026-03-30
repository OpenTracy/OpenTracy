import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ItemGroup } from '@/components/ui/item';
import { useModelLeaderboard } from './useModelLeaderboard';
import { LeaderboardRow } from './LeaderboardRow';
import { LeaderboardEmptyState } from './LeaderboardEmptyState';
import type { ModelLeaderboardProps } from './types';

export function ModelLeaderboard({ evaluations }: ModelLeaderboardProps) {
  const { rankings, completedCount, topScore } = useModelLeaderboard(evaluations);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-muted-foreground" />
            <CardTitle>Model Leaderboard</CardTitle>
          </div>
          {completedCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {completedCount} eval{completedCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {completedCount > 0 && (
          <CardDescription className="text-xs">
            Average score across completed evaluations
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 px-3 pt-0 pb-3">
        {rankings.length === 0 ? (
          <LeaderboardEmptyState hasCompletedEvals={completedCount > 0} />
        ) : (
          <ItemGroup>
            {rankings.map((entry, index) => (
              <LeaderboardRow
                key={entry.model}
                entry={entry}
                rank={index + 1}
                topScore={topScore}
              />
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}
