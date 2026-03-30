import { useState, useEffect } from 'react';

// Tipos ajustados para os novos componentes
interface KPI {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: 'dollar' | 'activity' | 'trending' | 'alert';
}

interface CostByProvider {
  provider: string;
  cost: number;
}

interface UsageByModel {
  model: string;
  requests: number;
}

interface Alert {
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp?: string;
}

interface TimeSeriesData {
  date: string;
  cost: number;
}

interface CostByTask {
  task: string;
  cost: number;
}

interface ExpensiveRequest {
  id: string;
  cost: number;
  model: string;
  promptSize: number;
  date: string;
}

interface LatencyData {
  key: string;
  value: number;
}

interface ErrorData {
  date: string;
  errors: number;
}

interface ErrorTableItem {
  date: string;
  model: string;
  reason: string;
  requestId: string;
}

export function useMockOverview() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    kpis: [] as KPI[],
    providers: [] as CostByProvider[],
    models: [] as UsageByModel[],
    alerts: [] as Alert[],
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setData({
        kpis: [
          {
            label: 'Total Cost (30d)',
            value: '$4,120',
            change: '12% vs last period',
            isPositive: true,
            icon: 'dollar',
          },
          {
            label: 'Total Requests',
            value: '1.2M',
            change: '8% vs last period',
            isPositive: true,
            icon: 'activity',
          },
          {
            label: 'Avg Latency (P95)',
            value: '420ms',
            change: '5% vs last period',
            isPositive: false,
            icon: 'trending',
          },
          {
            label: 'Error Rate (1h)',
            value: '0.8%',
            change: '2% vs last period',
            isPositive: false,
            icon: 'alert',
          },
        ],
        providers: [
          { provider: 'OpenAI', cost: 2600 },
          { provider: 'Anthropic', cost: 900 },
          { provider: 'Azure', cost: 400 },
          { provider: 'Other', cost: 220 },
        ],
        models: [
          { model: 'gpt-4o', requests: 650000 },
          { model: 'claude-3', requests: 380000 },
          { model: 'gpt-4.1', requests: 125000 },
          { model: 'local-llm', requests: 45000 },
        ],
        alerts: [
          {
            type: 'warning',
            message:
              'Your usage is 25% higher than usual this week. Consider optimizing prompt sizes.',
            timestamp: '2 hours ago',
          },
          {
            type: 'info',
            message: 'GPT-4o shows the best cost-performance ratio for your workload.',
            timestamp: '1 day ago',
          },
          {
            type: 'error',
            message: 'Claude-3 experienced 15 timeouts in the last hour. Check endpoint health.',
            timestamp: '30 minutes ago',
          },
        ],
      });
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return { loading, ...data };
}

export function useMockCostAnalysis() {
  const [data, setData] = useState({
    timeSeries: [] as TimeSeriesData[],
    costByTask: [] as CostByTask[],
    expensiveRequests: [] as ExpensiveRequest[],
  });

  useEffect(() => {
    const series: TimeSeriesData[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      series.push({
        date: `${month}-${day}`,
        cost: Math.round(100 + Math.random() * 80 + Math.sin(i / 5) * 30),
      });
    }

    setData({
      timeSeries: series,
      costByTask: [
        { task: 'Chat', cost: 1850 },
        { task: 'Summarization', cost: 980 },
        { task: 'Code Gen', cost: 750 },
        { task: 'Translation', cost: 540 },
      ],
      expensiveRequests: [
        {
          id: 'req_8x9y',
          cost: 12.5,
          model: 'gpt-4o',
          promptSize: 15420,
          date: 'Oct 9, 14:23',
        },
        {
          id: 'req_7w3v',
          cost: 10.8,
          model: 'claude-3',
          promptSize: 12890,
          date: 'Oct 9, 13:15',
        },
        {
          id: 'req_6u2t',
          cost: 9.2,
          model: 'gpt-4o',
          promptSize: 11230,
          date: 'Oct 9, 11:42',
        },
        {
          id: 'req_5s1r',
          cost: 8.7,
          model: 'gpt-4.1',
          promptSize: 9870,
          date: 'Oct 9, 10:18',
        },
        {
          id: 'req_4p0q',
          cost: 7.3,
          model: 'claude-3',
          promptSize: 8540,
          date: 'Oct 8, 16:55',
        },
      ],
    });
  }, []);

  return data;
}

export function useMockPerformance() {
  const [data, setData] = useState({
    latencyBy: [] as LatencyData[],
    latencyHistogram: [] as { bucket: string; count: number }[],
    errors: [] as ErrorData[],
    errorsTable: [] as ErrorTableItem[],
  });

  useEffect(() => {
    const errorsSeries: ErrorData[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      errorsSeries.push({
        date: `${month}-${day}`,
        errors: Math.floor(Math.random() * 15 + 5),
      });
    }

    setData({
      latencyBy: [
        { key: 'OpenAI / gpt-4o', value: 450 },
        { key: 'Anthropic / claude-3', value: 320 },
        { key: 'Azure / gpt-4.1', value: 520 },
        { key: 'Local / llama-3', value: 210 },
      ],
      latencyHistogram: [
        { bucket: '<200ms', count: 420000 },
        { bucket: '200-400ms', count: 58000 },
        { bucket: '400-800ms', count: 22000 },
        { bucket: '>800ms', count: 8000 },
      ],
      errors: errorsSeries,
      errorsTable: [
        {
          date: '2025-10-09T12:24:11Z',
          model: 'gpt-4o',
          reason: '503 Service Unavailable',
          requestId: 'req_8xy1',
        },
        {
          date: '2025-10-09T08:16:42Z',
          model: 'claude-3',
          reason: 'Timeout (30s)',
          requestId: 'req_7wv2',
        },
        {
          date: '2025-10-08T18:45:23Z',
          model: 'gpt-4.1',
          reason: 'Rate limit exceeded',
          requestId: 'req_6ut3',
        },
        {
          date: '2025-10-08T14:32:11Z',
          model: 'claude-3',
          reason: 'Invalid API key',
          requestId: 'req_5sr4',
        },
        {
          date: '2025-10-08T09:18:55Z',
          model: 'gpt-4o',
          reason: 'Context length exceeded',
          requestId: 'req_4pq5',
        },
      ],
    });
  }, []);

  return data;
}
