import type { ReactNode } from 'react';

import type { PosterFieldConfig } from './visuals/posterFieldConfig';

export type StoryMedia = {
  type: 'poster' | 'profile';
  url: string;
  alt: string;
  objectPosition?: string;
};

export type SlideVisual =
  | 'mosaic'
  | 'hero'
  | 'portrait'
  | 'strip'
  | 'cascade'
  | 'director'
  | 'person'
  | 'actor'
  | 'poster-wall'
  | 'recap';

export type PersonRewatchInsight = {
  title: string;
  watchCount: number;
};

export type PersonSequenceData = {
  personName: string;
  filmCount: number;
  profile: StoryMedia | null;
  streamPosters: StoryMedia[];
  rewatch: PersonRewatchInsight | null;
};

export type DirectorRewatchInsight = PersonRewatchInsight;
export type DirectorSequenceData = PersonSequenceData;

export type SlideInsight = {
  kind: 'actor-rewatch';
  title: string;
  watchCount: number;
};

export type Slide = {
  key: string;
  body: ReactNode;
  media?: StoryMedia[];
  accent?: string;
  visual?: SlideVisual;
  /** Optional override for desktop poster-field placement (merged with visual defaults). */
  posterLayout?: Partial<PosterFieldConfig>;
  /** Cinematic person beat — desktop animation + localized copy metadata. */
  directorSequence?: PersonSequenceData;
  actorSequence?: PersonSequenceData;
  insight?: SlideInsight;
};
