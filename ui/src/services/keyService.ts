import { API_BASE_URL } from '../config/api';

const API_BASE = `${API_BASE_URL}/v1`;

export interface KeyResponse {
  id: number;
  name: string;
  key?: string; // só retorna na criação (pk_live_xxx...)
  key_prefix?: string;
  created_at: string;
  is_active: boolean;
  message?: string;
}

export const keyService = (accessToken?: string) => {
  const listKeys = async (): Promise<KeyResponse[]> => {
    if (!accessToken) throw new Error('accessToken is required to list keys');

    console.log('[keyService] GET /api-keys');
    const res = await fetch(`${API_BASE}/api-keys`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) throw new Error(`Failed to list keys: ${res.status} ${res.statusText}`);
    return res.json();
  };

  const createKey = async (name: string): Promise<KeyResponse> => {
    if (!accessToken) throw new Error('accessToken is required to create keys');

    console.log('[keyService] POST /api-keys', { name });
    const res = await fetch(`${API_BASE}/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[keyService] POST /api-keys failed:', res.status, res.statusText, text);
      throw new Error(`Failed to create key: ${res.status} ${res.statusText}`);
    }

    const data: KeyResponse = await res.json();
    console.log('[keyService] POST /api-keys -> OK', { id: data.id, name: data.name });
    return data;
  };

  const deleteKey = async (keyId: string | number): Promise<void> => {
    if (!accessToken) {
      throw new Error('Access token não disponível. Faça login novamente para excluir API keys.');
    }

    console.log('[keyService] DELETE /api-keys/', keyId);

    const res = await fetch(`${API_BASE}/api-keys/${keyId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error('[keyService] DELETE failed:', res.status, res.statusText, errorText);
      throw new Error(
        `Falha ao excluir API key: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`
      );
    }
  };

  return { listKeys, createKey, deleteKey };
};
