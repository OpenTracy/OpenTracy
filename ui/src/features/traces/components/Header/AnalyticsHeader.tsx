import { RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';

interface AnalyticsHeaderProps {
  isLoading: boolean;
  hasData: boolean;
  onRefresh: () => void;
  onExport: () => void;
}

export function AnalyticsHeader({ isLoading, hasData, onRefresh, onExport }: AnalyticsHeaderProps) {
  return (
    <PageHeader
      title="Traces & Analytics"
      actions={[
        <Button
          key="refresh"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          loading={isLoading}
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>,
        <Button key="export" size="sm" onClick={onExport} disabled={!hasData}>
          <Download className="size-4" />
          <span className="hidden sm:inline">Export CSV</span>
        </Button>,
      ]}
    />
  );
}
