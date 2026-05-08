'use client';

import { useMemo, useState } from 'react';
import { HeartHandshake, Search } from 'lucide-react';

import { dateNight, handleApiError, type DateNightResult } from '@/lib/api';

function cleanUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export default function DateNight() {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [result, setResult] = useState<DateNightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalized = useMemo(() => [cleanUsername(first), cleanUsername(second)] as const, [first, second]);
  const canSubmit = normalized[0].length > 0 && normalized[1].length > 0 && normalized[0] !== normalized[1];

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await dateNight(normalized[0], normalized[1]));
    } catch (err) {
      setError(handleApiError(err, 'date night recommendations').message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 border border-stone-800 bg-[#15120f] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center bg-red-900/50 text-red-200">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-black text-stone-100">Date Night Engine</h2>
          <p className="text-sm text-stone-500">Taste-profile recommendations beyond watchlist overlap.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={first}
          onChange={(event) => setFirst(event.target.value)}
          placeholder="alice"
          className="border border-stone-700 bg-[#0f0d0b] px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-red-300"
        />
        <input
          value={second}
          onChange={(event) => setSecond(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSubmit();
          }}
          placeholder="bob"
          className="border border-stone-700 bg-[#0f0d0b] px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-red-300"
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || loading}
          className="inline-flex h-[46px] items-center justify-center gap-2 bg-red-200 px-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-950 transition hover:bg-red-100 disabled:bg-stone-800 disabled:text-stone-500"
        >
          <Search className="h-4 w-4" />
          {loading ? 'Profiling' : 'Find films'}
        </button>
      </div>

      {error && <p className="border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p>}

      {result && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="border border-stone-800 bg-[#201b16] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Genres</p>
              <p className="mt-2 text-sm text-stone-100">{result.mutual_profile.top_genres.join(', ') || 'Mixed'}</p>
            </div>
            <div className="border border-stone-800 bg-[#201b16] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Directors</p>
              <p className="mt-2 text-sm text-stone-100">{result.mutual_profile.top_directors.join(', ') || 'No shared auteur yet'}</p>
            </div>
            <div className="border border-stone-800 bg-[#201b16] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Era</p>
              <p className="mt-2 text-sm text-stone-100">{result.mutual_profile.era_overlap}</p>
            </div>
          </div>

          {result.recommendations.length === 0 ? (
            <p className="border border-stone-800 bg-[#201b16] p-4 text-sm text-stone-400">No shared recommendations found. Try different usernames.</p>
          ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {result.recommendations.map((film) => (
              <article key={`${film.title}-${film.year}`} className="border border-stone-800 bg-[#201b16] p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-black text-stone-100">{film.title}</h3>
                  <span className="font-mono text-xs text-stone-500">{film.year}</span>
                </div>
                <p className="mt-2 text-sm text-stone-400">{film.reason}</p>
              </article>
            ))}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
