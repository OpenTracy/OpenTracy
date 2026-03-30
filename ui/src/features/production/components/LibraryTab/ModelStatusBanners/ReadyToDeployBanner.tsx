import { CheckCircle, Rocket } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import type { RegisteredModel } from '@/features/production/api/modelRegistryService';
import { resolveModelIcon } from '@/features/production/constants/productionModels';
import { ModelAvatar } from '../../ModelAvatar';

interface ReadyToDeployBannerProps {
  models: RegisteredModel[];
  onDeploy: (modelId: string) => void;
}

export function ReadyToDeployBanner({ models, onDeploy }: ReadyToDeployBannerProps) {
  if (models.length === 0) return null;

  return (
    <Card className="mb-6 gap-1">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          Ready to Deploy
        </CardTitle>
      </CardHeader>

      <CardContent>
        <ItemGroup>
          {models.map((model) => {
            const icon = resolveModelIcon(
              model.hf_model_id ? 'huggingface' : 'internal',
              model.model_id,
              model.display_name
            );

            return (
              <Item key={model.model_id} size="sm">
                <ItemMedia variant="image">
                  <ModelAvatar icon={icon} size="sm" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{model.display_name}</ItemTitle>
                </ItemContent>

                <ItemActions>
                  <Button onClick={() => onDeploy(model.model_id)} variant="outline" size="sm">
                    <Rocket className="w-3.5 h-3.5" />
                    Deploy
                  </Button>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
