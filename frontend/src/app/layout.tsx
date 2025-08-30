import type { Metadata } from "next";
import { Inter } from "next/font/google";
import PlausibleProvider from 'next-plausible';

import ErrorCaptureInitializer from '@/components/ErrorCaptureInitializer';
import PageViewTracker from '@/components/PageViewTracker';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Letterboxd Wrapped",
  description: "A comprehensive analysis of your cinematic journey.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <PlausibleProvider domain="letterboxdwrapped.com" trackOutboundLinks />
      </head>
      <body className={inter.className}>
        {children}
        <ErrorCaptureInitializer />
        {/* PostHog pageview tracker */}
        {typeof window !== 'undefined' && <PageViewTracker />}
      </body>
    </html>
  );
}
