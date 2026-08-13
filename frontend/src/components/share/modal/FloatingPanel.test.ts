import { describe, expect, it } from 'vitest';

import { computePosition } from './FloatingPanel';

const viewport = { width: 1440, height: 900 };

describe('computePosition', () => {
  it('opens below a top-of-modal tune button without overlapping it', () => {
    const anchor = { top: 96, bottom: 140, left: 1100, right: 1144, width: 44, height: 44 };
    const pos = computePosition(anchor, { width: 288, height: 120 }, 'below', viewport);

    expect(pos.placement).toBe('below');
    expect(pos.top).toBeGreaterThanOrEqual(anchor.bottom + 12);
    expect(pos.top + 120).toBeLessThanOrEqual(viewport.height - 12);
    expect(pos.left + 288).toBeLessThanOrEqual(viewport.width - 12);
  });

  it('flips above when there is no room below, still clear of the anchor', () => {
    const anchor = { top: 780, bottom: 824, left: 1100, right: 1144, width: 44, height: 44 };
    const pos = computePosition(anchor, { width: 288, height: 160 }, 'below', viewport);

    expect(pos.placement).toBe('above');
    expect(pos.top + 160).toBeLessThanOrEqual(anchor.top - 12);
  });

  it('does not clamp an above placement back down over the Story/Landscape row', () => {
    const anchor = { top: 200, bottom: 244, left: 1100, right: 1144, width: 44, height: 44 };
    const pos = computePosition(anchor, { width: 288, height: 140 }, 'above', viewport);

    expect(pos.top + 140).toBeLessThanOrEqual(anchor.top - 12);
  });
});
