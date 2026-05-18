import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Heart, User, Star } from 'lucide-react';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../types';

type EditorialShareCardProps = {
  data: ShareCardData;
  className?: string;
  orientation?: ShareOrientation;
};

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

const normalizeTmdb = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return getTmdbImageUrl(url) ?? undefined;
  return url;
};

const formatReviewWords = (words?: ShareCardData['topReviewWords']) =>
  words?.slice(0, 3).map(({ word }) => word).join(' / ') || '';

/* ── Portrait with optional VHS glitch ── */
function Portrait({
  label,
  name,
  countLabel,
  imageUrl,
  fallback,
  accentColor,
  glitch = false,
}: {
  label: string;
  name: string;
  countLabel: string;
  imageUrl?: string;
  fallback: 'heart' | 'user';
  accentColor: string;
  glitch?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const hasImage = imageUrl && !broken;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        flex: 1,
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '0.20em',
          textTransform: 'uppercase' as const,
          color: accentColor,
          marginBottom: 10,
          fontFamily: 'Georgia, Playfair Display, serif',
        }}
      >
        {label}
      </div>

      {/* Portrait frame */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          minHeight: 0,
          borderRadius: 16,
          overflow: 'hidden',
          background: '#0a0e1a',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {hasImage ? (
          <>
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="object-cover object-center"
              priority
              crossOrigin="anonymous"
              onError={() => setBroken(true)}
              sizes="240px"
              style={{ filter: 'grayscale(100%) contrast(1.15)' }}
            />
            {/* Bottom fade */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(8,12,28,0.75) 0%, rgba(8,12,28,0.2) 40%, transparent 65%)',
                pointerEvents: 'none',
              }}
            />
            {/* VHS glitch overlay */}
            {glitch && (
              <>
                {/* Cyan channel offset */}
                <div
                  style={{
                    position: 'absolute',
                    top: '28%',
                    left: -3,
                    right: 3,
                    height: '18%',
                    background: 'rgba(0,255,229,0.12)',
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                  }}
                />
                {/* Magenta channel offset */}
                <div
                  style={{
                    position: 'absolute',
                    top: '52%',
                    left: 4,
                    right: -4,
                    height: '12%',
                    background: 'rgba(255,0,102,0.10)',
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                  }}
                />
                {/* Scanlines */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
                    pointerEvents: 'none',
                  }}
                />
                {/* Horizontal distortion bar */}
                <div
                  style={{
                    position: 'absolute',
                    top: '45%',
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, transparent 10%, rgba(0,255,229,0.35) 30%, rgba(255,0,102,0.25) 70%, transparent 90%)',
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {fallback === 'heart' ? <Heart size={36} /> : <User size={36} />}
          </div>
        )}

        {/* Name + count at bottom of portrait */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '14px 16px',
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              lineHeight: 1.05,
              color: '#fff',
              fontFamily: 'Avenir Next, Manrope, Segoe UI, system-ui, sans-serif',
            }}
          >
            {name || 'Unknown'}
          </div>
          <div
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.7)',
              marginTop: 5,
              fontFamily: 'Georgia, Playfair Display, serif',
            }}
          >
            {countLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat cell ── */
function StatCell({
  label,
  value,
  unit,
  valueColor = '#fff',
}: {
  label: string;
  value: string;
  unit?: React.ReactNode;
  valueColor?: string;
}) {
  const valueIsLongText = typeof value === 'string' && value.length > 12;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase' as const,
          color: 'rgba(255,255,255,0.55)',
          fontFamily: 'Georgia, Playfair Display, serif',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          style={{
            fontSize: valueIsLongText ? 18 : 28,
            fontWeight: 900,
            color: valueColor,
            lineHeight: valueIsLongText ? 1.15 : 1,
            fontFamily: 'Avenir Next, Manrope, Segoe UI, system-ui, sans-serif',
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'Georgia, Playfair Display, serif',
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

const EditorialShareCard = React.forwardRef<HTMLDivElement, EditorialShareCardProps>(
  function EditorialShareCard({ data, className = '', orientation = 'horizontal' }, ref) {
    const isVertical = orientation === 'vertical';
    const crushUrl = useMemo(
      () => normalizeTmdb(data.onScreenCrush.headshotUrl),
      [data.onScreenCrush.headshotUrl],
    );
    const directorUrl = useMemo(
      () => normalizeTmdb(data.favoriteDirector.headshotUrl),
      [data.favoriteDirector.headshotUrl],
    );
    const reviewWordsText = formatReviewWords(data.topReviewWords);

    /* ────────────────── VERTICAL (675×1200) ────────────────── */
    if (isVertical) {
      return (
        <div
          ref={ref}
          data-export-root="true"
          className={cx(className)}
          style={{
            width: 675,
            height: 1200,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 24,
            color: '#fff',
            fontFamily: 'Avenir Next, Manrope, Segoe UI, system-ui, sans-serif',
          }}
        >
          {/* Background gradient */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(165deg, #080c1c 0%, #0c1230 35%, #12103a 65%, #0e0924 100%)',
            }}
          />
          {/* Subtle radial glow */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 30% 20%, rgba(0,255,229,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(255,0,102,0.04) 0%, transparent 50%)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'relative',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '36px 38px 28px',
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase' as const,
                  color: 'rgba(255,255,255,0.55)',
                  fontFamily: 'Georgia, Playfair Display, serif',
                }}
              >
                Year In Film
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: '#fff',
                  marginTop: 4,
                }}
              >
                Letterboxd Wrapped
              </div>
            </div>

            {/* Hero: Film Count */}
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 96,
                  fontWeight: 900,
                  lineHeight: 0.88,
                  color: '#fff',
                  textShadow: '0 0 40px rgba(0,255,229,0.25), 0 0 80px rgba(0,255,229,0.1)',
                }}
              >
                {data.watchedFilms.toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase' as const,
                  color: 'rgba(255,255,255,0.6)',
                  marginTop: 10,
                }}
              >
                Films Watched
              </div>
            </div>

            {/* 2×2 stats grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '18px 24px',
                marginBottom: 28,
                paddingBottom: 24,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <StatCell label="Days Spent" value={String(data.spentDays)} unit="days" />
              <StatCell
                label="Cinema Scale"
                value={data.cinemaScale.toFixed(1)}
                unit="/ 100"
                valueColor="#00ffe5"
              />
              {reviewWordsText ? (
                <StatCell label="Review Words" value={reviewWordsText} valueColor="#c084fc" />
              ) : (
                <StatCell label="Avg Runtime" value={String(data.minutesAverage)} unit="min" />
              )}
              <StatCell
                label="Most Common Rating"
                value={String(data.mostCommonRating)}
                unit={<Star size={14} fill="#FFD700" stroke="#FFD700" style={{ marginBottom: -1 }} />}
                valueColor="#FFD700"
              />
            </div>

            {/* Portraits side by side */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                flex: 1,
                minHeight: 0,
                marginBottom: 24,
              }}
            >
              <Portrait
                label="On-Screen Crush"
                name={data.onScreenCrush.name}
                countLabel={`${data.onScreenCrush.count} films together`}
                imageUrl={crushUrl}
                fallback="heart"
                accentColor="#FF0066"
                glitch
              />
              <Portrait
                label="Favorite Director"
                name={data.favoriteDirector.name}
                countLabel={`${data.favoriteDirector.count} films directed`}
                imageUrl={directorUrl}
                fallback="user"
                accentColor="#00ffe5"
              />
            </div>

            {/* Peak Decade bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '12px 18px',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase' as const,
                  color: 'rgba(255,255,255,0.55)',
                  fontFamily: 'Georgia, Playfair Display, serif',
                }}
              >
                Peak Decade
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: '#c084fc',
                  }}
                >
                  {data.peakDecade}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.5)',
                    fontFamily: 'Georgia, Playfair Display, serif',
                  }}
                >
                  {data.peakDecadeCount.toLocaleString()} films watched
                </span>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                textAlign: 'center',
                fontSize: 10,
                color: 'rgba(255,255,255,0.3)',
                letterSpacing: '0.1em',
              }}
            >
              movieswrapped.com
            </div>
          </div>
        </div>
      );
    }

    /* ────────────────── HORIZONTAL (1200×630) ────────────────── */
    return (
      <div
        ref={ref}
        data-export-root="true"
        className={cx(className)}
        style={{
          width: 1200,
          height: 630,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 24,
          color: '#fff',
          fontFamily: 'Avenir Next, Manrope, Segoe UI, system-ui, sans-serif',
        }}
      >
        {/* Background gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(145deg, #080c1c 0%, #0c1230 30%, #12103a 60%, #0e0924 100%)',
          }}
        />
        {/* Subtle neon radial glows */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 25% 35%, rgba(0,255,229,0.06) 0%, transparent 45%), radial-gradient(ellipse at 80% 70%, rgba(255,0,102,0.04) 0%, transparent 45%)',
            pointerEvents: 'none',
          }}
        />
        {/* Thin magenta accent line at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background:
              'linear-gradient(90deg, transparent 5%, rgba(255,0,102,0.6) 30%, rgba(0,255,229,0.4) 70%, transparent 95%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            height: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 420px',
            gap: 28,
            padding: '32px 36px 28px',
          }}
        >
          {/* ── LEFT COLUMN ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Header */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.32em',
                  textTransform: 'uppercase' as const,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'Georgia, Playfair Display, serif',
                }}
              >
                Year In Film
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: 'rgba(255,255,255,0.85)',
                  marginTop: 3,
                }}
              >
                Letterboxd Wrapped
              </div>
            </div>

            {/* Hero film count */}
            <div>
              <div
                style={{
                  fontSize: 120,
                  fontWeight: 900,
                  lineHeight: 0.86,
                  color: '#fff',
                  textShadow:
                    '0 0 50px rgba(0,255,229,0.2), 0 0 100px rgba(0,255,229,0.08)',
                  letterSpacing: '-0.02em',
                }}
              >
                {data.watchedFilms.toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase' as const,
                  color: 'rgba(255,255,255,0.55)',
                  marginTop: 8,
                }}
              >
                Films Watched
              </div>
            </div>

            {/* 4-column sub-stats grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 20,
                paddingTop: 20,
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <StatCell label="Days Spent" value={String(data.spentDays)} unit="days" />
              <StatCell
                label="Cinema Scale"
                value={data.cinemaScale.toFixed(1)}
                unit="/ 100"
                valueColor="#00ffe5"
              />
              <StatCell label="Avg Runtime" value={String(data.minutesAverage)} unit="min" />
              <StatCell
                label="Most Common Rating"
                value={String(data.mostCommonRating)}
                unit={
                  <Star
                    size={13}
                    fill="#FFD700"
                    stroke="#FFD700"
                    style={{ marginBottom: -1 }}
                  />
                }
                valueColor="#FFD700"
              />
            </div>

            {/* Peak Decade bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '10px 18px',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase' as const,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'Georgia, Playfair Display, serif',
                  whiteSpace: 'nowrap',
                }}
              >
                Peak Decade
              </div>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#c084fc',
                }}
              >
                {data.peakDecade}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.45)',
                  fontFamily: 'Georgia, Playfair Display, serif',
                }}
              >
                ({data.peakDecadeCount.toLocaleString()} films watched)
              </span>
              {/* Spacer + time percent badge */}
              <div style={{ flex: 1 }} />
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.6)',
                  background: 'rgba(255,0,102,0.12)',
                  border: '1px solid rgba(255,0,102,0.2)',
                  borderRadius: 8,
                  padding: '4px 10px',
                  whiteSpace: 'nowrap',
                }}
              >
                {data.timePercent}% of time watching
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Portraits ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <Portrait
              label="On-Screen Crush"
              name={data.onScreenCrush.name}
              countLabel={`${data.onScreenCrush.count} films together`}
              imageUrl={crushUrl}
              fallback="heart"
              accentColor="#FF0066"
              glitch
            />
            <Portrait
              label="Favorite Director"
              name={data.favoriteDirector.name}
              countLabel={`${data.favoriteDirector.count} films directed`}
              imageUrl={directorUrl}
              fallback="user"
              accentColor="#00ffe5"
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 10,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.1em',
          }}
        >
          movieswrapped.com
        </div>
      </div>
    );
  },
);

export default EditorialShareCard;
