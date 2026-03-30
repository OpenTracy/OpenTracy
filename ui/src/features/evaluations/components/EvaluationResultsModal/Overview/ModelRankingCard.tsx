import { Trophy, Clock, DollarSign } from 'lucide-react';
import type { EvaluationResults } from '../../../types';
import { formatLatency } from '@/utils/formatUtils';
import { formatScore, formatModelName, getScoreColor } from '../utils';
import { RankingCard, type RankingCardStat } from '../../shared/RankingCard';

interface ModelRankingCardProps {
  modelId: string;
  rank: number;
  score: number;
  modelData: NonNullable<EvaluationResults['summary']['models'][string]>;
  isWinner: boolean;
}

export function ModelRankingCard({
  modelId,
  rank,
  score,
  modelData,
  isWinner,
}: ModelRankingCardProps) {
  const stats: RankingCardStat[] = [
    {
      icon: <Clock className="size-3" />,
      label: 'Latency',
      value: formatLatency(modelData?.avg_latency ?? 0),
    },
    ...((modelData?.avg_cost ?? 0) > 0
      ? [
          {
            icon: <DollarSign className="size-3" />,
            label: 'Cost',
            value: `$${modelData.avg_cost.toFixed(4)}`,
          },
        ]
      : []),
  ];

  return (
    <RankingCard
      name={formatModelName(modelId)}
      nameTitle={modelId}
      rank={rank}
      formattedScore={formatScore(score)}
      scoreColorClass={getScoreColor(score)}
      isWinner={isWinner}
      winnerIcon={<Trophy className="size-4 text-muted-foreground" />}
      stats={stats}
    />
  );
}
