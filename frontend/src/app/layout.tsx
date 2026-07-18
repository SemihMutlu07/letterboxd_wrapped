import type { Metadata, Viewport } from 'next';
import { Manrope, Syne } from 'next/font/google';
import './globals.css';
import PageViewTracker from '@/components/PageViewTracker';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Suspense } from 'react';

const syne = Syne({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-syne',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'Movies Wrapped - Your Year in Film',
  description: 'Discover your personal film statistics and insights from your Letterboxd data.',
};

// Colors the mobile browser chrome (address bar / status bar) to match the page
// background and lets content extend into notch safe areas.
export const viewport: Viewport = {
  themeColor: '#1e252d',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
      <link
        rel="icon"
        type="image/svg+xml"
        href="/assets/favicon-16x16-Dark.svg"
        media="(prefers-color-scheme: dark)"
      />
      <link
          rel="icon"
          type="image/svg+xml"
          href="/assets/favicon-16x16-Light.svg"
          media="(prefers-color-scheme: light)"
      />  
      </head>  
        <body className={`${manrope.variable} ${syne.variable} bg-[#1e252d] text-white antialiased`}>
          <ErrorBoundary>
            {children}
            <Suspense fallback={null}>
              <PageViewTracker />
            </Suspense>
          </ErrorBoundary>
        </body>
    </html>
  );
}
