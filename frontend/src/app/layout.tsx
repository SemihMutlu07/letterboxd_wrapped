import type { Metadata } from 'next';
import './globals.css';
import PageViewTracker from '@/components/PageViewTracker';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Letterboxd Wrapped - Your Year in Film',
  description: 'Discover your personal film statistics and insights from your Letterboxd data.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-white antialiased">
        <ErrorBoundary>
          {children}
          {typeof window !== 'undefined' && <PageViewTracker />}
        </ErrorBoundary>
      </body>
    </html>
  );
}
