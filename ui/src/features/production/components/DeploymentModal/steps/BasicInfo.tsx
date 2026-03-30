import { Rocket, Zap, Shield, type LucideIcon } from 'lucide-react';

import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

const ICON_MAP: Record<string, LucideIcon> = { Rocket, Zap, Shield };

const BENEFITS: { icon: string; title: string; description: string }[] = [
  {
    icon: 'Rocket',
    title: 'Fast Deployment',
    description: 'Your model will be ready in minutes with optimized infrastructure.',
  },
  {
    icon: 'Zap',
    title: 'Auto-Scaling',
    description: 'Automatically scales based on demand to optimize costs and performance.',
  },
  {
    icon: 'Shield',
    title: 'Secure',
    description: 'Enterprise-grade security with encrypted connections and access controls.',
  },
];

interface BasicInfoProps {
  selectedModelName?: string;
}

export function BasicInfo({ selectedModelName }: BasicInfoProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Deployment Overview</h3>
        <p className="text-sm text-muted-foreground">
          Your deployment will be automatically named based on the selected model.
        </p>
      </div>

      {/* Benefits — grid wrapper outside ItemGroup to avoid layout conflict */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BENEFITS.map(({ icon, title, description }) => {
          const Icon = ICON_MAP[icon];
          return (
            <Item key={title} variant="outline" className="h-full items-start">
              <ItemMedia variant="icon">
                <Icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{title}</ItemTitle>
                <ItemDescription className="whitespace-normal line-clamp-none">
                  {description}
                </ItemDescription>
              </ItemContent>
            </Item>
          );
        })}
      </div>

      {/* Deployment name preview */}
      {selectedModelName && (
        <Item variant="muted" size="sm">
          <ItemContent>
            <ItemDescription>Deployment name</ItemDescription>
            <ItemTitle className="font-mono">{selectedModelName}</ItemTitle>
          </ItemContent>
        </Item>
      )}
    </div>
  );
}
