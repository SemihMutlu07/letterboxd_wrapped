import { describe, expect, it } from 'vitest';
import { pickActiveSectionId, scrollspyLabelKey } from './scrollspy';

describe('pickActiveSectionId', () => {
  const sections = [
    { id: 'hero', top: -40 },
    { id: 'people', top: 80 },
    { id: 'reviews', top: 400 },
  ];

  it('returns the first section when none have crossed the spy line', () => {
    expect(pickActiveSectionId(sections, -100)).toBe('hero');
  });

  it('returns the last section that has crossed the spy line', () => {
    expect(pickActiveSectionId(sections, 90)).toBe('people');
    expect(pickActiveSectionId(sections, 420)).toBe('reviews');
  });

  it('returns null for an empty list', () => {
    expect(pickActiveSectionId([], 0)).toBeNull();
  });
});

describe('scrollspyLabelKey', () => {
  it('maps known section ids to i18n keys', () => {
    expect(scrollspyLabelKey('cinema-scale')).toBe('results.spy.cinemaScale');
    expect(scrollspyLabelKey('share-footer')).toBe('results.spy.share');
  });
});
