import { KeyRound, MessageSquare, Database, Cpu, type LucideIcon } from 'lucide-react';

export interface TutorialStep {
  id: number;
  key: string;
  label: string;
  route: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tip: string;
  /** Recommended configuration hints for this step */
  recommendedConfig: string;
  /** Common errors users might encounter and how to fix them */
  commonErrors: { problem: string; fix: string }[];
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    key: 'api-key',
    label: 'API Key',
    route: '/data-sources',
    icon: KeyRound,
    title: 'Connect a Teacher Model',
    description:
      'Add an API key for a provider like OpenAI or Anthropic. This teacher model will generate the training data for your smaller student model.',
    tip: 'Click on any provider card to add your API key. OpenAI is a great starting point.',
    recommendedConfig:
      'We recommend starting with OpenAI (GPT-4o) or Anthropic (Claude) — they produce the highest quality training data for distillation.',
    commonErrors: [
      {
        problem: 'Invalid API key',
        fix: 'Double-check your key for extra spaces. Make sure it starts with "sk-" for OpenAI.',
      },
      {
        problem: 'Insufficient quota',
        fix: 'Verify your provider account has billing enabled and available credits.',
      },
    ],
  },
  {
    id: 2,
    key: 'playground',
    label: 'Playground',
    route: '/compare',
    icon: MessageSquare,
    title: 'Test the Playground',
    description:
      'Send a message to verify your API connection is working. The playground lets you test models side-by-side.',
    tip: 'Select a model, type a message, and press Enter to see it respond.',
    recommendedConfig:
      'Try a simple prompt like "Explain distillation in AI" to validate your connection is working.',
    commonErrors: [
      {
        problem: 'No models appearing',
        fix: 'Go back to Step 1 and make sure your API key was saved successfully.',
      },
      {
        problem: 'Model returns an error',
        fix: 'Check if your API key has access to the selected model. Some models require specific plan tiers.',
      },
    ],
  },
  {
    id: 3,
    key: 'dataset',
    label: 'Dataset',
    route: '/distill-datasets',
    icon: Database,
    title: 'Create Training Data',
    description:
      'Describe what your model should be good at — the AI will generate training examples automatically.',
    tip: 'Click "Create Dataset" and use the "Generate from topic" option for the fastest setup.',
    recommendedConfig:
      'Start with 50-100 samples for a quick test. Use a specific topic (e.g. "Python debugging") rather than broad topics for better results.',
    commonErrors: [
      {
        problem: 'Generation takes too long',
        fix: 'Start with fewer samples (50). Larger datasets can be created after your first successful run.',
      },
      {
        problem: 'Low quality samples',
        fix: 'Use a more specific topic description. "Customer support for a SaaS billing tool" works better than just "customer support".',
      },
    ],
  },
  {
    id: 4,
    key: 'train',
    label: 'Train',
    route: '/distill-new',
    icon: Cpu,
    title: 'Launch Distillation',
    description:
      'Configure your distillation: pick a teacher, a student model, and your dataset. Then launch the training pipeline. After starting, you can monitor progress and download the model from the job page.',
    tip: 'The default settings are a great starting point. Just select your dataset and hit "Start Distillation". Training may take hours — you\'ll be able to track it on the job page.',
    recommendedConfig:
      'Use GPT-4o as teacher + Llama 3.2 1B as student for the fastest and most cost-effective first run. Keep default training parameters.',
    commonErrors: [
      {
        problem: 'No datasets listed',
        fix: 'Go back to Step 3 and create a dataset first. It needs to finish generating before it appears here.',
      },
      {
        problem: 'Insufficient credits',
        fix: 'Check your credit balance in the sidebar. New accounts receive $15 in free credits.',
      },
    ],
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;
