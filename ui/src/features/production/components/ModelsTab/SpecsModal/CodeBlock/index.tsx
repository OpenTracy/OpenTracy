import { cn } from '@/lib/utils';

import { CodeBlockToolbar } from './CodeBlockToolbar';
import type { CodeBlockProps } from '@/features/production/types/codeBlocks.types';

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  return (
    <div className={cn('relative group rounded-lg bg-muted border border-border', className)}>
      <CodeBlockToolbar code={code} language={language} />

      <pre
        className={cn(
          'overflow-x-auto text-sm text-foreground p-4 pr-16 leading-relaxed',
          language && 'pt-8'
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
