import React from 'react';
import ShareCard from '@/components/ShareCard';
import AppleHIGShareCard from './variants/AppleHIGShareCard';
import EditorialShareCard from './variants/EditorialShareCard';
import Variant3ShareCard from './variants/Variant3ShareCard';
import DoubleFeatureShareCard from './variants/DoubleFeatureShareCard';
import ContactSheetShareCard from './variants/ContactSheetShareCard';
import AdmitOneShareCard from './variants/AdmitOneShareCard';
import MinimalOutlierShareCard from './variants/MinimalOutlierShareCard';
import type { ShareCardData, ShareCardInput, ShareOrientation, ShareVariant } from './types';

export const SHARE_VARIANTS: ReadonlyArray<{ key: ShareVariant; label: string }> = [
  { key: 'default', label: 'Hero Grid' },
  { key: 'admit-one', label: 'Cinema Ticket' },
  { key: 'minimal-outlier', label: 'Hot Take' },
  { key: 'apple-hig', label: 'Glass' },
  { key: 'editorial', label: 'Editorial' },
];

export const DIRECTOR_UNAVAILABLE = {
  name: 'Director unavailable',
  headshotUrl: '',
  count: 0,
} as const;

export function normalizeShareCardData(data: ShareCardInput): ShareCardData {
  return {
    ...data,
    favoriteDirector: data.favoriteDirector ?? { ...DIRECTOR_UNAVAILABLE },
    topFilms: (data.topFilms ?? []).slice(0, 5),
  };
}

type RendererProps = {
  variant: ShareVariant;
  data: ShareCardInput;
  orientation: ShareOrientation;
};

export function ShareVariantRenderer({ variant, data, orientation }: RendererProps) {
  const normalized = normalizeShareCardData(data);
  if (variant === 'default') return <ShareCard {...normalized} orientation={orientation} />;
  if (variant === 'admit-one') return <AdmitOneShareCard data={normalized} orientation={orientation} />;
  if (variant === 'minimal-outlier') return <MinimalOutlierShareCard data={normalized} orientation={orientation} />;
  if (variant === 'apple-hig') return <AppleHIGShareCard data={normalized} orientation={orientation} />;
  if (variant === 'editorial') return <EditorialShareCard data={normalized} orientation={orientation} />;
  if (variant === 'variant-3') return <Variant3ShareCard data={normalized} orientation={orientation} />;
  if (variant === 'double-feature') return <DoubleFeatureShareCard data={normalized} orientation={orientation} />;
  if (variant === 'contact-sheet') return <ContactSheetShareCard data={normalized} orientation={orientation} />;
  return null;
}
