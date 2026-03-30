import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  // Main content
  title: string;

  // Actions and controls
  action?: React.ReactNode;
  actions?: React.ReactNode[];

  // Meta information
  badge?: { label: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' };

  // Styling
  className?: string;
}

export function PageHeader({ title, action, actions, badge, className }: PageHeaderProps) {
  // Combine action and actions
  const allActions = action ? [action, ...(actions ?? [])] : (actions ?? []);

  return (
    <header className={cn('bg-background border-b border-border sticky top-0 z-10', className)}>
      <div className={cn('flex items-center justify-between px-6 py-4')}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">{title}</h1>
          {badge && (
            <span
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium',
                badge.variant === 'default' && 'bg-primary/10 text-primary',
                badge.variant === 'secondary' && 'bg-secondary/10 text-secondary',
                badge.variant === 'destructive' && 'bg-destructive/10 text-destructive',
                badge.variant === 'outline' && 'border border-border text-foreground-secondary'
              )}
            >
              {badge.label}
            </span>
          )}
        </div>

        {allActions.length > 0 && (
          <div className="flex items-center gap-2">
            {allActions.map((act, idx) => (
              <div key={idx}>{act}</div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
