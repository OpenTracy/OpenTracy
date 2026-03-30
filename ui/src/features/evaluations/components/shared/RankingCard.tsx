import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RankingCardStat {
  icon?: ReactNode;
  label: string;
  value: string;
}

interface RankingCardProps {
  /** Display name */
  name: string;
  /** Optional tooltip for long names */
  nameTitle?: string;
  /** 1-based rank */
  rank: number;
  /** Main score formatted as a string (e.g. "85.0%") */
  formattedScore: string;
  /** Score color class (e.g. "text-emerald-600") */
  scoreColorClass?: string;
  /** Whether this item is the winner/best */
  isWinner?: boolean;
  /** Winner icon (default: Trophy) */
  winnerIcon?: ReactNode;
  /** Optional stats below the score */
  stats?: RankingCardStat[];
  className?: string;
}

// ---------------------------------------------------------------------------
// RankingCard
// ---------------------------------------------------------------------------

/**
 * A generic ranking card used in both Evaluation Overview (model ranking)
 * and Experiment Overview (evaluation ranking).
 *
 * Accepts different columns/data via props while maintaining a consistent look.
 */
export function RankingCard({
  name,
  nameTitle,
  rank,
  formattedScore,
  scoreColorClass = 'text-foreground',
  isWinner = false,
  winnerIcon,
  stats = [],
  className,
}: RankingCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-2 transition-colors bg-card',
        isWinner ? 'border-foreground/30' : 'border-border',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {isWinner && winnerIcon ? (
          <span className="shrink-0">{winnerIcon}</span>
        ) : (
          <span className="text-xs text-muted-foreground font-medium w-4 text-center">{rank}</span>
        )}
        <span className="text-sm font-semibold truncate text-foreground" title={nameTitle ?? name}>
          {name}
        </span>
      </div>

      <p className={cn('text-2xl font-bold tabular-nums', scoreColorClass)}>{formattedScore}</p>

      {stats.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {stats.map((stat) => (
            <span key={stat.label} className="flex items-center gap-1">
              {stat.icon}
              {stat.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
