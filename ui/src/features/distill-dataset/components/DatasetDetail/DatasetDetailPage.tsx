import { Loader2, Database, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useDatasetDetailPage } from '../../hooks/useDatasetDetailPage';
import { DetailHeader } from './DetailHeader';
import { DatasetStats } from './DatasetStats';
import { SamplesExplorer } from './SamplesExplorer';
import { ModelsTab } from './ModelsTab';
import { EvaluateTab } from './EvaluateTab';
import { SettingsTab } from './SettingsTab';
import { AutoCollectTab } from '../AutoCollectTab';
import { BondEnhancementModal } from '../BondEnhancementModal';

export default function DatasetDetailPage() {
  const {
    dataset,
    pageLoading,
    activeTab,
    setActiveTab,
    showBondModal,
    setShowBondModal,
    samples,
    handleExportJSON,
    handleBondEnhance,
    handleDelete,
    navigate,
  } = useDatasetDetailPage();

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
          <Database className="size-8 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">Dataset not found</p>
          <p className="text-xs text-muted-foreground">
            The dataset may have been deleted or is unavailable
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/distill-datasets')}>
          <ArrowLeft className="size-4" />
          Back to Datasets
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DetailHeader
        dataset={dataset}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onExport={handleExportJSON}
        onTraining={() => setShowBondModal(true)}
      />

      <div className="flex-1 overflow-hidden">
        {activeTab === 'general' && (
          <ScrollArea className="h-full">
            <div className="p-6 max-w-6xl mx-auto space-y-6">
              {samples.loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : samples.stats ? (
                <>
                  <DatasetStats
                    stats={samples.stats}
                    dataset={dataset}
                    onHistogramClick={samples.handleHistogramClick}
                    inputLengthFilter={samples.inputLengthFilter}
                    outputLengthFilter={samples.outputLengthFilter}
                  />
                  <Separator />
                  <div
                    className="border border-border rounded-lg overflow-hidden"
                    style={{ height: 'calc(100vh - 480px)', minHeight: '400px' }}
                  >
                    <SamplesExplorer
                      filteredSamples={samples.filteredSamples}
                      paginatedSamples={samples.paginatedSamples}
                      totalPages={samples.totalPages}
                      currentPage={samples.currentPage}
                      startIndex={samples.startIndex}
                      samplesPerPage={samples.samplesPerPage}
                      searchTerm={samples.searchTerm}
                      hasActiveFilters={samples.hasActiveFilters}
                      expandedRows={samples.expandedRows}
                      inputLengthFilter={samples.inputLengthFilter}
                      outputLengthFilter={samples.outputLengthFilter}
                      onSearchChange={samples.setSearchTerm}
                      onPageChange={samples.setCurrentPage}
                      onSamplesPerPageChange={samples.setSamplesPerPage}
                      onToggleExpand={samples.toggleRowExpand}
                      onClearFilters={samples.clearFilters}
                      onClearInputFilter={() => samples.setInputLengthFilter(null)}
                      onClearOutputFilter={() => samples.setOutputLengthFilter(null)}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                    <Database className="size-8 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">No samples yet</p>
                    <p className="text-xs text-muted-foreground">
                      Configure Auto-Collect or import data to get started
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === 'data-pipeline' && <AutoCollectTab dataset={dataset} />}
        {activeTab === 'models' && (
          <ModelsTab dataset={dataset} onTraining={() => setShowBondModal(true)} />
        )}
        {activeTab === 'evaluate' && <EvaluateTab />}
        {activeTab === 'settings' && <SettingsTab dataset={dataset} onDelete={handleDelete} />}
      </div>

      <BondEnhancementModal
        open={showBondModal}
        dataset={dataset}
        onClose={() => setShowBondModal(false)}
        onEnhance={handleBondEnhance}
      />
    </div>
  );
}
