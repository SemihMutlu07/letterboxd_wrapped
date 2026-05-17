'use client';
import { useEffect, useState } from 'react';
import { Film, X } from 'lucide-react';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

type Props = {
  title?: string;
  message?: string;
  detail?: string;
  onCancel?: () => void;
  mode?: 'upload' | 'scrape';
  estimatedFilms?: number;
  /** Typical total duration in seconds (hardcoded or from historical data). */
  typicalSeconds?: number;
};

export default function LoadingScreen({
  title = 'Analyzing Your Films',
  message = 'Preparing files, running analysis, and building your results.',
  detail = "Large ZIP files can take a little longer. We'll redirect automatically.",
  onCancel,
  mode = 'upload',
  estimatedFilms,
  typicalSeconds,
}: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const isScrape = mode === 'scrape';
  const defaultTypical = isScrape ? 30 : 45;
  const typical = typicalSeconds ?? defaultTypical;
  const remaining = Math.max(0, typical - elapsed);
  const pct = Math.min(100, Math.round((elapsed / typical) * 100));

  const displayTitle = isScrape ? 'Scanning Your Profile' : title;
  const displayMessage = isScrape
    ? estimatedFilms && estimatedFilms > 0
      ? `Reading ${estimatedFilms.toLocaleString()} public films from Letterboxd...`
      : 'Reading your public Letterboxd diary and film list...'
    : message;
  const displayDetail = isScrape
    ? `Elapsed ${formatElapsed(elapsed)}. Most profiles finish in under a minute.`
    : `Elapsed ${formatElapsed(elapsed)}. Most exports finish in under a minute.`;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-xl text-center rounded-3xl border border-slate-700/70 bg-slate-800/55 p-8 md:p-10 backdrop-blur-sm">
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg bg-slate-700/60 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-600 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        )}

        <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-orange-500/15 border border-orange-400/35 flex items-center justify-center">
          <Film className="h-7 w-7 text-orange-300 animate-pulse" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">{displayTitle}</h1>
        <p className="text-slate-300 mb-7">{displayMessage}</p>

        {/* Progress + remaining time */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Typical</span>
            <span className="text-slate-400">{formatElapsed(typical)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700/80 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
          {remaining > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Remaining (est.)</span>
              <span className="text-orange-300 font-medium">{formatElapsed(remaining)}</span>
            </div>
          )}
          {remaining <= 0 && (
            <div className="text-xs text-center text-orange-300 font-medium">
              Almost there... wrapping up
            </div>
          )}
        </div>

        <p className="text-sm text-slate-400">{displayDetail}</p>

        {/* Progress + remaining time */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Typical</span>
            <span className="text-slate-400">{formatElapsed(typical)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700/80 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
          {remaining > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Remaining (est.)</span>
              <span className="text-orange-300 font-medium">{formatElapsed(remaining)}</span>
            </div>
          )}
          {remaining <= 0 && (
            <div className="text-xs text-center text-orange-300 font-medium">
              Almost there... wrapping up
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500 text-center">Your raw files are never stored. With consent, only anonymous viewing stats are kept to improve the product.</p>
      </div>
    </div>
  );
}
