import type { Metadata } from 'next';

// Personal analysis results — user-specific data. Must never be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
