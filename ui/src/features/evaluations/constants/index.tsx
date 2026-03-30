import { BarChart3, FlaskConical, Beaker, AlertTriangle, MessageSquare, Ruler } from 'lucide-react';

import type { PageTab } from '@/components/shared/PageTabs';
import type { EvaluationStatus, TabId } from '../types';

export const TABS: PageTab<TabId>[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'evaluations', label: 'Evaluations', icon: <FlaskConical className="w-4 h-4" /> },
  { id: 'experiments', label: 'Experiments', icon: <Beaker className="w-4 h-4" /> },
  { id: 'metrics', label: 'Metrics', icon: <Ruler className="w-4 h-4" /> },
  { id: 'annotations', label: 'Annotations', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'issues', label: 'Issues', icon: <AlertTriangle className="w-4 h-4" /> },
];

export const STATUS_FILTERS: { id: EvaluationStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export const RUNNING_STATUSES: EvaluationStatus[] = ['running', 'queued', 'starting'];
