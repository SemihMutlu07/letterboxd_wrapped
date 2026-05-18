import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Heart, User } from 'lucide-react';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../types';

type Variant3ShareCardProps = {
  data: ShareCardData;
  className?: string;
  orientation?: ShareOrientation;
};

/* ---------- palette (Letterboxd-aligned) ---------- */
const CREAM = '#F5F0EB';
const CHARCOAL = '#1A1A1A';
const SECONDARY = '#666666';
const LB_GREEN = '#00c030';
const SAGE_DARK = '#556B5A';
const NAVY = '#1B2838';
const TILE_BG = '#FFFFFF';
const TILE_BORDER = '#E5E0DB';

const SERIF: React.CSSProperties = {
  fontFamily: 'Georgia, Playfair Display, serif',
};

/* ---------- helpers ---------- */
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const formatReviewWords = (words?: ShareCardData['topReviewWords']) =>
  words?.slice(0, 3).map(({ word }) => word).join(' / ') || '';

const Label: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  className,
  children,
}) => (
  <div
    className={cx('uppercase tracking-[.18em] font-medium text-[12px]', className)}
    style={{ color: SECONDARY }}
  >
    {children}
  </div>
);

/* ---------- component ---------- */
const Variant3ShareCard = React.forwardRef<HTMLDivElement, Variant3ShareCardProps>(
  function Variant3ShareCard({ data, className = '', orientation = 'horizontal' }, ref) {
    const isVertical = orientation === 'vertical';
    const [crushBroken, setCrushBroken] = useState(false);
    const [directorBroken, setDirectorBroken] = useState(false);

    const normalizeTmdb = (u?: string): string | undefined => {
      if (!u) return undefined;
      if (u.startsWith('http')) return u;
      if (u.startsWith('/')) return getTmdbImageUrl(u) ?? undefined;
      return u;
    };

    const crushUrl = useMemo(
      () => normalizeTmdb(data.onScreenCrush.headshotUrl),
      [data.onScreenCrush.headshotUrl]
    );
    const directorUrl = useMemo(
      () => normalizeTmdb(data.favoriteDirector.headshotUrl),
      [data.favoriteDirector.headshotUrl]
    );

    /* --- portrait card (shared between layouts) --- */
    const portraitCard = (
      url: string | undefined,
      broken: boolean,
      onError: () => void,
      alt: string,
      fallbackIcon: React.ReactNode,
      label: string,
      name: string,
      count: number,
      countVerb: string,
      accentColor: string,
      size: { w: number; h: number }
    ) => (
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: size.w,
          border: `1px solid ${TILE_BORDER}`,
          borderRadius: 10,
          background: TILE_BG,
        }}
      >
        {/* image area */}
        <div className="relative overflow-hidden" style={{ height: size.h }}>
          {url && !broken ? (
            <Image
              src={url}
              alt={alt}
              fill
              className="object-cover object-center"
              priority
              crossOrigin="anonymous"
              onError={onError}
              sizes={`${size.w}px`}
            />
          ) : (
            <div
              className="absolute inset-0 grid place-items-center"
              style={{ background: '#F0EBE6' }}
            >
              {fallbackIcon}
            </div>
          )}
          {/* very subtle bottom vignette so text below reads cleanly */}
          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white/40 to-transparent" />
        </div>
        {/* caption */}
        <div className="px-3 py-2.5" style={SERIF}>
          <div
            className="uppercase tracking-[.18em] font-medium text-[8px]"
            style={{ color: accentColor }}
          >
            {label}
          </div>
          <div
            className="mt-0.5 text-[14px] font-bold leading-tight line-clamp-1"
            style={{ color: CHARCOAL }}
          >
            {name || 'Unknown'}
          </div>
          <div className="mt-0.5 text-[10px]" style={{ color: SECONDARY }}>
            {count} {countVerb}
          </div>
        </div>
      </div>
    );

    /* --- metric cell (shared) --- */
    const metricCell = (
      label: string,
      value: React.ReactNode,
      unit?: string,
      accentColor?: string
    ) => {
      const valueIsLongText = typeof value === 'string' && value.length > 12;
      return (
      <div
        className="flex flex-col items-center justify-center text-center px-3 py-3"
        style={{
          border: `1px solid ${TILE_BORDER}`,
          borderRadius: 8,
          background: TILE_BG,
          ...SERIF,
        }}
      >
        <Label>{label}</Label>
        <div className="mt-1 flex items-baseline justify-center gap-0.5">
          <span
            className="font-bold tabular-nums leading-none"
            style={{
              fontSize: valueIsLongText ? (isVertical ? 18 : 16) : isVertical ? 28 : 24,
              color: accentColor || CHARCOAL,
              lineHeight: valueIsLongText ? 1.15 : 1,
            }}
          >
            {value}
          </span>
          {unit && (
            <span className="text-[10px] font-medium" style={{ color: SECONDARY }}>
              {unit}
            </span>
          )}
        </div>
      </div>
      );
    };

    const reviewWordsText = formatReviewWords(data.topReviewWords);

    /* ============================================================
       VERTICAL (675 x 1200)
       ============================================================ */
    if (isVertical) {
      return (
        <div
          ref={ref}
          data-export-root="true"
          className={cx('w-[675px] h-[1200px] flex flex-col', className)}
          style={{ background: CREAM, color: CHARCOAL, ...SERIF }}
        >
          {/* top bar */}
          <div
            className="flex items-center justify-between px-10 pt-8 pb-3"
            style={{ borderBottom: `1px solid ${TILE_BORDER}` }}
          >
            <div className="text-[13px] uppercase tracking-[.20em] font-medium" style={{ color: SECONDARY }}>
              Letterboxd Wrapped
            </div>
            <div className="text-[13px] uppercase tracking-[.20em] font-medium" style={{ color: SECONDARY }}>
              Year in Film
            </div>
          </div>

          {/* hero stat */}
          <div className="px-10 pt-8 pb-4">
            <div className="text-[13px] uppercase tracking-[.20em] font-medium" style={{ color: LB_GREEN }}>
              Films Watched
            </div>
            <div className="mt-1 text-[96px] font-bold leading-none tabular-nums" style={{ color: NAVY }}>
              {data.watchedFilms.toLocaleString()}
            </div>
            <div className="mt-3 text-[15px] leading-relaxed" style={{ color: SECONDARY }}>
              {data.spentDays} days of cinema — {data.timePercent}% of your time dedicated to film.
              Your go-to rating is {data.mostCommonRating}★ and you gravitate towards the {data.peakDecade}.
            </div>
          </div>

          {/* thin divider */}
          <div className="mx-10" style={{ height: 1, background: TILE_BORDER }} />

          {/* portrait row */}
          <div className="px-10 pt-6 pb-5 flex gap-5">
            {portraitCard(
              crushUrl,
              crushBroken,
              () => setCrushBroken(true),
              data.onScreenCrush.name || 'On-screen crush',
              <Heart className="w-8 h-8" style={{ color: TILE_BORDER }} />,
              'On-Screen Crush',
              data.onScreenCrush.name,
              data.onScreenCrush.count,
              'films together',
              LB_GREEN,
              { w: 220, h: 280 }
            )}
            {portraitCard(
              directorUrl,
              directorBroken,
              () => setDirectorBroken(true),
              data.favoriteDirector.name || 'Favorite director',
              <User className="w-8 h-8" style={{ color: TILE_BORDER }} />,
              'Favorite Director',
              data.favoriteDirector.name,
              data.favoriteDirector.count,
              'films directed',
              SAGE_DARK,
              { w: 220, h: 280 }
            )}
          </div>

          {/* thin divider */}
          <div className="mx-10" style={{ height: 1, background: TILE_BORDER }} />

          {/* metrics grid */}
          <div className="px-10 pt-6 pb-4 grid grid-cols-3 gap-4">
            {metricCell('Most Common Rating', `${data.mostCommonRating} ★`, undefined, LB_GREEN)}
            {metricCell('Cinema Scale', data.cinemaScale.toFixed(1), '/100', NAVY)}
            {metricCell('Avg Runtime', `${data.minutesAverage}`, 'min', CHARCOAL)}
          </div>

          {/* bottom row */}
          <div className="px-10 pb-4 grid grid-cols-2 gap-4">
            {metricCell('Peak Decade', data.peakDecade, `${data.peakDecadeCount} films`, SAGE_DARK)}
            {reviewWordsText
              ? metricCell('Review Words', reviewWordsText, undefined, LB_GREEN)
              : metricCell('Time Spent', `${data.timePercent}%`, 'of your time', LB_GREEN)}
          </div>

          {/* spacer + footer */}
          <div className="flex-1" />
          <div
            className="px-10 py-5 flex items-center justify-center"
            style={{ borderTop: `1px solid ${TILE_BORDER}` }}
          >
            <div className="text-[10px] tracking-[.22em] uppercase font-medium" style={{ color: SECONDARY }}>
              movieswrapped.com
            </div>
          </div>
        </div>
      );
    }

    /* ============================================================
       HORIZONTAL (1200 x 630)
       ============================================================ */
    return (
      <div
        ref={ref}
        data-export-root="true"
        className={cx('w-[1200px] h-[630px] grid grid-cols-12', className)}
        style={{ background: CREAM, color: CHARCOAL, ...SERIF }}
      >
        {/* ---- LEFT column (cols 1-6): editorial text + metrics ---- */}
        <div className="col-span-6 flex flex-col px-10 py-8">
          {/* header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="text-[12px] uppercase tracking-[.22em] font-medium" style={{ color: SECONDARY }}>
              Letterboxd Wrapped
            </div>
            <div style={{ width: 32, height: 1, background: TILE_BORDER }} />
            <div className="text-[12px] uppercase tracking-[.22em] font-medium" style={{ color: SECONDARY }}>
              Year in Film
            </div>
          </div>

          {/* hero number */}
          <div>
            <div className="text-[12px] uppercase tracking-[.22em] font-medium" style={{ color: LB_GREEN }}>
              Films Watched
            </div>
            <div className="mt-1 text-[88px] font-bold leading-none tabular-nums" style={{ color: NAVY }}>
              {data.watchedFilms.toLocaleString()}
            </div>
          </div>

          {/* cinema persona badge */}
          {data.personaLabel && (
            <div
              className="mt-4 inline-block px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[.18em]"
              style={{ background: `${SAGE_DARK}1a`, color: SAGE_DARK, border: `1px solid ${SAGE_DARK}33` }}
            >
              {data.personaLabel}
            </div>
          )}

          {/* editorial summary — fills dead space with meaningful content */}
          <div className="mt-3 text-[13px] leading-relaxed max-w-[420px]" style={{ color: SECONDARY }}>
            {data.spentDays} days of cinema. {data.timePercent}% of your time dedicated to film.
            A most common rating of {data.mostCommonRating}★, averaging {data.minutesAverage} minutes per film,
            with a strong pull towards the {data.peakDecade}.
          </div>

          {/* spacer */}
          <div className="flex-1" />

          {/* bottom metrics strip */}
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col" style={{ borderTop: `1px solid ${TILE_BORDER}`, paddingTop: 8 }}>
              <Label>Days Spent</Label>
              <div className="mt-1 text-[22px] font-bold tabular-nums leading-none" style={{ color: CHARCOAL }}>
                {data.spentDays}
              </div>
            </div>
            <div className="flex flex-col" style={{ borderTop: `1px solid ${TILE_BORDER}`, paddingTop: 8 }}>
              <Label>Cinema Scale</Label>
              <div className="mt-1 text-[22px] font-bold tabular-nums leading-none" style={{ color: NAVY }}>
                {data.cinemaScale.toFixed(1)}
                <span className="text-[10px] font-medium ml-0.5" style={{ color: SECONDARY }}>/100</span>
              </div>
            </div>
            <div className="flex flex-col" style={{ borderTop: `1px solid ${TILE_BORDER}`, paddingTop: 8 }}>
              <Label>Peak Decade</Label>
              <div className="mt-1 text-[22px] font-bold leading-none" style={{ color: SAGE_DARK }}>
                {data.peakDecade}
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: SECONDARY }}>
                {data.peakDecadeCount} films
              </div>
            </div>
            <div className="flex flex-col" style={{ borderTop: `1px solid ${TILE_BORDER}`, paddingTop: 8 }}>
              <Label>Time Spent</Label>
              <div className="mt-1 text-[22px] font-bold tabular-nums leading-none" style={{ color: LB_GREEN }}>
                {data.timePercent}%
              </div>
            </div>
          </div>

          {/* footer */}
          <div className="mt-4 text-[9px] uppercase tracking-[.22em] font-medium" style={{ color: SECONDARY }}>
            movieswrapped.com
          </div>
        </div>

        {/* ---- thin vertical divider ---- */}
        <div className="col-span-1 flex items-stretch justify-center py-8">
          <div style={{ width: 1, background: TILE_BORDER }} />
        </div>

        {/* ---- RIGHT column (cols 7-12): portrait cards ---- */}
        <div className="col-span-5 flex flex-col justify-center gap-5 pr-10 py-8">
          {/* crush card */}
          <div
            className="flex items-stretch overflow-hidden"
            style={{
              border: `1px solid ${TILE_BORDER}`,
              borderRadius: 10,
              background: TILE_BG,
              height: 230,
            }}
          >
            {/* portrait image */}
            <div className="relative shrink-0" style={{ width: 180 }}>
              {crushUrl && !crushBroken ? (
                <Image
                  src={crushUrl}
                  alt={data.onScreenCrush.name || 'On-screen crush'}
                  fill
                  className="object-cover object-center"
                  priority
                  crossOrigin="anonymous"
                  onError={() => setCrushBroken(true)}
                  sizes="180px"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center" style={{ background: '#F0EBE6' }}>
                  <Heart className="w-10 h-10" style={{ color: TILE_BORDER }} />
                </div>
              )}
            </div>
            {/* text */}
            <div className="flex flex-col justify-center px-5 py-4">
              <div
                className="text-[9px] uppercase tracking-[.22em] font-medium"
                style={{ color: LB_GREEN }}
              >
                On-Screen Crush
              </div>
              <div
                className="mt-1 text-[26px] font-bold leading-tight line-clamp-1"
                style={{ color: CHARCOAL }}
              >
                {data.onScreenCrush.name || 'Unknown'}
              </div>
              <div className="mt-1 text-[13px]" style={{ color: SECONDARY }}>
                {data.onScreenCrush.count} films together
              </div>
            </div>
          </div>

          {/* director card */}
          <div
            className="flex items-stretch overflow-hidden"
            style={{
              border: `1px solid ${TILE_BORDER}`,
              borderRadius: 10,
              background: TILE_BG,
              height: 230,
            }}
          >
            {/* portrait image */}
            <div className="relative shrink-0" style={{ width: 180 }}>
              {directorUrl && !directorBroken ? (
                <Image
                  src={directorUrl}
                  alt={data.favoriteDirector.name || 'Favorite director'}
                  fill
                  className="object-cover object-center"
                  priority
                  crossOrigin="anonymous"
                  onError={() => setDirectorBroken(true)}
                  sizes="180px"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center" style={{ background: '#F0EBE6' }}>
                  <User className="w-10 h-10" style={{ color: TILE_BORDER }} />
                </div>
              )}
            </div>
            {/* text */}
            <div className="flex flex-col justify-center px-5 py-4">
              <div
                className="text-[9px] uppercase tracking-[.22em] font-medium"
                style={{ color: SAGE_DARK }}
              >
                Favorite Director
              </div>
              <div
                className="mt-1 text-[26px] font-bold leading-tight line-clamp-1"
                style={{ color: CHARCOAL }}
              >
                {data.favoriteDirector.name || 'Unknown'}
              </div>
              <div className="mt-1 text-[13px]" style={{ color: SECONDARY }}>
                {data.favoriteDirector.count} films directed
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default Variant3ShareCard;
