// Local-only replacement for `aws-amplify/data`.
// Returns a fake client whose model operations succeed with empty payloads,
// so hooks that do `.list()` / `.get()` / `.observeQuery().subscribe()` don't
// throw — they just render the "no data" state.

type ModelResult<T> = { data: T | null; errors: unknown[] };
type ListResult<T> = { data: T[]; errors: unknown[] };

interface SubscribeHandlers<T> {
  next: (msg: { items: T[]; isSynced: boolean }) => void;
  error?: (err: Error) => void;
}

const listOp = async <T>(): Promise<ListResult<T>> => ({ data: [], errors: [] });
const itemOp = async <T>(): Promise<ModelResult<T>> => ({ data: null, errors: [] });

function observeQuery<T>() {
  return {
    subscribe(handlers: SubscribeHandlers<T>) {
      queueMicrotask(() => handlers.next({ items: [], isSynced: true }));
      return { unsubscribe() {} };
    },
  };
}

function modelProxy<T>() {
  return {
    list: listOp<T>,
    get: itemOp<T>,
    create: itemOp<T>,
    update: itemOp<T>,
    delete: itemOp<T>,
    observeQuery: observeQuery<T>,
  };
}

function buildClient() {
  const modelsProxy: any = new Proxy(
    {},
    { get: () => modelProxy<unknown>() }
  );
  return { models: modelsProxy };
}

export function generateClient<_T = unknown>(): any {
  return buildClient();
}
