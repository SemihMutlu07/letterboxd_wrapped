'use client';

import { useEffect, useState } from 'react';

import {
  getLatestAnalysisRunByUsername,
  getRecentAnalysisRuns,
  getDetailsFromSummary,
  type CachedAnalysisRun,
  type CachedRunPreview,
} from '@/lib/supabase/analysis_runs';
import { resultPath } from '@/lib/routes';
import { getLocalFixtureByUsername, getLocalFixturePreviews } from '@/lib/experiment-fixtures';

/**
 * Dev-only harness: load a cached analysis run from Supabase into
 * sessionStorage and open /results — reproduces a full results page with
 * zero scraping. Experiment-branch tooling for persona/roast/story work.
 */
export default function LoadRunPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [run, setRun] = useState<CachedAnalysisRun | null>(null);
  const [accounts, setAccounts] = useState<CachedRunPreview[]>([]);

  useEffect(() => {
    getRecentAnalysisRuns()
      .then(setAccounts)
      .catch((err: unknown) => {
        getLocalFixturePreviews()
          .then((fixtures) => {
            setAccounts(fixtures);
            setStatus(
              err instanceof Error
                ? `Supabase unavailable, showing local fixtures. ${err.message}`
                : 'Supabase unavailable, showing local fixtures.',
            );
          })
          .catch(() => {
            setStatus(err instanceof Error ? err.message : 'Could not list cached accounts.');
          });
      });
  }, []);

  // NODE_ENV is inlined at build time; the static prod export ships a stub.
  if (process.env.NODE_ENV === 'production') {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f0d0b] p-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
          Dev-only tool — not available in production builds.
        </p>
      </main>
    );
  }

  const handleLoad = async (name: string) => {
    const clean = name.trim().replace(/^@/, '').toLowerCase();
    if (!clean) return;
    setStatus('Fetching latest cached run…');
    setRun(null);
    try {
      const cached = await getLatestAnalysisRunByUsername(clean) ?? await getLocalFixtureByUsername(clean);
      if (!cached) {
        setStatus(`No completed run found for @${clean}. Run a real analysis once, then reuse it here.`);
        return;
      }
      const details = getDetailsFromSummary(cached.summary);
      if (!details) {
        setStatus(`Run ${cached.id} has no readable summary.details payload.`);
        return;
      }
      sessionStorage.setItem('letterboxdStats', JSON.stringify(details));
      setRun(cached);
      setStatus('Loaded into sessionStorage. Opening results…');
      window.location.href = resultPath(clean);
    } catch (err) {
      const localFixture = await getLocalFixtureByUsername(clean);
      if (localFixture) {
        const details = getDetailsFromSummary(localFixture.summary);
        if (details) {
          sessionStorage.setItem('letterboxdStats', JSON.stringify(details));
          setRun(localFixture);
          setStatus('Loaded local fixture into sessionStorage. Opening results…');
          window.location.href = resultPath(clean);
          return;
        }
      }
      setStatus(err instanceof Error ? err.message : 'Unexpected error while loading the cached run.');
    }
  };

  return (
    <main className="min-h-screen bg-[#0f0d0b] p-8 text-stone-100">
      <div className="mx-auto max-w-lg space-y-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">Dev · Load cached run</p>
          <p className="mt-2 text-sm text-stone-400">
            Seeds <code className="text-stone-300">sessionStorage[&apos;letterboxdStats&apos;]</code> from the latest
            successful Supabase <code className="text-stone-300">analysis_runs</code> row and opens /results — no scrape.
          </p>
        </header>

        {accounts.length > 0 && (
          <section>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">
              Cached test accounts ({accounts.length})
            </p>
            <div className="mt-3 grid gap-2">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => { void handleLoad(acc.username); }}
                  className="border border-stone-800 bg-[#171411] px-4 py-3 text-left transition-colors hover:border-amber-400/60"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-bold text-stone-100">@{acc.username}</span>
                    <span className="font-mono text-[11px] text-stone-500">{acc.finished_at?.slice(0, 10) ?? '—'}</span>
                  </span>
                  <span className="mt-1 block font-mono text-[11px] text-stone-400">
                    {acc.total_films ?? '—'} films · sinefil {acc.sinefil_meter ?? '—'} · ★ {acc.average_rating ?? '—'} ·{' '}
                    {acc.total_countries ?? '—'} countries · {acc.cinematic_persona ?? '—'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {status && <p className="border border-stone-800 bg-[#171411] px-4 py-3 text-sm text-stone-300">{status}</p>}

        {run && (
          <section className="border border-stone-800 bg-[#171411] p-4">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Extracted metrics</p>
            <ul className="mt-3 space-y-1 font-mono text-sm text-stone-300">
              <li>total_films: {run.total_films ?? '—'}</li>
              <li>sinefil_meter: {run.sinefil_meter ?? '—'}</li>
              <li>cinematic_persona: {run.cinematic_persona ?? '—'}</li>
              <li>average_rating: {run.average_rating ?? '—'}</li>
              <li>total_countries: {run.total_countries ?? '—'}</li>
              <li className="text-stone-500">finished_at: {run.finished_at ?? '—'}</li>
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
