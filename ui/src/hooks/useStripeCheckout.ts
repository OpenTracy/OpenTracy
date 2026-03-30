import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { createCheckoutSession } from '../services/stripeCheckoutService';
import { useUser } from '../contexts/UserContext';

const stripePromise = loadStripe(
  'pk_live_51S88CdHz3vVTIrc1y139Uz6VrK9Mjk5sJ6sg4niPwb4IT0hsrhuTLGGUyYnLkFP45dF7GrTcnePUR5Ad4hATS0PB001eBBQtBF'
);

const USD_TO_BRL_RATE = 5.2;

export function useStripeCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const { accessToken } = useUser();

  const detectUserLocation = (): { isBrazil: boolean; currency: string } => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const locale = navigator.language || 'en-US';

    const isBrazil =
      timezone.includes('America/Sao_Paulo') ||
      timezone.includes('America/Recife') ||
      timezone.includes('America/Manaus') ||
      locale.startsWith('pt-BR');

    return {
      isBrazil,
      currency: isBrazil ? 'brl' : 'usd',
    };
  };

  const redirectToCheckout = useCallback(
    async (amountCents: number) => {
      try {
        setIsLoading(true);

        const stripe = await stripePromise;
        if (!stripe) throw new Error('Stripe failed to load');

        if (!accessToken) throw new Error('access token not set');

        const { isBrazil, currency } = detectUserLocation();
        const credits = Math.round(amountCents / 100);

        const finalAmount = isBrazil ? Math.round(amountCents * USD_TO_BRL_RATE) : amountCents;

        const sessionUrl = await createCheckoutSession({
          amount: finalAmount,
          currency,
          credits,
          successUrl: `${window.location.origin}/billing?success=true&credits=${credits}`,
          cancelUrl: `${window.location.origin}/billing?canceled=true`,
          locale: isBrazil ? 'pt-BR' : 'auto',
          token: accessToken,
        });

        window.location.href = sessionUrl;
      } catch (err) {
        console.error('Error redirecting to checkout:', err);
        alert('Failed to start checkout: ' + (err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken]
  );

  return {
    redirectToCheckout,
    isLoading,
  };
}
