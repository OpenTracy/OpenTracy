import { DollarSign, Gift, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CostBadgeProps {
  amount: number;
  label?: string;
  className?: string;
  variant?: 'default' | 'sandbox' | 'sufficient' | 'insufficient';
  balance?: number;
  onAddCredits?: () => void;
}

export function CostBadge({
  amount,
  label,
  className,
  variant = 'default',
  balance,
  onAddCredits,
}: CostBadgeProps) {
  if (variant === 'sandbox') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-sm',
          className
        )}
      >
        <Gift className="w-3.5 h-3.5 text-emerald-500" />
        <span className="font-medium text-emerald-600 dark:text-emerald-400">Free</span>
        <span className="text-emerald-600/70 dark:text-emerald-400/70">
          your first model is on us
        </span>
      </div>
    );
  }

  if (variant === 'insufficient') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-sm',
          className
        )}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        <span className="font-medium text-red-600 dark:text-red-400">
          ${amount.toFixed(2)} credits needed
        </span>
        {balance !== undefined && (
          <span className="text-red-600/70 dark:text-red-400/70">
            Balance: ${balance.toFixed(2)}
          </span>
        )}
        {onAddCredits && (
          <button
            type="button"
            onClick={onAddCredits}
            className="ml-1 font-medium text-red-600 dark:text-red-400 underline underline-offset-2 hover:text-red-700 dark:hover:text-red-300"
          >
            Add Credits
          </button>
        )}
      </div>
    );
  }

  if (variant === 'sufficient') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-sm',
          className
        )}
      >
        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          ${amount.toFixed(2)}
        </span>
        {label && <span className="text-emerald-600/70 dark:text-emerald-400/70">{label}</span>}
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border text-sm',
        className
      )}
    >
      <DollarSign className="w-3.5 h-3.5 text-foreground-muted" />
      <span className="font-medium text-foreground">${amount.toFixed(2)}</span>
      {label && <span className="text-foreground-muted">{label}</span>}
    </div>
  );
}
