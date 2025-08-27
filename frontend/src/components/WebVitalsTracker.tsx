"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initWebVitals } from '@/lib/webVitals';

export default function WebVitalsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Initialize web vitals tracking for the current route
    initWebVitals(pathname);
  }, [pathname]);

  // This component doesn't render anything
  return null;
}
