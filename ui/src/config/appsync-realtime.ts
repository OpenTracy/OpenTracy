/**
 * Realtime subscription endpoints (empty in local self-hosted mode).
 *
 * Previously pointed at hosted AppSync URLs for curation/job-status events.
 * In local mode there is no cloud subscription backend; useCurationSubscription
 * bails out when these are empty strings.
 */

export const APPSYNC_REALTIME_HTTP_URL = '';
export const APPSYNC_REALTIME_WS_URL = '';
