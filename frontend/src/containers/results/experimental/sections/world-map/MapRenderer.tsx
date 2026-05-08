'use client';

/**
 * MapRenderer — the actual SVG world choropleth.
 *
 * This file is NEVER imported directly; it is only loaded via:
 *   next/dynamic(() => import('./MapRenderer'), { ssr: false })
 *
 * That keeps the react-simple-maps + world-atlas topojson out of the main
 * bundle. The ~100 KB topology JSON is fetched from jsDelivr CDN on first render.
 *
 * How to add another map-like section
 * ────────────────────────────────────
 * Export a new component from this file (or create a sibling MapRenderer2.tsx)
 * that accepts a different `getFeatureColor` prop. Reuse ComposableMap +
 * Geographies — the topology URL and projection stay the same.
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { isoNumericToAlpha2 } from './iso-numeric-to-iso2';
import type { CountryDatum, MapMode } from './world-map-aggregator';
import { getCountryColor } from './world-map-aggregator';

// CDN URL for world-atlas 110m countries TopoJSON.
// ~99 KB uncompressed; served gzip ~30 KB from jsDelivr.
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TooltipState {
  name: string;
  count: number;
  avg_rating?: number;
  rated_count?: number;
  x: number;
  y: number;
}

export interface MapRendererProps {
  byIso2: Map<string, CountryDatum>;
  mode: MapMode;
  highlightedIso2?: string | null;
  onCountryHover?: (iso2: string | null) => void;
  onCountryClick?: (countryName: string, iso2: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const MapRenderer = memo(function MapRenderer({ byIso2, mode, highlightedIso2, onCountryHover, onCountryClick }: MapRendererProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showZoomHint, setShowZoomHint] = useState(true);
  const [hintFading, setHintFading] = useState(false);

  // Auto-dismiss zoom hint after 4s
  useEffect(() => {
    if (!showZoomHint) return;
    const t = setTimeout(() => setHintFading(true), 3500);
    const t2 = setTimeout(() => setShowZoomHint(false), 4500);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [showZoomHint]);

  const dismissHint = useCallback(() => {
    setHintFading(true);
    setTimeout(() => setShowZoomHint(false), 300);
  }, []);

  const handleMoveEnd = useCallback(({ zoom: z }: { zoom: number }) => {
    setZoom(z);
    dismissHint();
  }, [dismissHint]);

  const handleMouseEnter = useCallback(
    (geo: { id?: string | number; properties?: { name?: string } }, evt: React.MouseEvent) => {
      const iso2 = isoNumericToAlpha2(geo.id);
      const datum = iso2 ? byIso2.get(iso2) : undefined;
      const name = datum?.name ?? geo.properties?.name ?? (iso2 ?? 'Unknown');

      setTooltip({
        name,
        count: datum?.count ?? 0,
        avg_rating: datum?.avg_rating,
        rated_count: datum?.rated_count,
        x: evt.nativeEvent.offsetX,
        y: evt.nativeEvent.offsetY,
      });
      if (iso2) onCountryHover?.(iso2);
    },
    [byIso2, onCountryHover],
  );

  const handleMouseMove = useCallback((evt: React.MouseEvent) => {
    setTooltip((prev) => (prev ? { ...prev, x: evt.nativeEvent.offsetX, y: evt.nativeEvent.offsetY } : prev));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    onCountryHover?.(null);
  }, [onCountryHover]);

  const handleGeoClick = useCallback(
    (geo: { id?: string | number; properties?: { name?: string } }) => {
      const iso2 = isoNumericToAlpha2(geo.id);
      const datum = iso2 ? byIso2.get(iso2) : undefined;
      if (!datum || datum.count === 0) return;
      const name = datum.name ?? geo.properties?.name ?? 'Unknown';
      if (iso2) onCountryClick?.(name, iso2);
    },
    [byIso2, onCountryClick],
  );

  return (
    <div className="relative w-full select-none" onMouseLeave={handleMouseLeave} onMouseMove={handleMouseMove}>
      {/* Zoom controls */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <ZoomBtn label="+" onClick={() => setZoom((z) => Math.min(z + 0.5, 6))} />
        <ZoomBtn label="−" onClick={() => setZoom((z) => Math.max(z - 0.5, 1))} />
        {zoom > 1 && (
          <ZoomBtn label="↺" onClick={() => setZoom(1)} title="Reset zoom" small />
        )}
      </div>

      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155, center: [0, 10] }}
        style={{ width: '100%', height: 'auto' }}
      >
        {/* SVG filter for neon glow on highlighted countries */}
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feFlood floodColor="#00c030" floodOpacity="0.6" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <ZoomableGroup zoom={zoom} center={[0, 10]} onMoveEnd={handleMoveEnd}>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => {
                const iso2 = isoNumericToAlpha2(geo.id);
                const datum = iso2 ? byIso2.get(iso2) : undefined;
                const baseFill = getCountryColor(datum, mode);
                const hasData = !!datum && datum.count > 0;
                const isHighlighted = iso2 != null && iso2 === highlightedIso2;
                const fill = isHighlighted ? lighten(lighten(baseFill)) : baseFill;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={isHighlighted ? '#00e676' : '#0f172a'}
                    strokeWidth={isHighlighted ? 1.5 : 0.4}
                    filter={isHighlighted ? 'url(#neon-glow)' : undefined}
                    style={{
                      default: { outline: 'none' },
                      hover: {
                        fill: hasData ? lighten(baseFill) : '#334155',
                        outline: 'none',
                        cursor: hasData ? 'pointer' : 'default',
                      },
                      pressed: { outline: 'none' },
                    }}
                    onMouseEnter={(evt: React.MouseEvent<SVGPathElement>) => handleMouseEnter(geo, evt)}
                    onClick={() => handleGeoClick(geo)}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Zoom hint */}
      {showZoomHint && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-sm"
          style={{
            opacity: hintFading ? 0 : 1,
            transition: 'opacity 0.5s ease-out',
            animation: hintFading ? undefined : 'zoom-hint-pulse 2s ease-in-out infinite',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-slate-300">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[11px] text-slate-300 font-medium whitespace-nowrap">
            Scroll to zoom
          </span>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-white/10 bg-[#0f172a]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            transform: tooltip.x > 600 ? 'translateX(-110%)' : undefined,
          }}
        >
          <p className="font-semibold text-white">{tooltip.name}</p>
          {tooltip.count > 0 ? (
            <>
              <p className="text-slate-400">
                {tooltip.count} film{tooltip.count !== 1 ? 's' : ''}
              </p>
              {mode === 'highest_rated' && tooltip.avg_rating != null && (
                <p className="text-[#00c030]">
                  ★ {tooltip.avg_rating.toFixed(2)}
                  <span className="text-slate-500 ml-1">
                    ({tooltip.rated_count} rated)
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="text-slate-600 italic">No films watched</p>
          )}
        </div>
      )}

      {/* Keyframe for zoom hint pulse */}
      <style>{`
        @keyframes zoom-hint-pulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.05); }
        }
      `}</style>
    </div>
  );
});

export default MapRenderer;

// ─── Legend ───────────────────────────────────────────────────────────────────

export function MapLegend({ mode }: { mode: MapMode }) {
  const items =
    mode === 'most_watched'
      ? [
          { color: '#0d2b16', label: '1' },
          { color: '#14532d', label: '2–4' },
          { color: '#166534', label: '5–15' },
          { color: '#15803d', label: '16–50' },
          { color: '#16a34a', label: '51–150' },
          { color: '#00c030', label: '150+' },
        ]
      : [
          { color: '#7f1d1d', label: '< 2.5★' },
          { color: '#92400e', label: '2.5★' },
          { color: '#713f12', label: '3.0★' },
          { color: '#166534', label: '3.5★' },
          { color: '#15803d', label: '4.0★' },
          { color: '#00c030', label: '4.5★+' },
        ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded-[2px] shrink-0 border border-white/[0.06]"
            style={{ background: item.color }}
          />
          <span
            className="text-[10px] text-slate-400"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace" }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ZoomBtn({
  label,
  onClick,
  title,
  small,
}: {
  label: string;
  onClick: () => void;
  title?: string;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      className={[
        'rounded border border-slate-700/60 bg-slate-800/80 text-slate-300 hover:text-white hover:border-slate-500 transition-colors leading-none',
        small ? 'text-[10px] w-5 h-5 flex items-center justify-center' : 'text-sm w-6 h-6 flex items-center justify-center',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

/** Lighten a hex color slightly for hover state (crude but effective). */
function lighten(hex: string): string {
  // Parse 6-digit hex and add ~30 to each channel
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 30);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 30);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 30);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
