import { Code, Cpu, Globe, Rocket, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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
import { FieldSet, FieldLegend } from '@/components/ui/field';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DeploymentModel } from '@/types/deploymentTypes';

import { extractModelSpecs } from '@/features/production/utils/extractModelSpecs';
import { ModelAvatar } from '../ModelAvatar';

interface ModelSpecsModalProps {
  isOpen: boolean;
  model: DeploymentModel | null;
  onClose: () => void;
  onDeploy?: (modelId: string) => void;
}

export function ModelSpecsModal({ isOpen, model, onClose, onDeploy }: ModelSpecsModalProps) {
  if (!model) return null;

  const specs = extractModelSpecs(model);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Model Specifications</DialogTitle>
          <DialogDescription>
            Detailed technical information, capabilities and recommended use cases for this model.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-8 pr-3">
            <FieldSet>
              <FieldLegend>About</FieldLegend>
              <Item variant="outline">
                <ItemMedia variant="image">
                  <ModelAvatar icon={model.icon} size="sm" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{model.name}</ItemTitle>
                  <ItemDescription className="line-clamp-none">{model.description}</ItemDescription>
                </ItemContent>
              </Item>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Technical Specifications</FieldLegend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Item variant="outline">
                  <ItemMedia variant="icon">
                    <Zap className="text-amber-500" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Parameters</ItemTitle>
                    <ItemDescription>{specs.parameters}</ItemDescription>
                  </ItemContent>
                </Item>

                <Item variant="outline">
                  <ItemMedia variant="icon">
                    <Code className="text-emerald-500" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Model Type</ItemTitle>
                    <ItemDescription>{specs.modelType}</ItemDescription>
                  </ItemContent>
                </Item>

                <Item variant="outline">
                  <ItemMedia variant="icon">
                    <Globe className="text-sky-500" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Optimization</ItemTitle>
                    <ItemDescription>{specs.optimization}</ItemDescription>
                  </ItemContent>
                </Item>

                <Item variant="outline">
                  <ItemMedia variant="icon">
                    <Cpu className="text-violet-500" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Features</ItemTitle>
                    <div className="flex flex-wrap gap-1">
                      {model.features.map((feature) => (
                        <Badge key={feature} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </ItemContent>
                </Item>
              </div>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Recommended Use Cases</FieldLegend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {specs.useCases.map((useCase) => (
                  <Item key={useCase} variant="muted" size="sm">
                    <ItemMedia variant="icon">
                      <Rocket />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{useCase}</ItemTitle>
                    </ItemContent>
                  </Item>
                ))}
              </div>
            </FieldSet>
          </div>
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          {onDeploy && (
            <Button
              onClick={() => {
                onDeploy(model.id);
                onClose();
              }}
            >
              Deploy This Model
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
