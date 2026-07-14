'use client';

import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

type Row = { language: string; count: number };

export default function LanguagesPieChart({
  sortedData,
  colors,
  total,
  hoveredLanguage,
  onHover,
  onLeave,
  onSliceClick,
  languageLabel,
}: {
  sortedData: Row[];
  colors: string[];
  total: number;
  hoveredLanguage: string | null;
  onHover: (language: string) => void;
  onLeave: () => void;
  onSliceClick: (language: string) => void;
  languageLabel: Record<string, string>;
}) {
  return (
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
          isAnimationActive={false}
          onClick={(entry: Row) => onSliceClick(entry.language)}
          onMouseEnter={(entry: Row) => onHover(entry.language)}
          onMouseLeave={onLeave}
        >
          {sortedData.map((entry, i) => (
            <Cell
              key={entry.language}
              fill={colors[i % colors.length]}
              opacity={!hoveredLanguage || hoveredLanguage === entry.language ? 1 : 0.38}
              className="cursor-pointer transition-opacity duration-150"
            />
          ))}
        </Pie>
        <Tooltip
          cursor={false}
          isAnimationActive={false}
          position={{ x: 8, y: 8 }}
          allowEscapeViewBox={{ x: true, y: true }}
          content={({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload;
            const name = languageLabel[row.language] || row.language.toUpperCase();
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
  );
}
