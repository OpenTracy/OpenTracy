import { useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ExpandableTextProps {
  text: string;
  label: string;
  previewLines?: number;
}

export function ExpandableText({ text, label, previewLines = 3 }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);

  const threshold = previewLines * 120;
  const shouldTruncate = text.length > threshold;
  const preview = shouldTruncate && !expanded ? `${text.slice(0, threshold)}…` : text;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <pre className="rounded-md bg-muted/30 border px-3 py-2.5 text-xs font-mono whitespace-pre-wrap wrap-break-words leading-relaxed">
          {preview}
        </pre>
        {shouldTruncate && !expanded && (
          <div className="absolute inset-x-0 bottom-0 h-10 rounded-b-md bg-linear-to-t from-muted/80 to-transparent pointer-events-none" />
        )}
      </div>
      {shouldTruncate && (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed text-xs text-muted-foreground gap-1.5"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? (
            <>
              <ChevronsDownUp className="size-3.5" /> Show less
            </>
          ) : (
            <>
              <ChevronsUpDown className="size-3.5" /> Show more
            </>
          )}
        </Button>
      )}
    </div>
  );
}
