'use client';

import React, { useState, useMemo } from 'react';
import Section from '@/components/results/Section';
import { motion } from 'framer-motion';
import LangModal from '@/containers/results/experimental/sections/LangModal';

const COLORS = ['#f97316', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#059669', '#ec4899'];

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

  // 1. Sanitize and sort data from highest to lowest
  const sortedData = (Array.isArray(data) ? data : [])
    .filter(d => d && Number.isFinite(d.count) && d.count > 0)
    .sort((a, b) => b.count - a.count);

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
              className="relative flex items-center justify-between gap-4 p-4 overflow-hidden rounded-lg bg-slate-800/50 cursor-pointer hover:bg-slate-800/70 transition-colors"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() => handleLanguageClick(d.language)}
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

      {/* Language Modal */}
      {selectedLanguage && (
        <LangModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedLanguage(null);
          }}
          language={selectedLanguage}
          count={sortedData.find(d => d.language === selectedLanguage)?.count ?? 0}
          films={selectedFilms}
        />
      )}
    </Section>
  );
}
