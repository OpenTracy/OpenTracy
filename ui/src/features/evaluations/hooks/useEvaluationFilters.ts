import { useState, useMemo } from 'react';

import type { Evaluation, EvaluationStatus } from '../types';
import { RUNNING_STATUSES } from '../constants';

export function useEvaluationFilters(evaluations: Evaluation[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<EvaluationStatus | 'all'>('all');

  const filtered = useMemo(() => {
    let result = [...evaluations];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(term) ||
          (e.dataset_name && e.dataset_name.toLowerCase().includes(term))
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'running') {
        result = result.filter((e) => RUNNING_STATUSES.includes(e.status));
      } else {
        result = result.filter((e) => e.status === statusFilter);
      }
    }

    return result.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [evaluations, searchTerm, statusFilter]);

  return { searchTerm, setSearchTerm, statusFilter, setStatusFilter, filtered };
}
