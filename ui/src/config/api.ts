/**
 * OpenTracy — API Configuration
 *
 * Points to the local opentracy API by default.
 * Override with VITE_API_BASE_URL / VITE_ROUTER_URL / VITE_STATS_URL for remote.
 */

/** Python API (FastAPI) — analytics, traces, health */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/** Go Engine — routing, chat completions, metrics */
export const ROUTER_BASE_URL = import.meta.env.VITE_ROUTER_URL || 'http://localhost:8080';

/** Stats API — same as Python API by default */
export const STATS_API_URL = import.meta.env.VITE_STATS_URL || API_BASE_URL;

if (import.meta.env.DEV) {
  console.log('[API Config] API_BASE_URL:', API_BASE_URL);
  console.log('[API Config] ROUTER_BASE_URL:', ROUTER_BASE_URL);
  console.log('[API Config] STATS_API_URL:', STATS_API_URL);
}
