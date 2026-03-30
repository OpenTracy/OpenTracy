import { useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import type {
  DistillationJob,
  DistillationStatus,
  DistillationPhase,
  DistillationProgress,
  DistillationResults,
  DistillationConfig,
  CreateDistillationJobRequest,
  BackendJobStatus,
  BackendJobDetails,
  GGUFArtifact,
  AvailableTeacherModel,
} from '../types/distillationTypes';

const API_BASE = API_BASE_URL;

export interface CurationCandidate {
  text: string;
  scores: { quality: number; diversity?: number };
  isWinner: boolean;
  candidate_idx: number;
}

export interface CurationSample {
  prompt: string;
  trace_id: string;
  candidates: CurationCandidate[];
}

// =============================================================================
// API Helper
// =============================================================================

async function apiCall<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[DistillationService] API Error: ${response.status}`, errorText);
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// =============================================================================
// Backend → Frontend Mapping
// =============================================================================

const VALID_STATUSES: DistillationStatus[] = [
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
];
const VALID_PHASES: DistillationPhase[] = [
  'initializing',
  'data_generation',
  'curation',
  'training',
  'export',
  'completed',
];

function mapStatus(status: string): DistillationStatus {
  const lower = status.toLowerCase();
  if (VALID_STATUSES.includes(lower as DistillationStatus)) {
    return lower as DistillationStatus;
  }
  // Map "pending" from backend to "queued" if needed (backend uses "pending" pre-SFN start)
  if (lower === 'pending') return 'pending';
  return 'running';
}

function mapPhase(phase?: string): DistillationPhase {
  if (!phase) return 'data_generation';
  const lower = phase.toLowerCase();
  if (VALID_PHASES.includes(lower as DistillationPhase)) {
    return lower as DistillationPhase;
  }
  return 'data_generation';
}

/**
 * Convert backend progress (per-stage dict) to frontend DistillationProgress.
 *
 * Backend format: { data_generation: { status, progress }, curation: {...}, training: {...}, export: {...} }
 * Frontend format: { phase, phase_progress, overall_progress, candidates_generated, ... }
 */
function mapProgress(
  backendProgress: Record<string, Record<string, unknown>> | undefined,
  phase: DistillationPhase
): DistillationProgress {
  if (!backendProgress) {
    return {
      phase,
      phase_progress: 0,
      overall_progress: 0,
    };
  }

  // Determine current phase progress
  const stages = ['data_generation', 'curation', 'training', 'export'];
  const currentStage = backendProgress[phase] || backendProgress[stages[0]];
  const phaseProgress = (currentStage?.progress as number) ?? 0;

  // Calculate overall progress as weighted average across stages
  let completedWeight = 0;
  for (const stage of stages) {
    const stageData = backendProgress[stage];
    if (stageData) {
      completedWeight += ((stageData.progress as number) ?? 0) / 100;
    }
  }
  const overallProgress = Math.round((completedWeight / stages.length) * 100);

  const dataGen = backendProgress.data_generation;
  const training = backendProgress.training;
  const trainingDetails = training?.details as Record<string, unknown> | undefined;
  const curation = backendProgress.curation;

  // Resolve training metrics from top-level or nested details, with HF-style key fallbacks
  const trainingLoss =
    (training?.training_loss as number | undefined) ??
    (training?.train_loss as number | undefined) ??
    (training?.loss as number | undefined) ??
    (trainingDetails?.training_loss as number | undefined) ??
    (trainingDetails?.train_loss as number | undefined) ??
    (trainingDetails?.loss as number | undefined);

  const validationLoss =
    (training?.validation_loss as number | undefined) ??
    (training?.eval_loss as number | undefined) ??
    (training?.val_loss as number | undefined) ??
    (trainingDetails?.validation_loss as number | undefined) ??
    (trainingDetails?.eval_loss as number | undefined) ??
    (trainingDetails?.val_loss as number | undefined);

  return {
    phase,
    phase_progress: phaseProgress,
    overall_progress: overallProgress,
    candidates_generated: dataGen?.candidates_generated as number | undefined,
    candidates_total: dataGen?.candidates_total as number | undefined,
    samples_curated: curation?.samples_curated as number | undefined,
    training_loss: trainingLoss,
    validation_loss: validationLoss,
    training_epoch: training?.training_epoch as number | undefined,
    total_epochs: training?.total_epochs as number | undefined,
    current_step: training?.current_step as number | undefined,
    total_steps: training?.total_steps as number | undefined,
  };
}

function mapConfig(backendConfig: Record<string, unknown>): DistillationConfig {
  return {
    teacher_model: (backendConfig.teacher_model as string) || 'gpt-4o',
    student_model:
      (backendConfig.student_model as string) || (backendConfig.base_model as string) || '',
    target_device: (backendConfig.target_device as string) || '',
    dataset_id: (backendConfig.dataset_id as string) || '',
    n_samples: (backendConfig.n_samples as number) || 4,
    temperature: (backendConfig.temperature as number) || 0.8,
    curation_agents: (backendConfig.curation_agents as DistillationConfig['curation_agents']) || [],
    quantization:
      (backendConfig.quantization as string) ||
      (backendConfig.quantization_types as string[])?.[0] ||
      'q4_k_m',
    output_name: (backendConfig.output_name as string) || '',
    training_steps: backendConfig.training_steps as number | undefined,
    num_prompts: backendConfig.num_prompts as number | undefined,
    base_model: backendConfig.base_model as string | undefined,
    quantization_types: backendConfig.quantization_types as string[] | undefined,
    export_gguf: backendConfig.export_gguf as boolean | undefined,
  };
}

function mapResults(
  results?: BackendJobDetails['results'] | null
): DistillationResults | undefined {
  if (!results) return undefined;
  return {
    quality_score: results.quality_score ?? 0,
    cost_savings: results.cost_savings ?? 0,
    speed_improvement: results.speed_improvement ?? 0,
    sample_comparisons: (results.sample_comparisons ?? []).map((c) => ({
      ...c,
      teacher_response: c.teacher_response || c.response || '',
    })),
    model_artifact_url: results.model_artifact_url,
    gguf_download_url: results.gguf_download_url,
  };
}

function mapBackendJobStatus(job: BackendJobStatus): DistillationJob {
  const status = mapStatus(job.status);
  const phase = status === 'completed' ? 'completed' : mapPhase(job.phase);

  return {
    id: job.id,
    name: job.name || 'Untitled',
    status,
    phase,
    config: job.config
      ? mapConfig(job.config)
      : {
          teacher_model: '',
          student_model: '',
          target_device: '',
          dataset_id: '',
          n_samples: 4,
          temperature: 0.8,
          curation_agents: [],
          quantization: 'q4_k_m',
          output_name: '',
        },
    progress: mapProgress(job.progress, phase),
    cost_accrued: job.cost_accrued ?? 0,
    created_at: job.created_at,
  };
}

function mapBackendJobDetails(job: BackendJobDetails): DistillationJob {
  const status = mapStatus(job.status);
  const phase = status === 'completed' ? 'completed' : mapPhase(job.phase);

  return {
    id: job.id,
    name: job.name || 'Untitled',
    status,
    phase,
    config: mapConfig(job.config),
    progress: mapProgress(job.progress, phase),
    results: mapResults(job.results),
    cost_accrued: job.cost_accrued ?? 0,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    error: job.error ? { code: 'ERROR', message: job.error } : undefined,
  };
}

// =============================================================================
// Frontend → Backend Mapping
// =============================================================================

interface BackendCreateRequest {
  tenant_id: string;
  name: string;
  prompt_dataset_key?: string;
  config: {
    teacher_model: string;
    student_model: string;
    n_samples: number;
    temperature: number;
    target_device?: string;
    curation_agents?: { id: string; enabled: boolean; threshold?: number }[];
    quantization?: string;
    output_name?: string;
    dataset_id?: string;
  };
}

function mapCreateRequest(
  request: CreateDistillationJobRequest,
  tenantId: string
): BackendCreateRequest {
  const config = request.config;

  return {
    tenant_id: tenantId,
    name: request.name,
    config: {
      teacher_model: config.teacher_model || 'gpt-4o',
      student_model: config.student_model,
      n_samples: config.n_samples ?? 4,
      temperature: config.temperature ?? 0.8,
      ...(config.target_device ? { target_device: config.target_device } : {}),
      ...(config.curation_agents?.length
        ? {
            curation_agents: config.curation_agents.map((a) => ({
              id: a.id,
              enabled: a.enabled,
              threshold: a.threshold,
            })),
          }
        : {}),
      ...(config.quantization ? { quantization: config.quantization } : {}),
      ...(config.output_name ? { output_name: config.output_name } : {}),
      ...(config.dataset_id ? { dataset_id: config.dataset_id } : {}),
    },
  };
}

// =============================================================================
// Estimate types
// =============================================================================

export interface EstimateRequest {
  student_model: string;
  num_prompts: number;
  n_samples: number;
}

export interface EstimateResponse {
  estimated_cost: number;
  is_sandbox: boolean;
  tier: string;
  balance: number;
  sufficient: boolean;
}

// =============================================================================
// Service Hook
// =============================================================================

export function useDistillationService() {
  const listJobs = useCallback(
    async (accessToken: string, tenantId: string): Promise<DistillationJob[]> => {
      const data = await apiCall<BackendJobStatus[]>(
        `/v1/distillation?tenant_id=${encodeURIComponent(tenantId)}`,
        accessToken
      );
      return data.map(mapBackendJobStatus);
    },
    []
  );

  const getJob = useCallback(
    async (
      accessToken: string,
      jobId: string,
      tenantId: string
    ): Promise<DistillationJob | null> => {
      try {
        const data = await apiCall<BackendJobDetails>(
          `/v1/distillation/${encodeURIComponent(jobId)}?tenant_id=${encodeURIComponent(tenantId)}`,
          accessToken
        );
        console.debug('[DistillationService] Raw progress:', data.progress);
        if (data.progress?.training) {
          console.debug(
            '[DistillationService] Training keys:',
            Object.keys(data.progress.training),
            data.progress.training
          );
        }
        return mapBackendJobDetails(data);
      } catch {
        return null;
      }
    },
    []
  );

  const createJob = useCallback(
    async (
      accessToken: string,
      request: CreateDistillationJobRequest,
      tenantId: string
    ): Promise<DistillationJob> => {
      const backendReq = mapCreateRequest(request, tenantId);
      const data = await apiCall<BackendJobStatus>('/v1/distillation', accessToken, {
        method: 'POST',
        body: JSON.stringify(backendReq),
      });
      return mapBackendJobStatus(data);
    },
    []
  );

  const cancelJob = useCallback(
    async (accessToken: string, jobId: string, tenantId: string): Promise<boolean> => {
      try {
        await apiCall<BackendJobStatus>(
          `/v1/distillation/${encodeURIComponent(jobId)}/cancel?tenant_id=${encodeURIComponent(tenantId)}`,
          accessToken,
          { method: 'POST' }
        );
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const deleteJob = useCallback(
    async (accessToken: string, jobId: string, tenantId: string): Promise<boolean> => {
      try {
        await apiCall<{ deleted: boolean }>(
          `/v1/distillation/${encodeURIComponent(jobId)}?tenant_id=${encodeURIComponent(tenantId)}`,
          accessToken,
          { method: 'DELETE' }
        );
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const getJobResults = useCallback(
    async (
      accessToken: string,
      jobId: string,
      tenantId: string
    ): Promise<DistillationResults | null> => {
      try {
        const data = await apiCall<BackendJobDetails>(
          `/v1/distillation/${encodeURIComponent(jobId)}?tenant_id=${encodeURIComponent(tenantId)}`,
          accessToken
        );
        return mapResults(data.results) || null;
      } catch {
        return null;
      }
    },
    []
  );

  const getJobLogs = useCallback(
    async (accessToken: string, jobId: string, tenantId?: string): Promise<string[]> => {
      try {
        const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
        const data = await apiCall<{ logs: string[] }>(
          `/v1/distillation/${encodeURIComponent(jobId)}/logs${qs}`,
          accessToken
        );
        return data.logs ?? [];
      } catch {
        return [];
      }
    },
    []
  );

  const getJobCandidates = useCallback(
    async (
      accessToken: string,
      jobId: string,
      tenantId?: string
    ): Promise<{ samples: CurationSample[]; total: number }> => {
      try {
        const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
        const data = await apiCall<{ samples: CurationSample[]; total: number }>(
          `/v1/distillation/${encodeURIComponent(jobId)}/candidates${qs}`,
          accessToken
        );
        return { samples: data.samples ?? [], total: data.total ?? 0 };
      } catch {
        return { samples: [], total: 0 };
      }
    },
    []
  );

  const getJobArtifacts = useCallback(
    async (accessToken: string, jobId: string, tenantId: string): Promise<GGUFArtifact[]> => {
      try {
        return await apiCall<GGUFArtifact[]>(
          `/v1/distillation/${encodeURIComponent(jobId)}/artifacts?tenant_id=${encodeURIComponent(tenantId)}`,
          accessToken
        );
      } catch {
        return [];
      }
    },
    []
  );

  const estimateJob = useCallback(
    async (
      accessToken: string,
      request: EstimateRequest,
      tenantId: string
    ): Promise<EstimateResponse> => {
      return apiCall<EstimateResponse>(
        `/v1/distillation/estimate?tenant_id=${encodeURIComponent(tenantId)}`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );
    },
    []
  );

  const listAvailableModels = useCallback(
    async (accessToken: string): Promise<AvailableTeacherModel[]> => {
      try {
        const data = await apiCall<{ models: AvailableTeacherModel[] }>(
          '/v1/models/available',
          accessToken
        );
        return (data.models ?? []).filter((m) => m.available);
      } catch {
        return [];
      }
    },
    []
  );

  const deployJob = useCallback(
    async (
      accessToken: string,
      jobId: string,
      tenantId: string,
      instanceType?: string
    ): Promise<{
      deployment_id: string;
      model_id: string;
      status: string;
      already_deployed: boolean;
    }> => {
      return apiCall(
        `/v1/distillation/${encodeURIComponent(jobId)}/deploy?tenant_id=${encodeURIComponent(tenantId)}`,
        accessToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instance_type: instanceType || 'cpu-small' }),
        }
      );
    },
    []
  );

  return {
    listJobs,
    getJob,
    createJob,
    cancelJob,
    deleteJob,
    getJobResults,
    getJobLogs,
    getJobCandidates,
    getJobArtifacts,
    estimateJob,
    listAvailableModels,
    deployJob,
  };
}
