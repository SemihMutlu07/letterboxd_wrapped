import type { ReactNode } from 'react';
import AppHeader from '@/components/AppHeader';

export default function ResultsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
