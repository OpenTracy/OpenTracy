import { Cpu } from 'lucide-react';
import type { SVGProps } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import type { DeploymentModel } from '@/types/deploymentTypes';

interface ModelSelectionProps {
  selectedModelId: string;
  models: DeploymentModel[];
  onModelChange: (id: string) => void;
}

interface ModelAvatarProps {
  icon: React.ComponentType<SVGProps<SVGSVGElement>> | null;
  isSelected: boolean;
}

function ModelAvatar({ icon: IconComponent, isSelected }: ModelAvatarProps) {
  return (
    <Avatar size="lg">
      <AvatarFallback
        className={cn(
          'transition-colors duration-200',
          isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        )}
      >
        {IconComponent ? <IconComponent className="size-5" /> : <Cpu className="size-5" />}
      </AvatarFallback>
    </Avatar>
  );
}

export function ModelSelection({ selectedModelId, models, onModelChange }: ModelSelectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Select Model</h3>
        <p className="text-sm text-muted-foreground">
          Choose from our collection of optimized models.
        </p>
      </div>

      <div className="space-y-2">
        {models.map((model) => {
          const isSelected = selectedModelId === model.id;

          return (
            <Item
              key={model.id}
              variant="outline"
              role="button"
              tabIndex={0}
              onClick={() => onModelChange(model.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onModelChange(model.id);
                }
              }}
              className={cn(
                'cursor-pointer transition-all duration-200 select-none',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border hover:border-border-hover hover:bg-accent/50 hover:shadow-sm'
              )}
            >
              <ItemMedia>
                <ModelAvatar
                  icon={typeof model.icon === 'string' ? null : model.icon}
                  isSelected={isSelected}
                />
              </ItemMedia>

              <ItemContent>
                <ItemTitle className={isSelected ? 'text-primary font-semibold' : undefined}>
                  {model.name}
                </ItemTitle>
                <ItemDescription className="line-clamp-2 whitespace-normal text-xs">
                  {model.description}
                </ItemDescription>
                {model.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {model.features.slice(0, 3).map((feature) => (
                      <Badge
                        key={feature}
                        variant={isSelected ? 'default' : 'secondary'}
                        className="text-xs font-normal"
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                )}
              </ItemContent>

              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onModelChange(model.id)}
                aria-label={`Select ${model.name}`}
              />
            </Item>
          );
        })}
      </div>
    </div>
  );
}
