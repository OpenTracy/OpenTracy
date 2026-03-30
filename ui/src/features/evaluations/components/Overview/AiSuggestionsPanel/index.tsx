import { Sparkles, ShieldAlert, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from '@/components/ui/item';
import { SuggestionCard } from './SuggestionCard';
import { useSuggestions } from './useSuggestions';
import type { AiSuggestionsPanelProps } from './types';

export function AiSuggestionsPanel({
  evaluations,
  datasets,
  availableModels,
  metrics,
  onRunSuggestion,
  traceIssues,
  onViewProblems,
}: AiSuggestionsPanelProps) {
  const suggestions = useSuggestions({
    evaluations,
    datasets,
    availableModels,
    metrics,
    traceIssues,
  });
  const unresolvedIssueCount = traceIssues?.filter((i) => !i.resolved).length ?? 0;

  if (suggestions.length === 0 && unresolvedIssueCount === 0) return null;

  return (
    <div className="space-y-4">
      {unresolvedIssueCount > 0 && onViewProblems && (
        <Item
          variant="outline"
          size="sm"
          className="cursor-pointer border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
          onClick={onViewProblems}
        >
          <ItemMedia
            variant="icon"
            className="bg-destructive/10 text-destructive border-destructive/20"
          >
            <ShieldAlert className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-sm text-foreground">Trace Issues</ItemTitle>
            <ItemDescription className="text-sm text-muted-foreground">
              {unresolvedIssueCount} unresolved trace issue{unresolvedIssueCount !== 1 ? 's' : ''}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <ArrowRight className="size-4 text-destructive shrink-0" />
          </ItemActions>
        </Item>
      )}

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Suggested Next Steps</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Actions recommended based on your evaluation data and detected issues.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onRun={onRunSuggestion}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
