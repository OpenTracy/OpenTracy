import { createElement } from 'react';
import { BarChart3, DollarSign, Gauge } from 'lucide-react';

import type { PageTab } from '@/components/shared/PageTabs';
import type { TabId } from '../types';

export const TABS: PageTab<TabId>[] = [
  { id: 'overview', label: 'Overview', icon: createElement(BarChart3, { className: 'size-4' }) },
  { id: 'cost', label: 'Costs', icon: createElement(DollarSign, { className: 'size-4' }) },
  { id: 'perf', label: 'Performance', icon: createElement(Gauge, { className: 'size-4' }) },
  // { id: 'deployments', label: 'Deployments', icon: createElement(Server, { className: 'size-4' }) },
];

export const TIME_RANGE_OPTIONS = [7, 14, 30] as const;
export type TimeRange = (typeof TIME_RANGE_OPTIONS)[number];

export const DEPLOYMENT_TIME_RANGE_OPTIONS = [
  { label: '1h', minutes: 60, period: 300 },
  { label: '6h', minutes: 360, period: 600 },
  { label: '24h', minutes: 1440, period: 1800 },
  { label: '7d', minutes: 10080, period: 3600 },
  { label: '14d', minutes: 43200, period: 14400 },
] as const;

export type DeploymentTimeRange = (typeof DEPLOYMENT_TIME_RANGE_OPTIONS)[number];
