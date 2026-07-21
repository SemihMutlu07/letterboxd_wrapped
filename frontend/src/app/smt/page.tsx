'use client';

import { useEffect, useState } from 'react';

import { loadSmtFixture } from '@/lib/smt-loader';

export default function SmtPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const seedResults = async () => {
      try {
        await loadSmtFixture();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load the local fixture.');
      }
    };

    void seedResults();
  }, []);

  const production = process.env.NODE_ENV === 'production';
  return (
    <main className="grid min-h-screen place-items-center bg-[#0f0d0b] p-8 text-stone-300">
      <div className="max-w-lg text-center font-mono text-xs uppercase tracking-[0.18em]">
        {production ? (
          <p className="text-stone-500">Dev-only tool — not available in production builds.</p>
        ) : error ? (
          <p className="normal-case tracking-normal text-red-300">{error}</p>
        ) : (
          <p>Loading Semih&apos;s fixture into the real results page…</p>
        )}
      </div>
    </main>
  );
}
