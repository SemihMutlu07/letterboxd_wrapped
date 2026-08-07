import type { Metadata } from 'next';

export { default } from '@/app/LegacyRootLayout';

// Legacy non-locale route: superseded by /en/watchlist and /tr/watchlist.
export const metadata: Metadata = { robots: { index: false, follow: false } };

