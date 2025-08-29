import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Heart, User } from "lucide-react";

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

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const Kicker: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  className,
  children,
}) => (
  <div
    className={cx(
      "uppercase tracking-[.18em] opacity-80 font-semibold text-base",
      className
    )}
  >
    {children}
  </div>
);

const tileBase =
  "rounded-2xl shadow-lg backdrop-blur-sm relative overflow-hidden before:absolute before:inset-0 before:rounded-2xl before:ring-1 before:ring-white/10";

const TONES = {
  slate: "bg-slate-800/60 border border-slate-700/60",
  indigo:
    "bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30",
  pink:
    "bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/40",
  orange: "bg-orange-500/10 border border-orange-500/20",
  cyan: "bg-cyan-500/10 border border-cyan-500/20",
  purple: "bg-purple-500/10 border border-purple-500/20",
  yellow: "bg-yellow-500/10 border border-yellow-500/20",
};

// Image well helpers
  const aspect43 = "relative w-full aspect-[4/3] rounded-xl overflow-hidden";

const ShareCard = React.forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  {
    onScreenCrush,
    favoriteDirector,
    watchedFilms,
    spentDays,
    timePercent,
    cinemaScale,
    personaLabel,
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
  const [crushBroken, setCrushBroken] = useState(false);
  const [directorBroken, setDirectorBroken] = useState(false);

  // Normalize TMDB paths like "/a1b2c3.jpg" into full URLs so <Image/> loads
  const normalizeTmdb = (u?: string) => {
    if (!u) return undefined;
    if (u.startsWith("http")) return u;
    if (u.startsWith("/")) return `https://image.tmdb.org/t/p/w300${u}`;
    return u;
  };

  const crushUrl = useMemo(() => normalizeTmdb(onScreenCrush.headshotUrl), [onScreenCrush.headshotUrl]);
  const directorUrl = useMemo(() => normalizeTmdb(favoriteDirector.headshotUrl), [favoriteDirector.headshotUrl]);

  if (isVertical) {
    // VERTICAL LAYOUT (630 x 1200) — fonts up, image slot expects 4:3
    return (
      <div
        ref={ref}
        className={cx(
          "w-[630px] h-[1200px] bg-slate-900 text-white rounded-3xl p-8 grid grid-rows-12 gap-6 font-sans",
          className
        )}
        style={{
          fontFamily: "system-ui, -apple-system, Inter, Segoe UI, Roboto, sans-serif",
        }}
      >
        {/* Header (subtle) */}
        <div className="row-span-1 grid place-content-center">
          <div className="text-[20px] font-bold opacity-90">Your Letterboxd Wrapped</div>
        </div>

        {/* Main Stats */}
        <div className="row-span-2 grid grid-cols-2 gap-6">
          <div className={cx(tileBase, TONES.indigo, "grid place-content-center text-center p-6")}>
            <div className="uppercase tracking-[.18em] opacity-90 font-bold text-[18px]">
              YOU WATCHED
            </div>
            <div className="mt-1 text-[56px] font-black tabular-nums">
              {watchedFilms.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[18px] opacity-90 uppercase tracking-wider">
              Films
            </div>
          </div>
          <div className={cx(tileBase, TONES.pink, "grid place-content-center text-center p-6")}>
            <div className="uppercase tracking-[.18em] opacity-90 font-bold text-[18px]">
              YOU SPENT
            </div>
            <div className="mt-1 text-[56px] font-black tabular-nums">
              {spentDays.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[18px] opacity-90 uppercase tracking-wider">
              Days
            </div>
          </div>
        </div>

        {/* People cards (4:3 image well) */}
        <div className="row-span-4 grid grid-rows-2 gap-6">
          {/* On-Screen Crush */}
          <div className={cx(tileBase, TONES.pink, "grid grid-cols-3 p-5 min-h-[240px]")}>
            <div className="relative col-span-1">
              <div className={aspect43}>
                {crushUrl && !crushBroken ? (
                  <Image
                    src={crushUrl}
                    alt={onScreenCrush.name || "On-screen crush"}
                    fill
                    className="object-cover object-center"
                    priority
                    onError={()=>setCrushBroken(true)}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-white/70">
                    <Heart className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/20 to-transparent" />
              </div>
            </div>
            <div className="col-span-2 pl-5 pr-2 flex flex-col justify-center">
              <Kicker>On-Screen Crush</Kicker>
              <div className="mt-1 text-[28px] font-extrabold leading-tight line-clamp-1">
                {onScreenCrush.name || "Unknown"}
              </div>
              <div className="mt-2 text-[22px] leading-snug">
                You spent{" "}
                <span className="font-extrabold tabular-nums">{onScreenCrush.count}</span>{" "}
                movies together
              </div>
            </div>
          </div>

          {/* Favorite Director */}
          <div className={cx(tileBase, TONES.cyan, "grid grid-cols-3 p-5 min-h-[240px]")}>
            <div className="relative col-span-1">
              <div className={aspect43}>
                {directorUrl && !directorBroken ? (
                  <Image
                    src={directorUrl}
                    alt={favoriteDirector.name || "Favorite director"}
                    fill
                    className="object-cover object-center"
                    priority
                    onError={()=>setDirectorBroken(true)}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-white/70">
                    <User className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/20 to-transparent" />
              </div>
            </div>
            <div className="col-span-2 pl-5 pr-2 flex flex-col justify-center">
              <Kicker>Favorite Director</Kicker>
              <div className="mt-1 text-[28px] font-extrabold leading-tight line-clamp-1 text-white">
                {favoriteDirector.name || "Unknown"}
              </div>
              <div className="mt-2 text-[22px] leading-snug">
                You watched{" "}
                <span className="font-extrabold tabular-nums">{favoriteDirector.count}</span>{" "}
                movies
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="row-span-3 grid grid-cols-2 gap-6">
          <div className={cx(tileBase, TONES.yellow, "grid place-content-center text-center p-5")}>
            <Kicker>MOST COMMON RATING</Kicker>
            <div className="mt-2 text-[36px] font-extrabold tabular-nums text-yellow-400">
              {mostCommonRating}★
            </div>
          </div>

          <div className={cx(tileBase, TONES.cyan, "grid place-content-center text-center p-5")}>
            <Kicker>YOUR CINEMA SCALE</Kicker>
            <div className="mt-1 text-[32px] font-extrabold tabular-nums text-cyan-400">
              {cinemaScale.toFixed(1)} / 100
            </div>
            <div className="mt-1 text-[16px] text-cyan-200">{personaLabel}</div>
          </div>

          <div className={cx(tileBase, TONES.indigo, "grid place-content-center text-center p-5")}>
            <Kicker>MINUTES AVERAGE</Kicker>
            <div className="mt-1 text-[36px] font-extrabold tabular-nums text-blue-300">
              {minutesAverage}
            </div>
          </div>

          <div className={cx(tileBase, TONES.orange, "grid place-content-center text-center p-5")}>
            <div className="text-[36px] font-extrabold tabular-nums text-orange-500">
              {timePercent}%
            </div>
            <div className="mt-1 text-[14px] opacity-80 tracking-wider">
              OF YOUR TIME SPENT WATCHING FILMS
            </div>
          </div>
        </div>

        {/* Peak Decade */}
        <div className="row-span-2">
          <div className={cx(tileBase, TONES.purple, "grid place-content-center text-center p-6 h-full")}>
            <div className="text-[48px] font-black leading-none text-purple-400">
              {peakDecade}
            </div>
            <div className="mt-2 text-[18px] opacity-90">
              {peakDecadeCount.toLocaleString()} FILMS • YOUR PEAK DECADE
            </div>
          </div>
        </div>
      </div>
    );
  }

  // HORIZONTAL LAYOUT (unchanged)
  return (
    <div
      ref={ref}
      className={cx(
        "w-[1200px] h-[630px] bg-slate-900 text-white rounded-3xl p-8 grid grid-cols-12 gap-6 font-sans",
        className
      )}
      style={{
        fontFamily: "system-ui, -apple-system, Inter, Segoe UI, Roboto, sans-serif",
      }}
    >
      {/* LEFT column */}
      <div className="col-span-12 md:col-span-6 grid grid-rows-2 gap-6 auto-rows-fr">
        {/* On-Screen Crush */}
        <div className={cx(tileBase, TONES.pink, "grid grid-cols-5 items-stretch min-h-[240px] md:min-h-[280px]")}> 
          <div className="col-span-2 p-6">
            <div className="relative w-full h-full rounded-xl overflow-hidden">
              {crushUrl && !crushBroken ? (
                <Image
                  src={crushUrl}
                  alt={onScreenCrush.name || "On-screen crush"}
                  fill
                  className="object-cover object-center"
                  priority
                  onError={()=>setCrushBroken(true)}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/70">
                  <Heart className="w-16 h-16" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/20 to-transparent" />
            </div>
          </div>
          <div className="col-span-3 p-8 flex flex-col justify-center">
            <Kicker>On-Screen Crush</Kicker>
            <div className="mt-2 text-[26px] font-extrabold leading-tight line-clamp-1">
              {onScreenCrush.name || "Unknown"}
            </div>
            <div className="mt-2 text-[24px] leading-snug">
              You spent{" "}
              <span className="font-extrabold tabular-nums">{onScreenCrush.count}</span>{" "}
              movies together
            </div>
          </div>
        </div>

        {/* Favorite Director */}
        <div className={cx(tileBase, TONES.cyan, "grid grid-cols-5 items-stretch min-h-[240px] md:min-h-[280px]")}> 
          <div className="col-span-2 p-6">
            <div className="relative w-full h-full rounded-xl overflow-hidden">
              {directorUrl && !directorBroken ? (
                <Image
                  src={directorUrl}
                  alt={favoriteDirector.name || "Favorite director"}
                  fill
                  className="object-cover object-center"
                  priority
                  onError={()=>setDirectorBroken(true)}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/70">
                  <User className="w-16 h-16" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/20 to-transparent" />
            </div>
          </div>
          <div className="col-span-3 p-8 flex flex-col justify-center">
            <Kicker>Favorite Director</Kicker>
            <div className="mt-2 text-[26px] font-extrabold leading-tight line-clamp-1 text-white">
              {favoriteDirector.name || "Unknown"}
            </div>
            <div className="mt-2 text-[24px] leading-snug">
              You watched{" "}
              <span className="font-extrabold tabular-nums">{favoriteDirector.count}</span>{" "}
              movies
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT column (rows: 2 / 3 / 2) */}
      <div className="col-span-12 md:col-span-6 grid grid-rows-3 gap-6 auto-rows-fr">
        {/* Row 1: 2 cards */}
        <div className="grid grid-cols-2 gap-6 auto-rows-fr">
          <div className={cx(tileBase, TONES.indigo, "grid place-content-center text-center p-6")}>
            <Kicker>YOU WATCHED</Kicker>
            <div className="mt-1 text-[46px] font-black tabular-nums">
              {watchedFilms.toLocaleString()}
            </div>
            <div className="mt-0.5 text-lg opacity-85 uppercase tracking-wider">Films</div>
          </div>
          <div className={cx(tileBase, TONES.pink, "grid place-content-center text-center p-6")}>
            <Kicker>YOU SPENT</Kicker>
            <div className="mt-1 text-[46px] font-black tabular-nums">
              {spentDays.toLocaleString()}
            </div>
            <div className="mt-0.5 text-lg opacity-90 uppercase tracking-wider">Days</div>
          </div>
        </div>

        {/* Row 2: 3 cards */}
        <div className="grid grid-cols-3 gap-6 auto-rows-fr">
          <div className={cx(tileBase, TONES.yellow, "grid place-content-center text-center p-4")}>
            <Kicker>MOST COMMON RATING</Kicker>
            <div className="mt-2 text-[34px] font-extrabold tabular-nums text-yellow-400">
              {mostCommonRating}★
            </div>
          </div>

          <div className={cx(tileBase, TONES.cyan, "grid place-content-center text-center p-4")}>
            <Kicker>YOUR CINEMA SCALE</Kicker>
            <div className="mt-1 text-[30px] font-extrabold tabular-nums text-cyan-400">
              {cinemaScale.toFixed(1)} / 100
            </div>
            <div className="mt-1 text-base text-cyan-200">{personaLabel}</div>
          </div>

        <div className={cx(tileBase, TONES.indigo, "grid place-content-center text-center p-4")}>
            <Kicker>MINUTES AVERAGE</Kicker>
            <div className="mt-1 text-[38px] font-extrabold tabular-nums text-blue-300">
              {minutesAverage}
            </div>
          </div>
        </div>

        {/* Row 3: 2 cards */}
        <div className="grid grid-cols-2 gap-6 auto-rows-fr">
          <div className={cx(tileBase, TONES.orange, "grid place-content-center text-center p-6")}>
            <div className="text-[36px] font-extrabold tabular-nums text-orange-500">
              {timePercent}%
            </div>
            <div className="mt-1 text-base opacity-80 tracking-wider">
              OF YOUR TIME SPENT WATCHING FILMS
            </div>
          </div>

          <div className={cx(tileBase, TONES.purple, "grid place-content-center text-center p-6")}>
            <div className="text-[46px] font-black leading-none text-purple-400">
              {peakDecade}
            </div>
            <div className="mt-2 text-base opacity-90">
              {peakDecadeCount.toLocaleString()} FILMS • YOUR PEAK DECADE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
