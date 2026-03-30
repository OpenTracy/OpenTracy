import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';

interface StripeCheckoutProps {
  amountCents: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export function StripeCheckout({
  amountCents,
  onSuccess,
  onError,
  disabled = false,
}: StripeCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      onError('Stripe not loaded correctly');
      return;
    }

    setIsLoading(true);

    try {
      // Confirm payment using Stripe Elements
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/checkout',
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        // Handle additional authentication if needed
        onError('Payment requires additional authentication');
      }
    } catch (_err) {
      onError('Unexpected error during payment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-6 border border-border rounded-lg bg-background-secondary">
        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
            fields: {
              billingDetails: {
                address: {
                  country: 'never',
                  postalCode: 'never',
                },
              },
            },
          }}
        />
      </div>

      <Button
        type="submit"
        disabled={!stripe || !elements || isLoading || disabled}
        loading={isLoading}
        variant="default"
        className="w-full py-4"
      >
        {isLoading ? 'Processing Payment...' : `Pay $${(amountCents / 100).toFixed(2)}`}
      </Button>

      <div className="text-center text-sm text-foreground-muted">
        <p>Your payment is secured by Stripe</p>
      </div>
    </form>
  );
}
