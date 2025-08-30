'use client';

import React from 'react';
import Section from '@/components/results/Section';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#f97316', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#059669', '#ec4899'];

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English', fr: 'French', ja: 'Japanese', es: 'Spanish', ko: 'Korean',
  de: 'German', it: 'Italian', ru: 'Russian', pt: 'Portuguese', zh: 'Chinese',
  hi: 'Hindi', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', tr: 'Türkçe'
};

type Row = { language: string; count: number };

type LanguageTooltipProps = {
  active?: boolean;
  payload?: { payload: { language: string; count: number; color: string } }[];
};

const CustomTooltip: React.FC<LanguageTooltipProps> = ({ active, payload }) => {
  if (active && payload?.length) {
    const item = payload[0].payload;
    const name = item.language === '__other__'
      ? 'Other'
      : LANGUAGE_LABEL[item.language] || item.language.toUpperCase();

    return (
      <div className="bg-slate-800/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/15 text-white shadow-xl">
        <div className="font-semibold">{name}</div>
        <div className="text-sm opacity-90">{item.count.toLocaleString()} films</div>
      </div>
    );
  }
  return null;
};

export default function LanguagesChart({ data }: { data: Row[] }) {
  const cleaned = (Array.isArray(data) ? data : [])
    .filter(d => d && Number.isFinite(d.count) && d.count > 0)
    .sort((a, b) => b.count - a.count);

  const total = Math.max(1, cleaned.reduce((s, d) => s + d.count, 0));

  const TOP_N = 7;
  const top = cleaned.slice(0, TOP_N);
  const tailSum = cleaned.slice(TOP_N).reduce((s, d) => s + d.count, 0);

  const chartRows: Row[] = tailSum > 0
    ? [...top, { language: '__other__', count: tailSum }]
    : top;

  const legendRows = top;

  const pieData = chartRows.map((d, i) => ({
    language: d.language,
    count: d.count,
    color: d.language === '__other__' ? '#64748b' : COLORS[i % COLORS.length],
  }));

  const percent = (c: number) => ((c / total) * 100);

  return (
    <Section title="Languages" subtitle="Your cinematic linguistic profile">
      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:gap-12">
        {/* Chart */}
        <div className="w-full max-w-[480px] aspect-square flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="count"
                nameKey="language"
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                minAngle={1.5}
                paddingAngle={2}
                cornerRadius={8}
                isAnimationActive={false}
              >
                {pieData.map((entry) => (
                  <Cell
                    key={`cell-${entry.language}`}
                    fill={entry.color}
                    stroke={"#0f172a"} // Use your background color
                    strokeWidth={4}
                  />
                ))}
              </Pie>
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                content={<CustomTooltip />}
                wrapperStyle={{ outline: 'none' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <motion.ul className="w-full max-w-md grid grid-cols-1 gap-3">
          {legendRows.map((d, i) => {
            const pct = percent(d.count);
            const label = LANGUAGE_LABEL[d.language] || d.language.toUpperCase();
            return (
              <li
                key={d.language}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate font-medium">{label}</span>
                </span>
                <span className="tabular-nums font-semibold text-white/90">{pct.toFixed(1)}%</span>
              </li>
            );
          })}
          {tailSum > 0 && (
            <li className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 opacity-70">
              <span className="flex items-center gap-3 min-w-0">
                <span className="inline-block h-3 w-3 rounded-full bg-slate-500" />
                <span className="truncate font-medium">Other</span>
              </span>
              <span className="tabular-nums font-semibold">{percent(tailSum).toFixed(1)}%</span>
            </li>
          )}
        </motion.ul>
      </div>
    </Section>
  );
}
