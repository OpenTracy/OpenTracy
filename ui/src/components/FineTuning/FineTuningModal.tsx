import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { FineTuningJob } from '../../types/fineTuningTypes';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { ModelSelectionStep } from './steps/ModelSelectionStep';
import { ConfigurationStep } from './steps/ConfigurationStep';
import { ReviewStep } from './steps/ReviewStep';
import { Button } from '@/components/ui/button';

interface FineTuningModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (jobData: Partial<FineTuningJob>) => Promise<void>;
  isLoading?: boolean;
}

const STEPS = [
  { id: 'basic', title: 'Basic Info', component: BasicInfoStep },
  { id: 'model', title: 'Base Model', component: ModelSelectionStep },
  { id: 'config', title: 'Configuration', component: ConfigurationStep },
  { id: 'review', title: 'Review', component: ReviewStep },
] as const;

export const FineTuningModal = ({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}: FineTuningModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [jobData, setJobData] = useState<Partial<FineTuningJob>>({
    trainingConfig: {
      learningRate: 0.0002,
      numEpochs: 1,
      perDeviceTrainBatchSize: 2,
      gradientAccumulationSteps: 4,
      warmupSteps: 5,
      maxGradNorm: 0.3,
      weightDecay: 0.01,
      optimizer: 'adamw_8bit' as const,
      lrSchedulerType: 'linear' as const,
      maxSeqLength: 2048,
      seed: 3407,
      loggingSteps: 1,
      fp16: false,
      bf16: true,
      packing: false,
      useGradientCheckpointing: true,
    },
  });

  const handleUpdate = (updates: Partial<FineTuningJob>) => {
    setJobData((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    await onSubmit(jobData);
    handleClose();
  };

  const handleClose = () => {
    setCurrentStep(0);
    setJobData({
      trainingConfig: {
        learningRate: 0.0002,
        numEpochs: 1,
        perDeviceTrainBatchSize: 2,
        gradientAccumulationSteps: 4,
        warmupSteps: 5,
        maxGradNorm: 0.3,
        weightDecay: 0.01,
        optimizer: 'adamw_8bit' as const,
        lrSchedulerType: 'linear' as const,
        maxSeqLength: 2048,
        seed: 3407,
        loggingSteps: 1,
        fp16: false,
        bf16: true,
        packing: false,
        useGradientCheckpointing: true,
      },
    });
    onClose();
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return !!jobData.name && !!jobData.dataset;
      case 1: // Model Selection
        return !!jobData.baseModel;
      case 2: // Configuration
        return !!jobData.trainingConfig;
      case 3: // Review
        return true;
      default:
        return false;
    }
  };

  const CurrentStepComponent = STEPS[currentStep].component;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className={cn('p-0', 'max-w-md')} showCloseButton={false}>
        <div className="w-full max-w-3xl bg-surface rounded-lg shadow-sm max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Create Fine-Tuning Job</h2>
              <p className="text-sm text-foreground-muted mt-1">
                Step {currentStep + 1} of {STEPS.length}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
              disabled={isLoading}
            >
              <X className="w-5 h-5 text-foreground-muted" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                        index <= currentStep
                          ? 'bg-accent text-white'
                          : 'bg-background-secondary text-foreground-muted'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium ${
                        index <= currentStep ? 'text-accent' : 'text-foreground-muted'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 mb-6 transition-colors ${
                        index < currentStep ? 'bg-accent' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <CurrentStepComponent jobData={jobData} onUpdate={handleUpdate} />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-background-secondary">
            <button
              onClick={handleBack}
              disabled={currentStep === 0 || isLoading}
              className="px-4 py-2 text-sm font-medium text-foreground-secondary hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              <Button onClick={handleClose} disabled={isLoading} variant="outline">
                Cancel
              </Button>

              {currentStep < STEPS.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={!isStepValid() || isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!isStepValid() || isLoading}
                  loading={isLoading}
                  variant="default"
                >
                  {isLoading ? 'Launching...' : 'Launch Fine-Tuning'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
