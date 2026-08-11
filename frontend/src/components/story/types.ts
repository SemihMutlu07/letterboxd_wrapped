import type { ReactNode } from 'react';

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
  | 'poster-wall';

export type Slide = {
  key: string;
  body: ReactNode;
  media?: StoryMedia[];
  accent?: string;
  visual?: SlideVisual;
};
