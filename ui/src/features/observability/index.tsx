import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageTabs } from '@/components/shared/PageTabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { TABS } from './constants';
import { useObservability } from './hooks/useObservability';
import { OverviewTab } from './components/Overview';
import { CostTab } from './components/CostAnalysis';
import { PerformanceTab } from './components/PerformanceAnalysis';
// import { DeploymentsTab } from './components/Deployments';

export default function ObservabilityPage() {
  const { activeTab, setActiveTab, metrics, handleTimeRangeChange } = useObservability();

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Observability"
        actions={[
          <Tooltip key="refresh">
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={metrics.refreshData}
                disabled={metrics.loading}
                className="gap-1.5"
              >
                <RefreshCw className={`size-3.5 ${metrics.loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh all metrics</TooltipContent>
          </Tooltip>,
        ]}
      />

      <PageTabs tabs={TABS} value={activeTab} onValueChange={setActiveTab} />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {activeTab === 'overview' && (
          <OverviewTab metrics={metrics} onTimeRangeChange={handleTimeRangeChange} />
        )}
        {activeTab === 'cost' && (
          <CostTab metrics={metrics} onTimeRangeChange={handleTimeRangeChange} />
        )}
        {activeTab === 'perf' && (
          <PerformanceTab metrics={metrics} onTimeRangeChange={handleTimeRangeChange} />
        )}
        {/* {activeTab === 'deployments' && <DeploymentsTab />} */}
      </main>
    </div>
  );
}
