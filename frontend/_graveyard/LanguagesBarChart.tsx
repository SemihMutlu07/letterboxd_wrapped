'use client';

import React from 'react';
import Section from '@/components/results/Section';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const COLORS = ['#f97316', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#059669', '#ec4899', '#ec4899'];

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English', fr: 'French', ja: 'Japanese', es: 'Spanish', ko: 'Korean',
  de: 'German', it: 'Italian', ru: 'Russian', pt: 'Portuguese', zh: 'Chinese',
  hi: 'Hindi', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', tr: 'Türkçe'
};

type Row = { language: string; count: number };

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; count: number } }> }) => {
  if (active && payload?.length) {
    const { name, count } = payload[0].payload;
    return (
      <div className="bg-slate-800/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/15 text-white shadow-xl">
        <div className="font-semibold">{name}</div>
        <div className="text-sm opacity-90">{count.toLocaleString()} films</div>
      </div>
    );
  }
  return null;
};

export default function LanguagesBarChart({ data }: { data: Row[] }) {
  const cleaned = (Array.isArray(data) ? data : [])
    .filter(d => d && Number.isFinite(d.count) && d.count > 0)
    .sort((a, b) => a.count - b.count); // Sort ascending for the chart

  const total = Math.max(1, cleaned.reduce((s, d) => s + d.count, 0));

  const chartData = cleaned.slice(-8).map((d, i) => ({ // Get top 8
    ...d,
    name: LANGUAGE_LABEL[d.language] || d.language.toUpperCase(),
    percent: (d.count / total) * 100,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <Section title="Languages" subtitle="Your cinematic linguistic profile">
      <div className="w-full h-[400px] max-w-2xl mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#94a3b8"
              axisLine={false}
              tickLine={false}
              width={80} // Adjust width for language names
            />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.08)' }}
              content={<CustomTooltip />}
              wrapperStyle={{ outline: 'none' }}
            />
            <Bar dataKey="percent" radius={[0, 8, 8, 0]} barSize={28}>
              {chartData.map((entry) => (
                <Cell key={`cell-${entry.language}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
