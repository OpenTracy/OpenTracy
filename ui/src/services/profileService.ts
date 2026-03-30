import { useState, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config/api';

interface Tenant {
  id: string;
  name: string;
  created_at?: string;
}

export interface Profile {
  user_id: string;
  sub?: string; // mantido para compatibilidade
  email: string;
  name?: string;
  tenant_id: string;
  tenant_name: string;
  tenant?: Tenant; // mantido para compatibilidade
  credits_balance: number;
  plan_type: 'free' | 'pro' | 'enterprise';
  is_active: boolean;
  is_new_user: boolean;
  onboarding_step: number;
}

const API_BASE = API_BASE_URL;

export function useProfileService() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async (idToken: string): Promise<Profile> => {
    if (!idToken) throw new Error('Missing idToken');

    inflight.current?.abort();
    const ac = new AbortController();
    inflight.current = ac;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/v1/profile`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
        signal: ac.signal,
      });

      console.log('[ProfileService] Response:', res.status);

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`GET /v1/profile ${res.status}${txt ? `: ${txt}` : ''}`);
      }

      const rawData = await res.json();
      console.log('[ProfileService] Raw data:', rawData);

      // Unwrap profile object if API returns { profile: {...} }
      const profileData = rawData.profile || rawData;

      // Extrair tenant_id de múltiplos formatos possíveis
      const extractedTenantId =
        profileData.tenant_id ||
        profileData.tenantId ||
        profileData.tenant?.id ||
        profileData.tenant?.tenant_id ||
        null;

      const extractedTenantName =
        profileData.tenant_name ||
        profileData.tenantName ||
        profileData.tenant?.name ||
        profileData.tenant?.tenant_name ||
        profileData.name ||
        '';

      console.log('[ProfileService] Extracted tenant_id:', extractedTenantId);

      if (!extractedTenantId) {
        console.error('[ProfileService] Tenant ID not found in response:', rawData);
      }

      // Normalizar resposta para manter compatibilidade com código existente
      const data: Profile = {
        user_id: profileData.user_id || profileData.sub || profileData.userId || '',
        sub: profileData.user_id || profileData.sub || profileData.userId,
        email: profileData.email || '',
        name: profileData.name,
        tenant_id: extractedTenantId,
        tenant_name: extractedTenantName,
        // Criar objeto tenant para compatibilidade com código existente que usa profile.tenant.id
        tenant: {
          id: extractedTenantId,
          name: extractedTenantName,
        },
        credits_balance: profileData.credits_balance ?? 0,
        plan_type: profileData.plan_type || 'free',
        is_active: profileData.is_active ?? true,
        is_new_user: profileData.is_new_user ?? false,
        onboarding_step: profileData.onboarding_step ?? 0,
      };

      setProfile(data);
      return data;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      setError(err?.message || 'Unknown error');
      throw err;
    } finally {
      if (inflight.current === ac) inflight.current = null;
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(
    async (
      idToken: string,
      updates: { onboarding_step?: number; is_new_user?: boolean }
    ): Promise<void> => {
      const res = await fetch(`${API_BASE}/v1/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`PATCH /v1/profile ${res.status}${txt ? `: ${txt}` : ''}`);
      }

      // Optimistically update local state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...(updates.onboarding_step !== undefined && {
                onboarding_step: updates.onboarding_step,
              }),
              ...(updates.is_new_user !== undefined && { is_new_user: updates.is_new_user }),
            }
          : prev
      );
    },
    []
  );

  const reset = useCallback(() => {
    inflight.current?.abort();
    inflight.current = null;
    setProfile(null);
    setError(null);
    setLoading(false);
  }, []);

  return { profile, loading, error, fetchProfile, updateProfile, reset };
}
