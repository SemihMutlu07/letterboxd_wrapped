'use client';

import React, { useState, useMemo } from 'react';
import Section from '@/components/results/Section';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#f97316', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#059669', '#ec4899'];
const OTHER_COLOR = '#64748b';

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English', fr: 'French', ja: 'Japanese', es: 'Spanish', ko: 'Korean',
  de: 'German', it: 'Italian', ru: 'Russian', pt: 'Portuguese', zh: 'Chinese',
  hi: 'Hindi', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', tr: 'Türkçe'
};

type Row = { language: string; count: number };
type WaffleBlock = { language: string; name: string; count: number; color: string };

export default function LanguagesWaffleChart({ data }: { data: Row[] }) {
  const [hovered, setHovered] = useState<WaffleBlock | null>(null);

  const { waffleBlocks, legendRows } = useMemo(() => {
    const cleaned = (Array.isArray(data) ? data : [])
      .filter(d => d && Number.isFinite(d.count) && d.count > 0)
      .sort((a, b) => b.count - a.count);

    const total = Math.max(1, cleaned.reduce((s, d) => s + d.count, 0));

    const top = cleaned.slice(0, 6); // Top 6 + Other
    const tailSum = cleaned.slice(6).reduce((s, d) => s + d.count, 0);

    const legendData = tailSum > 0 
      ? [...top, { language: '__other__', count: tailSum }] 
      : top;

    const blocks: WaffleBlock[] = [];
    let currentBlocks = 0;

    legendData.forEach((d, i) => {
      const isOther = d.language === '__other__';
      const percent = (d.count / total) * 100;
      const blockCount = Math.round(percent);
      const color = isOther ? OTHER_COLOR : COLORS[i % COLORS.length];
      const name = isOther ? 'Other' : LANGUAGE_LABEL[d.language] || d.language.toUpperCase();

      for (let j = 0; j < blockCount && currentBlocks < 100; j++) {
        blocks.push({ language: d.language, name, count: d.count, color });
        currentBlocks++;
      }
    });
    
    // Fill any remaining blocks due to rounding
    while (blocks.length < 100) {
        const lastBlock = blocks[blocks.length - 1];
        blocks.push(lastBlock);
    }

    return { waffleBlocks: blocks, legendRows: legendData };
  }, [data]);

  return (
    <Section title="Languages" subtitle="Your cinematic linguistic profile">
      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:gap-12">
        <div className="relative w-full max-w-sm aspect-square">
          {/* Waffle Grid */}
          <div className="grid grid-cols-10 gap-1.5">
            {waffleBlocks.map((block, i) => (
              <div
                key={i}
                onMouseEnter={() => setHovered(block)}
                onMouseLeave={() => setHovered(null)}
                className="w-full aspect-square rounded-md"
                style={{ backgroundColor: block.color, transition: 'transform 0.2s ease' }}
              />
            ))}
          </div>
          
          {/* Cursor Prompt (Tooltip) */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="bg-slate-800/90 backdrop-blur-sm px-4 py-3 rounded-lg border border-white/15 text-white shadow-xl text-center">
                  <div className="font-semibold text-lg">{hovered.name}</div>
                  <div className="text-sm opacity-90">{hovered.count.toLocaleString()} films</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Legend */}
        <ul className="w-full max-w-md grid grid-cols-1 gap-3">
          {legendRows.map((d, i) => {
            const isOther = d.language === '__other__';
            return (
              <li
                key={d.language}
                className="flex items-center gap-3 min-w-0"
              >
                <span
                  className="inline-block h-4 w-4 rounded-full"
                  style={{ backgroundColor: isOther ? OTHER_COLOR : COLORS[i % COLORS.length] }}
                />
                <span className="truncate font-medium">{isOther ? 'Other' : LANGUAGE_LABEL[d.language]}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
