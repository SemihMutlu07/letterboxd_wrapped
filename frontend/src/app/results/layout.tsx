import type { Metadata } from 'next';

export { default } from '@/app/LegacyRootLayout';

// Legacy non-locale route: superseded by /en/results and /tr/results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

