import { CheckCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

import type { HuggingFaceModelInfo } from '../../../types/hfModelModal.types';

interface ModelInfoCardProps {
  modelInfo: HuggingFaceModelInfo;
}

export function ModelInfoCard({ modelInfo }: ModelInfoCardProps) {
  const stats = [
    modelInfo.downloads && `${modelInfo.downloads.toLocaleString()} downloads`,
    modelInfo.likes && `${modelInfo.likes.toLocaleString()} likes`,
    modelInfo.config?.model_type && `Architecture: ${modelInfo.config.model_type}`,
    modelInfo.cardData?.license && `License: ${modelInfo.cardData.license}`,
  ].filter(Boolean);

  return (
    <Item
      variant="outline"
      className="animate-in fade-in duration-300 border-green-500/20 bg-green-500/5"
    >
      <ItemMedia variant="icon">
        <CheckCircle className="text-green-600" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="text-green-600">Model Ready to Register</ItemTitle>
        {stats.length > 0 && (
          <ItemDescription>
            <span className="flex flex-wrap gap-1.5 pt-1">
              {stats.map((stat) => (
                <Badge key={stat} variant="secondary" className="text-xs font-normal">
                  {stat}
                </Badge>
              ))}
            </span>
          </ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}
