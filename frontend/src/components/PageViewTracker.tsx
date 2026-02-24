'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureEvent } from '@/lib/posthog';

export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Will queue if consent undecided, send if accepted, no-op if declined
    captureEvent('$pageview', { path: pathname, search: searchParams?.toString() || '' });
  }, [pathname, searchParams]);

  return null;
}
