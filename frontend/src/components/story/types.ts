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
  | 'poster-wall'
  | 'recap';

export type DirectorRewatchInsight = {
  title: string;
  watchCount: number;
};

export type DirectorSequenceData = {
  directorName: string;
  filmCount: number;
  profile: StoryMedia | null;
  streamPosters: StoryMedia[];
  rewatch: DirectorRewatchInsight | null;
};

export type Slide = {
  key: string;
  body: ReactNode;
  media?: StoryMedia[];
  accent?: string;
  visual?: SlideVisual;
  /** Optional override for desktop poster-field placement (merged with visual defaults). */
  posterLayout?: Partial<PosterFieldConfig>;
  /** Cinematic director beat — desktop animation + localized copy metadata. */
  directorSequence?: DirectorSequenceData;
};
