import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';

/**
 * Captures a PostHog pageview on every route change.
 * Renders nothing — purely a side-effect component.
 */
export function PostHogPageView() {
  const location = useLocation();
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog?.__loaded) {
      posthog.capture('$pageview', { $current_url: window.location.href });
    }
  }, [location, posthog]);

  return null;
}
