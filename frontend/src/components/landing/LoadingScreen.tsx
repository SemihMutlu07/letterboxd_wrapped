'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PosterGuessGame, type PosterGameProps } from '@/components/landing/PosterGuessGame';

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
  /** Live scrape trace events from /api/progress — real discovery feed. */
  events?: { stage?: string; message?: string; metrics?: Record<string, unknown>; elapsed_seconds?: number }[];
  /** Pixelated poster guessing game, shown while scraping. */
  posterGame?: PosterGameProps | null;
  /** Set once the scrape/analysis is done — shows a "See Wrapped" button instead of auto-redirecting. */
  resultReady?: string | null;
};

const FUN_MESSAGES = [
  "naber?",
  "nuri bilge ceylan, hakan taşıyan, müslüm gürses",
  "The drama çok kötü değil miydi?",
  "500 film altında izleyenlerin sonuç ekranı gelmiyormuş doğru mu?",
  "2 cümleden fazla inceleme atıyor musun ona bakıyoruz.",
  "summer haklıydı",
  "bu loading ekranına kaç kere baktın hadi söyle",
  "Her yıl aynı filmi 5 kere izleyenler kulübü başkanı mısın?",
  "jaz belgesel avangarde falan",
  "Şu ana kadar hiç 1 yıldız verdiğin film oldu mu?",
  "Enter the void mu izlesem yoksa 90 günlük yaz tatil mi?",
  "gaspar noe izleyen çocuktan uzak durucan",
  "Senin favori filmine arkadaşın 'eh işte' dediğinde hissettiklerin.",
  "Daha önce bir filmi sırf posteri güzel diye izledin mi?",
  "3 saatlik filmleri 'bir ara izlerim' diye listeye eklemek.",
  "🖐️ absolute cinema 🖐️",
  "En çok hangi film için 'abartılıyor' dedin söyle.",
  "Hangi filmi izlerken 'acaba bitse de uyusam' dedin?",
  "Hiç film arasında geçiş yapıp birini yarım bıraktın mı?",
  "Bir filmi en fazla kaç kere izledin?",
  "İzlediğin en kötü filmi savunabilir misin?",
  "Şu listendeki filmlerin yarısını izlememiş olman çok normal.",
  "Haftada 10 film izleyenler var, sen kaçtasın?",
  "Filmi başlatıp 10 dakikada kapatanlardan mısın?",
  // Add more fun messages here
];

export default function LoadingScreen({
  title = 'Analyzing Your Films',
  message = 'Preparing files, running analysis, and building your results.',
  detail = "Large ZIP files can take a little longer. We'll redirect automatically.",
  onCancel,
  mode = 'upload',
  estimatedFilms,
  typicalSeconds,
  events,
  posterGame,
  resultReady,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [funMessageIndex, setFunMessageIndex] = useState(0);
  const isScrape = mode === 'scrape';

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isScrape) return;
    const interval = setInterval(() => {
      setFunMessageIndex((i) => (i + 1) % FUN_MESSAGES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isScrape]);

  const defaultTypical = isScrape ? 30 : 45;
  const typical = typicalSeconds ?? defaultTypical;
  const remaining = Math.max(0, typical - elapsed);
  const pct = Math.min(100, Math.round((elapsed / typical) * 100));

  // Live discovery feed from the real scrape trace (films climb as pages load).
  const liveFilms = (events ?? []).reduce((max, e) => {
    const f = e.metrics?.films;
    return typeof f === 'number' && f > max ? f : max;
  }, 0);
  const recentEvents = (events ?? []).filter((e) => e.message).slice(-3);

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
    <div className="min-h-dvh overflow-y-auto bg-slate-900 text-white flex flex-col items-center justify-start px-4 py-5 sm:justify-center sm:py-8">
      {/* Keep the rotating prompt in one place, above the loading container. */}
      {isScrape && (
        <div className="mt-1 mb-4 max-w-xl text-center">
          <p
            key={funMessageIndex}
            className="text-lg md:text-xl font-semibold italic leading-snug tracking-tight text-white/80 transition-opacity duration-500"
          >
            {FUN_MESSAGES[funMessageIndex]}
          </p>
        </div>
      )}

      <div className="relative w-full max-w-xl text-center rounded-3xl border border-slate-700/70 bg-slate-800/55 p-5 md:p-6 backdrop-blur-sm">
        {onCancel && (
          <button
            onClick={onCancel}
            className="group absolute right-4 top-4 flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/85 shadow-sm shadow-black/20 transition-all duration-200 hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white hover:shadow-rose-500/15 active:scale-[0.96]"
          >
            <X className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-90" />
            Cancel
          </button>
        )}

        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1.5">{displayTitle}</h1>
        {!isScrape && <p className="text-sm text-slate-300 mb-2">{displayMessage}</p>}

        {/* Live film count — one line, pops on every increase */}
        {isScrape && liveFilms > 0 && (
          <p className="mb-2 text-2xl font-black tabular-nums text-orange-300">
            <span key={liveFilms} className="inline-block animate-[score-pop_1.1s_ease-out]">
              {liveFilms.toLocaleString()}
            </span>{' '}
            <span className="text-sm font-medium text-slate-400">films found</span>
          </p>
        )}

        {/* Status — two lines: elapsed/almost-there, then trouble hint if it's taking a while */}
        <div className="mb-4 space-y-1">
          <p className="text-xs text-orange-300 font-medium">
            {remaining <= 0 ? 'Almost there... wrapping up' : displayDetail}
          </p>
          {elapsed > typical && (
            <p className="text-xs text-amber-300/90 animate-pulse">
              Having a little trouble — bigger libraries can take a bit longer. Hang tight.
            </p>
          )}
        </div>

        {isScrape && posterGame && (
          <div className="mb-5">
            <PosterGuessGame {...posterGame} />
          </div>
        )}

        {resultReady && (
          <button
            onClick={() => {
              window.location.href = resultReady;
            }}
            className="mb-5 w-full rounded-xl bg-orange-500 px-6 py-3 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-400 active:scale-[0.98]"
          >
            See Wrapped
          </button>
        )}

        {/* Progress + remaining time */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-slate-300">Typical</span>
            <span className="text-slate-200">{formatElapsed(typical)}</span>
          </div>
          <div
            className="h-2 rounded-full bg-slate-700/80 overflow-hidden"
            role="progressbar"
            aria-label="Analysis progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
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
        </div>
      </div>
    </div>
  );
}
