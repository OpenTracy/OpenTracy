import { useEffect, useRef } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AgentLogProps {
  lines: string[];
  processing: boolean;
}

const getLineColor = (line: string) => {
  if (line.startsWith('> Error')) return 'text-destructive';
  if (line.startsWith('> Warning')) return 'text-chart-4';
  if (line.startsWith('> Done')) return 'text-chart-2';
  return 'text-muted-foreground';
};

export function AgentLog({ lines, processing }: AgentLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <Card className="overflow-hidden py-0 gap-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted">
        <Bot className="size-3.5 text-primary" />
        <span className="text-xs font-mono text-muted-foreground">agent-log</span>
        {processing && <Loader2 className="size-3 text-primary animate-spin ml-auto" />}
      </div>
      <ScrollArea className="max-h-40">
        <CardContent className="p-3 font-mono text-xs space-y-1">
          {lines.map((line, i) => (
            <div key={i} className={cn('transition-opacity duration-300', getLineColor(line))}>
              {line}
            </div>
          ))}
          {processing && <div className="text-muted-foreground animate-pulse">_</div>}
          <div ref={endRef} />
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
