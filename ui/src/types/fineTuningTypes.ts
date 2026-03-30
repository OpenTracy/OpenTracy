export type FineTuningStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface LoRAConfig {
  rank: number;
  alpha: number;
  dropout: number;
  targetModules: string[];
}

export interface TrainingConfig {
  // Core training parameters
  learningRate: number;
  numEpochs: number;
  perDeviceTrainBatchSize: number;
  gradientAccumulationSteps: number;
  warmupSteps: number;

  // Optimization
  maxGradNorm: number;
  weightDecay: number;
  optimizer: 'adamw_8bit' | 'adamw' | 'sgd';
  lrSchedulerType: 'linear' | 'cosine' | 'constant';

  // Model parameters
  maxSeqLength: number;
  seed: number;
  loggingSteps: number;

  // Precision
  fp16: boolean;
  bf16: boolean;

  // Advanced
  packing: boolean;
  useGradientCheckpointing: boolean;
}

export interface FineTuningJob {
  id: string;
  name: string;
  baseModel: string;
  dataset: {
    name: string;
    url?: string;
    file?: File;
    type: 'url' | 'upload';
  };
  trainingConfig: TrainingConfig;
  loraConfig?: LoRAConfig;
  status: FineTuningStatus;
  progress?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  metrics?: {
    loss: number;
    accuracy?: number;
    validationLoss?: number;
  };
  error?: string;
}

export interface CreateFineTuningJobRequest {
  name: string;
  baseModel: string;
  datasetUrl?: string;
  datasetFile?: File;
  trainingConfig: TrainingConfig;
  loraConfig?: LoRAConfig;
}

export interface FineTuningJobResponse {
  job: FineTuningJob;
  message?: string;
}
