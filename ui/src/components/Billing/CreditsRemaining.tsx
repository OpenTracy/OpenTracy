import { useState, useEffect } from 'react';
import { Wallet, Plus } from 'lucide-react';
import { useStripeCheckout } from '../../hooks/useStripeCheckout';
import { useUser } from '../../contexts/UserContext';
import { useProfileService } from '../../services/profileService';
import { AddCreditsModal } from './AddCreditsModal';
import { Button } from '@/components/ui/button';

interface CreditsRemainingProps {
  credits?: number;
}

export function CreditsRemaining({ credits: propCredits }: CreditsRemainingProps) {
  const { redirectToCheckout, isLoading: checkoutLoading } = useStripeCheckout();
  const { accessToken } = useUser();
  const { fetchProfile } = useProfileService();
  const [showModal, setShowModal] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;

    const loadBalance = async () => {
      try {
        const profile = await fetchProfile(accessToken);
        setBalance(profile.credits_balance);
      } catch (err) {
        console.error('Failed to fetch credits balance:', err);
        setBalance(null);
      } finally {
        setLoading(false);
      }
    };

    loadBalance();
  }, [accessToken, fetchProfile]);

  const formatBalance = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handleBuyCredits = () => {
    setShowModal(true);
  };

  const handleConfirmAmount = (amount: number) => {
    setShowModal(false);
    redirectToCheckout(amount);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const displayBalance = balance ?? (propCredits ? propCredits / 100 : null);

  return (
    <>
      <section className="bg-surface border border-border rounded-lg overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-accent-hover" />
        <div className="p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-accent/10 rounded-lg">
                <Wallet className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground-muted">Available Credits</p>
                {loading ? (
                  <div className="h-9 w-32 bg-background-secondary rounded-lg animate-pulse mt-1" />
                ) : (
                  <p className="text-3xl font-semibold text-foreground tracking-tight">
                    {displayBalance !== null ? formatBalance(displayBalance) : '--'}
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={handleBuyCredits}
              disabled={checkoutLoading}
              loading={checkoutLoading}
              variant="default"
              className="px-5 py-2.5 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Credits
            </Button>
          </div>
        </div>
        <div className="px-8 py-4 bg-background-secondary border-t border-border">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent rounded-full" />
            <span className="text-xs text-foreground-muted">
              Charged per hour of active deployment
            </span>
          </div>
        </div>
      </section>

      <AddCreditsModal
        show={showModal}
        onClose={handleCloseModal}
        onConfirm={handleConfirmAmount}
        isLoading={checkoutLoading}
      />
    </>
  );
}
