export type {
  AutoEvalConfig,
  CreateCustomMetricRequest,
  CreateEvaluationRequest,
  Dataset,
  Evaluation,
  EvaluationMetric,
  EvaluationResults,
  EvaluationStatus,
  EvaluationStatusResponse,
  Proposal,
  ProposalPriority,
  ProposalStatus,
  ProposalType,
  SampleResult,
  TraceIssue,
} from './evaluationsTypes';

export interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  type: 'external' | 'deployment' | 'registered' | 'deployed';
  available: boolean;
  status?: string;
  providers?: string[];
}

export interface EvalPrefillConfig {
  name?: string;
  datasetId?: string;
  models?: string[];
  metrics?: string[];
}

export type TabId =
  | 'overview'
  | 'evaluations'
  | 'experiments'
  | 'issues'
  | 'annotations'
  | 'metrics';
