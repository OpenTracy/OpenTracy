import { Check } from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface WizardStep {
  id: string;
  title: string;
}

interface WizardBreadcrumbProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (index: number) => void;
}

export function WizardBreadcrumb({ steps, currentStep, onStepClick }: WizardBreadcrumbProps) {
  return (
    <div className="py-3 border-b">
      <div className="px-6">
        <Breadcrumb>
          <BreadcrumbList>
            {steps.map((step, i) => {
              const isCompleted = i < currentStep;
              const isCurrent = i === currentStep;
              const canClick = isCompleted && !!onStepClick;

              return (
                <BreadcrumbItem key={step.id}>
                  {isCompleted && (
                    <BreadcrumbLink
                      onClick={() => canClick && onStepClick(i)}
                      className={`flex items-center gap-1.5 text-primary font-medium ${
                        canClick ? 'cursor-pointer hover:text-primary/80' : 'cursor-default'
                      }`}
                    >
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                      <span className="hidden sm:inline">{step.title}</span>
                    </BreadcrumbLink>
                  )}

                  {isCurrent && (
                    <BreadcrumbPage className="flex items-center gap-1.5 font-semibold text-foreground">
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground text-xs">
                        {i + 1}
                      </span>
                      <span className="hidden sm:inline">{step.title}</span>
                    </BreadcrumbPage>
                  )}

                  {!isCompleted && !isCurrent && (
                    <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-muted text-muted-foreground text-xs border">
                        {i + 1}
                      </span>
                      <span className="hidden sm:inline">{step.title}</span>
                    </span>
                  )}

                  {i < steps.length - 1 && <BreadcrumbSeparator />}
                </BreadcrumbItem>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}
