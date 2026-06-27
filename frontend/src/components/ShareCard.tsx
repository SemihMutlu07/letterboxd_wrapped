import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Heart, User, Clock, Star, Calendar, Film } from "lucide-react";
import { getTmdbImageUrl } from "@/lib/analytics";
import type { ShareFilmStat, ShareReviewWordStat } from "@/components/share/types";

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
  topFilms?: ShareFilmStat[];
  topReviewWords?: ShareReviewWordStat[];
  username?: string;
  className?: string;
  orientation?: "horizontal" | "vertical";
};

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

/* ─── Spotify Wrapped aesthetic ─── */
const BG = "#0D0D0D";
const ACCENT_START = "#8B5CF6"; // violet-500
const ACCENT_END = "#22C55E";   // green-500
const SUBTEXT = "#A3A3A3";      // neutral-400
const ELEVATION = "#18181B";    // zinc-900

const SectionLabel: React.FC<React.PropsWithChildren> = ({ children }) => (
  <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-neutral-400">
    {children}
  </p>
);

const GiantNumber: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span
    className={cx(
      "font-black leading-[0.85] tabular-nums bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-purple-400 to-green-400",
      className
    )}
  >
    {children}
  </span>
);

const PosterStrip: React.FC<{ films?: ShareFilmStat[]; size: "xl" | "lg" | "sm" }> = ({ films, size }) => {
  if (!films || films.length === 0) return null;
  const shown = films.slice(0, 4);
  const w = size === "xl" ? 128 : size === "lg" ? 72 : 56;
  const h = size === "xl" ? 192 : size === "lg" ? 108 : 84;
  return (
    <div className="flex gap-2 justify-center">
      {shown.map((f) => {
        const url = f.posterPath ? getTmdbImageUrl(f.posterPath, "w342") : null;
        return (
          <div
            key={`${f.title}-${f.year}`}
            className="relative rounded-lg overflow-hidden shrink-0 bg-white/5 border border-white/10"
            style={{ width: w, height: h }}
          >
            {url ? (
              <Image
                src={url}
                alt={f.title}
                fill
                sizes={`${w}px`}
                className="object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-[10px] font-bold px-1 text-center text-neutral-500">
                {f.title.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const formatReviewWords = (words?: ShareReviewWordStat[]) =>
  words?.slice(0, 3).map(({ word }) => word).join(" / ") || "";

const StatPill: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent?: string }> = ({
  icon,
  label,
  value,
  accent = "text-neutral-300",
}) => (
  <div className="flex items-center gap-4 bg-zinc-900/80 rounded-2xl px-5 py-4 border border-white/[0.04]">
    <div className="shrink-0 w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-neutral-400">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">{label}</p>
      <p className={cx("text-lg font-bold", accent)}>{value}</p>
    </div>
  </div>
);

const PersonCard: React.FC<{
  label: string;
  name: string;
  count: number;
  countLabel: string;
  imageUrl?: string;
  fallback: React.ReactNode;
  gradient: string;
}> = ({ label, name, count, countLabel, imageUrl, fallback, gradient }) => {
  const [broken, setBroken] = useState(false);

  return (
    <div className={cx("relative rounded-3xl overflow-hidden border border-white/[0.06] p-5", gradient)}>
      <div className="flex items-center gap-4">
        {/* Portrait 2:3 */}
        <div className="relative w-[110px] h-[165px] rounded-2xl overflow-hidden shrink-0 bg-zinc-800">
          {imageUrl && !broken ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="object-cover object-center"
              priority
              crossOrigin="anonymous"
              onError={() => setBroken(true)}
              sizes="110px"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-neutral-600">{fallback}</div>
          )}
          <div className="absolute inset-0 ring-1 ring-white/10 rounded-2xl" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-500">{label}</p>
          <p className="mt-1.5 text-[22px] font-black leading-tight text-white truncate">{name || "Unknown"}</p>
          <p className="mt-1 text-sm text-neutral-400">
            <span className="font-bold text-white">{count}</span> {countLabel}
          </p>
        </div>
      </div>
    </div>
  );
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
    minutesAverage,
    mostCommonRating,
    peakDecade,
    peakDecadeCount,
    topFilms,
    topReviewWords,
    username,
    className = "",
    orientation = "horizontal",
  },
  ref
) {
  const isVertical = orientation === "vertical";

  const crushUrl = useMemo(
    () => {
      if (!onScreenCrush.headshotUrl) return undefined;
      const url = getTmdbImageUrl(onScreenCrush.headshotUrl);
      return url === null ? undefined : url;
    },
    [onScreenCrush.headshotUrl]
  );

  const reviewWordsText = formatReviewWords(topReviewWords);
  const directorUrl = useMemo(
    () => {
      if (!favoriteDirector.headshotUrl) return undefined;
      const url = getTmdbImageUrl(favoriteDirector.headshotUrl);
      return url === null ? undefined : url;
    },
    [favoriteDirector.headshotUrl]
  );

  /* ═══════ VERTICAL (675×1200) ═══════ */
  if (isVertical) {
    return (
      <div
        ref={ref}
        data-export-root="true"
        className={cx("w-[675px] h-[1200px] text-white relative overflow-hidden", className)}
        style={{
          background: BG,
          fontFamily: "'Avenir Next', Manrope, 'Segoe UI', system-ui, sans-serif",
        }}
      >
        {/* Subtle background blobs */}
        <div
          className="absolute -top-[300px] -right-[200px] w-[700px] h-[700px] rounded-full opacity-[0.12] blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${ACCENT_START}, transparent)` }}
        />
        <div
          className="absolute -bottom-[300px] -left-[200px] w-[700px] h-[700px] rounded-full opacity-[0.10] blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${ACCENT_END}, transparent)` }}
        />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500/50 via-purple-500/50 to-green-500/50" />

        <div className="relative z-10 h-full flex flex-col px-10 py-12 gap-8">
          {/* Header */}
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-neutral-400">
              Year In Film
            </p>
            <h1 className="mt-3 text-[42px] font-black leading-none">
              Your{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-purple-400 to-green-400">
                Letterboxd
              </span>{" "}
              Wrapped
            </h1>
          </div>

          {/* Hero stat */}
          <div>
            <SectionLabel>You watched</SectionLabel>
            <div className="flex items-start justify-between">
              <GiantNumber className="text-[120px] mt-1">
                {watchedFilms.toLocaleString()}
              </GiantNumber>
              {username && (
                <span className="mt-4 text-[15px] font-bold text-neutral-400 tracking-wide">
                  @{username}
                </span>
              )}
            </div>
            <p className="mt-2 text-xl font-bold text-neutral-400">films this year</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06]" />

          {/* Person cards */}
          <div className="flex flex-col gap-4">
            <PersonCard
              label="On-Screen Crush"
              name={onScreenCrush.name}
              count={onScreenCrush.count}
              countLabel="movies together"
              imageUrl={crushUrl}
              fallback={<Heart className="w-8 h-8" />}
              gradient="bg-gradient-to-br from-purple-600/[0.18] to-fuchsia-600/[0.10]"
            />
            <PersonCard
              label="Favorite Director"
              name={favoriteDirector.name}
              count={favoriteDirector.count}
              countLabel="movies directed"
              imageUrl={directorUrl}
              fallback={<User className="w-8 h-8" />}
              gradient="bg-gradient-to-br from-emerald-600/[0.18] to-teal-600/[0.10]"
            />
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-2 gap-3">
            <StatPill
              icon={<Clock size={18} />}
              label="Days spent"
              value={`${spentDays} days`}
              accent="text-green-400"
            />
            <StatPill
              icon={<Star size={18} />}
              label="Most common rating"
              value={`${mostCommonRating} ★`}
              accent="text-yellow-400"
            />
            <StatPill
              icon={<Film size={18} />}
              label="Cinema Scale"
              value={`${cinemaScale.toFixed(1)} / 100`}
              accent="text-violet-400"
            />
            {reviewWordsText ? (
              <StatPill
                icon={<Calendar size={18} />}
                label="Review words"
                value={reviewWordsText}
                accent="text-purple-300"
              />
            ) : (
              <StatPill
                icon={<Calendar size={18} />}
                label="Peak Decade"
                value={`${peakDecade} (${peakDecadeCount})`}
                accent="text-purple-400"
              />
            )}
          </div>

          {/* Top films */}
          {topFilms && topFilms.length > 0 && (
            <div>
              <SectionLabel>Favorite films</SectionLabel>
              <div className="mt-2">
                <PosterStrip films={topFilms} size="xl" />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-600">
              movieswrapped.com
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════ HORIZONTAL (1200×630) ═══════ */
  return (
    <div
      ref={ref}
      data-export-root="true"
      className={cx("w-[1200px] h-[630px] text-white relative overflow-hidden", className)}
      style={{
        background: BG,
        fontFamily: "'Avenir Next', Manrope, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Background blobs */}
      <div
        className="absolute -top-[200px] -right-[100px] w-[500px] h-[500px] rounded-full opacity-[0.10] blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ACCENT_START}, transparent)` }}
      />
      <div
        className="absolute -bottom-[200px] -left-[100px] w-[500px] h-[500px] rounded-full opacity-[0.08] blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ACCENT_END}, transparent)` }}
      />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500/50 via-purple-500/50 to-green-500/50" />

      <div className="relative z-10 h-full grid grid-cols-12 gap-8 px-10 py-10">
        {/* LEFT (7 cols) */}
        <div className="col-span-7 flex flex-col justify-between">
          {/* Header */}
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-neutral-400">
              Year In Film
            </p>
            <h1 className="mt-2 text-[48px] font-black leading-none">
              Your{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-purple-400 to-green-400">
                Letterboxd
              </span>{" "}
              Wrapped
            </h1>
          </div>

          {/* Hero number */}
          <div>
            <SectionLabel>You watched</SectionLabel>
            <div className="flex items-start justify-between">
              <GiantNumber className="text-[110px] mt-1">
                {watchedFilms.toLocaleString()}
              </GiantNumber>
              {username && (
                <span className="mt-4 text-[14px] font-bold text-neutral-400 tracking-wide">
                  @{username}
                </span>
              )}
            </div>
            <p className="mt-1 text-lg font-bold text-neutral-400">films this year</p>
          </div>

          {/* Pills row 1 */}
          <div className="grid grid-cols-4 gap-3">
            <StatPill icon={<Clock size={16} />} label="Days" value={`${spentDays}`} accent="text-green-400" />
            <StatPill icon={<Star size={16} />} label="Rating" value={`${mostCommonRating}★`} accent="text-yellow-400" />
            <StatPill icon={<Film size={16} />} label="Scale" value={`${cinemaScale.toFixed(1)}`} accent="text-violet-400" />
            {reviewWordsText ? (
              <StatPill icon={<Calendar size={16} />} label="Review" value={reviewWordsText} accent="text-purple-300" />
            ) : (
              <StatPill icon={<Calendar size={16} />} label="Decade" value={peakDecade} accent="text-purple-400" />
            )}
          </div>

          {topFilms && topFilms.length > 0 && (
            <PosterStrip films={topFilms} size="lg" />
          )}

          {/* Footer */}
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-600">
            movieswrapped.com
          </p>
        </div>

        {/* RIGHT (5 cols) — Person cards */}
        <div className="col-span-5 flex flex-col justify-center gap-5">
          <PersonCard
            label="On-Screen Crush"
            name={onScreenCrush.name}
            count={onScreenCrush.count}
            countLabel="movies together"
            imageUrl={crushUrl}
            fallback={<Heart className="w-8 h-8" />}
            gradient="bg-gradient-to-br from-purple-600/[0.18] to-fuchsia-600/[0.10]"
          />
          <PersonCard
            label="Favorite Director"
            name={favoriteDirector.name}
            count={favoriteDirector.count}
            countLabel="movies directed"
            imageUrl={directorUrl}
            fallback={<User className="w-8 h-8" />}
            gradient="bg-gradient-to-br from-emerald-600/[0.18] to-teal-600/[0.10]"
          />
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
