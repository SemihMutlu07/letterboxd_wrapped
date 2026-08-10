import React from 'react';

import type { ShareCardData } from '../types';
import {
  Brand,
  GenresLine,
  Metric,
  PersonPanel,
  Username,
} from './shared/LayoutPrimitives';

type Props = { data: ShareCardData };

const AdmitOneShareCard = React.forwardRef<HTMLDivElement, Props>(
  function AdmitOneShareCard({ data }, ref) {
    return (
      <div
        ref={ref}
        data-export-root="true"
        className="relative h-[1200px] w-[675px] overflow-hidden bg-[#f7f3ec] text-[#191919]"
        style={{ fontFamily: "'Avenir Next', Manrope, 'Segoe UI', system-ui, sans-serif" }}
      >
        <div className="absolute right-0 top-0 h-[380px] w-[380px] rounded-bl-full bg-[#ffb000]/20" />
        <div className="relative mx-10 flex h-full min-w-0 flex-col py-[150px]">
          <header className="min-w-0">
            <div className="flex min-w-0 items-start justify-between gap-6">
              <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#686868]">{data.year} in film</p>
              <Username username={data.username} className="max-w-[230px] text-right text-[12px] font-semibold text-[#686868]" />
            </div>
            <h1 className="mt-4 text-[49px] font-semibold leading-[0.94] tracking-[-0.045em] [text-wrap:balance]">
              Your Letterboxd Wrapped
            </h1>
          </header>

          <section className="mt-7 grid min-w-0 grid-cols-[minmax(0,1fr)_190px] items-end gap-5 border-y border-black/15 py-5">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#686868]">Films watched</p>
              <strong className="block text-[96px] font-semibold leading-[0.8] tracking-[-0.06em] tabular-nums">
                {data.watchedFilms}
              </strong>
            </div>
            <p className="text-[16px] font-medium leading-relaxed text-[#555]">
              {data.writtenReviews} reviews<br />
              {data.spentDays} days watching<br />
              {data.spentHours} hours total
            </p>
          </section>

          <section className="mt-6 grid grid-cols-3 gap-3">
            <Metric
              label="Cinema Scale"
              value={`${Math.round(data.cinemaScale)}/100`}
              className="rounded-2xl bg-white p-4 shadow-sm"
              valueClassName="text-[27px] font-semibold leading-none tabular-nums"
            />
            <Metric
              label="Peak decade"
              value={data.peakDecade}
              detail={`${data.peakDecadeCount} films`}
              className="rounded-2xl bg-white p-4 shadow-sm"
              valueClassName="text-[27px] font-semibold leading-none"
            />
            <Metric
              label="Common rating"
              value={`${data.mostCommonRating}★`}
              className="rounded-2xl bg-white p-4 shadow-sm"
              valueClassName="text-[27px] font-semibold leading-none"
            />
          </section>

          <section className="mt-6 grid min-h-0 min-w-0 flex-1 grid-rows-2 gap-4">
            <PersonPanel
              person={data.onScreenCrush}
              label="On-screen crush"
              countLabel="films together"
              className="rounded-[24px] bg-white p-4 shadow-sm"
              mediaClassName="w-[102px] rounded-[18px] bg-[#e8e3db]"
              labelClassName="text-[11px] font-semibold text-[#b85b00]"
              nameClassName="text-[23px] font-semibold leading-tight tracking-[-0.02em]"
              countClassName="text-[13px] text-[#686868]"
            />
            <PersonPanel
              person={data.favoriteDirector}
              label="Favorite director"
              countLabel="films directed"
              className="rounded-[24px] bg-white p-4 shadow-sm"
              mediaClassName="w-[102px] rounded-[18px] bg-[#e8e3db]"
              labelClassName="text-[11px] font-semibold text-[#b85b00]"
              nameClassName="text-[23px] font-semibold leading-tight tracking-[-0.02em]"
              countClassName="text-[13px] text-[#686868]"
            />
          </section>

          <footer className="mt-6 min-w-0 border-t border-black/15 pt-4">
            <GenresLine genres={data.genres} className="text-[14px] font-semibold leading-snug text-[#555]" />
            <Brand className="mt-3 block text-[11px] text-[#8a8a8a]" />
          </footer>
        </div>
      </div>
    );
  },
);

export default AdmitOneShareCard;
