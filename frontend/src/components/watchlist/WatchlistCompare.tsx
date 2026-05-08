'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Clapperboard, Shuffle, Sparkles } from 'lucide-react';

import {
  compareWatchlists,
  recommendFromCompare,
  handleApiError,
  type FilmRecommendation,
  type RecommendationStrategy,
  type WatchlistCompareResult,
  type WatchlistFilm,
} from '@/lib/api';

function cleanUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

function FilmList({ title, films }: { title: string; films: WatchlistFilm[] }) {
  return (
    <section className="min-h-[280px] border border-stone-800 bg-[#171411] p-4">
      <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-amber-300">{title}</h3>
      <div className="mt-4 space-y-2">
        {films.slice(0, 10).map((film) => (
          <div key={`${film.title}-${film.year}-${film.slug}`} className="flex items-baseline justify-between gap-3 border-b border-stone-800/80 pb-2">
            <span className="text-sm text-stone-100">{film.title}</span>
            <span className="shrink-0 font-mono text-xs text-stone-500">{film.year}</span>
          </div>
        ))}
        {films.length === 0 && <p className="text-sm text-stone-500">No films in this bucket.</p>}
        {films.length > 10 && <p className="font-mono text-xs text-stone-500">+{films.length - 10} more</p>}
      </div>
    </section>
  );
}

function RecommendationStrip({ recommendation }: { recommendation: FilmRecommendation }) {
  return (
    <div className="border border-amber-400/40 bg-amber-300 p-4 text-stone-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]">Tonight's pick</p>
          <p className="mt-1 text-2xl font-black leading-tight">{recommendation.title}</p>
          <p className="mt-1 font-mono text-xs text-stone-700">{recommendation.year}</p>
        </div>
        <Sparkles className="h-6 w-6 shrink-0" />
      </div>
      <p className="mt-3 text-sm font-medium text-stone-800">{recommendation.reason}</p>
    </div>
  );
}

export default function WatchlistCompare() {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [strategy, setStrategy] = useState<RecommendationStrategy>('random');
  const [result, setResult] = useState<WatchlistCompareResult | null>(null);
  const [recommendation, setRecommendation] = useState<FilmRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = useMemo(() => [cleanUsername(first), cleanUsername(second)] as const, [first, second]);
  const canSubmit = normalized[0].length > 0 && normalized[1].length > 0 && normalized[0] !== normalized[1];

  const handleCompare = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setRecommendation(null);
    setResult(null);
    setRecommendation(null);
    try {
      const next = await compareWatchlists(normalized[0], normalized[1]);
      setResult(next);
    } catch (err) {
      setError(handleApiError(err, 'watchlist comparison').message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecommend = async () => {
    if (!canSubmit) return;
    setRecommending(true);
    setRecommendation(null);
    setError(null);
    try {
      const next = await recommendFromCompare(normalized[0], normalized[1], strategy);
      setRecommendation(next.recommendation);
    } catch (err) {
      setError(handleApiError(err, 'recommendation').message);
    } finally {
      setRecommending(false);
    }
  };

  const counts = result?.counts;
  const total = counts ? Math.max(counts.first_total + counts.second_total - counts.common, 1) : 1;
  const commonPct = counts ? Math.max(12, (counts.common / total) * 100) : 12;
  const firstPct = counts ? Math.max(12, (counts.first_only / total) * 100) : 12;
  const secondPct = counts ? Math.max(12, (counts.second_only / total) * 100) : 12;

  return (
    <div className="space-y-8">
      <section className="border border-stone-800 bg-[#201b16] p-5 shadow-2xl shadow-black/20">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">First watchlist</span>
            <input
              value={first}
              onChange={(event) => setFirst(event.target.value)}
              placeholder="alice"
              className="mt-2 w-full border border-stone-700 bg-[#0f0d0b] px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-amber-400"
            />
          </label>
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Second watchlist</span>
            <input
              value={second}
              onChange={(event) => setSecond(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleCompare();
              }}
              placeholder="bob"
              className="mt-2 w-full border border-stone-700 bg-[#0f0d0b] px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-amber-400"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCompare()}
            disabled={!canSubmit || loading}
            className="mt-6 inline-flex h-[46px] items-center justify-center gap-2 bg-amber-300 px-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-950 transition hover:bg-amber-200 disabled:bg-stone-800 disabled:text-stone-500"
          >
            <Clapperboard className="h-4 w-4" />
            {loading ? 'Reading' : 'Compare'}
          </button>
        </div>
        {error && <p className="mt-4 border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p>}
      </section>

      {result && (
        <>
          <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="border border-amber-400 bg-[#0f0d0b] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">Match score</p>
              <p className="mt-4 text-7xl font-black leading-none text-stone-50">{result.match_score}%</p>
              <p className="mt-4 text-sm text-stone-400">@{result.users[0]} <ArrowRight className="mx-1 inline h-3 w-3" /> @{result.users[1]}</p>
            </div>
            <div className="border border-stone-800 bg-[#171411] p-5">
              <div className="flex h-full items-center gap-3">
                <div style={{ flexGrow: firstPct }} className="h-24 bg-orange-500/80" title="First only" />
                <div style={{ flexGrow: commonPct }} className="h-24 bg-amber-300" title="Watched by both" />
                <div style={{ flexGrow: secondPct }} className="h-24 bg-emerald-500/80" title="Second only" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500">
                <span>Only @{result.users[0]}: {counts?.first_only}</span>
                <span className="text-amber-300">Both: {counts?.common}</span>
                <span>Only @{result.users[1]}: {counts?.second_only}</span>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <FilmList title={`Watched by both (${result.counts.common})`} films={result.common} />
            <FilmList title={`Only @${result.users[0]} (${result.counts.first_only})`} films={result.first_only} />
            <FilmList title={`Only @${result.users[1]} (${result.counts.second_only})`} films={result.second_only} />
          </section>

          <section className="grid gap-4 border border-stone-800 bg-[#201b16] p-5 md:grid-cols-[1fr_auto]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">What should we watch?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['random', 'highest_rated', 'newest'] as RecommendationStrategy[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStrategy(item)}
                    className={`border px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] transition ${
                      strategy === item ? 'border-amber-300 bg-amber-300 text-stone-950' : 'border-stone-700 text-stone-400 hover:text-stone-100'
                    }`}
                  >
                    {item.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleRecommend()}
              disabled={recommending}
              className="inline-flex h-[46px] items-center justify-center gap-2 bg-stone-100 px-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-950 transition hover:bg-white disabled:bg-stone-800 disabled:text-stone-500"
            >
              <Shuffle className="h-4 w-4" />
              {recommending ? 'Choosing' : 'Pick one'}
            </button>
          </section>

          {recommendation && <RecommendationStrip recommendation={recommendation} />}
        </>
      )}
    </div>
  );
}
