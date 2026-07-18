'use client';

import React, { useState, useMemo } from 'react';
import Section from '@/components/results/Section';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import LangModal from '@/containers/results/experimental/sections/LangModal';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });

const COLORS = ['#ff7a1a', '#ff9852', '#ffb47d', '#d88958', '#b86f45', '#92593b', '#704632'];

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English', fr: 'French', ja: 'Japanese', es: 'Spanish', ko: 'Korean',
  de: 'German', it: 'Italian', ru: 'Russian', pt: 'Portuguese', zh: 'Chinese',
  hi: 'Hindi', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', tr: 'Türkçe'
};

type Row = { language: string; count: number };

interface Film {
  title: string;
  year?: number;
  language?: string;
  rating?: number | null;
}

export default function LanguagesLeaderboard({ data, allFilms }: { data: Row[]; allFilms: any[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [hoveredLanguage, setHoveredLanguage] = useState<string | null>(null);

  const sortedData = useMemo(
    () => (Array.isArray(data) ? data : [])
      .filter(d => d && Number.isFinite(d.count) && d.count > 0)
      .sort((a, b) => b.count - a.count),
    [data],
  );

  const total = sortedData.reduce((sum, row) => sum + row.count, 0);

  // Filter films by selected language
  const selectedFilms = useMemo(() => {
    if (!selectedLanguage) return [];
    return (allFilms ?? [])
      .filter((f: any) => f.language === selectedLanguage)
      .map((f: any) => ({
        title: f.title,
        year: f.year ? Number(f.year) : undefined,
        your_rating: f.rating ?? null,
        poster_path: f.poster_path || undefined,
      }));
  }, [selectedLanguage, allFilms]);

  const handleLanguageClick = (lang: string) => {
    setSelectedLanguage(lang);
    setModalOpen(true);
  };

  return (
    <Section title="Languages" subtitle="Your cinematic linguistic profile">
      <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] lg:items-center">
        <motion.div
          className="results-surface relative h-[260px] overflow-hidden"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.35 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sortedData}
                dataKey="count"
                nameKey="language"
                innerRadius={70}
                outerRadius={104}
                paddingAngle={2}
                stroke="rgba(15,23,42,0.9)"
                strokeWidth={2}
                onClick={(entry) => handleLanguageClick((entry as unknown as Row).language)}
                onMouseEnter={(entry) => setHoveredLanguage((entry as unknown as Row).language)}
                onMouseLeave={() => setHoveredLanguage(null)}
              >
                {sortedData.map((entry, i) => (
                  <Cell
                    key={entry.language}
                    fill={COLORS[i % COLORS.length]}
                    opacity={!hoveredLanguage || hoveredLanguage === entry.language ? 1 : 0.38}
                    className="cursor-pointer transition-opacity duration-150"
                  />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as Row | undefined;
                  if (!row) return null;
                  const name = LANGUAGE_LABEL[row.language] || row.language.toUpperCase();
                  const pct = total ? Math.round((row.count / total) * 100) : 0;
                  return (
                    <div className="rounded-xl border border-orange-500/30 bg-slate-950/95 px-3 py-2 text-sm shadow-2xl">
                      <p className="font-bold text-white">{name}</p>
                      <p className="text-orange-300">{row.count} films · {pct}%</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-4xl font-black text-white">{sortedData.length}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">languages</p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-2">
          {sortedData.map((d, i) => {
            const name = LANGUAGE_LABEL[d.language] || d.language.toUpperCase();
            const color = COLORS[i % COLORS.length];
            const pct = total ? Math.round((d.count / total) * 100) : 0;

            return (
              <motion.button
                key={d.language}
                type="button"
                className="results-row group flex min-h-14 items-center justify-between gap-4 px-2 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--results-text)_4%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--results-accent)]"
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                onClick={() => handleLanguageClick(d.language)}
                onMouseEnter={() => setHoveredLanguage(d.language)}
                onMouseLeave={() => setHoveredLanguage(null)}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--results-text)]">{name}</span>
                    <span className="block text-xs text-[var(--results-muted)]">{pct}% of tracked language data</span>
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--results-text)]">{d.count.toLocaleString()}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Language Modal */}
      {selectedLanguage && (
        <LangModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedLanguage(null);
          }}
          language={selectedLanguage}
          languageLabel={LANGUAGE_LABEL[selectedLanguage] || selectedLanguage.toUpperCase()}
          count={sortedData.find(d => d.language === selectedLanguage)?.count ?? 0}
          films={selectedFilms}
        />
      )}
    </Section>
  );
}
