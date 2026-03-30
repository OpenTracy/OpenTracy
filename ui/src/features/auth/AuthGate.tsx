import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { usePostHog } from 'posthog-js/react';
import type { AuthUser } from 'aws-amplify/auth';

import { LoginPage } from '@/features/auth/LoginPage';
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner';

/**
 * Authentication boundary.
 *
 * Resolves the current Amplify session on mount and renders:
 *  - loading  → FullScreenSpinner
 *  - no user  → LoginPage
 *  - user ok  → children (receives `signOut` via render prop)
 *
 * Also handles OAuth redirects (Amplify Hub) and PostHog identify/reset.
 *
 */

interface AuthGateProps {
  children: (signOut: () => Promise<void>) => ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const posthog = usePostHog();

  // Resolve current session
  const resolveCurrentUser = useCallback(async () => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout')), 8000)
      );
      setUser(await Promise.race([getCurrentUser(), timeoutPromise]));
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    resolveCurrentUser();
  }, [resolveCurrentUser]);

  // OAuth redirect listener
  useEffect(() => {
    return Hub.listen('auth', async ({ payload }) => {
      if (payload.event === 'signInWithRedirect') {
        try {
          setUser(await getCurrentUser());
        } catch (err) {
          console.error('Error resolving user after OAuth redirect:', err);
        }
      }
      if (payload.event === 'signInWithRedirect_failure') {
        console.error('OAuth sign-in failed:', payload.data);
      }
    });
  }, []);

  // PostHog identify
  useEffect(() => {
    if (user && posthog?.__loaded) {
      posthog.identify(user.userId, { username: user.username });
    }
  }, [user, posthog]);

  // Sign-out handler
  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      localStorage.clear();
      posthog?.reset();
      setUser(null);
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  }, [posthog]);

  const handleAuthSuccess = useCallback((authUser: AuthUser) => {
    setUser(authUser);
  }, []);

  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <LoginPage onAuthSuccess={handleAuthSuccess} />;

  return <>{children(handleSignOut)}</>;
}
