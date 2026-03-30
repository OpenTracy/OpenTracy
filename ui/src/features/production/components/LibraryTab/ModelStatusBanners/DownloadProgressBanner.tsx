import { Download, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import type {
  ModelStatusResponse,
  RegisteredModel,
} from '@/features/production/api/modelRegistryService';

interface DownloadProgressBannerProps {
  models: RegisteredModel[];
  modelStatuses: Record<string, ModelStatusResponse>;
}

export function DownloadProgressBanner({ models, modelStatuses }: DownloadProgressBannerProps) {
  if (models.length === 0) return null;

  return (
    <Card className="mb-6 gap-1">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          Downloading Models
        </CardTitle>
      </CardHeader>

      <CardContent>
        <ItemGroup>
          {models.map((model) => {
            const status = modelStatuses[model.model_id] ?? model;
            const progressPercent = status.progress?.progress_percent ?? 0;

            return (
              <Item key={model.model_id}>
                <ItemMedia variant="icon">
                  <Loader2 className="text-primary animate-spin" />
                </ItemMedia>

                <ItemContent>
                  <div className="flex items-center gap-2">
                    <ItemTitle>{model.display_name}</ItemTitle>
                    <Badge variant="secondary" className="capitalize text-primary text-xs">
                      {status.download_status}
                    </Badge>
                  </div>

                  <ItemDescription>{model.hf_model_id}</ItemDescription>

                  {status.progress && (
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={progressPercent} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right shrink-0">
                        {progressPercent}%
                      </span>
                    </div>
                  )}
                </ItemContent>
              </Item>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
