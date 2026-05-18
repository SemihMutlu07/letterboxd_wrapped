import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Heart, User, Clock, Star, Calendar, Film } from 'lucide-react';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../types';

/**
 * Apple HIG Share Card — 4th design variant.
 *
 * Principles:
 *   - True black OLED background (#000000)
 *   - Single accent: Apple system blue (#0A84FF)
 *   - 3 font sizes only: 96px hero, 22px name, 13px caption
 *   - 8pt spacing scale: 16/24/32/48
 *   - No gradients, no glassmorphism, no decorative shadows
 *   - Surfaces: #1C1C1E with 1px #38383A border, 12px radius
 *   - SF Pro / system-ui font stack
 */

type Props = {
  data: ShareCardData;
  className?: string;
  orientation?: ShareOrientation;
};

const BG = '#000000';
const SURFACE = '#1C1C1E';
const BORDER = '#38383A';
const ACCENT = '#0A84FF';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#8E8E93';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const SectionLabel: React.FC<React.PropsWithChildren> = ({ children }) => (
  <p
    className="text-[15px] font-semibold uppercase tracking-[0.10em]"
    style={{ color: TEXT_SECONDARY }}
  >
    {children}
  </p>
);

const HeroNumber: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    className="font-black leading-[0.88] tabular-nums"
    style={{ fontSize: 96, color: TEXT_PRIMARY, letterSpacing: '-0.03em' }}
  >
    {children}
  </span>
);

const PosterStrip: React.FC<{
  films: ShareCardData['topFilms'];
  size: 'xl' | 'lg' | 'sm';
}> = ({ films, size }) => {
  if (!films || films.length === 0) return null;
  const shown = films.slice(0, 4);
  const w = size === 'xl' ? 128 : size === 'lg' ? 72 : 56;
  const h = size === 'xl' ? 192 : size === 'lg' ? 108 : 84;
  return (
    <div className="flex gap-2 justify-center">
      {shown.map((f) => {
        const url = f.posterPath ? getTmdbImageUrl(f.posterPath, 'w342') : null;
        return (
          <div
            key={`${f.title}-${f.year}`}
            className="relative rounded-lg overflow-hidden shrink-0"
            style={{ width: w, height: h, background: SURFACE, border: `1px solid ${BORDER}` }}
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
              <div
                className="absolute inset-0 grid place-items-center text-[10px] font-semibold px-1 text-center"
                style={{ color: TEXT_SECONDARY }}
              >
                {f.title.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const formatReviewWords = (words?: ShareCardData['topReviewWords']) =>
  words?.slice(0, 3).map(({ word }) => word).join(' / ') || '';

const OutlierFilmCard: React.FC<{ film?: ShareCardData['ratingOutlierFilm'] }> = ({ film }) => {
  if (!film) return null;
  const posterUrl = film.posterPath ? getTmdbImageUrl(film.posterPath, 'w342') : null;
  const sign = film.delta > 0 ? '+' : '';
  const deltaColor = film.delta > 0 ? '#34C759' : '#FF453A';
  return (
    <div
      className="flex items-center gap-4 rounded-2xl px-4 py-3"
      style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
    >
      <div
        className="relative shrink-0 rounded-lg overflow-hidden"
        style={{ width: 72, height: 108, background: '#2C2C2E' }}
      >
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={film.title}
            fill
            sizes="72px"
            className="object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-center px-1"
            style={{ color: TEXT_SECONDARY }}>
            {film.title.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[12px] font-semibold uppercase tracking-[0.10em]"
          style={{ color: TEXT_SECONDARY }}
        >
          Rating Outlier
        </p>
        <p
          className="mt-1 text-[18px] font-bold leading-tight truncate"
          style={{ color: TEXT_PRIMARY }}
        >
          {film.title}
          {film.year ? <span className="font-normal" style={{ color: TEXT_SECONDARY }}>{' '}{film.year}</span> : null}
        </p>
        <p className="mt-1 text-[12px] tabular-nums" style={{ color: TEXT_SECONDARY }}>
          You <span className="font-bold" style={{ color: TEXT_PRIMARY }}>{film.userRating}★</span>
          {'  ·  '}
          Avg <span className="font-bold" style={{ color: TEXT_PRIMARY }}>{film.avgRating.toFixed(1)}</span>
          {'  '}
          <span className="font-bold" style={{ color: deltaColor }}>{sign}{film.delta.toFixed(1)}</span>
        </p>
      </div>
    </div>
  );
};

const StatPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div
    className="flex items-center gap-3 rounded-2xl px-4 py-3"
    style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
  >
    <div
      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
      style={{ background: '#2C2C2E' }}
    >
      {icon}
    </div>
    <div>
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: TEXT_SECONDARY }}
      >
        {label}
      </p>
      <p className="text-[15px] font-bold" style={{ color: TEXT_PRIMARY }}>
        {value}
      </p>
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
}> = ({ label, name, count, countLabel, imageUrl, fallback }) => {
  const [broken, setBroken] = useState(false);

  return (
    <div
      className="flex items-center gap-4 rounded-2xl px-4 py-4"
      style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
    >
      {/* Portrait 2:3 */}
      <div
        className="relative shrink-0 rounded-xl overflow-hidden"
        style={{ width: 110, height: 165, background: '#2C2C2E' }}
      >
        {imageUrl && !broken ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover object-[50%_25%]"
            priority
            crossOrigin="anonymous"
            onError={() => setBroken(true)}
            sizes="110px"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center" style={{ color: TEXT_SECONDARY }}>
            {fallback}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: TEXT_SECONDARY }}
        >
          {label}
        </p>
        <p
          className="mt-1 text-[22px] font-bold leading-tight truncate"
          style={{ color: TEXT_PRIMARY }}
        >
          {name || 'Unknown'}
        </p>
        <p className="mt-0.5 text-[13px]" style={{ color: TEXT_SECONDARY }}>
          <span className="font-semibold" style={{ color: TEXT_PRIMARY }}>{count}</span>{' '}
          {countLabel}
        </p>
      </div>
    </div>
  );
};

const PersonSquare: React.FC<{
  label: string;
  name: string;
  count: number;
  countLabel: string;
  imageUrl?: string;
  fallback: React.ReactNode;
}> = ({ label, name, count, countLabel, imageUrl, fallback }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col aspect-[2/3]"
      style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
    >
      <div className="relative flex-1 min-h-0 overflow-hidden" style={{ background: '#2C2C2E' }}>
        {imageUrl && !broken ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover object-[50%_25%]"
            priority
            crossOrigin="anonymous"
            onError={() => setBroken(true)}
            sizes="290px"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center" style={{ color: TEXT_SECONDARY }}>
            {fallback}
          </div>
        )}
      </div>
      <div className="px-4 py-3 shrink-0">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: TEXT_SECONDARY }}
        >
          {label}
        </p>
        <p
          className="mt-0.5 text-[18px] font-bold leading-tight truncate"
          style={{ color: TEXT_PRIMARY }}
        >
          {name || 'Unknown'}
        </p>
        <p className="mt-0.5 text-[12px]" style={{ color: TEXT_SECONDARY }}>
          <span className="font-semibold" style={{ color: TEXT_PRIMARY }}>{count}</span>{' '}
          {countLabel}
        </p>
      </div>
    </div>
  );
};

const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => {
  const valueIsLongText = value.length > 12;
  return (
    <div
      className="rounded-2xl px-4 py-3 flex flex-col justify-center gap-1.5"
      style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <p
          className="text-[12px] font-semibold uppercase tracking-[0.08em] truncate"
          style={{ color: TEXT_SECONDARY }}
        >
          {label}
        </p>
      </div>
      <p
        className="font-bold tabular-nums"
        style={{
          color: TEXT_PRIMARY,
          fontSize: valueIsLongText ? 18 : 26,
          lineHeight: valueIsLongText ? 1.15 : 1,
        }}
      >
        {value}
      </p>
    </div>
  );
};

const ProgressBar: React.FC<{ value: number; max: number }> = ({ value, max }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold" style={{ color: TEXT_SECONDARY }}>
          Cinema Scale
        </span>
        <span className="text-[22px] font-bold tabular-nums" style={{ color: ACCENT }}>
          {value}
          <span className="text-[13px] font-semibold ml-1" style={{ color: TEXT_SECONDARY }}>
            /{max}
          </span>
        </span>
      </div>
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: '#2C2C2E' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: ACCENT }}
        />
      </div>
    </div>
  );
};

const AppleHIGShareCard = React.forwardRef<HTMLDivElement, Props>(
  function AppleHIGShareCard({ data, className = '', orientation = 'horizontal' }, ref) {
    const isVertical = orientation === 'vertical';

    const crushUrl = useMemo(() => {
      if (!data.onScreenCrush.headshotUrl) return undefined;
      const url = getTmdbImageUrl(data.onScreenCrush.headshotUrl);
      return url === null ? undefined : url;
    }, [data.onScreenCrush.headshotUrl]);

    const directorUrl = useMemo(() => {
      if (!data.favoriteDirector.headshotUrl) return undefined;
      const url = getTmdbImageUrl(data.favoriteDirector.headshotUrl);
      return url === null ? undefined : url;
    }, [data.favoriteDirector.headshotUrl]);
    const reviewWordsText = formatReviewWords(data.topReviewWords);

    /* ═══════ VERTICAL (675×1200) ═══════ */
    if (isVertical) {
      return (
        <div
          ref={ref}
          data-export-root="true"
          className={cx('w-[675px] h-[1200px] relative overflow-hidden', className)}
          style={{
            background: BG,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
          }}
        >
          {/* Thin accent line at top */}
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: ACCENT }} />

          <div className="relative z-10 h-full flex flex-col px-8 py-10 gap-6">
            {/* Top eyebrow */}
            <p
              className="text-[14px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: TEXT_SECONDARY }}
            >
              Year In Film
            </p>

            {/* Title */}
            <h1
              className="font-bold leading-none -mt-2"
              style={{ fontSize: 44, color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}
            >
              Letterboxd Wrapped
            </h1>

            {/* Hero count — big, left-aligned */}
            <div className="-mt-2">
              <p
                className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: TEXT_SECONDARY }}
              >
                You watched
              </p>
              <p
                className="font-black leading-none tabular-nums mt-1"
                style={{ fontSize: 80, color: TEXT_PRIMARY, letterSpacing: '-0.03em' }}
              >
                {data.watchedFilms.toLocaleString()}
              </p>
              <p
                className="mt-1 text-[15px] font-semibold"
                style={{ color: TEXT_SECONDARY }}
              >
                films this year
              </p>
            </div>

            {/* Big person squares — 2 columns */}
            <div className="grid grid-cols-2 gap-4">
              <PersonSquare
                label="On-Screen Crush"
                name={data.onScreenCrush.name}
                count={data.onScreenCrush.count}
                countLabel="together"
                imageUrl={crushUrl}
                fallback={<Heart size={48} style={{ color: TEXT_SECONDARY }} />}
              />
              <PersonSquare
                label="Favorite Director"
                name={data.favoriteDirector.name}
                count={data.favoriteDirector.count}
                countLabel="directed"
                imageUrl={directorUrl}
                fallback={<User size={48} style={{ color: TEXT_SECONDARY }} />}
              />
            </div>

            {/* Stat tiles — 2×2 */}
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                icon={<Clock size={14} style={{ color: TEXT_SECONDARY }} />}
                label="Days spent"
                value={`${Math.round(data.spentDays)}`}
              />
              <StatTile
                icon={<Star size={14} style={{ color: TEXT_SECONDARY }} />}
                label="Most common rating"
                value={`${data.mostCommonRating} ★`}
              />
              <StatTile
                icon={<Film size={14} style={{ color: TEXT_SECONDARY }} />}
                label="Cinema Scale"
                value={`${data.cinemaScale.toFixed(0)} / 100`}
              />
              {reviewWordsText ? (
                <StatTile
                  icon={<Calendar size={14} style={{ color: TEXT_SECONDARY }} />}
                  label="Review words"
                  value={reviewWordsText}
                />
              ) : (
                <StatTile
                  icon={<Calendar size={14} style={{ color: TEXT_SECONDARY }} />}
                  label="Peak Decade"
                  value={`${data.peakDecade}`}
                />
              )}
            </div>

            {/* Wide poster strip */}
            {data.topFilms && data.topFilms.length > 0 && (
              <div>
                <SectionLabel>Top this year</SectionLabel>
                <div className="mt-2">
                  <PosterStrip films={data.topFilms} size="xl" />
                </div>
              </div>
            )}

            {/* Rating outlier — gated on backend data */}
            {data.ratingOutlierFilm && (
              <OutlierFilmCard film={data.ratingOutlierFilm} />
            )}

            {/* Footer */}
            <div className="mt-auto pt-2 text-center">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: '#636366' }}
              >
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
        className={cx('w-[1200px] h-[630px] relative overflow-hidden', className)}
        style={{
          background: BG,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: ACCENT }} />

        <div className="relative z-10 h-full grid grid-cols-12 gap-6 px-10 py-9">
          {/* LEFT (7 cols) */}
          <div className="col-span-7 flex flex-col justify-between">
            <div>
              <p
                className="text-[16px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: TEXT_SECONDARY }}
              >
                Year In Film
              </p>
              <h1
                className="mt-2 font-bold leading-none"
                style={{ fontSize: 44, color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}
              >
                Your Letterboxd Wrapped
              </h1>
            </div>

            <div>
              <SectionLabel>You watched</SectionLabel>
              <span
                className="block font-black leading-[0.88] tabular-nums mt-1"
                style={{ fontSize: 104, color: TEXT_PRIMARY, letterSpacing: '-0.03em' }}
              >
                {data.watchedFilms.toLocaleString()}
              </span>
              <p
                className="mt-1 text-[18px] font-semibold"
                style={{ color: TEXT_SECONDARY }}
              >
                films this year
              </p>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <StatPill
                icon={<Clock size={14} style={{ color: TEXT_SECONDARY }} />}
                label="Days"
                value={`${Math.round(data.spentDays)}`}
              />
              <StatPill
                icon={<Star size={14} style={{ color: TEXT_SECONDARY }} />}
                label="Rating"
                value={`${data.mostCommonRating}★`}
              />
              <StatPill
                icon={<Film size={14} style={{ color: TEXT_SECONDARY }} />}
                label="Scale"
                value={`${data.cinemaScale.toFixed(1)}`}
              />
              {reviewWordsText ? (
                <StatPill
                  icon={<Calendar size={14} style={{ color: TEXT_SECONDARY }} />}
                  label="Review"
                  value={reviewWordsText}
                />
              ) : (
                <StatPill
                  icon={<Calendar size={14} style={{ color: TEXT_SECONDARY }} />}
                  label="Decade"
                  value={data.peakDecade}
                />
              )}
            </div>

            {data.topFilms && data.topFilms.length > 0 && (
              <div>
                <PosterStrip films={data.topFilms} size="lg" />
              </div>
            )}

            <p
              className="text-[12px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: '#636366' }}
            >
              movieswrapped.com
            </p>
          </div>

          {/* RIGHT (5 cols) */}
          <div className="col-span-5 flex flex-col justify-center gap-4">
            <PersonCard
              label="On-Screen Crush"
              name={data.onScreenCrush.name}
              count={data.onScreenCrush.count}
              countLabel="movies together"
              imageUrl={crushUrl}
              fallback={<Heart size={28} style={{ color: TEXT_SECONDARY }} />}
            />
            <PersonCard
              label="Favorite Director"
              name={data.favoriteDirector.name}
              count={data.favoriteDirector.count}
              countLabel="movies directed"
              imageUrl={directorUrl}
              fallback={<User size={28} style={{ color: TEXT_SECONDARY }} />}
            />
          </div>
        </div>
      </div>
    );
  }
);

export default AppleHIGShareCard;
