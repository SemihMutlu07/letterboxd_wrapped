import { describe, expect, it } from 'vitest';
import { mergePersonProfiles } from './section-utils';

describe('mergePersonProfiles', () => {
  it('copies a missing profile photo from the other ranking list', () => {
    const merged = mergePersonProfiles(
      [{ name: 'Peter Watkins', avg_rating: 4.1, profile_path: undefined }],
      [{ name: 'Peter Watkins', profile_path: '/demo/smt-media/watkins.jpg', films: [] }],
    );
    expect(merged[0].profile_path).toBe('/demo/smt-media/watkins.jpg');
  });

  it('keeps an existing photo instead of overwriting it', () => {
    const merged = mergePersonProfiles(
      [{ name: 'Chloé Zhao', profile_path: '/zhao.jpg' }],
      [{ name: 'Chloé Zhao', profile_path: '/other.jpg' }],
    );
    expect(merged[0].profile_path).toBe('/zhao.jpg');
  });
});
