import { Badge } from '@/components/ui/badge';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

const STEPS = [
  {
    number: '1',
    title: 'Validate',
    description: 'We check the model for vLLM compatibility and access permissions.',
  },
  {
    number: '2',
    title: 'Download',
    description: 'The model is securely downloaded to your private storage.',
  },
  {
    number: '3',
    title: 'Deploy',
    description: 'Once ready, deploy it to any GPU instance with one click.',
  },
] as const;

export function HowItWorks() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-3">
        How it works
      </p>
      {STEPS.map((step) => (
        <Item key={step.number} variant="muted" size="sm">
          <ItemMedia variant="icon">
            <Badge
              variant="secondary"
              className="size-5 p-0 flex items-center justify-center text-xs rounded-full"
            >
              {step.number}
            </Badge>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{step.title}</ItemTitle>
            <ItemDescription>{step.description}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </div>
  );
}
