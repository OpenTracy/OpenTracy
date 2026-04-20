import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { centsToCurrency } from '../../utils/formatCurrency';
import { Button } from '@/components/ui/button';

interface AddCreditsModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  isLoading?: boolean;
}

const PRESET_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export function AddCreditsModal({
  show,
  onClose,
  onConfirm,
  isLoading = false,
}: AddCreditsModalProps) {
  const [selectedAmount, setSelectedAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const amount = useCustom ? Math.round(parseFloat(customAmount) * 100) : selectedAmount;

    if (amount && amount >= 100) {
      setError(null);
      onConfirm(amount);
    } else {
      setError('Minimum amount is $1.00');
    }
  };

  const handleCustomAmountChange = (value: string) => {
    const cleanValue = value.replace(/[^0-9.]/g, '');

    const parts = cleanValue.split('.');
    const formattedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleanValue;

    setCustomAmount(formattedValue);
    setError(null);
  };

  const finalAmount = useCustom
    ? Math.round(parseFloat(customAmount || '0') * 100)
    : selectedAmount;

  const isValidAmount = finalAmount >= 100;

  return (
    <Dialog open={show} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Credits</DialogTitle>
          <DialogDescription>
            Add credits to your account to continue using OpenTracy services
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <h4 className="block text-sm font-medium text-foreground mb-3">Quick Select</h4>
            <div className="grid grid-cols-2 gap-3">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setSelectedAmount(amount);
                    setUseCustom(false);
                    setError(null);
                  }}
                  disabled={isLoading}
                  className={`p-3 rounded-lg border text-base font-medium transition-all ${
                    !useCustom && selectedAmount === amount
                      ? 'border-accent bg-accent/5 text-accent ring-2 ring-accent'
                      : 'border-border hover:border-border-hover text-foreground-secondary hover:bg-accent/5'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {centsToCurrency(amount)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-foreground">
                Custom Amount (USD)
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustom}
                  onChange={(e) => {
                    setUseCustom(e.target.checked);
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="rounded border-border text-accent focus:ring-accent transition"
                />
                <span className="ml-2 text-sm text-foreground-secondary">Use custom</span>
              </label>
            </div>

            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-base">
                $
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={useCustom ? customAmount : centsToCurrency(selectedAmount).replace('$', '')}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                onFocus={() => setUseCustom(true)}
                placeholder="5.00"
                disabled={isLoading}
                className={`w-full pl-8 pr-4 py-2 border rounded-lg text-foreground text-base bg-background focus-visible:outline-none focus-visible:ring-2 transition ${
                  useCustom
                    ? error
                      ? 'border-destructive focus-visible:ring-destructive'
                      : 'border-input focus-visible:ring-ring hover:border-accent'
                    : 'border-input bg-muted cursor-not-allowed'
                } disabled:opacity-50`}
              />
            </div>
          </div>

          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Minimum: $5.00</p>
          )}

          {/* Total Preview */}
          <div className="bg-muted rounded-lg p-4 border border-border">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-foreground">Total Amount:</span>
              <span className="text-xl font-semibold text-foreground">
                {centsToCurrency(finalAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-muted-foreground">Credits to add:</span>
              <span className="text-sm text-foreground">{centsToCurrency(finalAmount)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button onClick={onClose} disabled={isLoading} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValidAmount || isLoading}
            loading={isLoading}
            className="flex-1"
          >
            Continue to Checkout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
