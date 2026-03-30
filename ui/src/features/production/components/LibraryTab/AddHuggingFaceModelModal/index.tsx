import { useEffect } from 'react';
import { ArrowRight, CheckCircle, ExternalLink, Sparkles } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Field, FieldContent, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import type { RegisteredModel } from '@/features/production/api/modelRegistryService';
import { useHuggingFaceImport } from '@/features/production/hooks/useHuggingFaceImport';

import { ApiKeyField } from './ApiKeyField';
import { HowItWorks } from './HowItWorks';
import { ModelInfoCard } from './ModelInfoCard';
import { ValidationPanel } from './ValidationPanel';

interface AddHuggingFaceModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModelRegistered: (model: RegisteredModel) => void;
  initialModelId?: string;
}

type WizardState = 'validating' | 'registering' | 'ready' | 'retry' | 'idle';

function resolveWizardState(hf: ReturnType<typeof useHuggingFaceImport>): WizardState {
  if (hf.isValidating) return 'validating';
  if (hf.isRegistering) return 'registering';
  if (hf.allPassed) return 'ready';
  if (hf.hasError) return 'retry';
  return 'idle';
}

const SUBMIT_BUTTON_CONFIG: Record<
  WizardState,
  { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' }
> = {
  validating: { label: 'Validating…', icon: <Spinner />, variant: 'default' },
  registering: { label: 'Registering…', icon: <Spinner />, variant: 'default' },
  ready: { label: 'Add Model', icon: <CheckCircle className="size-4" />, variant: 'default' },
  retry: { label: 'Retry', icon: <ArrowRight className="size-4" />, variant: 'secondary' },
  idle: { label: 'Validate & Add', icon: <Sparkles className="size-4" />, variant: 'default' },
};

export function AddHuggingFaceModelModal({
  isOpen,
  onClose,
  onModelRegistered,
  initialModelId,
}: AddHuggingFaceModelModalProps) {
  const hf = useHuggingFaceImport({ onModelRegistered, onClose });

  useEffect(() => {
    if (isOpen && initialModelId) hf.setHfModelId(initialModelId);
  }, [isOpen, initialModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    hf.resetValidation();
  }, [hf.hfModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const wizardState = resolveWizardState(hf);
  const submitConfig = SUBMIT_BUTTON_CONFIG[wizardState];
  const isBusy = wizardState === 'validating' || wizardState === 'registering';

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && hf.handleClose()}>
      <DialogContent className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Add HuggingFace Model</DialogTitle>
          <DialogDescription>
            Import any open-source text-generation model from HuggingFace Hub.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <form id="hf-import-form" onSubmit={hf.handleSubmit} className="space-y-5 px-6 py-5">
            <Field>
              <FieldContent>
                <Label htmlFor="hf-model-id">
                  Model ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="hf-model-id"
                  value={hf.hfModelId}
                  onChange={(e) => hf.setHfModelId(e.target.value)}
                  placeholder="e.g., meta-llama/Llama-2-7b-hf"
                  disabled={isBusy}
                />
                <FieldDescription className="flex items-center gap-1">
                  <ExternalLink className="size-3 shrink-0" />
                  <a
                    href="https://huggingface.co/models?pipeline_tag=text-generation&sort=trending"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate"
                  >
                    Browse text-generation models
                  </a>
                </FieldDescription>
              </FieldContent>
            </Field>

            <ApiKeyField
              hfApiKey={hf.hfApiKey}
              showApiKey={hf.showApiKey}
              needsApiKey={hf.needsApiKey}
              disabled={isBusy}
              apiKeyInputRef={hf.apiKeyInputRef}
              onApiKeyChange={hf.setHfApiKey}
              onToggle={() => hf.setShowApiKey(!hf.showApiKey)}
              onRetryWithApiKey={hf.handleRetryWithApiKey}
            />

            {hf.showValidation && <ValidationPanel validation={hf.validation} />}

            {hf.modelInfo && hf.allPassed && <ModelInfoCard modelInfo={hf.modelInfo} />}

            {hf.error && (
              <Alert variant="destructive">
                <AlertTitle>Registration Failed</AlertTitle>
                <AlertDescription>{hf.error}</AlertDescription>
              </Alert>
            )}

            {!hf.showValidation && !hf.error && <HowItWorks />}
          </form>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <DialogClose asChild>
            <Button variant="outline" onClick={hf.handleClose} disabled={isBusy}>
              Cancel
            </Button>
          </DialogClose>

          <Button
            type="submit"
            form="hf-import-form"
            disabled={!hf.canSubmit}
            variant={submitConfig.variant}
            className="gap-1.5"
          >
            {submitConfig.icon}
            {submitConfig.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
