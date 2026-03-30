import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Phase {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PhaseProgressProps {
  phases: Phase[];
  currentPhase: string;
  phaseIndex: number;
  isProcessing: boolean;
  isDone: boolean;
}

export function PhaseProgress({
  phases,
  currentPhase,
  phaseIndex,
  isProcessing,
  isDone,
}: PhaseProgressProps) {
  return (
    <div className="flex items-center justify-between">
      {phases.map((step, idx) => {
        const Icon = step.icon;
        const isActive = step.id === currentPhase;
        const isComplete = isDone || phaseIndex > idx;
        const isCurrent = isActive && isProcessing;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  'flex size-8 items-center justify-center rounded-full transition-all duration-300',
                  isComplete && !isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'bg-secondary text-primary ring-2 ring-ring'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {isComplete && !isCurrent ? (
                  <CheckCircle className="size-4" />
                ) : (
                  <Icon className={cn('size-3.5', isCurrent && 'animate-pulse')} />
                )}
              </div>
              <span
                className={cn(
                  'mt-1.5 whitespace-nowrap text-xs',
                  isActive || isComplete ? 'font-medium' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < phases.length - 1 && (
              <div
                className={cn(
                  '-mt-4 mx-1 h-px flex-1 transition-colors duration-500',
                  isDone || phaseIndex > idx ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
