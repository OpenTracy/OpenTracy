import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Shield,
  Cpu,
  Gift,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  MessageSquare,
  Database,
  Download,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { VisuallyHidden } from 'radix-ui';
import { useOnboarding } from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({ x: direction > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -48 : 48, opacity: 0 }),
};

const SLIDE_TRANSITION = { type: 'spring' as const, stiffness: 320, damping: 32 };

const DISTILLATION_STEPS = [
  {
    icon: Sparkles,
    step: 1,
    title: 'Generate',
    description: 'A teacher model (GPT-4o) generates high-quality responses to your prompts.',
    iconClass: 'text-foreground',
    bgClass: 'bg-foreground border-foreground',
    iconInnerClass: 'text-background',
    cardClass: 'bg-card border-border',
  },
  {
    icon: Shield,
    step: 2,
    title: 'Curate',
    description: 'AI judges score every response. Only the best examples are kept.',
    iconClass: 'text-foreground',
    bgClass: 'bg-foreground border-foreground',
    iconInnerClass: 'text-background',
    cardClass: 'bg-card border-border',
  },
  {
    icon: Cpu,
    step: 3,
    title: 'Train',
    description: 'A small student model learns from the curated data on our GPUs.',
    iconClass: 'text-foreground',
    bgClass: 'bg-foreground border-foreground',
    iconInnerClass: 'text-background',
    cardClass: 'bg-card border-border',
  },
];

const TUTORIAL_STEPS = [
  {
    icon: KeyRound,
    title: 'Connect an API Key',
    description: 'Add your OpenAI key so models appear in the playground.',
  },
  {
    icon: MessageSquare,
    title: 'Test the Playground',
    description: 'Send a message to GPT-4o and verify the quality baseline.',
  },
  {
    icon: Database,
    title: 'Create Training Data',
    description: 'Describe your use case — AI generates the prompts for you.',
  },
  {
    icon: Cpu,
    title: 'Train Your Model',
    description: 'Launch a free distillation. We train Qwen 2.5 0.5B on our GPUs.',
  },
  {
    icon: Download,
    title: 'Download & Run',
    description: 'Get a GGUF file and run it locally with Ollama.',
  },
];

function Slide1() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Welcome to OpenTracy</h2>
        <p className="text-sm text-muted-foreground">
          Turn any powerful AI into your own tiny, fast, private model — running on your own
          hardware.
        </p>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        OpenTracy uses knowledge distillation to compress the intelligence of large models like GPT-4o
        into small models you can run locally — for pennies per request instead of dollars.
      </p>

      <Card className="border-emerald-200 bg-emerald-50 py-0 shadow-none dark:border-emerald-800 dark:bg-emerald-950/30">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/50">
            <Gift className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              $15 in free credits included
            </p>
            <p className="text-sm text-emerald-700/70 dark:text-emerald-400/70">
              Your first model is completely free.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Slide2() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">How Distillation Works</h2>
        <p className="text-sm text-muted-foreground">
          Three automated stages compress a large model into a small one.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DISTILLATION_STEPS.map((item, idx) => (
          <div
            key={item.step}
            className={cn(
              'relative flex flex-col items-center gap-3 rounded-xl border p-5 text-center',
              item.cardClass
            )}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background border text-xs font-bold tabular-nums shadow-sm">
                {item.step}
              </span>
            </div>

            {idx < DISTILLATION_STEPS.length - 1 && (
              <span className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-muted-foreground/40 sm:block">
                →
              </span>
            )}

            <div
              className={cn(
                'mt-2 flex h-12 w-12 items-center justify-center rounded-xl border',
                item.bgClass
              )}
            >
              <item.icon className={cn('h-5 w-5', item.iconInnerClass)} />
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Result: a model <span className="font-medium text-foreground">10-100x smaller</span> that
        retains <span className="font-medium text-foreground">85-95%</span> of the teacher's
        quality.
      </p>
    </div>
  );
}

function Slide3() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Your First Model in 5 Steps</h2>
        <p className="text-sm text-muted-foreground">
          This guided tutorial takes about 10 minutes to complete.
        </p>
      </div>

      <div className="space-y-2">
        {TUTORIAL_STEPS.map((item, idx) => (
          <Card key={item.title} className="py-0 shadow-none">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-secondary">
                <item.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                Step {idx + 1}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const SLIDES = [Slide1, Slide2, Slide3];
const SLIDE_LABELS = ['Welcome', 'How It Works', 'Tutorial'];

/**
 * WelcomeWizard — shows a multi-slide welcome dialog for new users (step 0).
 * When the user clicks "Get Started", it advances onboarding and navigates
 * to the first real tutorial page (/data-sources).
 */
export function WelcomeWizard() {
  const navigate = useNavigate();
  const { step, isActive, nextStep, skip, loading: userLoading } = useOnboarding();
  const [slideIndex, setSlideIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const isOpen = !userLoading && !dismissed && isActive && step === 0;

  const goTo = (idx: number) => {
    setDirection(idx > slideIndex ? 1 : -1);
    setSlideIndex(idx);
  };

  const goNext = () => {
    if (slideIndex < SLIDES.length - 1) goTo(slideIndex + 1);
  };

  const goBack = () => {
    if (slideIndex > 0) goTo(slideIndex - 1);
  };

  const handleStart = async () => {
    await nextStep();
    navigate('/data-sources?onboarding=1');
  };

  const handleSkip = async () => {
    setDismissed(true);
    try {
      await skip();
    } catch (err) {
      console.error('[WelcomeWizard] Failed to skip onboarding:', err);
    }
  };

  const SlideComponent = SLIDES[slideIndex];
  const progress = ((slideIndex + 1) / SLIDES.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent
        className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Welcome to OpenTracy</DialogTitle>
          <DialogDescription>Onboarding wizard — get started with OpenTracy.</DialogDescription>
        </VisuallyHidden.Root>

        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <nav className="flex items-center gap-1">
            {SLIDE_LABELS.map((label, i) => (
              <button
                key={label}
                onClick={() => goTo(i)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  i === slideIndex
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <Button variant="ghost" size="sm" onClick={handleSkip}>
            <X className="h-4 w-4" />
            Skip tutorial
          </Button>
        </div>

        <Progress value={progress} className="h-px rounded-none" />

        <div className="min-h-80 overflow-hidden px-6 py-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slideIndex}
              custom={direction}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={SLIDE_TRANSITION}
            >
              <SlideComponent />
            </motion.div>
          </AnimatePresence>
        </div>

        <Separator />

        <div className="flex items-center justify-between px-6 py-4">
          <Button variant="outline" size="sm" onClick={goBack} disabled={slideIndex === 0}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === slideIndex ? 'w-4 bg-foreground' : 'w-1.5 bg-border'
                )}
              />
            ))}
          </div>

          {slideIndex < SLIDES.length - 1 ? (
            <Button size="sm" onClick={goNext}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleStart}>
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
