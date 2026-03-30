import { API_BASE_URL } from '../config/api';

export interface CheckoutParams {
  amount: number;
  currency: string;
  credits: number;
  successUrl: string;
  cancelUrl: string;
  token: string;
  locale?: string;
}

export async function createCheckoutSession(params: CheckoutParams): Promise<string> {
  const { amount, currency, credits, successUrl, cancelUrl, locale, token } = params;

  try {
    const res = await fetch(`${API_BASE_URL}/v1/checkout/create-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount, currency, credits, successUrl, cancelUrl, locale }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Failed to create checkout session: ${errBody}`);
    }

    const data = await res.json();
    if (!data.url) throw new Error('Checkout session URL not returned');

    return data.url;
  } catch (err: any) {
    console.error('Stripe Checkout Service error:', err);
    throw err;
  }
}
