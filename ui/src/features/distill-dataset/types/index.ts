export type {
  Dataset,
  DatasetSample,
  CreateDatasetRequest,
  CreateFromInstructionRequest,
  CreateFromInstructionResponse,
  GenerateDatasetRequest,
  GenerateDatasetResponse,
  CollectRun,
  Trace,
} from '@/features/evaluations/types/evaluationsTypes';

export type ViewTab = 'general' | 'data-pipeline' | 'models' | 'evaluate' | 'settings';

export type CreateMode = 'manual' | 'import' | 'topic' | 'generate' | 'traces';

export type GeneratePhase =
  | 'idle'
  | 'preparing'
  | 'generating'
  | 'reviewing'
  | 'building'
  | 'done'
  | 'error';

export type TopicPhase =
  | 'idle'
  | 'scanning'
  | 'analyzing'
  | 'matching'
  | 'building'
  | 'done'
  | 'no-match'
  | 'error';
