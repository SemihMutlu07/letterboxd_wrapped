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
    className="text-[13px] font-semibold uppercase tracking-[0.08em]"
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
        style={{ width: 90, height: 135, background: '#2C2C2E' }}
      >
        {imageUrl && !broken ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover object-[50%_10%]"
            priority
            crossOrigin="anonymous"
            onError={() => setBroken(true)}
            sizes="90px"
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

    /* ═══════ VERTICAL (630×1200) ═══════ */
    if (isVertical) {
      return (
        <div
          ref={ref}
          id="wrapped-export-root"
          className={cx('w-[630px] h-[1200px] relative overflow-hidden', className)}
          style={{
            background: BG,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
          }}
        >
          {/* Thin accent line at top */}
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: ACCENT }} />

          <div className="relative z-10 h-full flex flex-col px-8 py-10 gap-6">
            {/* Header */}
            <div>
              <p
                className="text-[13px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: TEXT_SECONDARY }}
              >
                Year In Film
              </p>
              <h1
                className="mt-2 font-bold leading-none"
                style={{ fontSize: 32, color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}
              >
                Your Letterboxd Wrapped
              </h1>
            </div>

            {/* Hero stat */}
            <div>
              <SectionLabel>You watched</SectionLabel>
              <HeroNumber>{data.watchedFilms.toLocaleString()}</HeroNumber>
              <p
                className="mt-1 text-[22px] font-semibold"
                style={{ color: TEXT_SECONDARY }}
              >
                films this year
              </p>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ background: BORDER }} />

            {/* Person cards */}
            <div className="flex flex-col gap-3">
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

            {/* Stat pills — 2×2 */}
            <div className="grid grid-cols-2 gap-3">
              <StatPill
                icon={<Clock size={16} style={{ color: TEXT_SECONDARY }} />}
                label="Days spent"
                value={`${Math.round(data.spentDays)} days`}
              />
              <StatPill
                icon={<Star size={16} style={{ color: TEXT_SECONDARY }} />}
                label="Most common rating"
                value={`${data.mostCommonRating} ★`}
              />
              <StatPill
                icon={<Film size={16} style={{ color: TEXT_SECONDARY }} />}
                label="Cinema Scale"
                value={`${data.cinemaScale.toFixed(1)} / 100`}
              />
              <StatPill
                icon={<Calendar size={16} style={{ color: TEXT_SECONDARY }} />}
                label="Peak Decade"
                value={`${data.peakDecade} (${data.peakDecadeCount})`}
              />
            </div>

            {/* Cinema Scale progress */}
            <ProgressBar value={Math.round(data.cinemaScale)} max={100} />

            {/* Footer */}
            <div className="mt-auto pt-4 text-center">
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
        id="wrapped-export-root"
        className={cx('w-[1200px] h-[630px] relative overflow-hidden', className)}
        style={{
          background: BG,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: ACCENT }} />

        <div className="relative z-10 h-full grid grid-cols-12 gap-6 px-8 py-8">
          {/* LEFT (7 cols) */}
          <div className="col-span-7 flex flex-col justify-between">
            <div>
              <p
                className="text-[13px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: TEXT_SECONDARY }}
              >
                Year In Film
              </p>
              <h1
                className="mt-2 font-bold leading-none"
                style={{ fontSize: 28, color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}
              >
                Your Letterboxd Wrapped
              </h1>
            </div>

            <div>
              <SectionLabel>You watched</SectionLabel>
              <span
                className="block font-black leading-[0.88] tabular-nums"
                style={{ fontSize: 88, color: TEXT_PRIMARY, letterSpacing: '-0.03em' }}
              >
                {data.watchedFilms.toLocaleString()}
              </span>
              <p
                className="mt-1 text-[17px] font-semibold"
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
              <StatPill
                icon={<Calendar size={14} style={{ color: TEXT_SECONDARY }} />}
                label="Decade"
                value={data.peakDecade}
              />
            </div>

            <ProgressBar value={Math.round(data.cinemaScale)} max={100} />

            <p
              className="text-[11px] font-semibold uppercase tracking-[0.12em]"
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
