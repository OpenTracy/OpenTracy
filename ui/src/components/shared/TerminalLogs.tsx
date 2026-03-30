import { useRef, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TerminalLogsProps {
  logs: string[];
  title?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  maxHeight?: string;
  className?: string;
}

export function TerminalLogs({
  logs,
  title = 'Logs',
  collapsible = true,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  maxHeight = '300px',
  className,
}: TerminalLogsProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = (v: boolean) => {
    setInternalExpanded(v);
    onExpandedChange?.(v);
  };
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, expanded]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden', className)}>
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 bg-muted',
          collapsible && 'cursor-pointer hover:bg-accent'
        )}
        onClick={collapsible ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-center gap-2">
          {collapsible &&
            (expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ))}
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">({logs.length} lines)</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>

      {(!collapsible || expanded) && (
        <div
          ref={scrollRef}
          className="bg-background text-foreground overflow-y-auto p-4 font-mono text-xs leading-5"
          style={{ maxHeight }}
        >
          {logs.length === 0 ? (
            <span className="text-muted-foreground">Waiting for logs...</span>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="text-foreground/80 hover:text-foreground whitespace-pre-wrap">
                {line}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
