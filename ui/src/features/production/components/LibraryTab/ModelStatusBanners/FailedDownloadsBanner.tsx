import { Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { RegisteredModel } from '@/features/production/api/modelRegistryService';

interface FailedDownloadsBannerProps {
  models: RegisteredModel[];
  deletingModelIds: Set<string>;
  onRetry: (model: RegisteredModel) => void;
  onDelete: (modelId: string) => void;
}

export function FailedDownloadsBanner({
  models,
  deletingModelIds,
  onRetry,
  onDelete,
}: FailedDownloadsBannerProps) {
  if (models.length === 0) return null;

  return (
    <TooltipProvider>
      <Card className="mb-6 gap-1 border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Failed Downloads
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {models.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <ItemGroup>
            {models.map((model) => {
              const isDeleting = deletingModelIds.has(model.model_id);

              return (
                <Item key={model.model_id}>
                  <ItemMedia variant="icon">
                    <XCircle className="text-destructive" />
                  </ItemMedia>

                  <ItemContent>
                    <ItemTitle>{model.display_name}</ItemTitle>
                    <ItemDescription>{model.hf_model_id}</ItemDescription>
                  </ItemContent>

                  <ItemActions>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => onRetry(model)}
                          variant="outline"
                          size="sm"
                          className="border-destructive/20 hover:bg-destructive/5 hover:border-destructive/40"
                        >
                          <RefreshCw className="size-3.5" />
                          Retry
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Re-validate and retry download</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => onDelete(model.model_id)}
                          disabled={isDeleting}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          {isDeleting ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove from registry</TooltipContent>
                    </Tooltip>
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
