/**
 * Per-tab "currently selected agent" pointer.
 *
 * The backend tracks a single global `active` agent in the registry, but that
 * pointer is shared across every tab/operator — so reading it server-side to
 * resolve a request leaks across agents under concurrency (tab A's read lands
 * on tab B's agent after B switches). Instead, each tab remembers the agent it
 * loaded against and sends it explicitly via the `x-agent-id` header (injected
 * in apiFetch) / an `agent_id` query param (for the SSE stream, which can't
 * carry headers). The backend's `agent_middleware` honours the header over the
 * global pointer, so every request binds to the agent this tab intends.
 *
 * This is a plain module variable (one per tab's JS context, reset on reload).
 * It's seeded from `/v1/agents`'s `active` field the first time the agent
 * switcher loads, and updated when the user switches agents.
 */
let currentAgentId: string | null = null;

export function setCurrentAgent(id: string | null): void {
  currentAgentId = id;
}

export function getCurrentAgent(): string | null {
  return currentAgentId;
}
