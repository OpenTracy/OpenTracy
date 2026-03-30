import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Code, FlaskConical, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

import type { AvailableModel, CreateCustomMetricRequest } from '../../types';
import { getModelCategory } from '@/utils/modelUtils';
import {
  SUGGESTED_CRITERIA,
  type CustomMetricType,
  useCreateCustomMetricForm,
} from './useCreateCustomMetricForm';
import { PythonScriptEditor } from './PythonScriptEditor';

interface CreateCustomMetricModalProps {
  open: boolean;
  loading?: boolean;
  availableModels: AvailableModel[];
  onClose: () => void;
  onCreate: (request: CreateCustomMetricRequest) => Promise<void>;
}

function isPureAIModel(model: AvailableModel): boolean {
  const providerLower = model.provider?.toLowerCase() || '';
  return (
    model.type === 'deployment' || providerLower === 'pureai' || providerLower === 'deployment'
  );
}

function getModelDisplayName(model: AvailableModel): string {
  const category = isPureAIModel(model) ? 'PureAI' : getModelCategory(model.id);
  const displayName = isPureAIModel(model) ? `pureai/${model.name}` : model.name;
  return `[${category}] ${displayName}`;
}

export function CreateCustomMetricModal({
  open,
  loading,
  availableModels,
  onClose,
  onCreate,
}: CreateCustomMetricModalProps) {
  const judgeModels = useMemo(
    () => availableModels.filter((model) => model.available),
    [availableModels]
  );
  const [step, setStep] = useState<1 | 2>(1);

  const {
    state,
    setField,
    setType,
    setJudgeModel,
    setError,
    reset,
    addCriteria,
    removeCriteria,
    addRequirement,
    removeRequirement,
    buildPayload,
  } = useCreateCustomMetricForm(judgeModels);

  useEffect(() => {
    if (open) {
      reset();
      setStep(1);
    }
  }, [open, reset]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload = buildPayload();
    if (!payload) return;

    try {
      await onCreate(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create custom metric';
      setError(message);
    }
  };

  const onTypeChange = (value: string) => {
    setType(value as CustomMetricType);
  };

  const canProceedToConfiguration =
    state.name.trim().length > 0 && state.description.trim().length > 0;

  const goToConfiguration = () => {
    setError(null);
    if (!canProceedToConfiguration) {
      setError('Please fill metric name and description before continuing');
      return;
    }
    setStep(2);
  };

  const goBackToBasics = () => {
    setError(null);
    setStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create Custom Metric</DialogTitle>
          <DialogDescription>
            Step {step} of 2 · {step === 1 ? 'Basics & metric style' : 'Metric configuration'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <ScrollArea className="max-h-[80vh]">
            <div className="space-y-5">
              {step === 1 && (
                <>
                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldLabel htmlFor="metric-name">Metric Name</FieldLabel>
                      <Input
                        id="metric-name"
                        placeholder="Code Quality Score"
                        value={state.name}
                        onChange={(event) => setField('name', event.target.value)}
                        autoFocus
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="metric-description">Description</FieldLabel>
                      <Textarea
                        id="metric-description"
                        rows={6}
                        className="min-h-36"
                        placeholder="Describe what this metric should evaluate, scoring intent, edge cases and what good/bad output looks like."
                        value={state.description}
                        onChange={(event) => setField('description', event.target.value)}
                      />
                    </Field>
                  </FieldGroup>

                  <section className="space-y-4 rounded-lg border bg-background p-5">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold">Choose metric style</h3>
                      <p className="text-muted-foreground text-sm">
                        Pick the approach that best matches your evaluation goal.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <RadioGroup
                        value={state.type}
                        onValueChange={onTypeChange}
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        <Label
                          htmlFor="metric-type-llm"
                          className={cn(
                            'flex h-full cursor-pointer flex-col items-start gap-2 rounded-lg border p-4 transition-colors',
                            state.type === 'llm_judge'
                              ? 'border-primary bg-accent'
                              : 'border-border hover:bg-accent'
                          )}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex items-center gap-2 font-medium">
                              <FlaskConical className="size-4" />
                              LLM-as-Judge
                            </div>
                            <RadioGroupItem id="metric-type-llm" value="llm_judge" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Better for subjective quality checks like helpfulness, coherence, tone
                            and style. Fast setup and easy iteration.
                          </p>
                        </Label>

                        <Label
                          htmlFor="metric-type-python"
                          className={cn(
                            'flex h-full cursor-pointer flex-col items-start gap-2 rounded-lg border p-4 transition-colors',
                            state.type === 'python'
                              ? 'border-primary bg-accent'
                              : 'border-border hover:bg-accent'
                          )}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex items-center gap-2 font-medium">
                              <Code className="size-4" />
                              Python Script
                            </div>
                            <RadioGroupItem id="metric-type-python" value="python" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Better for deterministic logic, regex/rule-based checks and custom
                            algorithms with external libraries.
                          </p>
                        </Label>
                      </RadioGroup>
                    </div>
                  </section>
                </>
              )}

              {step === 2 && state.type === 'llm_judge' && (
                <section className="space-y-4 rounded-lg border bg-background p-5">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">Judge Configuration</h3>
                    <p className="text-muted-foreground text-sm">
                      Select a model, define criteria and optionally tune the prompt template.
                    </p>
                  </div>

                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldLabel>Judge Model</FieldLabel>
                      {judgeModels.length === 0 ? (
                        <Alert>
                          <AlertCircle className="size-4" />
                          <AlertTitle>No available models</AlertTitle>
                          <AlertDescription>
                            Configure API keys or deploy a model before creating an LLM metric.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Select value={state.judgeModel} onValueChange={setJudgeModel}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent>
                            {judgeModels.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {getModelDisplayName(model)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </Field>

                    <Field>
                      <FieldLabel>Evaluation Criteria</FieldLabel>

                      {state.criteria.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {state.criteria.map((criterion) => (
                            <Badge
                              key={criterion}
                              variant="secondary"
                              className="gap-1.5 py-1 px-2"
                            >
                              {criterion}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="size-4 hover:bg-transparent"
                                onClick={() => removeCriteria(criterion)}
                              >
                                <X className="size-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Input
                          value={state.customCriteria}
                          placeholder="custom criterion (press Enter to add)"
                          onChange={(event) => setField('customCriteria', event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              addCriteria(state.customCriteria);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => addCriteria(state.customCriteria)}
                          disabled={!state.customCriteria.trim()}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {SUGGESTED_CRITERIA.filter((item) => !state.criteria.includes(item)).map(
                          (criterion) => (
                            <Button
                              key={criterion}
                              type="button"
                              size="xs"
                              variant="secondary"
                              onClick={() => addCriteria(criterion)}
                            >
                              + {criterion}
                            </Button>
                          )
                        )}
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="prompt-template">
                        Custom Prompt Template (optional)
                      </FieldLabel>
                      <Textarea
                        id="prompt-template"
                        rows={7}
                        className="min-h-40 font-mono"
                        value={state.promptTemplate}
                        onChange={(event) => setField('promptTemplate', event.target.value)}
                        placeholder={`You are evaluating a response based on: {criteria}\n\nInput: {input}\nExpected Output: {expected_output}\nActual Output: {output}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Placeholders: {'{input}'}, {'{output}'}, {'{expected_output}'},{' '}
                        {'{criteria}'}
                      </p>
                    </Field>
                  </FieldGroup>
                </section>
              )}

              {step === 2 && state.type === 'python' && (
                <PythonScriptEditor
                  pythonScript={state.pythonScript}
                  requirements={state.requirements}
                  newRequirement={state.newRequirement}
                  onScriptChange={(value) => setField('pythonScript', value || '')}
                  onNewRequirementChange={(value) => setField('newRequirement', value)}
                  onAddRequirement={addRequirement}
                  onRemoveRequirement={removeRequirement}
                />
              )}

              {state.error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Could not create metric</AlertTitle>
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex-row pt-4 items-center justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>
            </DialogClose>

            {step === 1 ? (
              <Button
                type="button"
                onClick={goToConfiguration}
                disabled={!canProceedToConfiguration}
              >
                Next
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={goBackToBasics}>
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <Button type="submit" loading={loading}>
                  {loading ? 'Creating...' : 'Create Metric'}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
