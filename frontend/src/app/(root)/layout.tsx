import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import RootDocument from '@/app/RootDocument';

export const metadata: Metadata = {
  metadataBase: new URL('https://movieswrapped.com'),
  title: 'Movies Wrapped - Your Year in Film from Letterboxd',
  description:
    'Movies Wrapped turns your Letterboxd watch history into a personal year-in-film dossier: film statistics, rating personality, favorite directors and actors, review analysis, and your cinema scale.',
  alternates: {
    canonical: '/',
    languages: { en: '/en', tr: '/tr' },
  },
  openGraph: {
    type: 'website',
    url: 'https://movieswrapped.com/',
    siteName: 'Movies Wrapped',
    title: 'Movies Wrapped - Your Year in Film from Letterboxd',
    description:
      'Turn your Letterboxd watch history into a personal year-in-film dossier.',
    images: [
      {
        url: '/assets/Sosyal%20Medya%20Logo%20-%20Dark.png',
        width: 1080,
        height: 1080,
        alt: 'Movies Wrapped — your year in film from Letterboxd',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Movies Wrapped - Your Year in Film from Letterboxd',
    description: 'Turn your Letterboxd watch history into a personal year-in-film dossier.',
    images: ['/assets/Sosyal%20Medya%20Logo%20-%20Dark.png'],
  },
  // Root chooser is a JS redirect — do not index this page.
  // Search engines should follow the canonical (/) and hreflang alternates.
  robots: { index: false, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#1e252d',
  viewportFit: 'cover',
};

export default function RootChooserLayout({ children }: { children: ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}

