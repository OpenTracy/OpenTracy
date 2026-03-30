import { floatToCents } from '../utils/formatCurrency';
import { API_BASE_URL } from '../config/api';

const API_BASE = `${API_BASE_URL}/v1`;

export interface CreditBalance {
  tenant_id: string;
  balance: number;
}

interface CreditResponse {
  tenant_id: string;
  balance: string;
}

interface AddCreditResponse {
  tenant_id: string;
  new_balance: string;
}

export function creditsService() {
  const fetchCredits = async (token: string): Promise<CreditBalance> => {
    const res = await fetch(`${API_BASE}/credits`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch credits: ${res.status} ${res.statusText}`);
    }

    const data: CreditResponse = await res.json();
    return {
      tenant_id: data.tenant_id,
      balance: floatToCents(data.balance),
    };
  };

  const addCredits = async (token: string, amount: number): Promise<CreditBalance> => {
    const res = await fetch(`${API_BASE}/credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount }),
    });

    if (!res.ok) {
      throw new Error(`Failed to add credits: ${res.status} ${res.statusText}`);
    }

    const data: AddCreditResponse = await res.json();
    return {
      tenant_id: data.tenant_id,
      balance: floatToCents(data.new_balance),
    };
  };

  return {
    fetchCredits,
    addCredits,
  };
}
