export type ValidationStatus = 'idle' | 'validating' | 'success' | 'error' | 'warning';

export interface ValidationState {
  modelAccess: ValidationStatus;
  textGeneration: ValidationStatus;
  vllm: ValidationStatus;
  modelAccessMessage?: string;
  textGenerationMessage?: string;
  vllmMessage?: string;
}

export interface HuggingFaceModelInfo {
  id: string;
  pipeline_tag?: string;
  library_name?: string;
  gated?: boolean | string;
  private?: boolean;
  downloads?: number;
  likes?: number;
  config?: { model_type?: string };
  cardData?: { license?: string };
  tags?: string[];
}

export const INITIAL_VALIDATION: ValidationState = {
  modelAccess: 'idle',
  textGeneration: 'idle',
  vllm: 'idle',
};
