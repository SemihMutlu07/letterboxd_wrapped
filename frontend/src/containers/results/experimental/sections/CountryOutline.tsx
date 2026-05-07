'use client';

/**
 * CountryOutline — renders a tiny silhouette of a country from world-atlas topology.
 *
 * Loads the TopoJSON once (cached), extracts the geometry for a given ISO-2 code,
 * projects it via a fitted geoPath, and renders a small SVG.
 *
 * Usage: <CountryOutline iso2="TR" size={28} />
 */

import React, { useEffect, useState, memo } from 'react';

// ─── Topology cache (singleton, loaded once) ─────────────────────────────────

interface GeoFeature {
  type: string;
  id: string;
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
  properties: { name: string };
}

let featureCache: Map<string, GeoFeature> | null = null;
let loadPromise: Promise<void> | null = null;

// Reverse map: alpha2 → numeric (built from iso-numeric-to-iso2)
import { ISO_NUMERIC_TO_ALPHA2 } from './world-map/iso-numeric-to-iso2';

const ALPHA2_TO_NUMERIC: Record<string, string> = {};
for (const [num, alpha] of Object.entries(ISO_NUMERIC_TO_ALPHA2)) {
  ALPHA2_TO_NUMERIC[alpha] = num;
}

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

async function loadTopology(): Promise<void> {
  if (featureCache) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const res = await fetch(GEO_URL);
    const topo = await res.json();
    // Inline topojson → geojson conversion (avoid importing topojson-client)
    const obj = topo.objects.countries;
    const features: GeoFeature[] = [];

    if (obj.type === 'GeometryCollection') {
      for (const geom of obj.geometries) {
        const feature = topoFeature(topo, geom);
        if (feature) features.push(feature);
      }
    }

    featureCache = new Map();
    for (const f of features) {
      const iso2 = ISO_NUMERIC_TO_ALPHA2[String(f.id).padStart(3, '0')];
      if (iso2) featureCache.set(iso2, f);
    }
  })();

  return loadPromise;
}

// Minimal topojson → geojson for a single geometry
// (handles Polygon + MultiPolygon, which is all countries-110m uses)
function topoFeature(topology: { arcs: number[][][]; transform?: { scale: number[]; translate: number[] } }, geom: { type: string; id?: string | number; arcs: number[] | number[][] | number[][][]; properties?: { name: string } }): GeoFeature | null {
  const transform = topology.transform;

  function decodeArc(arcIdx: number): number[][] {
    const arc = topology.arcs[arcIdx < 0 ? ~arcIdx : arcIdx];
    const coords: number[][] = [];
    let x = 0, y = 0;
    for (const pt of arc) {
      x += pt[0];
      y += pt[1];
      if (transform) {
        coords.push([x * transform.scale[0] + transform.translate[0], y * transform.scale[1] + transform.translate[1]]);
      } else {
        coords.push([x, y]);
      }
    }
    if (arcIdx < 0) coords.reverse();
    return coords;
  }

  function decodeRing(ring: number[]): number[][] {
    const pts: number[][] = [];
    for (const idx of ring) {
      const decoded = decodeArc(idx);
      // Skip first point of subsequent arcs (shared with previous arc's last point)
      pts.push(...(pts.length > 0 ? decoded.slice(1) : decoded));
    }
    return pts;
  }

  if (geom.type === 'Polygon') {
    const coordinates = (geom.arcs as number[][]).map(decodeRing);
    return { type: 'Feature', id: String(geom.id ?? ''), geometry: { type: 'Polygon', coordinates }, properties: geom.properties ?? { name: '' } };
  }
  if (geom.type === 'MultiPolygon') {
    const coordinates = (geom.arcs as number[][][]).map(polygon => polygon.map(decodeRing));
    return { type: 'Feature', id: String(geom.id ?? ''), geometry: { type: 'MultiPolygon', coordinates }, properties: geom.properties ?? { name: '' } };
  }
  return null;
}

// ─── SVG path from coordinates ───────────────────────────────────────────────

/** Compute area of a ring (shoelace formula) — used to find the largest polygon. */
function ringArea(ring: number[][]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(area / 2);
}

/**
 * For MultiPolygon countries (USA, France, etc.) only keep the largest polygon
 * so that tiny overseas territories don't stretch the bounding box and shrink
 * the mainland to a sliver.
 */
function getLargestPolygon(feature: GeoFeature): number[][][] {
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    return geom.coordinates as number[][][];
  }
  if (geom.type === 'MultiPolygon') {
    const polygons = geom.coordinates as number[][][][];
    let best = polygons[0];
    let bestArea = 0;
    for (const poly of polygons) {
      const a = ringArea(poly[0]); // outer ring
      if (a > bestArea) {
        bestArea = a;
        best = poly;
      }
    }
    return best;
  }
  return [];
}

function geoToSvgPath(feature: GeoFeature, size: number): string {
  // Use only the largest polygon to avoid bounding-box distortion
  const rings = getLargestPolygon(feature);
  if (!rings || rings.length === 0) return '';

  const allPoints: number[][] = [];
  for (const ring of rings) {
    allPoints.push(...ring);
  }

  if (allPoints.length === 0) return '';

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of allPoints) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const geoW = maxX - minX || 1;
  const geoH = maxY - minY || 1;
  const padding = size * 0.08;
  const drawSize = size - padding * 2;
  const scale = Math.min(drawSize / geoW, drawSize / geoH);
  const offsetX = padding + (drawSize - geoW * scale) / 2;
  const offsetY = padding + (drawSize - geoH * scale) / 2;

  const project = (x: number, y: number): [number, number] => [
    offsetX + (x - minX) * scale,
    offsetY + (maxY - y) * scale, // flip Y
  ];

  const ringToPath = (ring: number[][]): string => {
    return ring.map((pt, i) => {
      const [sx, sy] = project(pt[0], pt[1]);
      return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`;
    }).join('') + 'Z';
  };

  let d = '';
  for (const ring of rings) {
    d += ringToPath(ring);
  }

  return d;
}

// ─── Component ───────────────────────────────────────────────────────────────

const CountryOutline = memo(function CountryOutline({
  iso2,
  size = 28,
  color = 'rgba(255,255,255,0.25)',
}: {
  iso2: string;
  size?: number;
  color?: string;
}) {
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTopology().then(() => {
      if (cancelled) return;
      const feature = featureCache?.get(iso2);
      if (feature) {
        setPath(geoToSvgPath(feature, size));
      }
    });
    return () => { cancelled = true; };
  }, [iso2, size]);

  if (!path) {
    return <span className="inline-block shrink-0" style={{ width: size, height: size }} />;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <path d={path} fill={color} fillRule="evenodd" />
    </svg>
  );
});

export default CountryOutline;
