import type { Metadata } from 'next';

export { default } from '@/app/LegacyRootLayout';

// Internal tooling route: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

