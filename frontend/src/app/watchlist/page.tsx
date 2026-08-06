'use client';

import Link from 'next/link';

import DateNight from '@/components/watchlist/DateNight';
import WatchlistCompare from '@/components/watchlist/WatchlistCompare';
import { useI18n } from '@/i18n/I18nProvider';
import { localizePath } from '@/i18n/routing';

export default function WatchlistPage() {
  const { locale, t } = useI18n();
  return (
    <main className="min-h-screen bg-[#0f0d0b] text-stone-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 border-b border-stone-800 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-300">{t('watchlist.page.eyebrow')}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-none tracking-normal text-stone-50 sm:text-6xl">
            {t('watchlist.page.title')}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-400">
            {t('watchlist.page.description')}
          </p>
        </header>

        <div className="space-y-8">
          <WatchlistCompare />
          <DateNight />
        </div>

        <div className="mt-12 flex justify-center border-t border-stone-800 pt-8">
          <Link
            href={localizePath('/', locale)}
            className="inline-flex h-10 items-center justify-center border border-stone-700 px-4 font-mono text-xs uppercase tracking-[0.14em] text-stone-300 transition hover:border-amber-300 hover:text-amber-200"
          >
            {t('common.backHome')}
          </Link>
        </div>
      </div>
    </main>
  );
}
