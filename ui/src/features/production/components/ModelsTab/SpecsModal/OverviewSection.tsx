import { Code2, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

import type { SectionProps } from '@/features/production/types/specsModal.types';

export function OverviewSection({ apiModelId }: SectionProps) {
  return (
    <FieldSet>
      <FieldLegend>Overview</FieldLegend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Item variant="outline">
          <ItemMedia variant="icon">
            <Zap className="text-amber-500" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Status</ItemTitle>
            <ItemDescription>
              <Badge
                variant="secondary"
                className="bg-green-500/10 text-green-600 border-green-500/20 mt-0.5"
              >
                Active &amp; ready
              </Badge>
            </ItemDescription>
          </ItemContent>
        </Item>

        <Item variant="outline">
          <ItemMedia variant="icon">
            <Code2 className="text-sky-500" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Model identifier</ItemTitle>
            <ItemDescription>
              <span className="font-mono text-xs">{`lunar/${apiModelId}`}</span>
            </ItemDescription>
          </ItemContent>
        </Item>
      </div>
    </FieldSet>
  );
}
