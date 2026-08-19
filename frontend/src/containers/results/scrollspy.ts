import type { MessageKey } from '@/i18n/catalogs';

export const SCROLLSPY_LABEL_KEYS: Record<string, MessageKey> = {
  hero: 'results.spy.hero',
  people: 'results.spy.people',
  'cinema-scale': 'results.spy.cinemaScale',
  'rating-deviation': 'results.spy.ratingDeviation',
  reviews: 'results.spy.reviews',
  'film-history': 'results.spy.filmHistory',
  'ratings-bar': 'results.spy.ratings',
  'rewatch-champions': 'results.spy.rewatch',
  languages: 'results.spy.languages',
  'share-footer': 'results.spy.share',
};

export function scrollspyLabelKey(id: string): MessageKey {
  return SCROLLSPY_LABEL_KEYS[id] ?? 'results.spy.hero';
}

/** Last section whose top edge has crossed the spy line (viewport Y). */
export function pickActiveSectionId(
  sections: ReadonlyArray<{ id: string; top: number }>,
  spyY: number,
): string | null {
  if (sections.length === 0) return null;
  let active = sections[0].id;
  for (const section of sections) {
    if (section.top <= spyY) active = section.id;
    else break;
  }
  return active;
}
