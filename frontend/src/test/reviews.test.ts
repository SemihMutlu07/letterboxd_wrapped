import { describe, expect, it } from 'vitest';

import { reviewCharLength, reviewDateLabel, reviewWordCount } from '@/lib/reviews';

describe('review helpers', () => {
  it('prefers actual text length over stale text_length metadata', () => {
    expect(reviewCharLength({ text: 'actual body', text_length: 500 })).toBe(11);
  });

  it('falls back to text_length when text is unavailable', () => {
    expect(reviewCharLength({ text_length: 42 })).toBe(42);
  });

  it('uses date and review_date consistently', () => {
    expect(reviewDateLabel({ date: '2026-07-07T10:30:00Z' })).toBe('2026-07-07');
    expect(reviewDateLabel({ review_date: '2026-07-06T10:30:00Z' })).toBe('2026-07-06');
  });

  it('derives word count from text when metadata is missing', () => {
    expect(reviewWordCount({ text: 'one two  three' })).toBe(3);
  });
});
