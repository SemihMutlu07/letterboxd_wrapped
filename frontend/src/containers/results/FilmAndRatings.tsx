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
      <div className="w-full h-64 md:h-80 lg:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: isMobile ? 12 : 30, left: isMobile ? 10 : 20, bottom: isMobile ? 48 : 60 }}>
            <XAxis
              dataKey="decade"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: isMobile ? 10 : 12 }}
              angle={isMobile ? -30 : 0}
              textAnchor={isMobile ? 'end' : 'middle'}
              height={isMobile ? 60 : 40}
              tickLine={{ stroke: '#475569' }}
              interval={isMobile ? 1 : 'preserveStartEnd'}
              axisLine={{ stroke: '#475569' }}
              tickMargin={isMobile ? 2 : 6}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: isMobile ? 10 : 11 }}
              tickLine={{ stroke: '#475569' }}
              axisLine={{ stroke: '#475569' }}
              domain={[0, Math.ceil(max * 1.2)]}
              allowDecimals={false}
              tickCount={isMobile ? 4 : 6}
              tickMargin={isMobile ? 2 : 6}
            />
            <Tooltip
              cursor={{ stroke: primary, strokeWidth: 2, strokeDasharray: '5 5', strokeOpacity: 0.7 }}
              content={({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) =>
                active && payload?.length ? (
                  <div className="bg-slate-900/95 backdrop-blur-sm p-3 rounded-lg border border-orange-500/40 text-white shadow-2xl">
                    <p className="font-bold text-lg mb-1">{label}</p>
                    <p className="text-orange-400 font-semibold">{`${payload[0].value} films`}</p>
                  </div>
                ) : null
              }
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={primary}
              strokeWidth={3}
              dot={{ fill: primary, strokeWidth: 2, stroke: '#0f172a', r: 4 }}
              activeDot={{ r: 8, stroke: primary, strokeWidth: 2, fill: '#0f172a' }}
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
}: {
  data: { label: string; count: number }[];
  max: number;
}) {
  const rating = '#eab308';
  return (
    <Section title="Rating Patterns" subtitle="How you rate films">
      <div className="w-full h-48 md:h-64 lg:h-80">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="label" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af' }}
              domain={[0, Math.ceil(max * 1.2)]}
              allowDecimals={false}
              tickCount={5}
              tickMargin={6}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                borderRadius: '0.75rem',
                color: '#ffffff',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              }}
            />
            <Bar dataKey="count" fill={rating} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}


