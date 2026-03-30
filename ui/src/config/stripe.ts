import { loadStripe } from '@stripe/stripe-js';

// Live Stripe publishable key
const STRIPE_PUBLISHABLE_KEY =
  'pk_live_51S88CdHz3vVTIrc1y139Uz6VrK9Mjk5sJ6sg4niPwb4IT0hsrhuTLGGUyYnLkFP45dF7GrTcnePUR5Ad4hATS0PB001eBBQtBF';

// Initialize Stripe
export const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// Stripe configuration
export const stripeConfig = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  currency: 'usd',
  appearance: {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#ededed', // Grayscale theme
      colorBackground: '#ffffff',
      colorText: '#1f2937',
      colorDanger: '#ef4444',
      fontFamily: 'system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '12px',
    },
  },
  loader: 'auto' as const,
};
