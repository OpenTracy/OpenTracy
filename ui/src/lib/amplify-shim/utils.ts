// Local-only replacement for `aws-amplify/utils`.
// Only `Hub.listen` is consumed by the UI (OAuth redirect events).

type HubPayload = { event: string; data?: unknown };
type HubCallback = (msg: { payload: HubPayload }) => void;

export const Hub = {
  listen(_channel: string, _callback: HubCallback): () => void {
    return () => {};
  },
  dispatch(_channel: string, _payload: HubPayload): void {},
};
