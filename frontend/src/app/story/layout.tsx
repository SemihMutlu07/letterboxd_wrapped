import type { Metadata } from 'next';

export { default } from '@/app/LegacyRootLayout';

// Legacy non-locale route: superseded by /en/story and /tr/story.
export const metadata: Metadata = { robots: { index: false, follow: false } };

