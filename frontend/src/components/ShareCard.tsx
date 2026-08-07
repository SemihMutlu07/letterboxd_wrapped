import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Heart, User, Clock, Star, Calendar, Film } from "lucide-react";
import { getTmdbImageUrl } from "@/lib/analytics";
import type { ShareFilmStat, ShareReviewWordStat, ShareMilestoneFilm } from "@/components/share/types";
import { MilestonesRow, Wordmark } from "@/components/share/variants/shared/SchemaBlocks";
import { useI18n } from '@/i18n/I18nProvider';

// ==================== Types ====================
export type ShareCardProps = {
  onScreenCrush: { name: string; headshotUrl: string; count: number };
  favoriteDirector: { name: string; headshotUrl: string; count: number };
  watchedFilms: number;
  spentDays: number;
  spentHours: number;
  timePercent: number;
  cinemaScale: number;
  personaLabel: string;
  minutesAverage: number;
  mostCommonRating: number;
  peakDecade: string;
  peakDecadeCount: number;
  topFilms?: ShareFilmStat[];
  topReviewWords?: ShareReviewWordStat[];
  milestones?: ShareMilestoneFilm[];
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

const TimeCallout: React.FC<{ hours: number; percent: number; compact?: boolean }> = ({
  hours,
  percent,
  compact = false,
}) => (
  <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/35 px-6 py-5">
    <div className="absolute right-0 top-0 h-24 w-24 translate-x-1/3 -translate-y-1/3 rounded-full bg-green-400/10 blur-2xl" />
    <TimeCopy hours={hours} percent={percent} compact={compact} />
  </div>
);

const TimeCopy: React.FC<{ hours: number; percent: number; compact: boolean }> = ({ hours, percent, compact }) => {
  const { formatNumber, t } = useI18n();
  return <>
    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">{t('share.card.timeOnScreen')}</p>
    <div className="mt-2 flex items-end gap-3">
      <GiantNumber className={compact ? "text-[54px]" : "text-[72px]"}>
        {formatNumber(Math.max(0, Math.round(hours)))}
      </GiantNumber>
      <span className="pb-2 text-2xl font-black text-neutral-300">{t('share.card.hours')}</span>
    </div>
    <p className="mt-2 text-sm font-bold text-green-300">{t('share.card.yearToFilm').replace('{percent}', String(Math.max(0, percent)))}</p>
  </>;
};

const PersonCard: React.FC<{
  label: string;
  name: string;
  count: number;
  countLabel: string;
  imageUrl?: string;
  fallback: React.ReactNode;
  gradient: string;
}> = ({ label, name, count, countLabel, imageUrl, fallback, gradient }) => {
  const { t } = useI18n();
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
          <p className="mt-1.5 text-[22px] font-black leading-tight text-white truncate">{name || t('share.card.unknown')}</p>
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
    spentHours,
    timePercent,
    cinemaScale,
    minutesAverage,
    mostCommonRating,
    peakDecade,
    peakDecadeCount,
    topReviewWords,
    milestones,
    username,
    className = "",
    orientation = "horizontal",
  },
  ref
) {
  const { formatNumber, t } = useI18n();
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
          className="absolute top-0 right-0 w-[675px] h-[675px] rounded-full opacity-[0.12] blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${ACCENT_START}, transparent)` }}
        />
        <div
          className="absolute bottom-0 left-0 w-[675px] h-[675px] rounded-full opacity-[0.10] blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${ACCENT_END}, transparent)` }}
        />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500/50 via-purple-500/50 to-green-500/50" />

        <div className="relative z-10 h-full flex flex-col px-10 py-12 gap-8">
          {/* Header */}
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-neutral-400">
              {t('share.card.yearInFilm')}
            </p>
            <h1 className="mt-3 text-[42px] font-black leading-none">
              {t('share.card.yourWrapped')}
            </h1>
          </div>

          {/* Hero stat */}
          <div>
            <SectionLabel>{t('share.card.youWatched')}</SectionLabel>
            <div className="flex items-start justify-between">
              <GiantNumber className="text-[120px] mt-1">
                {formatNumber(watchedFilms)}
              </GiantNumber>
              {username && (
                <span className="mt-4 text-[15px] font-bold text-neutral-400 tracking-wide">
                  @{username}
                </span>
              )}
            </div>
            <p className="mt-2 text-xl font-bold text-neutral-400">{t('share.card.filmsThisYear')}</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06]" />

          {/* Person cards */}
          <div className="flex flex-col gap-4">
            <PersonCard
              label={t('share.card.onScreenCrush')}
              name={onScreenCrush.name}
              count={onScreenCrush.count}
              countLabel={t('share.card.moviesTogether')}
              imageUrl={crushUrl}
              fallback={<Heart className="w-8 h-8" />}
              gradient="bg-gradient-to-br from-purple-600/[0.18] to-fuchsia-600/[0.10]"
            />
            <PersonCard
              label={t('share.card.favoriteDirector')}
              name={favoriteDirector.name}
              count={favoriteDirector.count}
              countLabel={t('share.card.moviesDirected')}
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

          <TimeCallout hours={spentHours} percent={timePercent} />

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

  /* ═══════ HORIZONTAL (1200×675 - Schema B) ═══════ */
  return (
    <div
      ref={ref}
      data-export-root="true"
      className={cx("w-[1200px] h-[675px] text-white relative overflow-hidden flex flex-col justify-between p-10", className)}
      style={{
        background: BG,
        fontFamily: "'Avenir Next', Manrope, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Background blobs */}
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.10] blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ACCENT_START}, transparent)` }}
      />
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.08] blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ACCENT_END}, transparent)` }}
      />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500/50 via-purple-500/50 to-green-500/50" />

      {/* Header line */}
      <div className="flex items-center justify-between z-10">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-neutral-400">
            Year In Film
          </p>
          <h1 className="text-3xl font-black leading-none">
            Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-purple-400 to-green-400">Letterboxd</span> Wrapped
          </h1>
        </div>
        {username && (
          <span className="text-sm font-bold text-neutral-400">@{username}</span>
        )}
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex flex-col gap-5 my-auto">
        {/* Headline + Niche Score box */}
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-5">
          <div>
            <SectionLabel>You watched</SectionLabel>
            <GiantNumber className="text-5xl mt-1">
              you watched {watchedFilms.toLocaleString()} films
            </GiantNumber>
          </div>
          <div className="flex flex-col items-end border-l border-white/10 pl-8">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Niche Score</span>
            <span className="text-4xl font-black text-white tabular-nums">
              %{Math.round(cinemaScale)}
            </span>
          </div>
        </div>

        {/* Milestones row */}
        {milestones && milestones.length > 0 && (
          <MilestonesRow
            data={{
              onScreenCrush,
              favoriteDirector,
              watchedFilms,
              spentDays,
              spentHours,
              timePercent,
              cinemaScale,
              personaLabel: "",
              minutesAverage,
              mostCommonRating,
              peakDecade,
              peakDecadeCount,
              milestones,
            }}
          />
        )}

        {/* Person cards */}
        <div className="grid grid-cols-2 gap-5">
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

      <Wordmark orientation="horizontal" />
    </div>
  );
});

export default ShareCard;
