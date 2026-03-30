import { useNavigate } from 'react-router-dom';
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  GraduationCap,
  ChevronRight,
  X,
  PanelRightClose,
  PanelRightOpen,
  HelpCircle,
  Wrench,
  PartyPopper,
  Clock,
  Download,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { TUTORIAL_STEPS, TOTAL_STEPS } from './constants';
import { useTutorialContext } from './TutorialContext';
import { useEffect } from 'react';

export function TutorialPanel() {
  const navigate = useNavigate();
  const { step, isActive, nextStep, goToStep, skip, complete, loading } = useOnboarding();
  const { completed, continueLabel, onContinue } = useTutorialContext();
  const [collapsed, setCollapsed] = useLocalStorage('tutorial-collapsed', false);

  useEffect(() => {
    if (!isActive || loading) {
      document.documentElement.removeAttribute('data-tutorial-panel');
      return;
    }
    document.documentElement.setAttribute(
      'data-tutorial-panel',
      collapsed ? 'collapsed' : 'expanded'
    );
    return () => document.documentElement.removeAttribute('data-tutorial-panel');
  }, [isActive, collapsed, loading]);

  if (loading || !isActive) return null;

  const isCompletionScreen = step > TOTAL_STEPS;
  const currentStep = TUTORIAL_STEPS.find((s) => s.id === step);
  const nextStepDef = TUTORIAL_STEPS.find((s) => s.id === step + 1);
  const prevStepDef = TUTORIAL_STEPS.find((s) => s.id === step - 1);
  const completedCount = isCompletionScreen ? TOTAL_STEPS : Math.max(0, step - 1);
  const progressPercent = isCompletionScreen ? 100 : (completedCount / TOTAL_STEPS) * 100;

  const handleContinue = async () => {
    if (onContinue) {
      onContinue();
      return;
    }
    await nextStep();
    if (nextStepDef) {
      navigate(nextStepDef.route);
    }
  };

  const handleFinish = async () => {
    await complete();
    navigate('/command-center?highlight=tutorial');
  };

  const handleBack = async () => {
    if (prevStepDef) {
      await goToStep(prevStepDef.id);
      navigate(prevStepDef.route);
    }
  };

  const handleSkip = async () => {
    try {
      await skip();
    } finally {
      navigate('/command-center');
    }
  };

  const handleGoToStep = async (targetStep: number) => {
    const target = TUTORIAL_STEPS.find((s) => s.id === targetStep);
    if (!target || targetStep > step) return;
    await goToStep(targetStep);
    navigate(target.route);
  };

  // Collapsed state — show a minimal floating button
  if (collapsed) {
    return (
      <div className="shrink-0 border-l flex flex-col items-center py-4 px-2 gap-3 sticky top-0 h-dvh">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setCollapsed(false)}
            >
              <PanelRightOpen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Expand tutorial</TooltipContent>
        </Tooltip>

        <div className="flex flex-col items-center gap-1.5">
          {TUTORIAL_STEPS.map((s) => {
            const done = step > s.id || isCompletionScreen;
            const current = step === s.id && !isCompletionScreen;
            return (
              <Tooltip key={s.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleGoToStep(s.id)}
                    disabled={step < s.id}
                    className={cn(
                      'size-2.5 rounded-full transition-colors',
                      done && 'bg-foreground',
                      current &&
                        'bg-primary ring-2 ring-primary ring-offset-2 ring-offset-background',
                      !done && !current && 'bg-border'
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="left">
                  {s.label} {done ? '(done)' : current ? '(current)' : ''}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <span className="text-xs text-muted-foreground font-medium tabular-nums">
          {completedCount}/{TOTAL_STEPS}
        </span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-80 shrink-0 border-l bg-card flex flex-col sticky top-0 h-dvh">
        <div className="px-4 pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-foreground">
                <GraduationCap className="size-4 text-background" />
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-none">
                  {isCompletionScreen ? 'Tour Complete!' : 'Guided Tour'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isCompletionScreen
                    ? `All ${TOTAL_STEPS} steps done`
                    : `Step ${step} of ${TOTAL_STEPS}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setCollapsed(true)}
                  >
                    <PanelRightClose className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Collapse panel</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => void handleSkip()}
                  >
                    <X className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Exit tutorial</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="space-y-1.5">
            <Progress value={progressPercent} className="h-1.5" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {completedCount} of {TOTAL_STEPS} completed
              </span>
              <span className="text-xs text-muted-foreground tabular-nums font-medium">
                {Math.round(progressPercent)}%
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {isCompletionScreen ? (
          <>
            <ScrollArea className="flex-1">
              <div className="px-4 py-6 space-y-5">
                <div className="text-center space-y-2">
                  <div className="flex justify-center">
                    <div className="flex size-12 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background">
                      <PartyPopper className="size-6" />
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-foreground">All steps completed!</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You've set up everything you need to distill your first model.
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    What happens next
                  </p>

                  <div className="flex items-start gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                      <Clock className="size-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Training in progress</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        Your distillation job is now running. This may take a few hours depending on
                        your dataset size and model.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                      <Download className="size-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Download when ready</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        Once the training completes, you can download the GGUF model file from the
                        job page and run it locally.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                      <Compass className="size-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Explore the platform</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        While you wait, feel free to explore other features like the playground,
                        analytics, and deployments.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
                  <GraduationCap className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You can restart this tutorial anytime from the Command Center.
                  </p>
                </div>
              </div>
            </ScrollArea>

            <Separator />
            <div className="px-3 py-3">
              <Button size="sm" onClick={handleFinish} className="w-full gap-2 h-9">
                Go to Command Center
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="px-3 py-3 space-y-0.5">
                {TUTORIAL_STEPS.map((s) => {
                  const done = step > s.id;
                  const current = step === s.id;
                  const future = step < s.id;
                  const Icon = s.icon;

                  return (
                    <Tooltip key={s.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleGoToStep(s.id)}
                          disabled={future}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                            current && 'bg-secondary',
                            done && 'hover:bg-secondary cursor-pointer',
                            future && 'cursor-default'
                          )}
                        >
                          <div
                            className={cn(
                              'flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                              done && 'border-foreground bg-foreground text-background',
                              current && 'border-foreground text-foreground',
                              future && 'border-border text-muted-foreground'
                            )}
                          >
                            {done ? (
                              <Check className="size-3.5" strokeWidth={2.5} />
                            ) : (
                              <Icon className="size-3.5" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                'text-sm truncate',
                                done && 'text-muted-foreground font-medium',
                                current && 'text-foreground font-semibold',
                                future && 'text-muted-foreground'
                              )}
                            >
                              {s.label}
                            </p>
                            {current && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {s.title}
                              </p>
                            )}
                          </div>

                          {current && (
                            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                          )}
                          {done && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              Done
                            </Badge>
                          )}
                        </button>
                      </TooltipTrigger>
                      {done && (
                        <TooltipContent side="left">Click to revisit this step</TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>

              {currentStep && (
                <div className="px-3 pb-4">
                  <Separator className="mb-3" />

                  <div className="space-y-2 mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Instructions
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {currentStep.description}
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 mb-3">
                    <Lightbulb className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {currentStep.tip}
                    </p>
                  </div>

                  <Accordion type="multiple" className="border-none">
                    <AccordionItem value="config" className="border-b">
                      <AccordionTrigger className="py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:no-underline">
                        <span className="flex items-center gap-2">
                          <HelpCircle className="size-3.5" />
                          Recommended setup
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3 pt-0">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {currentStep.recommendedConfig}
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="errors" className="border-none">
                      <AccordionTrigger className="py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:no-underline">
                        <span className="flex items-center gap-2">
                          <Wrench className="size-3.5" />
                          Troubleshooting
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3 pt-0">
                        <div className="space-y-2">
                          {currentStep.commonErrors.map((err, i) => (
                            <div key={i} className="space-y-0.5">
                              <p className="text-xs font-medium text-foreground">{err.problem}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {err.fix}
                              </p>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {completed && (
                    <div className="mt-3 rounded-lg border bg-secondary px-3 py-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">Step completed</p>
                      <Button size="sm" onClick={handleContinue} className="w-full gap-2">
                        {continueLabel ??
                          (nextStepDef ? `Continue to ${nextStepDef.label}` : 'Finish Tutorial')}
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <Separator />
            <div className="px-3 py-3 space-y-2">
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBack}
                      disabled={!prevStepDef}
                      className="flex-1 gap-1.5 h-8 text-xs"
                    >
                      <ArrowLeft className="size-3" />
                      Back
                    </Button>
                  </TooltipTrigger>
                  {prevStepDef && <TooltipContent>Go to {prevStepDef.label}</TooltipContent>}
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex-1">
                      <Button
                        size="sm"
                        onClick={completed ? handleContinue : undefined}
                        disabled={!completed}
                        className="w-full gap-1.5 h-8 text-xs"
                      >
                        Next
                        <ArrowRight className="size-3" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {completed
                      ? nextStepDef
                        ? `Go to ${nextStepDef.label}`
                        : 'Finish the tutorial'
                      : 'Complete the current step to continue'}
                  </TooltipContent>
                </Tooltip>
              </div>

              <button
                onClick={() => void handleSkip()}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Skip tutorial
              </button>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
