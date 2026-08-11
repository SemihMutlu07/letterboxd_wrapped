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

const DoubleFeatureShareCard = React.forwardRef<HTMLDivElement, Props>(
  function DoubleFeatureShareCard({ data }, ref) {
    return (
      <div
        ref={ref}
        data-export-root="true"
        className="relative h-[1200px] w-[675px] overflow-hidden bg-[#17130f] text-[#fff8ec]"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        <div className="absolute inset-x-0 top-0 h-[360px] bg-gradient-to-b from-[#db4f1d] to-transparent opacity-75" />
        <div className="relative mx-10 flex h-full min-w-0 flex-col py-[158px]">
          <header className="flex min-w-0 items-start justify-between gap-5 border-y border-[#ffd2a8]/60 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em]">Your year in cinema</p>
              <h1 className="mt-1 text-[35px] font-black leading-none">Letterboxd Wrapped</h1>
            </div>
            <div className="shrink-0 text-right">
              <strong className="block text-[27px] font-black tabular-nums">{data.year}</strong>
              <Username username={data.username} className="block max-w-[180px] text-[11px]" />
            </div>
          </header>

          <section className="mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)_168px] gap-5 border-b border-[#ffd2a8]/40 pb-6">
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#ffaf79]">The headline</p>
              <p className="mt-2 text-[37px] font-black leading-[0.98] [text-wrap:balance]">
                {data.watchedFilms} films shaped your {data.year}.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-[#e8d8c7]">
                You wrote {data.writtenReviews} reviews and spent {data.spentDays} days watching.
              </p>
            </div>
            <Metric
              label="Cinema Scale"
              value={Math.round(data.cinemaScale)}
              detail="/ 100"
              className="grid aspect-square place-content-center rounded-full border border-[#ffaf79]/60 bg-black/20 text-center"
              labelClassName="text-[10px] font-bold uppercase tracking-[0.1em] text-[#ffaf79]"
              valueClassName="text-[48px] font-black leading-none tabular-nums"
            />
          </section>

          <section className="mt-5 grid min-h-0 min-w-0 flex-1 grid-rows-2 gap-4">
            <PersonPanel
              person={data.onScreenCrush}
              label="On-screen crush"
              countLabel="films together"
              className="border border-[#ffaf79]/40 bg-[#251b14] p-4"
              mediaClassName="w-[108px] border border-[#ffaf79]/40 bg-[#3a2419]"
              nameClassName="text-[24px] font-black leading-tight"
              labelClassName="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffaf79]"
            />
            <PersonPanel
              person={data.favoriteDirector}
              label="Favorite director"
              countLabel="films directed"
              className="border border-[#ffaf79]/40 bg-[#251b14] p-4"
              mediaClassName="w-[108px] border border-[#ffaf79]/40 bg-[#3a2419]"
              nameClassName="text-[24px] font-black leading-tight"
              labelClassName="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffaf79]"
            />
          </section>

          <footer className="mt-5 min-w-0 border-t border-[#ffd2a8]/40 pt-4">
            <div className="flex min-w-0 items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffaf79]">Top genres</p>
                <GenresLine genres={data.genres} className="mt-1 text-[14px] font-bold leading-snug" />
              </div>
              <div className="shrink-0 max-w-[210px] text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#ffaf79]">
                  {data.topReviewWords?.length ? 'Review words' : 'Peak decade'}
                </p>
                <p className="mt-1 text-[12px] font-bold leading-snug [overflow-wrap:anywhere]">
                  {data.topReviewWords?.length
                    ? data.topReviewWords.map(({ word }) => word).join(' / ')
                    : `${data.peakDecade} · ${data.peakDecadeCount} films`}
                </p>
              </div>
            </div>
            <Brand className="mt-4 block text-[11px] text-[#ffaf79]" />
          </footer>
        </div>
      </div>
    );
  },
);

export default DoubleFeatureShareCard;
