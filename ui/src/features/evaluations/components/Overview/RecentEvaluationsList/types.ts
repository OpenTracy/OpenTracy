import type { Evaluation } from '../../../types';

export interface RecentEvaluationsListProps {
  evaluations: Evaluation[];
  onViewResults: (evaluation: Evaluation) => void;
  onCancel: (evaluation: Evaluation) => void;
  onDelete: (evaluation: Evaluation) => void;
  onViewAll: () => void;
}

export interface ActivityRowProps {
  evaluation: Evaluation;
  onViewResults: (evaluation: Evaluation) => void;
  onCancel: (evaluation: Evaluation) => void;
  onDelete: (evaluation: Evaluation) => void;
}

export type { Evaluation };
