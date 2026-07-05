'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StoryExperience from '@/components/StoryExperience';
import { cleanRouteUsername, isValidRouteUsername } from '@/lib/routes';
import { loadExperimentAccount } from '@/lib/experiment-fixtures';

type LoadState = 'loading' | 'ready' | 'unknown';

/**
 * Story mode for the fixed experiment accounts. Accepts ?u=<username>; loads
 * the local fixture into sessionStorage (same contract as the picker) before
 * rendering the shared StoryExperience — no scraping, no desktop worker.
 */
export default function ExperimentStoryPage() {
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const username = cleanRouteUsername(params.get('u'));

      if (!isValidRouteUsername(username)) {
        setState(sessionStorage.getItem('letterboxdStats') ? 'ready' : 'unknown');
        return;
      }

      const alreadyLoaded =
        sessionStorage.getItem('username') === username && sessionStorage.getItem('letterboxdStats');
      if (alreadyLoaded) {
        setState('ready');
        return;
      }

      try {
        await loadExperimentAccount(username);
        if (!cancelled) setState('ready');
      } catch (err) {
        console.error('[experiment/story] failed to load fixture:', err);
        if (!cancelled) setState('unknown');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading') return null;

  if (state === 'unknown') {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f0d0b] p-8 text-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Unknown experiment account</p>
          <Link href="/experiment" className="mt-3 inline-block text-sm text-amber-300 hover:text-amber-200">
            Back to account picker
          </Link>
        </div>
      </main>
    );
  }

  return <StoryExperience />;
}
