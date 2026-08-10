import React from 'react';
import ShareCard from '@/components/ShareCard';
import AppleHIGShareCard from './variants/AppleHIGShareCard';
import EditorialShareCard from './variants/EditorialShareCard';
import Variant3ShareCard from './variants/Variant3ShareCard';
import DoubleFeatureShareCard from './variants/DoubleFeatureShareCard';
import ContactSheetShareCard from './variants/ContactSheetShareCard';
import AdmitOneShareCard from './variants/AdmitOneShareCard';
import type {
  ShareCardData,
  ShareCardInput,
  ShareOrientation,
  ShareVariant,
} from './types';
import { normalizeShareCardData } from './viewModel';

export type ShareVariantDefinition = {
  key: ShareVariant;
  label: string;
  orientation: ShareOrientation;
};

export const SHARE_VARIANTS: ReadonlyArray<ShareVariantDefinition> = [
  { key: 'default', label: 'Your Wrapped', orientation: 'horizontal' },
  { key: 'apple-hig', label: 'Apple Clean', orientation: 'horizontal' },
  { key: 'editorial', label: 'Editorial Story', orientation: 'horizontal' },
  { key: 'variant-3', label: 'Tile Dashboard', orientation: 'horizontal' },
  { key: 'double-feature', label: 'Portrait Story', orientation: 'vertical' },
  { key: 'contact-sheet', label: 'Letterboxd Vertical', orientation: 'vertical' },
  { key: 'admit-one', label: 'Clean Vertical', orientation: 'vertical' },
];

export function shareVariantsForOrientation(
  orientation: ShareOrientation,
): ReadonlyArray<ShareVariantDefinition> {
  return SHARE_VARIANTS.filter((variant) => variant.orientation === orientation);
}

type VariantComponent = React.ComponentType<{ data: ShareCardData }>;

const VARIANT_COMPONENTS: Record<ShareVariant, VariantComponent> = {
  default: ShareCard,
  'apple-hig': AppleHIGShareCard,
  editorial: EditorialShareCard,
  'variant-3': Variant3ShareCard,
  'double-feature': DoubleFeatureShareCard,
  'contact-sheet': ContactSheetShareCard,
  'admit-one': AdmitOneShareCard,
};

type RendererProps = {
  variant: ShareVariant;
  data: ShareCardInput;
  orientation: ShareOrientation;
};

export function ShareVariantRenderer({ variant, data, orientation }: RendererProps) {
  const definition = SHARE_VARIANTS.find((candidate) => candidate.key === variant);
  if (!definition || definition.orientation !== orientation) {
    throw new Error(`Share variant "${variant}" does not support ${orientation} output.`);
  }
  const Component = VARIANT_COMPONENTS[variant];
  return <Component data={normalizeShareCardData(data)} />;
}
