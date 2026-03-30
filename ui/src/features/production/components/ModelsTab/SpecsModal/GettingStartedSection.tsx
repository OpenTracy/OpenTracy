import { Code2, Key, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

import type { SectionProps } from '@/features/production/types/specsModal.types';

interface GettingStartedStep {
  icon: LucideIcon;
  title: string;
  description: (apiModelId: string) => React.ReactNode;
}

const STEPS: GettingStartedStep[] = [
  {
    icon: Key,
    title: 'Get your API key',
    description: () => 'Go to Access Keys in the sidebar to create or copy your key.',
  },
  {
    icon: Code2,
    title: 'Use the lunar/ prefix',
    description: (apiModelId) => (
      <>
        Reference your model as <span className="font-mono text-xs">{`lunar/${apiModelId}`}</span>{' '}
        in every request.
      </>
    ),
  },
  {
    icon: Zap,
    title: 'Explore the docs',
    description: () => 'Learn about streaming, batching, and all supported parameters.',
  },
];

export function GettingStartedSection({ apiModelId }: SectionProps) {
  return (
    <FieldSet>
      <FieldLegend>Getting started</FieldLegend>
      <div className="flex flex-col gap-3">
        {STEPS.map(({ icon: Icon, title, description }) => (
          <Item key={title} variant="muted" size="sm">
            <ItemMedia variant="icon">
              <Icon aria-hidden="true" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{title}</ItemTitle>
              <ItemDescription>{description(apiModelId)}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </div>
    </FieldSet>
  );
}
