import { useState, useEffect } from 'react';

interface DeploymentRun {
  id: string;
  name: string;
  model: string;
  instance: string;
  cpuUsage: number;
  memoryUsage: number;
  requests: number;
  uptime: string;
  status: 'active' | 'idle' | 'overloaded';
}

interface OverallMetrics {
  activeDeployments: number;
  totalDeployments: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  totalUptime: string;
}

interface UsageHistory {
  time: string;
  usage: number;
}

interface DeploymentMetric {
  name: string;
  cpu: number;
  memory: number;
}

interface RecentActivity {
  time: string;
  deployment: string;
  event: string;
  status: string;
}

export function useDeploymentRuns() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    deployments: [] as DeploymentRun[],
    overallMetrics: {} as OverallMetrics,
    cpuUsageHistory: [] as UsageHistory[],
    memoryUsageHistory: [] as UsageHistory[],
    deploymentMetrics: [] as DeploymentMetric[],
    recentActivity: [] as RecentActivity[],
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const cpuHistory: UsageHistory[] = [];
      const memoryHistory: UsageHistory[] = [];
      const now = new Date();

      for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hour = time.getHours();

        cpuHistory.push({
          time: `${hour}:00`,
          usage: Math.round(45 + Math.random() * 30 + Math.sin(i / 3) * 15),
        });

        memoryHistory.push({
          time: `${hour}:00`,
          usage: Math.round(60 + Math.random() * 20 + Math.sin(i / 4) * 10),
        });
      }

      const mockDeployments: DeploymentRun[] = [
        {
          id: 'dep-001',
          name: 'GPT-4o Production',
          model: 'gpt-4o',
          instance: 'ml.g5.2xlarge',
          cpuUsage: 65,
          memoryUsage: 72,
          requests: 1240,
          uptime: '5d 12h',
          status: 'active',
        },
        {
          id: 'dep-002',
          name: 'Claude-3 Staging',
          model: 'claude-3-sonnet',
          instance: 'ml.g5.xlarge',
          cpuUsage: 42,
          memoryUsage: 58,
          requests: 856,
          uptime: '3d 8h',
          status: 'active',
        },
        {
          id: 'dep-003',
          name: 'Llama-3 Testing',
          model: 'llama-3-70b',
          instance: 'ml.g5.4xlarge',
          cpuUsage: 88,
          memoryUsage: 91,
          requests: 2145,
          uptime: '2d 4h',
          status: 'overloaded',
        },
        {
          id: 'dep-004',
          name: 'GPT-4.1 Development',
          model: 'gpt-4.1-mini',
          instance: 'ml.g5.xlarge',
          cpuUsage: 28,
          memoryUsage: 45,
          requests: 342,
          uptime: '6d 18h',
          status: 'idle',
        },
        {
          id: 'dep-005',
          name: 'Mistral Production',
          model: 'mistral-large',
          instance: 'ml.g5.2xlarge',
          cpuUsage: 71,
          memoryUsage: 68,
          requests: 1580,
          uptime: '4d 15h',
          status: 'active',
        },
      ];

      const activeDeployments = mockDeployments.filter((d) => d.status === 'active').length;
      const avgCpu = Math.round(
        mockDeployments.reduce((sum, d) => sum + d.cpuUsage, 0) / mockDeployments.length
      );
      const avgMemory = Math.round(
        mockDeployments.reduce((sum, d) => sum + d.memoryUsage, 0) / mockDeployments.length
      );

      setData({
        deployments: mockDeployments,
        overallMetrics: {
          activeDeployments,
          totalDeployments: mockDeployments.length,
          avgCpuUsage: avgCpu,
          avgMemoryUsage: avgMemory,
          totalUptime: '32d 5h',
        },
        cpuUsageHistory: cpuHistory,
        memoryUsageHistory: memoryHistory,
        deploymentMetrics: mockDeployments.map((d) => ({
          name: d.name.split(' ')[0],
          cpu: d.cpuUsage,
          memory: d.memoryUsage,
        })),
        recentActivity: [
          {
            time: '2 min ago',
            deployment: 'GPT-4o Production',
            event: 'High CPU usage detected',
            status: '⚠️ Warning',
          },
          {
            time: '15 min ago',
            deployment: 'Claude-3 Staging',
            event: 'Deployment scaled up',
            status: '✅ Success',
          },
          {
            time: '1 hour ago',
            deployment: 'Llama-3 Testing',
            event: 'Memory threshold exceeded',
            status: '🔴 Critical',
          },
          {
            time: '2 hours ago',
            deployment: 'Mistral Production',
            event: 'Health check passed',
            status: '✅ Success',
          },
          {
            time: '3 hours ago',
            deployment: 'GPT-4.1 Development',
            event: 'Low activity detected',
            status: 'ℹ️ Info',
          },
        ],
      });

      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return { loading, ...data };
}
