import type { Evaluation } from '../../../types';

export interface ModelLeaderboardProps {
  evaluations: Evaluation[];
}

export interface ModelRanking {
  model: string;
  avgScore: number;
  evalCount: number;
}

export type EvaluationResultsMap = Record<string, NonNullable<Evaluation['results']>>;

export type { Evaluation };
