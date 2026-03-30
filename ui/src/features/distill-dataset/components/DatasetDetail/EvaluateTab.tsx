import { Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function EvaluateTab() {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evaluation</CardTitle>
            <CardDescription>
              Run automated evaluations on this dataset to measure quality and consistency.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted border border-border">
              <div className="size-10 rounded-xl bg-secondary flex items-center justify-center">
                <Database className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Evaluation features coming soon. You can configure Auto-Eval from the metrics page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
