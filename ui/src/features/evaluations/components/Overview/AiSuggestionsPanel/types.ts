import type {
  EvaluationMetric,
  TraceIssue,
  Dataset,
  Evaluation,
  AvailableModel,
} from '../../../types';

export interface EvalPrefillConfig {
  name?: string;
  datasetId?: string;
  models?: string[];
  metrics?: string[];
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  prefill: EvalPrefillConfig;
  confidence?: number;
  isIssueBased?: boolean;
}

export interface AiSuggestionsPanelProps {
  evaluations: Evaluation[];
  datasets: Dataset[];
  availableModels: AvailableModel[];
  metrics: { builtin: EvaluationMetric[]; custom: EvaluationMetric[] };
  onRunSuggestion: (prefill: EvalPrefillConfig) => void;
  traceIssues?: TraceIssue[];
  onViewProblems?: () => void;
}
