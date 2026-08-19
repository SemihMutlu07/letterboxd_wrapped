import { describe, expect, it } from 'vitest';

import {
  ambientLoopTransition,
  MOTION_AMBIENT,
  MOTION_DURATION,
  scaledDuration,
  verticalDriftTransition,
} from './motionTokens';

describe('motionTokens', () => {
  it('scales durations with poster-field motion scale', () => {
    expect(scaledDuration(MOTION_DURATION.reveal, 1.15)).toBeCloseTo(0.598);
  });

  it('disables ambient loops when inactive', () => {
    expect(ambientLoopTransition(MOTION_AMBIENT.verticalStrip, 1, false)).toEqual({ duration: 0 });
  });

  it('staggers vertical drift by index', () => {
    const a = verticalDriftTransition(MOTION_AMBIENT.verticalCascade, 0, 1, true);
    const b = verticalDriftTransition(MOTION_AMBIENT.verticalCascade, 3, 1, true);
    expect(b.duration).toBeGreaterThan(a.duration!);
  });
});
