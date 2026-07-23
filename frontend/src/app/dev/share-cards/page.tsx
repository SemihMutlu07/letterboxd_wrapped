'use client';
import React, { useEffect, useState } from 'react';
import { exportExactPng } from '@/components/ShareModal';
import { SHARE_VARIANTS, ShareVariantRenderer } from '@/components/share/registry';
import type { ShareCardInput, ShareOrientation, ShareVariant } from '@/components/share/types';

const films = Array.from({ length: 5 }, (_, index) => ({
  title: ['Perfect Days', 'Past Lives', 'The Holdovers', 'Anatomy of a Fall', 'The Zone of Interest'][index],
  year: '2023',
  posterPath: `/tmdb-proxy/poster-${index + 1}.png`,
}));

const baseline: ShareCardInput = {
  onScreenCrush: { name: 'Greta Lee', headshotUrl: '/tmdb-proxy/actor.png', count: 8 },
  favoriteDirector: { name: 'Wim Wenders', headshotUrl: '/tmdb-proxy/director.png', count: 6 },
  watchedFilms: 147,
  spentDays: 12,
  spentHours: 288,
  timePercent: 3,
  cinemaScale: 84,
  personaLabel: 'The Archivist',
  minutesAverage: 112,
  mostCommonRating: 4,
  peakDecade: '1990s',
  peakDecadeCount: 31,
  topFilms: films,
  username: 'cinema_semih',
  ratingOutlierFilm: {
    title: 'Beau Is Afraid', year: '2023', posterPath: null, userRating: 4.5, avgRating: 3.4, delta: 1.1,
  },
};

function ShareCardHarness() {
  const [query, setQuery] = useState({ variant: 'default' as ShareVariant, orientation: 'horizontal' as ShareOrientation, fixture: 'baseline' });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const variant = params.get('variant') as ShareVariant;
    const orientation = params.get('orientation') as ShareOrientation;
    setQuery({
      variant: SHARE_VARIANTS.some(({ key }) => key === variant) ? variant : 'default',
      orientation: orientation === 'vertical' ? 'vertical' : 'horizontal',
      fixture: params.get('fixture') === 'stress' ? 'stress' : 'baseline',
    });
  }, []);
  const data: ShareCardInput = query.fixture === 'stress'
    ? {
        ...baseline,
        username: 'thirty_four_character_letterboxd_username',
        favoriteDirector: null,
        onScreenCrush: { name: 'An Extremely Long Performer Name That Wraps', headshotUrl: '/tmdb-proxy/broken.png', count: 12 },
      }
    : baseline;

  const save = async () => {
    try {
      document.body.dataset.exportStatus = 'running';
      const root = document.querySelector<HTMLElement>('[data-export-root="true"]');
      if (!root) throw new Error('Missing export root');
      await Promise.all(Array.from(root.querySelectorAll('img')).map((image) => image.decode().catch(() => undefined)));
      const blob = await exportExactPng(root, query.orientation, '#000');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${query.variant}--${query.orientation}.png`;
      link.click();
      document.body.dataset.exportStatus = 'complete';
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) {
      document.body.dataset.exportStatus = error instanceof Error ? error.message : String(error);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-900">
      <div
        id="share-card-harness"
        data-fixture={query.fixture}
        data-orientation={query.orientation}
        data-variant={query.variant}
        className="w-fit"
      >
        <ShareVariantRenderer variant={query.variant} data={data} orientation={query.orientation} />
      </div>
      <button data-testid="export" onClick={save} className="fixed bottom-2 right-2 bg-white p-2 text-black">Export</button>
    </main>
  );
}

export default function ShareCardHarnessPage() {
  if (process.env.NODE_ENV === 'production') {
    return <main>Share card validation is unavailable in production.</main>;
  }

  return <ShareCardHarness />;
}
