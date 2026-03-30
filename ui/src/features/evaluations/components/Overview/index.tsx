import { EvaluationStatsCards } from './EvaluationStatsCards';
import { ModelLeaderboard } from './ModelLeaderboard';
import { AiSuggestionsPanel } from './AiSuggestionsPanel';
import { RecentEvaluationsList } from './RecentEvaluationsList';
import { AutoEvalPanel } from './AutoEvalPanel';
import { ProposalsPanel } from './ProposalsPanel';
import { OverviewSkeleton } from './Skeleton';
import { useEvaluationsPage } from '../../contexts/useEvaluationsPage';

export function OverviewTab() {
  const {
    evaluations,
    datasets,
    traceIssues,
    availableModels,
    metrics,
    loading,
    handleViewResults,
    setCancellingEvaluation,
    handleDeleteEvaluation,
    setActiveTab,
    handleOpenRunEvaluation,
  } = useEvaluationsPage();

  if (loading) return <OverviewSkeleton />;

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      <EvaluationStatsCards evaluations={evaluations} traceIssues={traceIssues} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <RecentEvaluationsList
            evaluations={evaluations}
            onViewResults={handleViewResults}
            onCancel={(e) => setCancellingEvaluation(e)}
            onDelete={handleDeleteEvaluation}
            onViewAll={() => setActiveTab('evaluations')}
          />
        </div>
        <div className="lg:col-span-5">
          <ModelLeaderboard evaluations={evaluations} />
        </div>
      </div>
      <AutoEvalPanel />
      <ProposalsPanel />
      <AiSuggestionsPanel
        evaluations={evaluations}
        datasets={datasets}
        availableModels={availableModels}
        metrics={metrics}
        onRunSuggestion={handleOpenRunEvaluation}
        traceIssues={traceIssues}
        onViewProblems={() => setActiveTab('issues')}
      />
    </div>
  );
}
