import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Hidden page: reachable by direct URL only, never linked or indexed.
export const metadata: Metadata = {
  title: 'Find a film',
  robots: { index: false, follow: false },
};

export default function FindFilmLayout({ children }: { children: ReactNode }) {
  return children;
}
