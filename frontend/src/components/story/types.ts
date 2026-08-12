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

export type Slide = {
  key: string;
  body: ReactNode;
  media?: StoryMedia[];
  accent?: string;
  visual?: SlideVisual;
  /** Optional override for desktop poster-field placement (merged with visual defaults). */
  posterLayout?: Partial<PosterFieldConfig>;
};
