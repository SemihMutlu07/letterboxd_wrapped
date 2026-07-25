import { beforeEach, describe, expect, it, vi } from 'vitest';

const posthogMock = vi.hoisted(() => ({
  __loaded: false,
  init: vi.fn(),
  capture: vi.fn(),
  onFeatureFlags: vi.fn(),
  getFeatureFlag: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthogMock }));

describe('PostHog consent gate', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'test-key');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://posthog.example.test');
    sessionStorage.clear();
    posthogMock.__loaded = false;
  });

  it('does not initialize, capture, flush, or queue without explicit acceptance', async () => {
    sessionStorage.setItem(
      'ph_event_queue',
      JSON.stringify([{ event: 'legacy_event', queued_at: 1 }]),
    );
    posthogMock.__loaded = true;
    const { captureEvent, flushQueue, initPostHog } = await import('./posthog');

    initPostHog();
    captureEvent('new_event');
    flushQueue();

    expect(posthogMock.init).not.toHaveBeenCalled();
    expect(posthogMock.capture).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem('ph_event_queue') || '[]')).toEqual([
      { event: 'legacy_event', queued_at: 1 },
    ]);
  });

  it('initializes and sends events after explicit acceptance', async () => {
    sessionStorage.setItem('consent_decision', 'accept');
    const { captureEvent, initPostHog } = await import('./posthog');

    initPostHog();
    expect(posthogMock.init).toHaveBeenCalledOnce();

    posthogMock.__loaded = true;
    captureEvent('accepted_event', { source: 'test' });

    expect(posthogMock.capture).toHaveBeenCalledWith('accepted_event', { source: 'test' });
  });

  it('queues accepted events only while PostHog is still loading', async () => {
    sessionStorage.setItem('consent_decision', 'accept');
    const { captureEvent } = await import('./posthog');

    captureEvent('accepted_loading_event');

    expect(posthogMock.capture).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem('ph_event_queue') || '[]')).toEqual([
      expect.objectContaining({ event: 'accepted_loading_event' }),
    ]);
  });
});
