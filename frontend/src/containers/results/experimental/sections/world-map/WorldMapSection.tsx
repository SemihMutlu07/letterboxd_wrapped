'use client';

/**
 * WORLD MAP SECTION — "Explorer's Map" choropleth
 *
 * Cinematic explorer aesthetic with passport stamps, neon glow, and atlas legend.
 *
 * Data requirements:
 *   - stats.countries_iso_data — ISO-2 keyed country counts (preferred)
 *   - Fallback: stats.top_countries — name-only (map coloring disabled)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import type { StatsData } from '../../types';
import { trackEvent, trackConsentedEvent, getPosterUrl } from '@/lib/analytics';
import {
  requiresWorldMap,
  buildCountryLookup,
  type MapMode,
  type CountryDatum,
} from './world-map-aggregator';
import type { GateResult } from '../section-utils';
import { toggleClass, LB_GREEN } from '../section-utils';

const MapRenderer = dynamic(() => import('./MapRenderer'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});
const MapLegend = dynamic(() => import('./MapRenderer').then((m) => ({ default: m.MapLegend })), {
  ssr: false,
  loading: () => null,
});

export { requiresWorldMap };
export type { GateResult };

const PAGE_SIZE = 10;
const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// ─── Component ───────────────────────────────────────────────────────────────

export default function WorldMapSection({ stats }: { stats: StatsData }) {
  const gate = requiresWorldMap(stats);
  if (!gate.ok) return null;

  return <WorldMapInner stats={stats} />;
}

const DRAWER_PAGE_SIZE = 12;

interface SelectedCountry {
  name: string;
  iso2: string;
}

function WorldMapInner({ stats }: { stats: StatsData }) {
  const [mode, setMode] = useState<MapMode>('most_watched');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [hoveredIso2, setHoveredIso2] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedCountry | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(DRAWER_PAGE_SIZE);

  useEffect(() => {
    trackEvent('world_map_viewed');
  }, []);

  const mapData = useMemo(() => buildCountryLookup(stats, mode), [stats, mode]);

  const hasIsoData = (stats.countries_iso_data?.length ?? 0) > 0;
  const hasRatedMode = mapData.ratedModeAvailable;

  const handleModeChange = (next: MapMode) => {
    setMode(next);
    setVisible(PAGE_SIZE);
    trackConsentedEvent('world_map_mode_changed', { mode: next });
  };

  const handleCountryHover = (iso2: string | null) => {
    setHoveredIso2(iso2);
    if (iso2) trackConsentedEvent('world_map_country_hovered', { country_code: iso2 });
  };

  const handleCountryClick = useCallback((name: string, iso2: string) => {
    setSelected((prev) => (prev?.iso2 === iso2 ? null : { name, iso2 }));
    setDrawerVisible(DRAWER_PAGE_SIZE);
    trackConsentedEvent('world_map_country_clicked', { country: name, iso2 });
  }, []);

  // Films for the selected country
  const countryFilms = useMemo(() => {
    if (!selected || !stats.all_films) return [];
    return stats.all_films.filter((f) => f.countries?.includes(selected.name));
  }, [selected, stats.all_films]);

  const shown = mapData.ranked.slice(0, visible);
  const hasMore = visible < mapData.ranked.length;

  return (
    <div className="bg-[#0d0d0d]/90 border border-white/[0.06] rounded-2xl p-5 md:p-6 space-y-4 relative overflow-hidden">
      {/* Subtle grid background texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── Header ── */}
      <div className="relative flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
            Explorer&apos;s Map
          </h3>
          <p className="text-lg font-bold text-white mt-0.5">
            {mapData.totalCountries}{' '}
            <span className="text-slate-500 text-sm font-normal">
              countr{mapData.totalCountries !== 1 ? 'ies' : 'y'} explored
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-slate-800/60 border border-slate-700/30 rounded-full">
          <button
            className={toggleClass(mode === 'most_watched')}
            onClick={() => handleModeChange('most_watched')}
          >
            Most Watched
          </button>
          <button
            className={toggleClass(mode === 'highest_rated')}
            onClick={() => hasRatedMode && handleModeChange('highest_rated')}
            disabled={!hasRatedMode}
            title={!hasRatedMode ? 'Ratings data not available in this export' : "Your average rating across films you've rated for each country (minimum 5 rated films)"}
            style={!hasRatedMode ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
          >
            Highest Rated
          </button>
        </div>
      </div>

      {/* ── Body: map + sidebar ── */}
      <div className="relative flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">
        <div className="lg:flex-[1.7] min-w-0 w-full">
          <div className="rounded-[1.35rem] border border-white/[0.08] bg-[#111318]/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            {hasIsoData ? (
              <MapRenderer
                byIso2={mapData.byIso2}
                mode={mode}
                highlightedIso2={selected?.iso2 ?? hoveredIso2}
                onCountryHover={handleCountryHover}
                onCountryClick={handleCountryClick}
              />
            ) : (
              <NoIsoFallback />
            )}
          </div>

          {/* ── Country films drawer ── */}
          <AnimatePresence>
            {selected && stats.all_films && (
              <motion.div
                key={selected.iso2}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#111318]/80 p-4">
                  {/* Drawer header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{selected.name}</h4>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#00c03026', color: LB_GREEN }}
                      >
                        {countryFilms.length} film{countryFilms.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                      title="Close"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  {countryFilms.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">
                      No film data available for this country.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
                        {countryFilms.slice(0, drawerVisible).map((film) => (
                          <CountryFilmCard key={`${film.title}-${film.year}`} film={film} />
                        ))}
                      </div>
                      {drawerVisible < countryFilms.length && (
                        <div className="flex justify-center pt-3">
                          <button
                            onClick={() => setDrawerVisible((v) => v + DRAWER_PAGE_SIZE)}
                            className="text-xs font-semibold px-4 py-1.5 rounded-full border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                          >
                            Show {Math.min(countryFilms.length - drawerVisible, DRAWER_PAGE_SIZE)} more
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar: ranked list */}
        <div className="lg:flex-1 lg:max-w-[22rem] min-w-0 w-full space-y-1.5">
          <p
            className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2"
            style={{ fontFamily: MONO }}
          >
            {mode === 'highest_rated' ? 'Top Rated' : 'Most Watched'}
          </p>
          {shown.map((row, i) => (
            <SidebarRow
              key={row.iso2 || row.name}
              rank={i + 1}
              datum={row}
              mode={mode}
              maxCount={mapData.maxCount}
              highlighted={row.iso2 === hoveredIso2}
              onHover={(iso2) => setHoveredIso2(iso2)}
              onClick={() => row.iso2 && handleCountryClick(row.name, row.iso2)}
            />
          ))}
          {hasMore && (
            <button
              onClick={() => {
                setVisible((v) => v + PAGE_SIZE);
                trackConsentedEvent('world_map_show_more_clicked');
              }}
              className="mt-2 text-xs font-semibold px-4 py-2 w-full rounded-full border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
              style={{ fontFamily: MONO }}
            >
              Show {Math.min(mapData.ranked.length - visible, PAGE_SIZE)} more
            </button>
          )}
        </div>
      </div>

      {/* ── Atlas-style Map Key ── */}
      {hasIsoData && (
        <div className="relative pt-2">
          <div className="inline-flex items-center gap-3 bg-[#0a0a0a]/80 border border-white/[0.06] rounded-lg px-4 py-2.5">
            <span
              className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
              style={{ fontFamily: MONO }}
            >
              Map Key
            </span>
            <div className="w-px h-4 bg-slate-700/50" />
            <MapLegend mode={mode} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar row ─────────────────────────────────────────────────────────────

function SidebarRow({
  rank,
  datum,
  mode,
  maxCount,
  highlighted,
  onHover,
  onClick,
}: {
  rank: number;
  datum: CountryDatum;
  mode: MapMode;
  maxCount: number;
  highlighted?: boolean;
  onHover?: (iso2: string | null) => void;
  onClick?: () => void;
}) {
  const barPct =
    mode === 'highest_rated' && datum.avg_rating != null
      ? (datum.avg_rating / 5) * 100
      : maxCount > 0
      ? (datum.count / maxCount) * 100
      : 0;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-1.5 py-1 transition-all duration-200 cursor-pointer ${
        highlighted
          ? 'bg-[#00c030]/10 shadow-[0_0_12px_rgba(0,192,48,0.15)]'
          : 'hover:bg-white/[0.03]'
      }`}
      onMouseEnter={() => datum.iso2 && onHover?.(datum.iso2)}
      onMouseLeave={() => onHover?.(null)}
      onClick={onClick}
    >
      <span
        className="w-5 text-right text-xs shrink-0"
        style={{
          fontFamily: MONO,
          color: rank <= 3 ? '#00c030' : '#475569',
          fontWeight: rank <= 3 ? 700 : 400,
        }}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs truncate transition-colors duration-200 ${highlighted ? 'text-white font-medium' : 'text-slate-200'}`}>
            {datum.name}
          </span>
          <span
            className="text-xs shrink-0"
            style={{ color: '#00c030', fontFamily: MONO }}
          >
            {mode === 'highest_rated' && datum.avg_rating != null
              ? `★ ${datum.avg_rating.toFixed(2)}`
              : `${datum.count}`}
          </span>
        </div>
        <div className="h-1 rounded-full bg-slate-800/60 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${barPct}%`,
              background: highlighted
                ? 'linear-gradient(90deg, #00c030, #00e676)'
                : '#00c030',
              boxShadow: highlighted ? '0 0 6px rgba(0,192,48,0.4)' : undefined,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Country film card ──────────────────────────────────────────────────────

function CountryFilmCard({ film }: { film: NonNullable<StatsData['all_films']>[number] }) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = film.poster_path ? getPosterUrl(film.poster_path, 'grid') : null;
  const hue = film.title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const showFallback = !imageUrl || imgFailed;

  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative w-full aspect-[2/3] rounded-lg overflow-hidden ring-1 ring-white/8"
        style={showFallback ? { background: `hsl(${hue},25%,18%)` } : undefined}
      >
        {imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={film.title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="flex items-end p-1.5 h-full text-[9px] text-white/40 leading-tight">
            {film.title}
          </span>
        )}
        {film.rating != null && (
          <span className="absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-[#facc15] backdrop-blur-sm">
            ★ {film.rating.toFixed(1)}
          </span>
        )}
      </div>
      <p className="text-[10px] font-medium text-white leading-tight line-clamp-1 px-0.5">{film.title}</p>
      {film.year && (
        <p className="text-[9px] text-slate-500 px-0.5">{film.year}</p>
      )}
    </div>
  );
}

// ─── Small sub-components ────────────────────────────────────────────────────

function MapSkeleton() {
  return (
    <div className="w-full aspect-[16/9] lg:aspect-[16/8] rounded-xl bg-slate-800/30 animate-pulse flex items-center justify-center">
      <span className="text-slate-600 text-xs">Loading map…</span>
    </div>
  );
}

function NoIsoFallback() {
  return (
    <div className="w-full aspect-[16/9] lg:aspect-[16/8] rounded-xl bg-slate-800/30 flex flex-col items-center justify-center gap-2 border border-slate-700/30">
      <p className="text-slate-400 text-sm font-medium">Map coloring unavailable</p>
      <p className="text-slate-600 text-xs text-center max-w-xs">
        TMDB production country ISO codes were not returned for this export.
        The ranked list on the right still shows your countries.
      </p>
    </div>
  );
}
