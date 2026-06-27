'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureEvent, initPostHog, flushQueue } from '@/lib/posthog';

export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Enable analytics app-wide (not just the results page). Anonymous-only, no
  // consent prompt — PostHog turns on automatically whenever
  // NEXT_PUBLIC_POSTHOG_KEY is set, and is a silent no-op when it isn't.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('consent_decision') !== 'accept') {
      sessionStorage.setItem('consent_decision', 'accept');
    }
    initPostHog();
    flushQueue();
  }, []);

  useEffect(() => {
    // Will queue until PostHog finishes loading, then flush automatically
    captureEvent('$pageview', { path: pathname, search: searchParams?.toString() || '' });
  }, [pathname, searchParams]);

  return null;
}
