/**
 * Real-time curation event subscription via AppSync WebSocket.
 *
 * Uses the AppSync real-time WebSocket protocol to receive curation events
 * as the curation worker scores each prompt's candidates.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { APPSYNC_REALTIME_HTTP_URL, APPSYNC_REALTIME_WS_URL } from '@/config/appsync-realtime';

export interface CurationCandidateEvent {
  candidateIndex: number;
  responsePreview: string;
  score: number;
  coherence: number | null;
  helpfulness: number | null;
  correctness: number | null;
  format: number | null;
}

export interface CurationEvent {
  tenantId: string;
  jobId: string;
  promptIndex: number;
  promptText: string;
  totalPrompts: number;
  candidates: CurationCandidateEvent[];
  selectedIndex: number;
  timestamp: string;
}

const SUBSCRIPTION_QUERY = `
  subscription OnCurationEvent($tenantId: ID!, $jobId: ID!) {
    onCurationEvent(tenantId: $tenantId, jobId: $jobId) {
      tenantId
      jobId
      promptIndex
      promptText
      totalPrompts
      candidates {
        candidateIndex
        responsePreview
        score
        coherence
        helpfulness
        correctness
        format
      }
      selectedIndex
      timestamp
    }
  }
`;

async function getAuthToken(): Promise<string> {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString() ?? '';
}

/**
 * Hook to subscribe to real-time curation events for a specific job.
 *
 * Returns the accumulated list of curation events and the latest event.
 */
export function useCurationSubscription(
  tenantId: string | undefined,
  jobId: string | undefined,
  enabled: boolean = true
) {
  const [events, setEvents] = useState<CurationEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<CurationEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      try {
        if (subscriptionIdRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'stop',
              id: subscriptionIdRef.current,
            })
          );
        }
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
      subscriptionIdRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled || !tenantId || !jobId) {
      cleanup();
      return;
    }

    let cancelled = false;

    async function connect() {
      try {
        const token = await getAuthToken();
        if (cancelled || !token) return;

        // AppSync requires base64-encoded header in the connection URL
        const header = btoa(
          JSON.stringify({
            host: new URL(APPSYNC_REALTIME_HTTP_URL).host,
            Authorization: token,
          })
        );
        const payload = btoa(JSON.stringify({}));
        const wsUrl = `${APPSYNC_REALTIME_WS_URL}?header=${encodeURIComponent(header)}&payload=${encodeURIComponent(payload)}`;

        const ws = new WebSocket(wsUrl, ['graphql-ws']);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'connection_init' }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'connection_ack': {
              // Connection established — send subscription
              const subId = crypto.randomUUID();
              subscriptionIdRef.current = subId;

              ws.send(
                JSON.stringify({
                  id: subId,
                  type: 'start',
                  payload: {
                    data: JSON.stringify({
                      query: SUBSCRIPTION_QUERY,
                      variables: { tenantId, jobId },
                    }),
                    extensions: {
                      authorization: {
                        Authorization: token,
                        host: new URL(APPSYNC_REALTIME_HTTP_URL).host,
                      },
                    },
                  },
                })
              );
              setConnected(true);
              break;
            }

            case 'data': {
              const curationEvent = msg.payload?.data?.onCurationEvent as CurationEvent | undefined;
              if (curationEvent) {
                setLatestEvent(curationEvent);
                setEvents((prev) => [...prev, curationEvent]);
              }
              break;
            }

            case 'ka':
              // Keep-alive, ignore
              break;

            case 'error':
              console.warn('[CurationSub] Error:', msg.payload);
              break;
          }
        };

        ws.onerror = () => {
          console.warn('[CurationSub] WebSocket error');
          setConnected(false);
        };

        ws.onclose = () => {
          setConnected(false);
        };
      } catch (err) {
        console.warn('[CurationSub] Failed to connect:', err);
      }
    }

    connect();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [tenantId, jobId, enabled, cleanup]);

  // Reset events when job changes
  useEffect(() => {
    setEvents([]);
    setLatestEvent(null);
  }, [jobId]);

  return { events, latestEvent, connected };
}
