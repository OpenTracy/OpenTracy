import { ArrowRight } from 'lucide-react';
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from '@/components/ui/item';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Suggestion, EvalPrefillConfig } from './types';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onRun: (prefill: EvalPrefillConfig) => void;
}

export function SuggestionCard({ suggestion, onRun }: SuggestionCardProps) {
  const { isIssueBased } = suggestion;

  return (
    <Item
      variant="outline"
      className={cn(
        'cursor-pointer group transition-all hover:shadow-sm h-full items-start',
        isIssueBased
          ? 'border-destructive/25 bg-destructive/5 hover:border-destructive/50'
          : 'hover:border-primary/25'
      )}
      onClick={() => onRun(suggestion.prefill)}
    >
      <ItemMedia
        variant="icon"
        className={cn(
          'shrink-0',
          isIssueBased
            ? 'bg-destructive/10 text-destructive border-destructive/20'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {suggestion.icon}
      </ItemMedia>

      <ItemContent className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <ItemTitle className="text-xs font-semibold leading-snug truncate">
            {suggestion.title}
          </ItemTitle>
          {isIssueBased && (
            <Badge
              variant="outline"
              className="text-xs h-4 px-1.5 shrink-0 border-destructive/30 text-destructive"
            >
              Issue
            </Badge>
          )}
        </div>
        <ItemDescription className="text-xs leading-snug line-clamp-2 mt-0.5">
          {suggestion.description}
        </ItemDescription>
      </ItemContent>

      <ItemActions className="self-end shrink-0">
        <div className="flex items-center gap-2">
          {suggestion.confidence != null && (
            <span className="text-xs text-muted-foreground/60 tabular-nums">
              {Math.round(suggestion.confidence * 100)}%
            </span>
          )}
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            Run <ArrowRight className="size-3" />
          </span>
        </div>
      </ItemActions>
    </Item>
  );
}
