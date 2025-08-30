'use client';

import React from 'react';
import Section from '@/components/results/Section';
import { motion } from 'framer-motion';

type CountryRow = { name: string; count: number };

const colorClasses = [
  'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  'text-blue-500 bg-blue-500/10 border-blue-500/20',
  'text-purple-500 bg-purple-500/10 border-purple-500/20',
  'text-pink-500 bg-pink-500/10 border-pink-500/20',
  'text-orange-500 bg-orange-500/10 border-orange-500/20',
  'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
  'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
];

export default function CountriesList({ countries, total }: { countries: CountryRow[]; total: number; }) {
  return (
    <Section title="Countries" subtitle={`Films from ${total.toLocaleString()} countries`}>
      <div className="space-y-2 md:space-y-3">
        {countries.slice(0, 10).map((country, i) => (
          <motion.div
            key={country.name}
            className={`flex justify-between items-center p-3 rounded-lg border ${colorClasses[i % colorClasses.length]} hover:scale-[1.01] transition-all duration-200`}
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
