'use client';

import React from 'react';
import Section from '@/components/results/Section';
import { motion } from 'framer-motion';

const COLORS = ['#f97316','#a855f7','#3b82f6','#10b981','#eab308','#059669','#ec4899','#22c55e'];

const LANGUAGE_LABEL: Record<string,string> = {
  en:'English', fr:'French', ja:'Japanese', es:'Spanish', ko:'Korean',
  de:'German', it:'Italian', ru:'Russian', pt:'Portuguese', zh:'Chinese',
  hi:'Hindi', sv:'Swedish', no:'Norwegian', da:'Danish', fi:'Finnish', tr:'Türkçe'
};

type Row = { language: string; count: number };

export default function LanguagesChart({ data }: { data: Row[] }) {
  const safe = Array.isArray(data) ? data.filter(d => d && Number.isFinite(d.count)) : [];
  const total = Math.max(1, safe.reduce((s,d)=> s + d.count, 0));

  const slices = safe.map((d, i) => ({
    label: LANGUAGE_LABEL[d.language] ?? d.language.toUpperCase(),
    code:  d.language,
    count: d.count,
    color: COLORS[i % COLORS.length],
    pct:   (d.count / total) * 100
  }));

  // Donut geometry
  const R = 44;                 // radius
  const THICK = 16;             // ring thickness
  const BORDER = 1.2;           // thin white outline around each slice
  const CIRC = 2 * Math.PI * R;

  // visible gap (px along circumference). increase for larger gaps
  const GAP_LEN = Math.max(2.0, THICK * 0.12);

  let cursor = 0;

  return (
    <Section title="Languages" subtitle="Your cinematic linguistic profile">
      <div className="flex flex-col items-center gap-6">
        {/* Donut (üstte) */}
        <div className="w-[210px] sm:w-[240px] md:w-[260px] aspect-square">
          <svg viewBox="0 0 120 120" width="100%" height="100%" role="img" aria-label="Languages distribution">
            {/* çok hafif arkaplan kılavuz */}
            <circle cx="60" cy="60" r={R} fill="none" stroke="#0f1a2c" strokeOpacity="0.85" strokeWidth={THICK} />

            {slices.map((s, idx) => {
              const frac = Math.max(0, s.count / total);
              const fullLen = CIRC * frac;

              // shorten by gap so rounded caps çarpışmasın
              const segLen = Math.max(0, fullLen - GAP_LEN);
              const dash = `${segLen} ${CIRC - segLen}`;

              // start with half-gap lead; advance cursor by seg + gap
              const start = cursor + GAP_LEN / 2;
              cursor += segLen + GAP_LEN;

              return (
                <g key={`${s.code}-${idx}`} transform="rotate(-90 60 60)">
                  {/* 1) border stroke (alt katman) */}
                  <circle
                    cx="60" cy="60" r={R}
                    fill="none"
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth={THICK + BORDER * 2}
                    strokeLinecap="round"
                    strokeDasharray={dash}
                    strokeDashoffset={CIRC - start}
                  />
                  {/* 2) renkli stroke (üst katman) */}
                  <circle
                    cx="60" cy="60" r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={THICK}
                    strokeLinecap="round"
                    strokeDasharray={dash}
                    strokeDashoffset={CIRC - start}
                  >
                    <title>{`${s.label}: ${s.pct.toFixed(1)}% (${s.count} films)`}</title>
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend (daima altta) */}
        <ul className="grid grid-cols-1 gap-2 sm:gap-2.5 w-full max-w-md">
          {slices.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="tabular-nums font-semibold">{s.pct.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
export function CountriesList({
  countries,
  total,
}: {
  countries: { name: string; count: number }[];
  total: number;
}) {
  const color = (i: number) =>
    [
      'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      'text-blue-500 bg-blue-500/10 border-blue-500/20',
      'text-purple-500 bg-purple-500/10 border-purple-500/20',
      'text-pink-500 bg-pink-500/10 border-pink-500/20',
      'text-orange-500 bg-orange-500/10 border-orange-500/20',
      'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
      'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
      'text-green-500 bg-green-500/10 border-green-500/20',
      'text-red-500 bg-red-500/10 border-red-500/20',
      'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    ][i % 10];

  return (
    <Section title="Countries" subtitle={`Films from ${total.toLocaleString()} countries`}>
      <div className="space-y-2 md:space-y-3">
        {countries.slice(0, 10).map((country, i) => (
          <motion.div
            key={country.name}
            className={`flex justify-between items-center p-3 rounded-lg border ${color(i)} hover:scale-[1.01] transition-all duration-200`}
          >
            <div className="flex items-center min-w-0">
              <span className="text-xs md:text-sm font-bold w-6 md:w-8 opacity-70 flex-shrink-0">#{i + 1}</span>
              <span className="font-semibold text-sm md:text-base truncate">{country.name}</span>
            </div>
            <span className="font-bold text-sm md:text-base w-16 text-center py-1 px-3 rounded-lg bg-white/10 border border-white/15 flex-shrink-0 tabular-nums">
              {country.count.toLocaleString()}
            </span>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
