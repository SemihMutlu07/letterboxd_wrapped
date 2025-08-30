'use client';

import React from 'react';
import Section from '@/components/results/Section';
import { motion } from 'framer-motion';

const COLORS = ['#f97316', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#059669', '#ec4899'];

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English', fr: 'French', ja: 'Japanese', es: 'Spanish', ko: 'Korean',
  de: 'German', it: 'Italian', ru: 'Russian', pt: 'Portuguese', zh: 'Chinese',
  hi: 'Hindi', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', tr: 'Türkçe'
};

type Row = { language: string; count: number };

export default function LanguagesLeaderboard({ data }: { data: Row[] }) {
  // 1. Sanitize and sort data from highest to lowest
  const sortedData = (Array.isArray(data) ? data : [])
    .filter(d => d && Number.isFinite(d.count) && d.count > 0)
    .sort((a, b) => b.count - a.count);

  // 2. Find the count of the top language to create proportional bars
  const maxCount = sortedData.length > 0 ? sortedData[0].count : 1;

  return (
    <Section title="Languages" subtitle="Your cinematic linguistic profile">
      <div className="w-full max-w-2xl mx-auto space-y-2.5">
        {sortedData.map((d, i) => {
          const name = LANGUAGE_LABEL[d.language] || d.language.toUpperCase();
          const color = COLORS[i % COLORS.length];
          // 3. Calculate the width of the bar relative to the top language
          const barWidth = `${(d.count / maxCount) * 100}%`;

          return (
            <motion.div
              key={d.language}
              className="relative flex items-center justify-between gap-4 p-4 overflow-hidden rounded-lg bg-slate-800/50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              {/* Background Bar */}
              <div
                className="absolute top-0 left-0 h-full opacity-10"
                style={{ width: barWidth, backgroundColor: color }}
              />
              
              {/* Content */}
              <div className="flex items-center gap-4">
                <span 
                  className="text-sm font-bold w-6 text-center"
                  style={{ color: color }}
                >
                  #{i + 1}
                </span>
                <span className="font-semibold">{name}</span>
              </div>
              <span className="font-mono font-semibold text-white">
                {d.count.toLocaleString()}
              </span>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}
