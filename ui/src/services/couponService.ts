import { API_BASE_URL } from '../config/api';

export interface CouponDetails {
  code: string;
  credits: number;
  is_active: boolean;
  max_uses: number;
  current_uses: number;
}

export interface CouponRedeemResponse {
  message: string;
  credits_added: number;
  new_balance: number;
}

/**
 * Get coupon details
 * GET /v1/coupons/{code}
 */
export async function getCouponDetails(
  accessToken: string,
  couponCode: string
): Promise<CouponDetails> {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  if (!couponCode || !couponCode.trim()) {
    throw new Error('Coupon code is required');
  }

  const code = encodeURIComponent(couponCode.trim().toUpperCase());

  const response = await fetch(`${API_BASE_URL}/v1/coupons/${code}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Coupon not found');
  }

  return response.json();
}

/**
 * Redeem a coupon
 * POST /v1/coupons/{code}/redeem
 */
export async function redeemCoupon(
  accessToken: string,
  couponCode: string
): Promise<CouponRedeemResponse> {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  if (!couponCode || !couponCode.trim()) {
    throw new Error('Coupon code is required');
  }

  const code = encodeURIComponent(couponCode.trim().toUpperCase());

  const response = await fetch(`${API_BASE_URL}/v1/coupons/${code}/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to redeem coupon');
  }

  const data = await response.json();

  return {
    message: data.message,
    credits_added: parseFloat(data.credits_added) || 0,
    new_balance: parseFloat(data.new_balance) || 0,
  };
} //
