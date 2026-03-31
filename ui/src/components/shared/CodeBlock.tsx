import { Copy, FileCode } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  label: string;
  content: string;
  meta?: string;
  variant?: 'default' | 'success' | 'error';
  flush?: boolean;
}

export function CodeBlock({
  label,
  content,
  meta,
  variant = 'default',
  flush = false,
}: CodeBlockProps) {
  const accentColor =
    variant === 'success'
      ? 'text-emerald-500'
      : variant === 'error'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'overflow-hidden bg-card',
        flush ? 'rounded-none border-0 shadow-none' : 'rounded-lg border border-border shadow-sm'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border">
        <div className="flex items-center gap-2">
          <FileCode className={cn('size-3.5', accentColor)} />
          <span className={cn('text-[11px] uppercase tracking-wider font-semibold', accentColor)}>
            {label}
          </span>
          {meta && (
            <>
              <span className="text-border">·</span>
              <span className="text-[10px] font-mono text-muted-foreground/70">{meta}</span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 -mr-1 text-muted-foreground hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(content);
            toast.success(`${label} copied`);
          }}
        >
          <Copy className="size-3" />
        </Button>
      </div>
      {/* Code body */}
      <pre className="px-3 py-2.5 text-[12px] font-mono whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto text-foreground/90 selection:bg-foreground/10">
        {content || '—'}
      </pre>
    </div>
  );
}
