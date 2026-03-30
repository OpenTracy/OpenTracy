import { useState } from 'react';
import { Ticket, CheckCircle2 } from 'lucide-react';
import { redeemCoupon } from '../../services/couponService';
import { useUser } from '../../contexts/UserContext';
import { Button } from '@/components/ui/button';

interface CouponCardProps {
  onSuccess: (creditsAdded: number, newBalance: number) => void;
  onError: (message: string) => void;
}

export function CouponCard({ onSuccess, onError }: CouponCardProps) {
  const [couponCode, setCouponCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [redeemed, setRedeemed] = useState<{ credits: number } | null>(null);
  const { accessToken } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!couponCode.trim()) {
      onError('Please enter a coupon code');
      return;
    }

    if (!accessToken) {
      onError('Authentication required');
      return;
    }

    setIsLoading(true);
    setRedeemed(null);

    try {
      const result = await redeemCoupon(accessToken, couponCode);
      setCouponCode('');
      setRedeemed({ credits: result.credits_added });
      onSuccess(result.credits_added, result.new_balance);

      // Clear success state after 5 seconds
      setTimeout(() => setRedeemed(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to redeem coupon';
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setCouponCode(value);
    if (redeemed) setRedeemed(null);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Ticket className="w-4 h-4 text-foreground-muted" />
            </div>
            <input
              id="coupon-code"
              type="text"
              value={couponCode}
              onChange={handleInputChange}
              placeholder="Enter coupon code"
              className="w-full pl-11 pr-4 py-3 border border-border rounded-lg bg-surface text-foreground hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent transition-all font-mono tracking-wide placeholder:text-foreground-muted placeholder:font-sans placeholder:tracking-normal"
              disabled={isLoading}
              maxLength={20}
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || !couponCode.trim()}
            loading={isLoading}
            variant="default"
            className="px-6 whitespace-nowrap"
          >
            {isLoading ? <span className="hidden sm:inline">Applying...</span> : 'Apply'}
          </Button>
        </div>
      </form>

      {redeemed && (
        <div className="flex items-center gap-2 text-sm text-success animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>+${redeemed.credits.toFixed(2)} credits added to your account</span>
        </div>
      )}
    </div>
  );
}
