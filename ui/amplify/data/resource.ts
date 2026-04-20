// Type-only stub kept so existing `import type { Schema } from '.../amplify/data/resource'`
// statements keep resolving in local mode. The real Amplify backend is gone —
// all model shapes are `any`, and the data client shim at @/lib/amplify-shim/data
// returns empty payloads for every op.

export type Schema = {
  [K: string]: {
    type: any;
    createType: any;
    updateType: any;
  };
};
