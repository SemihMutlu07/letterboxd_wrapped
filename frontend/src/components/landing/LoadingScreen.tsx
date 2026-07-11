'use client';
import { useEffect, useState } from 'react';
import { Film, X } from 'lucide-react';
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
  "The drama çok kötü değil miydi?",
  "500 film altında izleyenlerin sonuç ekranı gelmiyormuş doğru mu?",
  "2 cümleden fazla inceleme atıyor musun ona bakıyoruz.",
  "bu loading ekranına kaç kere baktın hadi söyle",
  "Her yıl aynı filmi 5 kere izleyenler kulübü başkanı mısın?",
  "Letterboxd'a film eklemek izlemekten daha eğlenceli geliyor sana da mı öyle?",
  "Şu ana kadar hiç 1 yıldız verdiğin film oldu mu?",
  "Enter the void mu izlesem yoksa 90 günlük yaz tatil mi?",
  "Senin favori filmine arkadaşın 'eh işte' dediğinde hissettiklerin.",
  "Daha önce bir filmi sırf posteri güzel diye izledin mi?",
  "3 saatlik filmleri 'bir ara izlerim' diye listeye eklemek.",
  "IMDb puanı 8 üstü olup da sevmediğin tek film hangisi?",
  "En çok hangi film için 'abartılıyor' dedin söyle.",
  "Letterboxd'da takip ettiğin ve her yorumuna katıldığın kişi kim?",
  "Bir filmi sırf popüler diye izlemeyenlerden misin yoksa tam tersi?",
  "Hangi filmi izlerken 'acaba bitse de uyusam' dedin?",
  "Hiç film arasında geçiş yapıp birini yarım bıraktın mı?",
  "Bir filmi en fazla kaç kere izledin?",
  "İzlediğin en kötü filmi savunabilir misin?",
  "Şu listendeki filmlerin yarısını izlememiş olman çok normal.",
  "Haftada 10 film izleyenler var, sen kaçtasın?",
  "Filmi başlatıp 10 dakikada kapatanlardan mısın?",
  "Bir film için 'bunu herkese izletmeliyim' dediğin anı hatırlıyor musun?",
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
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      {/* Keep the rotating prompt in one place, above the loading container. */}
      {isScrape && (
        <div className="mb-3 max-w-xl text-center">
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

        <div className="mx-auto mb-3 h-10 w-10 rounded-xl bg-orange-500/15 border border-orange-400/35 flex items-center justify-center">
          <Film className="h-5 w-5 text-orange-300 animate-pulse" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1.5">{displayTitle}</h1>
        <p className="text-sm text-slate-300 mb-2">{displayMessage}</p>

        {/* Live discovery feed — real counts/stages streamed from the scrape */}
        {isScrape && (liveFilms > 0 || recentEvents.length > 0) && (
          <div className="mb-4 space-y-1.5">
            {liveFilms > 0 && (
              <p className="text-2xl font-black tabular-nums text-orange-300">
                {liveFilms.toLocaleString()}{' '}
                <span className="text-sm font-medium text-slate-400">films found</span>
              </p>
            )}
            <ul className="space-y-0.5 text-xs text-slate-400">
              {recentEvents.map((e, i) => (
                <li key={i} className="transition-opacity duration-500">{e.message}</li>
              ))}
            </ul>
          </div>
        )}

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

        <p className="text-xs text-slate-400">{displayDetail}</p>

        {elapsed > typical && (
          <p className="mt-3 text-xs text-amber-300/90 animate-pulse">
            Having a little trouble — bigger libraries can take a bit longer. Hang tight.
          </p>
        )}
      </div>
    </div>
  );
}
