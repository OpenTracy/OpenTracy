import type { ReactNode } from 'react';

import { MetricsProvider } from '@/contexts/MetricsContext';
import { UserProvider } from '@/contexts/UserContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';

/**
 * Data-layer providers mounted only after authentication.
 *
 *  1. UserProvider      — fetches profile, tokens, tenant
 *  2. MetricsProvider   — depends on user/tenant for API calls
 *  3. WorkspaceProvider — depends on user for personal workspace
 */
export function AuthenticatedProviders({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <MetricsProvider>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </MetricsProvider>
    </UserProvider>
  );
}
