import { RunEvaluationModal } from './RunEvaluationModal';
import { CreateCustomMetricModal } from './CreateCustomMetricModal';
import { EvaluationResultsModal } from './EvaluationResultsModal';
import { ConfirmCancelModal } from './shared/confirmCancelModal';
import { useEvaluationsPage } from '../contexts/useEvaluationsPage';

export function ModalsManager() {
  const {
    datasets,
    availableModels,
    metrics,
    allMetrics,
    showRunEvaluation,
    prefillConfig,
    runEvalLoading,
    showCreateMetric,
    setShowCreateMetric,
    selectedEvaluation,
    setSelectedEvaluation,
    cancellingEvaluation,
    setCancellingEvaluation,
    cancelLoading,
    handleRunEvaluation,
    handleCloseRunEvaluation,
    handleCreateMetric,
    handleCancelEvaluation,
  } = useEvaluationsPage();

  return (
    <>
      <RunEvaluationModal
        isOpen={showRunEvaluation}
        datasets={datasets}
        availableModels={availableModels}
        metrics={metrics}
        prefill={prefillConfig}
        loading={runEvalLoading}
        onClose={handleCloseRunEvaluation}
        onCreate={handleRunEvaluation}
      />

      <CreateCustomMetricModal
        open={showCreateMetric}
        onClose={() => setShowCreateMetric(false)}
        onCreate={handleCreateMetric}
        availableModels={availableModels}
      />

      {selectedEvaluation && (
        <EvaluationResultsModal
          open={!!selectedEvaluation}
          evaluation={selectedEvaluation}
          metrics={allMetrics}
          onClose={() => setSelectedEvaluation(null)}
        />
      )}

      {cancellingEvaluation && (
        <ConfirmCancelModal
          isOpen={!!cancellingEvaluation}
          onClose={() => setCancellingEvaluation(null)}
          onConfirm={handleCancelEvaluation}
          evaluationName={cancellingEvaluation.name}
          loading={cancelLoading}
        />
      )}
    </>
  );
}
