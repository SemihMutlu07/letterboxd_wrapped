import Link from 'next/link';

import DateNight from '@/components/watchlist/DateNight';
import WatchlistCompare from '@/components/watchlist/WatchlistCompare';

export default function WatchlistPage() {
  return (
    <main className="min-h-screen bg-[#0f0d0b] text-stone-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 flex flex-col gap-5 border-b border-stone-800 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-300">Watchlist lab</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black leading-none tracking-normal text-stone-50 sm:text-6xl">
              Compare two watchlists like a double feature program.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-400">
              Find overlap, split the misses, then pick a film from the shared shelf.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center border border-stone-700 px-4 font-mono text-xs uppercase tracking-[0.14em] text-stone-300 transition hover:border-amber-300 hover:text-amber-200"
          >
            Back home
          </Link>
        </header>

        <div className="space-y-8">
          <WatchlistCompare />
          <DateNight />
        </div>
      </div>
    </main>
  );
}
