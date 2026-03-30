import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WizardBreadcrumb } from '@/components/shared/WizardBreadcrumb';

import type {
  CreateEvaluationRequest,
  EvaluationMetric,
  Dataset,
  AvailableModel,
  EvalPrefillConfig,
} from '../../types';

import { useRunEvaluationWizard } from '../../hooks/useRunEvaluationWizard';
import { StepContent } from './steps/StepContent';

const STEPS = [
  { id: 'general', title: 'General' },
  { id: 'models', title: 'Models' },
  { id: 'metrics', title: 'Metrics' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const STEP_DESCRIPTIONS: Record<StepId, string> = {
  general: 'Name this evaluation and choose a dataset',
  models: 'Select the models to evaluate',
  metrics: 'Choose scoring metrics',
};

interface RunEvaluationModalProps {
  isOpen: boolean;
  datasets: Dataset[];
  availableModels: AvailableModel[];
  metrics: { builtin: EvaluationMetric[]; custom: EvaluationMetric[] };
  prefill?: EvalPrefillConfig | null;
  loading?: boolean;
  onClose: () => void;
  onCreate: (request: CreateEvaluationRequest) => Promise<void>;
}

export function RunEvaluationModal({
  isOpen,
  datasets,
  availableModels,
  metrics,
  prefill,
  loading,
  onClose,
  onCreate,
}: RunEvaluationModalProps) {
  const allMetrics = [...metrics.builtin, ...metrics.custom];

  const wizard = useRunEvaluationWizard({
    datasets,
    availableModels,
    allMetrics,
    prefill,
    isOpen,
  });

  const currentStepId = STEPS[wizard.currentStep].id as StepId;

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const handleCreate = async () => {
    await onCreate(wizard.buildPayload());
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-row items-start justify-between gap-4 space-y-0">
          <div className="flex-1">
            <DialogTitle>Run Evaluation</DialogTitle>
            <DialogDescription className="mt-1">
              {STEP_DESCRIPTIONS[currentStepId]}
            </DialogDescription>
          </div>
          <DialogClose className="mt-0.5" />
        </DialogHeader>

        <WizardBreadcrumb
          steps={[...STEPS]}
          currentStep={wizard.currentStep}
          onStepClick={(i) => wizard.goToStep(i)}
        />

        <ScrollArea className="min-h-64 max-h-[50vh]">
          <div className="px-8 pt-4 pb-6">
            <StepContent
              stepId={currentStepId}
              formData={wizard.formData}
              datasets={datasets}
              models={wizard.models}
              metrics={metrics}
              onFormChange={wizard.updateFormData}
            />
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t flex-row items-center justify-between gap-3 sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={wizard.handlePrevious}
              disabled={wizard.currentStep === 0}
            >
              Previous
            </Button>
            <Button
              disabled={!wizard.canProceed || loading}
              onClick={wizard.isLastStep ? handleCreate : wizard.handleNext}
            >
              {wizard.isLastStep ? (loading ? 'Starting…' : 'Run Evaluation') : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
