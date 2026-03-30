import { Sparkles, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Dataset } from '../../types';

interface ModelsTabProps {
  dataset: Dataset;
  onTraining: () => void;
}

export function ModelsTab({ dataset, onTraining }: ModelsTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-secondary flex items-center justify-center">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">BOND Training Pipeline</CardTitle>
                <CardDescription>
                  Best-of-N Distillation to train a smaller student model
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Configure and run the training pipeline to distill knowledge from a teacher model into
              a smaller, deployable student model using this dataset.
            </p>
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border border-border">
              <Database className="size-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{dataset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {dataset.samples_count.toLocaleString()} samples available for training
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {dataset.samples_count >= 50 ? 'Ready' : 'Need more data'}
              </Badge>
            </div>
            <Button onClick={onTraining}>
              <Sparkles className="size-4" />
              Configure Training
            </Button>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
