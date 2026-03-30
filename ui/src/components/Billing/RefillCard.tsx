import { Settings2 } from 'lucide-react';
import { centsToCurrency } from '../../utils/formatCurrency';

export function RefillCard({
  refillAmount,
  refillTrigger,
  onEdit,
}: {
  refillAmount: number;
  refillTrigger: number;
  onEdit: () => void;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-accent/10 rounded-lg">
            <Settings2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Refill Settings</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="text-xs text-foreground-muted">
                <span className="text-foreground-muted">Amount:</span>{' '}
                <span className="text-foreground-secondary font-medium">
                  {centsToCurrency(refillAmount)}
                </span>
              </div>
              <div className="text-xs text-foreground-muted">
                <span className="text-foreground-muted">Trigger:</span>{' '}
                <span className="text-foreground-secondary font-medium">
                  {centsToCurrency(refillTrigger)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="text-sm text-accent hover:text-accent-hover font-medium transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
