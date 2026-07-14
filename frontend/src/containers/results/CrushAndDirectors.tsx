'use client';

import React from 'react';
import Section from '@/components/results/Section';
import { ActorCard, DirectorCard, CountItem } from '@/components/results/Cards';

export default function CrushAndDirectors({
  topDirectors,
  topActors,
}: {
  topDirectors: CountItem[];
  topActors: CountItem[];
}) {
  return (
    <>
      <Section
        title="Favorite Directors"
        subtitle={`${topDirectors?.length ?? 0} directors explored`}
        icon="🎬"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {topDirectors?.slice(0, 3).map((d, i) => (
            <DirectorCard key={d.name} director={d} rank={i + 1} />
          ))}
        </div>
      </Section>

      {topActors && topActors.length > 0 && (
        <Section title="Your On-Screen Crush" subtitle="Top actors you couldn't get enough of">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 ">
            <ActorCard actor={topActors[0]} rank={1} variant="main" topCount={topActors[0].count} />
            <div className="space-y-3 lg:space-y-4">
              {topActors.slice(1, 3).map((actor, index) => (
                <ActorCard key={`${actor.name}-${index}`} actor={actor} rank={index + 2} variant="small" topCount={topActors[0].count} />
              ))}
            </div>
          </div>
        </Section>
      )}
    </>
  );
}


