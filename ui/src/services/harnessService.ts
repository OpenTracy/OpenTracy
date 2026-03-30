/**
 * Harness API service — connects UI to the agent system.
 */

import { useCallback } from 'react';
import { API_BASE_URL } from '../config/api';

const BASE = API_BASE_URL;

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  temperature: number;
  max_tokens: number;
  output_schema: {
    type: string;
    fields: Record<string, { type: string; description?: string }>;
  };
  system_prompt: string;
}

export interface AgentRunResult {
  agent: string;
  result: Record<string, unknown>;
}

export function useHarnessService() {
  const listAgents = useCallback(async (): Promise<AgentConfig[]> => {
    const res = await fetch(`${BASE}/v1/harness/agents`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.agents || [];
  }, []);

  const getAgent = useCallback(async (name: string): Promise<AgentConfig | null> => {
    const res = await fetch(`${BASE}/v1/harness/agents/${name}`);
    if (!res.ok) return null;
    return res.json();
  }, []);

  const runAgent = useCallback(
    async (name: string, input: string, useTools = false): Promise<AgentRunResult> => {
      const res = await fetch(`${BASE}/v1/harness/run/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, use_tools: useTools }),
      });
      if (!res.ok) throw new Error(`Agent run failed: ${res.status}`);
      return res.json();
    },
    []
  );

  return { listAgents, getAgent, runAgent };
}
