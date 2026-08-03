import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import RootDocument from '@/app/RootDocument';
import { isLocale, locales, type Locale } from '@/i18n/locales';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const metadataByLocale: Record<Locale, { title: string; description: string }> = {
  en: {
    title: 'Movies Wrapped - Your Year in Film from Letterboxd',
    description: 'Movies Wrapped turns your Letterboxd watch history into a personal year-in-film dossier: film statistics, rating personality, favorite directors and actors, review analysis, and your cinema scale.',
  },
  tr: {
    title: 'Movies Wrapped - Sinemada Yılın',
    description: 'Letterboxd verilerinden kişisel film istatistiklerini ve içgörülerini keşfet.',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = metadataByLocale[locale];
  const siteUrl = 'https://movieswrapped.com';
  return {
    metadataBase: new URL(siteUrl),
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { en: '/en', tr: '/tr', 'x-default': '/' },
    },
    openGraph: {
      type: 'website',
      url: `${siteUrl}/${locale}`,
      siteName: 'Movies Wrapped',
      title: copy.title,
      description: copy.description,
      images: [{
        url: '/assets/og-image-1200x630.png',
        width: 1200,
        height: 630,
        alt: locale === 'tr' ? 'Movies Wrapped — Letterboxd ile sinemada yılın' : 'Movies Wrapped — your year in film from Letterboxd',
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.title,
      description: copy.description,
      images: ['/assets/og-image-1200x630.png'],
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#1e252d',
  viewportFit: 'cover',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <RootDocument locale={locale} showLanguageSwitcher>{children}</RootDocument>;
}
