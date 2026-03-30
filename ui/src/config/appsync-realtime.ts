/**
 * AppSync Realtime Configuration
 *
 * Separate from the Amplify Data AppSync — this is the custom realtime API
 * for job status, training metrics, and curation events.
 */

const environment = import.meta.env.VITE_ENVIRONMENT || 'dev';
const isProd = environment === 'prod' && !import.meta.env.DEV;

const REALTIME_URLS = {
  dev: {
    http: 'https://jw7yje32d5g3rozu3me36acjba.appsync-api.us-east-1.amazonaws.com/graphql',
    ws: 'wss://jw7yje32d5g3rozu3me36acjba.appsync-realtime-api.us-east-1.amazonaws.com/graphql',
  },
  prod: {
    http: 'https://xpvrgacoq5grpj3jcqafnq4qzq.appsync-api.us-east-1.amazonaws.com/graphql',
    ws: 'wss://xpvrgacoq5grpj3jcqafnq4qzq.appsync-realtime-api.us-east-1.amazonaws.com/graphql',
  },
} as const;

const urls = isProd ? REALTIME_URLS.prod : REALTIME_URLS.dev;

export const APPSYNC_REALTIME_HTTP_URL = urls.http;
export const APPSYNC_REALTIME_WS_URL = urls.ws;
