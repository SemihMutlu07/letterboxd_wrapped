'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureEvent, initPostHog, flushQueue } from '@/lib/posthog';

export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('consent_decision') !== 'accept') return;
    initPostHog();
    flushQueue();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('consent_decision') !== 'accept') return;
    captureEvent('$pageview', { path: pathname, search: searchParams?.toString() || '' });
  }, [pathname, searchParams]);

  return null;
}
