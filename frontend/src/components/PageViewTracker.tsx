'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initPostHog, captureEvent } from '@/lib/posthog';

export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    const decision = typeof window !== 'undefined' && sessionStorage.getItem('consent_decision');
    if (decision === 'accept') {
      captureEvent('$pageview', { path: pathname, search: searchParams?.toString() || '' });
    }
  }, [pathname, searchParams]);

  return null;
}
