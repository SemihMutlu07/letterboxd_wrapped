"use client";

import { useEffect } from 'react';
import { initErrorCapture } from '@/lib/errorCapture';

export default function ErrorCaptureInitializer() {
  useEffect(() => {
    // Initialize global error capture
    initErrorCapture();
  }, []);

  // This component doesn't render anything
  return null;
}
