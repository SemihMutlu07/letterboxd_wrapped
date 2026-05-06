import type { Metadata } from 'next';
import { Manrope, Syne } from 'next/font/google';
import './globals.css';
import PageViewTracker from '@/components/PageViewTracker';
import { ErrorBoundary } from '@/components/ErrorBoundary';
// import { Link } from 'lucide-react'; // Unused for now

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
          href="/assets/Web Header - Dark.svg"
          media="(prefers-color-scheme: dark)"
        />
      <link
          rel="icon"
          type="image/svg+xml"
          href="/assets/favicon-16x16-Light.svg"
          media="(prefers-color-scheme: light)"
      />  
      </head>  
        <body className={`${manrope.variable} ${syne.variable} bg-slate-900 text-white antialiased`}>
          <ErrorBoundary>
            {children}
            {typeof window !== 'undefined' && <PageViewTracker />}
          </ErrorBoundary>
        </body>
    </html>
  );
}
