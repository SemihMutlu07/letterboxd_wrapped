'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Section from '@/components/results/Section';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });

export function FilmHistory({
  data,
  max,
  isMobile,
}: {
  data: { decade: string; count: number }[];
  max: number;
  isMobile: boolean;
}) {
  const primary = '#f97316';
  return (
    <Section title="Film History" subtitle="Your journey through cinema decades">
      <div className="w-full h-56 md:h-72 lg:h-80 px-2 md:px-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={data} 
            margin={{ 
              top: 16, 
              right: isMobile ? 8 : 24, 
              left: isMobile ? 4 : 16, 
              bottom: isMobile ? 32 : 48 
            }}
          >
            <XAxis
              dataKey="decade"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: isMobile ? 9 : 11 }}
              angle={isMobile ? -25 : 0}
              textAnchor={isMobile ? 'end' : 'middle'}
              height={isMobile ? 40 : 32}
              tickLine={{ stroke: '#475569' }}
              interval={isMobile ? 1 : 'preserveStartEnd'}
              axisLine={{ stroke: '#475569' }}
              tickMargin={isMobile ? 1 : 4}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: isMobile ? 9 : 10 }}
              tickLine={{ stroke: '#475569' }}
              axisLine={{ stroke: '#475569' }}
              domain={[0, Math.ceil(max * 1.1)]}
              allowDecimals={false}
              tickCount={isMobile ? 4 : 5}
              tickMargin={isMobile ? 1 : 4}
              width={isMobile ? 32 : 40}
            />
            <Tooltip
              cursor={{ stroke: primary, strokeWidth: 2, strokeDasharray: '5 5', strokeOpacity: 0.7 }}
              content={({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string | number }) =>
                active && payload?.length ? (
                  <div className="bg-slate-900/95 backdrop-blur-sm p-2 md:p-3 rounded-lg border border-orange-500/40 text-white shadow-2xl">
                    <p className="font-bold text-sm md:text-lg mb-1">{String(label)}</p>
                    <p className="text-orange-400 font-semibold text-xs md:text-sm">{`${payload[0].value} films`}</p>
                  </div>
                ) : null
              }
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={primary}
              strokeWidth={isMobile ? 2.5 : 3}
              dot={{ fill: primary, strokeWidth: 2, stroke: '#0f172a', r: isMobile ? 3 : 4 }}
              activeDot={{ r: isMobile ? 6 : 8, stroke: primary, strokeWidth: 2, fill: '#0f172a' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

export function RatingsBar({
  data,
  max,
  isMobile,
  mostCommonRating,
}: {
  data: { label: string; count: number }[];
  max: number;
  isMobile: boolean;
  mostCommonRating?: number;
}) {
  const rating = '#eab308';

  return (
    <Section title="Rating Patterns" subtitle="How you rate films">
      {mostCommonRating != null && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Most given rating</span>
          <span className="text-sm font-black text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-1">{mostCommonRating}★</span>
        </div>
      )}
      <div className="w-full h-44 md:h-56 lg:h-64 px-2 md:px-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            margin={{ 
              top: 12, 
              right: isMobile ? 8 : 20, 
              left: isMobile ? 4 : 12, 
              bottom: isMobile ? 16 : 24 
            }}
          >
            <XAxis 
              dataKey="label" 
              stroke="#9ca3af" 
              tick={{ fill: '#9ca3af', fontSize: isMobile ? 9 : 11 }}
              tickLine={{ stroke: '#64748b' }}
              axisLine={{ stroke: '#64748b' }}
              tickMargin={isMobile ? 2 : 4}
              interval={isMobile ? 1 : 'preserveStartEnd'}
            />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: isMobile ? 9 : 10 }}
              domain={[0, Math.ceil(max * 1.1)]}
              allowDecimals={false}
              tickCount={isMobile ? 4 : 5}
              tickMargin={isMobile ? 2 : 4}
              width={isMobile ? 28 : 36}
              tickLine={{ stroke: '#64748b' }}
              axisLine={{ stroke: '#64748b' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                borderRadius: '0.75rem',
                color: '#ffffff',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                fontSize: isMobile ? '12px' : '14px',
                padding: isMobile ? '8px' : '12px',
              }}
            />
            <Bar 
              dataKey="count" 
              fill={rating} 
              radius={[isMobile ? 2 : 4, isMobile ? 2 : 4, 0, 0]} 
              maxBarSize={isMobile ? 32 : 48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}


