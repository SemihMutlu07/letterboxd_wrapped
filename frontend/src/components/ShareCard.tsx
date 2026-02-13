import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Heart, User } from "lucide-react";
import { getTmdbImageUrl } from "@/lib/analytics";

// ==================== Types ====================
export type ShareCardProps = {
  onScreenCrush: { name: string; headshotUrl: string; count: number };
  favoriteDirector: { name: string; headshotUrl: string; count: number };
  watchedFilms: number;
  spentDays: number;
  timePercent: number;
  cinemaScale: number;
  personaLabel: string;
  minutesAverage: number;
  mostCommonRating: number;
  peakDecade: string;
  peakDecadeCount: number;
  className?: string;
  orientation?: "horizontal" | "vertical";
};

// ==================== UI helpers ====================
const avatarBox =
  "relative w-[140px] h-[220px] min-w-[120px] min-h-[120px] rounded-2xl overflow-hidden isolate shrink-0";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const Kicker: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  className,
  children,
}) => (
  <div className={cx("uppercase tracking-[.16em] opacity-80 font-semibold text-[11px]", className)}>
    {children}
  </div>
);

const tileBase =
  "rounded-2xl shadow-lg backdrop-blur-sm relative overflow-hidden before:absolute before:inset-0 before:rounded-2xl before:ring-1 before:ring-white/10";

const TONES = {
  slate: "bg-slate-800/60 border border-slate-700/60",
  indigo: "bg-gradient-to-br from-blue-500/30 to-blue-700/25 border border-blue-500/35",
  pink: "bg-gradient-to-r from-pink-500/28 via-rose-500/24 to-rose-600/24 border border-pink-500/40",
  orange: "bg-orange-500/14 border border-orange-500/25",
  cyan: "bg-cyan-500/14 border border-cyan-500/25",
  purple: "bg-purple-500/14 border border-purple-500/25",
  yellow: "bg-yellow-500/14 border border-yellow-500/25",
};

// ==================== Component ====================
const ShareCard = React.forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  {
    onScreenCrush,
    favoriteDirector,
    watchedFilms,
    spentDays,
    timePercent,
    cinemaScale,
    // personaLabel, // Unused - tier names removed
    minutesAverage,
    mostCommonRating,
    peakDecade,
    peakDecadeCount,
    className = "",
    orientation = "horizontal",
  },
  ref
) {
  const isVertical = orientation === "vertical";

  // -------------------- Local state --------------------
  const [crushBroken, setCrushBroken] = useState(false);
  const [directorBroken, setDirectorBroken] = useState(false);

  // -------------------- Utilities --------------------
  const normalizeTmdb = (u?: string) => {
    if (!u) return undefined;
    if (u.startsWith("http")) return u;
    if (u.startsWith("/")) return getTmdbImageUrl(u);
    return u;
  };

  // -------------------- Derived URLs --------------------
  const crushUrl = useMemo(
    () => normalizeTmdb(onScreenCrush.headshotUrl),
    [onScreenCrush.headshotUrl]
  );

  const directorUrl = useMemo(() => {
    const normalized = normalizeTmdb(favoriteDirector.headshotUrl);
    return normalized;
  }, [favoriteDirector.headshotUrl]);

  /* ===================== VERTICAL (630×1200) ===================== */
  if (isVertical) {
    return (
      <div
        ref={ref}
        id="wrapped-export-root"
        className={cx(
          "w-[630px] h-[1200px] bg-slate-900 text-white rounded-3xl p-12 grid grid-rows-[auto_1fr_auto] gap-7 font-sans",
          className
        )}
        style={{
          fontFamily:
            "Avenir Next, Manrope, Segoe UI, system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div className="grid place-content-center -mb-2">
          <div className="text-[20px] font-bold opacity-90">Your Letterboxd Wrapped</div>
        </div>

        {/* MAIN STACK */}
        <div className="grid gap-6">
          {/* 1) PEOPLE — Crush */}
          <div
            className={cx(
              tileBase,
              TONES.pink,
              "grid grid-cols-[140px_1fr] items-center p-6"
            )}
          >
            <div className="col-span-1">
              <div className={avatarBox}>
                {crushUrl && !crushBroken ? (
                  <Image
                    src={crushUrl}
                    alt={onScreenCrush.name || "On-screen crush"}
                    fill
                    className="object-cover object-center"
                    priority
                    crossOrigin="anonymous"
                    onError={() => setCrushBroken(true)}
                    sizes="120px"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-white/70">
                    <Heart className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-black/15 to-transparent" />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-white/15 rounded-2xl" />
              </div>
            </div>

            <div className="col-span-1 pl-6 pr-2 flex flex-col justify-center">
              <div className="uppercase tracking-[.18em] opacity-80 font-semibold text-[15px]">
                On-Screen Crush
              </div>
              <div className="mt-1 text-[34px] font-extrabold leading-tight line-clamp-1">
                {onScreenCrush.name || "Unknown"}
              </div>
              <div className="mt-2 text-[24px] leading-snug">
                You spent <span className="font-extrabold tabular-nums">{onScreenCrush.count}</span> movies together
              </div>
            </div>
          </div>

          {/* 2) PEOPLE — Favorite Director */}
          <div
            className={cx(
              tileBase,
              TONES.cyan,
              "grid grid-cols-[140px_1fr] items-center p-6"
            )}
          >
            <div className="col-span-1">
              <div className={avatarBox}>
                {directorUrl && !directorBroken ? (
                  <Image
                    src={directorUrl}
                    alt={favoriteDirector.name || "Favorite director"}
                    fill
                    className="object-cover object-center"
                    priority
                    crossOrigin="anonymous"
                    onError={() => setDirectorBroken(true)}
                    sizes="120px"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-white/70">
                    <User className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-black/15 to-transparent" />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-white/15 rounded-2xl" />
              </div>
            </div>

            <div className="col-span-1 pl-6 pr-2 flex flex-col justify-center">
              <div className="uppercase tracking-[.18em] opacity-80 font-semibold text-[15px]">
                Favorite Director
              </div>
              <div className="mt-1 text-[34px] font-extrabold leading-tight line-clamp-1 text-white">
                {favoriteDirector.name || "Unknown"}
              </div>
              <div className="mt-2 text-[24px] leading-snug">
                You watched <span className="font-extrabold tabular-nums">{favoriteDirector.count}</span> movies
              </div>
            </div>
          </div>

          {/* 3) BIG STATS — You Watched / You Spent */}
          
          {/* You Watched / You Spent grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* You Watched */}
            <div
              className={cx(
                tileBase,
                TONES.indigo,
                "grid place-content-center text-center p-6 min-h-[150px]"
              )}
            >
              <div className="uppercase tracking-[.14em] opacity-90 font-bold text-[18px]">
                YOU WATCHED
              </div>
              <div className="mt-1 text-[56px] font-black tabular-nums leading-none">
                {watchedFilms.toLocaleString()}
              </div>
              <div className="mt-0.5 text-[20px] opacity-90 uppercase tracking-wider">
                Films
              </div>
            </div>

            {/* You Spent */}
            <div
              className={cx(
                tileBase,
                TONES.pink,
                "grid place-content-center text-center p-6 min-h-[150px]"
              )}
            >
              <div className="uppercase tracking-[.14em] opacity-90 font-bold text-[18px]">
                YOU SPENT
              </div>
              <div className="mt-1 text-[56px] font-black tabular-nums leading-none">
                {spentDays.toLocaleString()}
              </div>
              <div className="mt-0.5 text-[20px] opacity-90 uppercase tracking-wider">
                Days
              </div>
            </div>
          </div>

          {/* 4) SMALL STATS — 3 cards */}
          <div className="grid grid-cols-3 gap-6">
            {/* Most Common Rating */}
            <div
              className={cx(
                tileBase,
                TONES.yellow,
                "flex flex-col items-center justify-center text-center p-4 min-h-[140px] gap-1"
              )}
            >
              <div className="uppercase tracking-[.10em] opacity-80 font-semibold text-[12px] whitespace-nowrap">
                Most Common Rating
              </div>
              <div className="flex items-center justify-center gap-0.5">
                <span className="text-[32px] font-extrabold tabular-nums text-yellow-400 leading-none">{mostCommonRating}</span>
                <span className="text-[28px] text-yellow-300 leading-none mt-1">★</span>
              </div>
            </div>

            {/* Cinema Scale */}
            <div
              className={cx(
                tileBase,
                TONES.cyan,
                "flex flex-col items-center justify-center text-center p-4 min-h-[140px] gap-1"
              )}
            >
              <div className="uppercase tracking-[.10em] opacity-80 font-semibold text-[12px] whitespace-nowrap">
                Your Cinema Scale
              </div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-[32px] font-extrabold tabular-nums text-cyan-400 leading-none">
                  {cinemaScale.toFixed(1)}
                </span>
                <span className="text-[10px] opacity-80">/100</span>
              </div>
            </div>

            {/* Minutes Average */}
            <div
              className={cx(
                tileBase,
                TONES.indigo,
                "flex flex-col items-center justify-center text-center p-4 min-h-[140px] gap-1"
              )}
            >
              <div className="uppercase tracking-[.10em] opacity-80 font-semibold text-[12px] whitespace-nowrap">
                Minutes Average
              </div>
              <div className="flex items-baseline justify-center">
                <span className="text-[32px] font-extrabold tabular-nums text-blue-300 leading-none">{minutesAverage}</span>
              </div>
            </div>
          </div>

          {/* 5) WIDE STATS — Time% + Peak decade */}
          <div className="grid grid-cols-2 gap-6">
            {/* Time percent */}
            <div
              className={cx(
                tileBase,
                TONES.orange,
                "flex flex-col items-center justify-center text-center p-6 min-h-[160px]"
              )}
            >
              <div className="flex items-baseline justify-center">
                <span className="text-[38px] font-extrabold tabular-nums text-orange-500 leading-none">{timePercent}</span>
                <span className="text-[22px] font-extrabold text-orange-500 leading-none ml-1">%</span>
              </div>
              <div className="mt-1 text-[14px] opacity-80 tracking-wider">
                OF YOUR TIME SPENT WATCHING FILMS
              </div>
            </div>

            {/* Peak Decade */}
            <div
              className={cx(
                tileBase,
                TONES.purple,
                "flex flex-col items-center justify-center text-center p-6 min-h-[160px]"
              )}
            >
              <div className="text-[42px] font-black leading-none text-purple-300 whitespace-nowrap">{peakDecade}</div>
              <div className="mt-2 text-[16px] opacity-90">
                {peakDecadeCount.toLocaleString()} FILMS • YOUR PEAK DECADE
              </div>
            </div>
          </div>
        </div>

        {/* Footer spacer */}
        <div className="h-8"></div>
      </div>
    );
  }

  /* ===================== HORIZONTAL (1200×630) ===================== */
  return (
    <div
      ref={ref}
      id="wrapped-export-root"
      className={cx(
        "w-[1200px] h-[630px] bg-slate-900 text-white rounded-3xl p-8 grid grid-cols-12 gap-6 font-sans",
        className
      )}
      style={{
        fontFamily:
          "Avenir Next, Manrope, Segoe UI, system-ui, sans-serif",
      }}
    >
      {/* LEFT column */}
      <div className="col-span-7 grid grid-rows-2 gap-5 auto-rows-fr">
        {/* Crush */}
        <div
          className={cx(
            tileBase,
            TONES.pink,
            "grid grid-cols-[180px_1fr] items-stretch min-h-[0]"
          )}
        >
          <div className="p-4">
            <div className="relative w-full h-full rounded-xl overflow-hidden">
              {crushUrl && !crushBroken ? (
                <Image
                  src={crushUrl}
                  alt={onScreenCrush.name || "On-screen crush"}
                  fill
                  className="object-cover object-center"
                  priority
                  crossOrigin="anonymous"
                  onError={() => setCrushBroken(true)}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/70">
                  <Heart className="w-16 h-16" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/20 to-transparent" />
            </div>
          </div>

          <div className="p-5 pr-6 flex flex-col justify-center">
            <Kicker className="text-pink-100/90">On-Screen Crush</Kicker>
            <div className="mt-1 text-[34px] font-extrabold leading-tight line-clamp-1">
              {onScreenCrush.name || "Unknown"}
            </div>
            <div className="mt-1 text-[21px] leading-snug">
              You spent <span className="font-extrabold tabular-nums">{onScreenCrush.count}</span> movies together
            </div>
          </div>
        </div>

        {/* Favorite Director */}
        <div
          className={cx(
            tileBase,
            TONES.cyan,
            "grid grid-cols-[180px_1fr] items-stretch min-h-[0]"
          )}
        >
          <div className="p-4">
            <div className="relative w-full h-full rounded-xl overflow-hidden">
              {directorUrl && !directorBroken ? (
                <Image
                  src={directorUrl}
                  alt={favoriteDirector.name || "Favorite director"}
                  fill
                  className="object-cover object-center"
                  priority
                  crossOrigin="anonymous"
                  onError={() => setDirectorBroken(true)}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/70">
                  <User className="w-16 h-16" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/20 to-transparent" />
            </div>
          </div>

          <div className="p-5 pr-6 flex flex-col justify-center">
            <Kicker className="text-cyan-100/90">Favorite Director</Kicker>
            <div className="mt-1 text-[34px] font-extrabold leading-tight line-clamp-1 text-white">
              {favoriteDirector.name || "Unknown"}
            </div>
            <div className="mt-1 text-[21px] leading-snug">
              You watched <span className="font-extrabold tabular-nums">{favoriteDirector.count}</span> movies
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT column */}
      <div className="col-span-5 grid grid-rows-3 gap-5 auto-rows-fr">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-5 auto-rows-fr">
          <div className={cx(tileBase, TONES.indigo, "grid place-content-center text-center p-4")}>
            <Kicker>YOU WATCHED</Kicker>
            <div className="mt-1 text-[54px] font-black tabular-nums leading-none">
              {watchedFilms.toLocaleString()}
            </div>
            <div className="mt-1 text-sm opacity-85 uppercase tracking-[.12em]">Films</div>
          </div>
          <div className={cx(tileBase, TONES.pink, "grid place-content-center text-center p-4")}>
            <Kicker>YOU SPENT</Kicker>
            <div className="mt-1 text-[54px] font-black tabular-nums leading-none">
              {spentDays.toLocaleString()}
            </div>
            <div className="mt-1 text-sm opacity-90 uppercase tracking-[.12em]">Days</div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-3 gap-5 auto-rows-fr">
          <div className={cx(tileBase, TONES.yellow, "grid place-content-center text-center p-3")}>
            <Kicker>MOST COMMON RATING</Kicker>
            <div className="mt-1 text-[28px] font-extrabold tabular-nums text-yellow-400 leading-none">
              {mostCommonRating}★
            </div>
          </div>
          <div className={cx(tileBase, TONES.cyan, "grid place-content-center text-center p-3")}>
            <Kicker>YOUR CINEMA SCALE</Kicker>
            <div className="mt-1 text-[26px] font-extrabold tabular-nums text-cyan-400 whitespace-nowrap leading-none">
              {cinemaScale.toFixed(1)}/100
            </div>
          </div>
          <div className={cx(tileBase, TONES.indigo, "grid place-content-center text-center p-3")}>
            <Kicker>MINUTES AVERAGE</Kicker>
            <div className="mt-1 text-[32px] font-extrabold tabular-nums text-blue-300 leading-none">
              {minutesAverage}
            </div>
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-2 gap-5 auto-rows-fr">
          <div className={cx(tileBase, TONES.orange, "grid place-content-center text-center p-4")}>
            <div className="text-[48px] font-extrabold tabular-nums text-orange-500 leading-none">
              {timePercent}%
            </div>
            <div className="mt-1 text-[11px] opacity-80 tracking-[.15em]">
              TIME SPENT WATCHING FILMS
            </div>
          </div>
          <div className={cx(tileBase, TONES.purple, "grid place-content-center text-center p-4")}>
            <div className="text-[52px] font-black leading-none text-purple-300">
              {peakDecade}
            </div>
            <div className="mt-1 text-[11px] opacity-90 tracking-[.12em]">
              {peakDecadeCount.toLocaleString()} FILMS IN YOUR PEAK DECADE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
