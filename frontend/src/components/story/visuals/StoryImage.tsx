'use client';

import { useI18n } from '@/i18n/I18nProvider';

import type { StoryMedia } from '../types';

export function StoryImage({ item, className = '', priority = false }: { item: StoryMedia; className?: string; priority?: boolean }) {
  const { locale } = useI18n();
  const alt = locale === 'tr'
    ? item.alt.replace(/ poster$/, ' posteri').replace(/ portrait$/, ' portresi')
    : item.alt;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt={alt}
      className={`h-full w-full object-cover ${className}`}
      loading={priority ? 'eager' : 'lazy'}
      style={{ objectPosition: item.objectPosition ?? (item.type === 'profile' ? '50% 28%' : 'center center') }}
    />
  );
}
