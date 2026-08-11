'use client';

import React from 'react';

import type { ShareCardData, ShareVariant } from '@/components/share/types';
import { ShareVariantRenderer } from '@/components/share/registry';

import { ScaledCard } from './ScaledCard';
import type { Orientation } from './types';

type VariantPageProps = {
  variantKey: ShareVariant;
  target: { w: number; h: number };
  pageW: number;
  pageH: number;
  data: ShareCardData;
  orientation: Orientation;
};

export const VariantPage = React.memo(function VariantPage({
  variantKey,
  target,
  pageW,
  pageH,
  data,
  orientation,
}: VariantPageProps) {
  return (
    <ScaledCard target={target} pageW={pageW} pageH={pageH}>
      <ShareVariantRenderer variant={variantKey} data={data} orientation={orientation} />
    </ScaledCard>
  );
});
