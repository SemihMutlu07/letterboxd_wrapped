'use client';

import Link from 'next/link';
import { useState } from 'react';

import FindFilm from '@/components/findfilm/FindFilm';
import { readFindFilmUsersFromLocation } from '@/lib/routes';

const STORAGE_KEY = 'ff_users';

function initialUsers(): string[] {
  const routed = readFindFilmUsersFromLocation();
  if (routed.length >= 2) return routed;
  if (typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(stored) && stored.length >= 2) {
        return stored.slice(0, 6).map((value) => String(value));
      }
    } catch {
      // corrupted storage — fall through to the empty form
    }
  }
  return ['', ''];
}

export default function FindFilmPage() {
  const [users, setUsers] = useState<string[]>(initialUsers);

  return (
    <main className="min-h-screen bg-[#0f0d0b] text-stone-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 border-b border-stone-800 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-300">Find film</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-none tracking-normal text-stone-50 sm:text-6xl">
            One list. Films everyone wants, nobody has seen.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-400">
            Add up to six Letterboxd usernames. We cross their watchlists, drop anything anyone
            already watched, and rank what is left by popularity.
          </p>
        </header>

        <FindFilm users={users} onUsersChange={setUsers} storageKey={STORAGE_KEY} />

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
