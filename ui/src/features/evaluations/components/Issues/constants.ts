import type { IssueSeverity, IssueType } from '../../types/evaluationsTypes';

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  hallucination: 'Hallucination',
  refusal: 'Refusal',
  safety: 'Safety',
  quality_regression: 'Quality Regression',
  latency_spike: 'Latency Spike',
  cost_anomaly: 'Cost Anomaly',
  format_violation: 'Format Violation',
  incomplete_response: 'Incomplete Response',
};

export const SEVERITY_VARIANT: Record<IssueSeverity, 'destructive' | 'secondary' | 'outline'> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

export const SEVERITY_FILTERS: { id: IssueSeverity | 'all'; label: string }[] = [
  { id: 'all', label: 'All Severities' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

export const TYPE_FILTERS: { id: IssueType | 'all'; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'hallucination', label: 'Hallucination' },
  { id: 'refusal', label: 'Refusal' },
  { id: 'safety', label: 'Safety' },
  { id: 'quality_regression', label: 'Quality' },
  { id: 'latency_spike', label: 'Latency' },
  { id: 'cost_anomaly', label: 'Cost' },
  { id: 'format_violation', label: 'Format' },
  { id: 'incomplete_response', label: 'Incomplete' },
];
