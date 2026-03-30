import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageTabs } from '@/components/shared/PageTabs';
import { ExperimentsTab } from './Experiments';
import { ProblemsTab } from './Issues';
import { AnnotationsTab } from './Annotations';

import { TABS } from '../constants';
import { EvaluationsPageProvider } from '../contexts/EvaluationsPageContext';
import { useEvaluationsPage } from '../contexts/useEvaluationsPage';
import { OverviewTab } from './Overview';
import { EvaluationsTab } from './Evaluations';
import { MetricsTab } from './Metrics';
import { ModalsManager } from './ModalsManager';

function DistillMetricsContent() {
  const { activeTab, setActiveTab, handleOpenRunEvaluation } = useEvaluationsPage();

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Distill Evaluations"
        action={
          <Button size="sm" onClick={() => handleOpenRunEvaluation()}>
            <Plus className="w-4 h-4 mr-1" />
            New Evaluation
          </Button>
        }
      />

      <PageTabs tabs={TABS} value={activeTab} onValueChange={setActiveTab} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'evaluations' && <EvaluationsTab />}
        {activeTab === 'metrics' && <MetricsTab />}
        {activeTab === 'experiments' && <ExperimentsTab />}
        {activeTab === 'issues' && <ProblemsTab onRunEval={handleOpenRunEvaluation} />}
        {activeTab === 'annotations' && <AnnotationsTab />}
      </main>

      <ModalsManager />
    </div>
  );
}

export default function DistillMetrics() {
  return (
    <EvaluationsPageProvider>
      <DistillMetricsContent />
    </EvaluationsPageProvider>
  );
}
