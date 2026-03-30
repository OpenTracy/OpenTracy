import { SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface LibrarySearchEmptyStateProps {
  searchTerm: string;
  onClearSearch: () => void;
}

export function LibrarySearchEmptyState({
  searchTerm,
  onClearSearch,
}: LibrarySearchEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mb-3">
          <SearchX className="w-5 h-5 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold mb-1">No models found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          No models match <span className="font-medium">"{searchTerm}"</span>.
        </p>
        <Button variant="outline" size="sm" onClick={onClearSearch}>
          Clear search
        </Button>
      </CardContent>
    </Card>
  );
}
