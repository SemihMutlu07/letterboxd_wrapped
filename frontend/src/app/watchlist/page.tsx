'use client';

import Link from 'next/link';
import { useState } from 'react';

import DateNight from '@/components/watchlist/DateNight';
import WatchlistCompare from '@/components/watchlist/WatchlistCompare';
import { readWatchlistUsersFromLocation } from '@/lib/routes';

export default function WatchlistPage() {
  const [[first, second], setUsers] = useState<[string, string]>(() => {
    const routed = readWatchlistUsersFromLocation();
    if (routed[0] || routed[1] || typeof window === 'undefined') return routed;
    return [sessionStorage.getItem('wc_first') || '', sessionStorage.getItem('wc_second') || ''];
  });
  const userProps = {
    first,
    second,
    onFirstChange: (value: string) => setUsers((current) => [value, current[1]]),
    onSecondChange: (value: string) => setUsers((current) => [current[0], value]),
  };

  return (
    <main className="min-h-screen bg-[#0f0d0b] text-stone-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 border-b border-stone-800 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-300">Watchlist lab</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-none tracking-normal text-stone-50 sm:text-6xl">
            Compare two watchlists like a double feature program.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-400">
            Find overlap, split the misses, then pick a film from the shared shelf.
          </p>
        </header>

        <div className="space-y-8">
          <WatchlistCompare {...userProps} />
          <DateNight {...userProps} />
        </div>

        <div className="mt-12 flex justify-center border-t border-stone-800 pt-8">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center border border-stone-700 px-4 font-mono text-xs uppercase tracking-[0.14em] text-stone-300 transition hover:border-amber-300 hover:text-amber-200"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
