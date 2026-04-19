import { Cpu } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import type { AvailableModel } from '../../../types';
import { getModelCategory, getProviderIconByBackend, getCleanModelName } from '@/utils/modelUtils';

function isOpentracyModel(model: AvailableModel): boolean {
  const providerLower = model.provider?.toLowerCase() || '';
  return model.type === 'deployment' || providerLower === 'opentracy' || providerLower === 'deployment';
}

function getCategory(model: AvailableModel): string {
  return isOpentracyModel(model) ? 'OpenTracy' : getModelCategory(model.id);
}

interface ModelsStepProps {
  models: AvailableModel[];
  selectedModels: string[];
  onToggle: (modelId: string) => void;
}

export function ModelsStep({ models, selectedModels, onToggle }: ModelsStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Select Models</h3>
        <p className="text-sm text-muted-foreground">
          Choose the models to evaluate side by side.{' '}
          {selectedModels.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedModels.length} selected
            </Badge>
          )}
        </p>
      </div>

      {models.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No models available. Configure API keys or deploy models first.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {models.map((model) => {
            const isSelected = selectedModels.includes(model.id);
            const iconUrl = getProviderIconByBackend(model.provider, model.id);
            const category = getCategory(model);
            const displayName = isOpentracyModel(model)
              ? `opentracy/${model.name}`
              : getCleanModelName(model.name);

            return (
              <Item
                key={model.id}
                variant="outline"
                size="sm"
                role="button"
                tabIndex={0}
                onClick={() => onToggle(model.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle(model.id);
                  }
                }}
                className={cn(
                  'cursor-pointer transition-all duration-200 select-none',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'hover:border-border-hover hover:bg-accent/50'
                )}
              >
                <ItemMedia>
                  <Avatar className="size-8">
                    <AvatarFallback
                      className={cn(
                        'transition-colors',
                        isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt={category}
                          className="size-4 dark:invert grayscale brightness-0 dark:brightness-100 opacity-70"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Cpu className="size-4 dark:invert grayscale brightness-0 dark:brightness-100 opacity-70" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                </ItemMedia>

                <ItemContent>
                  <ItemTitle className={isSelected ? 'text-primary font-semibold' : undefined}>
                    {displayName}
                  </ItemTitle>
                  <ItemDescription>{category}</ItemDescription>
                </ItemContent>

                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(model.id)}
                  aria-label={`Select ${model.name}`}
                />
              </Item>
            );
          })}
        </div>
      )}
    </div>
  );
}
