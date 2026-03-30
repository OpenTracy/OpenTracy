import { ROUTER_BASE_URL } from '../config/api';

const API_BASE = ROUTER_BASE_URL;

export type ResourceType = 'gpu_training' | 'cpu_export' | 'all';
export type QueuePressure = 'low' | 'medium' | 'high';

export interface QuotaPoolInfo {
  pool: string;
  available: boolean;
  queue_pressure: QueuePressure;
  quota: {
    limit: number;
    used_vcpus: number;
    available_vcpus: number;
  };
  compute_environment: {
    state: string;
    status: string;
    min_vcpus: number;
    max_vcpus: number;
    desired_vcpus: number;
    instance_types: string[];
    type: string;
  };
  queue: {
    running_jobs: number;
    runnable_jobs: number;
    pending_jobs: number;
  };
  effective_available_vcpus: number;
  vcpus_per_job: number;
}

export interface QuotaCheckResponse {
  available: boolean;
  resources: Record<string, QuotaPoolInfo>;
}

export interface QuotaStatusResponse {
  pools: Record<string, QuotaPoolInfo>;
  account_quotas: {
    gpu_ondemand_vcpus: number;
    cpu_ondemand_vcpus: number;
    cpu_spot_vcpus: number;
  };
}

export async function checkQuota(
  token: string,
  resourceType: ResourceType
): Promise<QuotaCheckResponse> {
  const res = await fetch(
    `${API_BASE}/v1/quota/check?resource_type=${encodeURIComponent(resourceType)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Quota check failed (${res.status})`);
  }

  return res.json();
}

export async function getQuotaStatus(token: string): Promise<QuotaStatusResponse> {
  const res = await fetch(`${API_BASE}/v1/quota/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Quota status failed (${res.status})`);
  }

  return res.json();
}
