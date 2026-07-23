'use client';
import React from 'react';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareFilmStat, SharePersonStat } from '../types';

export const displayFont = { fontFamily: 'var(--font-syne), Syne, ui-sans-serif, system-ui, sans-serif' };
export const utilityFont = { fontFamily: 'var(--font-manrope), Manrope, ui-sans-serif, system-ui, sans-serif' };

function imageUrl(path?: string | null) {
  if (!path) return '';
  return path.startsWith('http') ? path : (getTmdbImageUrl(path) ?? '');
}

export function PersonFrame({
  person,
  label,
  className = '',
}: {
  person: SharePersonStat;
  label: string;
  className?: string;
}) {
  const name = person.name.trim() || 'Unknown';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '—';
  const src = imageUrl(person.headshotUrl);
  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <div className="absolute inset-0 grid place-items-center text-6xl font-black opacity-35" style={displayFont}>{initials}</div>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/85 p-3 text-white">
        <div className="text-[11px] uppercase tracking-[0.18em] opacity-70" style={utilityFont}>{label}</div>
        <div
          className="line-clamp-2 text-xl font-black leading-[1.05]"
          style={{ ...displayFont, overflowWrap: 'anywhere' }}
          title={name}
        >
          {name}
        </div>
        <div className="text-[11px] opacity-70" style={utilityFont}>{person.count} films</div>
      </div>
    </div>
  );
}

export function PosterSlots({
  films,
  className = '',
  slotClassName = '',
}: {
  films?: ShareFilmStat[];
  className?: string;
  slotClassName?: string;
}) {
  const slots = Array.from({ length: 5 }, (_, index) => films?.[index]);
  return (
    <div className={`grid grid-cols-5 ${className}`}>
      {slots.map((film, index) => {
        const src = imageUrl(film?.posterPath);
        return (
          <div key={`${film?.title ?? 'empty'}-${index}`} className={`relative overflow-hidden border border-current bg-black/20 ${slotClassName}`}>
            <div className="absolute inset-0 grid place-items-center text-lg font-black opacity-25" style={displayFont}>{String(index + 1).padStart(2, '0')}</div>
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                crossOrigin="anonymous"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            )}
            <div
              className="absolute inset-x-0 bottom-0 line-clamp-2 bg-black/85 px-2 py-1 text-[9px] font-bold leading-tight text-white"
              style={{ ...utilityFont, overflowWrap: 'anywhere' }}
            >
              {film?.title ?? 'No selection'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Username({ username }: { username?: string }) {
  if (!username) return null;
  return (
    <div
      className="w-full min-w-0 max-w-full overflow-hidden text-sm font-bold leading-tight"
      style={{ ...utilityFont, overflowWrap: 'anywhere', wordBreak: 'break-all' }}
      title={`@${username}`}
    >
      @{username}
    </div>
  );
}
