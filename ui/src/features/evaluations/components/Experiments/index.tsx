import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/shared/SearchBar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useExperiments } from '../../hooks/useExperiments';
import { useEvaluations } from '@/features/evaluations';
import { useDatasets } from '../../../../hooks/useDatasets';
import { ExperimentRow } from './ExperimentRow';
import { ExperimentsEmpty } from './ExperimentsEmpty';
import { ExperimentsSkeleton } from './Skeleton';
import { CreateExperimentModal } from './CreateExperimentModal';
import { ComparisonTable } from './ComparisonTable';
import type { Experiment, ExperimentComparison } from '../../types/evaluationsTypes';

export function ExperimentsTab() {
  const { experiments, loading, createExperiment, deleteExperiment, getComparison } =
    useExperiments();
  const { evaluations } = useEvaluations();
  const { datasets } = useDatasets();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [comparisonData, setComparisonData] = useState<ExperimentComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const filtered = experiments.filter(
    (e) =>
      !searchTerm ||
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCardClick = useCallback(
    async (experiment: Experiment) => {
      setSelectedExperiment(experiment);
      setComparisonLoading(true);
      setComparisonData(null);
      const data = await getComparison(experiment.id);
      setComparisonData(data);
      setComparisonLoading(false);
    },
    [getComparison]
  );

  const handleCreate = useCallback(
    async (name: string, description: string, datasetId: string, evalIds: string[]) => {
      await createExperiment(name, description, datasetId, evalIds);
      toast.success(`Created experiment "${name}"`);
    },
    [createExperiment]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteExperiment(id);
      toast.success('Experiment deleted');
    },
    [deleteExperiment]
  );

  if (loading) return <ExperimentsSkeleton />;

  const isEmpty = experiments.length === 0;
  const hasResults = filtered.length > 0;

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      <div className="flex items-center gap-3">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search experiments…"
          resultCount={!isEmpty ? filtered.length : undefined}
        />
        <Button size="sm" className="shrink-0" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" />
          New Experiment
        </Button>
      </div>

      {!hasResults ? (
        <ExperimentsEmpty
          isEmpty={isEmpty}
          onCreateClick={isEmpty ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          <div className="space-y-2 pr-2">
            {filtered.map((experiment) => (
              <ExperimentRow
                key={experiment.id}
                experiment={experiment}
                onClick={() => handleCardClick(experiment)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <CreateExperimentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        datasets={datasets}
        evaluations={evaluations}
      />

      <ComparisonTable
        open={!!selectedExperiment}
        onClose={() => {
          setSelectedExperiment(null);
          setComparisonData(null);
        }}
        experiment={selectedExperiment}
        comparison={comparisonData}
        loading={comparisonLoading}
      />
    </div>
  );
}
