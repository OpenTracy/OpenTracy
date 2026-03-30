import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';

interface DataSourcesHeaderProps {
  readonly configuredCount: number;
}

const TOOLTIP_TEXT =
  'Teacher models are large LLMs used to generate training data for distillation and evaluation.';

export function DataSourcesHeader({ configuredCount }: DataSourcesHeaderProps) {
  return (
    <Card className="mb-8">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
              Teacher models
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary">
                  <Info className="h-3 w-3" />
                  Info
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="w-110">{TOOLTIP_TEXT}</TooltipContent>
            </Tooltip>
          </div>

          <h2 className="mt-2 text-2xl sm:text-3xl font-semibold">
            Connect sources that teach your models
          </h2>

          <p className="mt-2 text-sm text-foreground-muted max-w-2xl">
            Link your LLM providers and start collecting high-quality data.
          </p>
        </div>

        <Badge variant="secondary">{configuredCount} connected</Badge>
      </CardContent>
    </Card>
  );
}
