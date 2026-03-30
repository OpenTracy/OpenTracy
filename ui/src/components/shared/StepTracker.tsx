import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepTrackerStep {
  id: string;
  label: string;
}

interface StepTrackerProps {
  steps: StepTrackerStep[];
  currentStepId: string;
  progress?: number;
  className?: string;
}

export function StepTracker({ steps, currentStepId, progress = 0, className }: StepTrackerProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIndex || currentStepId === 'completed';
        const isCurrent = idx === currentIndex;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className="w-full h-2 rounded-full overflow-hidden bg-muted">
                {isCompleted ? (
                  <div className="h-full w-full bg-foreground rounded-full" />
                ) : isCurrent ? (
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                {isCompleted && <CheckCircle className="size-3 text-foreground shrink-0" />}
                <span
                  className={cn(
                    'text-xs truncate',
                    isCompleted
                      ? 'text-foreground font-medium'
                      : isCurrent
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
