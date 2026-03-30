/**
 * Dynamic Amplify Configuration
 *
 * Builds Amplify config from VITE_ env vars (injected per Amplify app via Terraform).
 * Falls back to amplify_outputs.json values for local development.
 */
import outputs from '../../amplify_outputs.json';

const env = import.meta.env;

// Cognito config: use env vars (set per Amplify app) or fall back to static JSON
const userPoolId = env.VITE_COGNITO_USER_POOL_ID || outputs.auth.user_pool_id;
const clientId = env.VITE_COGNITO_CLIENT_ID || outputs.auth.user_pool_client_id;
const region = env.VITE_COGNITO_REGION || outputs.auth.aws_region;

const isProd = env.VITE_ENVIRONMENT === 'prod';
const oauthDomain = isProd
  ? 'pureai-autodestill-prod-371447241813.auth.us-east-1.amazoncognito.com'
  : 'pureai-autodestill-dev-371447241813.auth.us-east-1.amazoncognito.com';

// Build dynamic redirect URIs based on current origin
const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
const redirectUri = `${origin}/`;

// AppSync Data URLs per environment
const APPSYNC_URLS = {
  prod: 'https://erls7ww7urfyzjdnvxzakesuf4.appsync-api.us-east-1.amazonaws.com/graphql',
  dev: 'https://52o3pckjmvep5ag3fi6jnjswvi.appsync-api.us-east-1.amazonaws.com/graphql',
};

const resolvedAppSyncUrl = env.VITE_APPSYNC_URL || (isProd ? APPSYNC_URLS.prod : APPSYNC_URLS.dev);

if (env.DEV || env.VITE_ENVIRONMENT) {
  console.log('[Amplify Config] AppSync URL:', resolvedAppSyncUrl);
  if (env.VITE_APPSYNC_URL) {
    console.log('[Amplify Config] Using VITE_APPSYNC_URL override (env var)');
  }
}

export const amplifyConfig = {
  ...outputs,
  auth: {
    ...outputs.auth,
    user_pool_id: userPoolId,
    user_pool_client_id: clientId,
    aws_region: region,
    identity_pool_id: isProd
      ? 'us-east-1:3e57805a-33a1-4ba4-b558-34fee0ea9d8f'
      : 'us-east-1:e69209b2-75d8-43ad-8e08-fe3e44adc213',
    oauth: {
      ...outputs.auth.oauth,
      domain: oauthDomain,
      redirect_sign_in_uri: [redirectUri],
      redirect_sign_out_uri: [redirectUri],
    },
  },
  data: {
    ...outputs.data,
    url: resolvedAppSyncUrl,
  },
};
