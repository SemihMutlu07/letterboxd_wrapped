import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const posthogMocks = vi.hoisted(() => ({
  initPostHog: vi.fn(),
  captureEvent: vi.fn(),
  flushQueue: vi.fn(),
  clearQueue: vi.fn(),
  getFlagVariant: vi.fn(() => Promise.resolve('control')),
}));

const consentMocks = vi.hoisted(() => ({
  saveConsentDecisionToDb: vi.fn(),
}));

vi.mock('framer-motion', () => ({ useReducedMotion: () => false }));
vi.mock('@/lib/posthog', () => posthogMocks);
vi.mock('@/lib/consentFlow', () => consentMocks);

import PreResultsConsentModal from './PreResultsConsentModal';

describe('PreResultsConsentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consentMocks.saveConsentDecisionToDb.mockResolvedValue(undefined);
  });

  it('accurately describes aggregate persistence', () => {
    render(
      <PreResultsConsentModal
        open
        sessionId="session-1"
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('aggregate viewing stats');
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'We do not save film lists, titles, reviews, or review text.',
    );
  });

  it('stores acceptance before initializing and capturing its first event', async () => {
    const onAccept = vi.fn();
    const user = userEvent.setup();
    render(
      <PreResultsConsentModal
        open
        sessionId="session-1"
        onAccept={onAccept}
        onDecline={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Yes, help improve' }));

    await waitFor(() => expect(onAccept).toHaveBeenCalledOnce());
    expect(consentMocks.saveConsentDecisionToDb).toHaveBeenCalledWith(true);
    expect(posthogMocks.captureEvent).toHaveBeenCalledWith(
      'consent_decision',
      expect.objectContaining({ decision: 'accept' }),
    );
    const order = [
      consentMocks.saveConsentDecisionToDb,
      posthogMocks.initPostHog,
      posthogMocks.captureEvent,
      posthogMocks.flushQueue,
      onAccept,
    ].map((mock) => mock.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(posthogMocks.clearQueue).not.toHaveBeenCalled();
  });

  it('declines without initializing analytics and clears any queue', async () => {
    const onDecline = vi.fn();
    const user = userEvent.setup();
    render(
      <PreResultsConsentModal
        open
        sessionId="session-1"
        onAccept={vi.fn()}
        onDecline={onDecline}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'No, just continue' }));

    await waitFor(() => expect(onDecline).toHaveBeenCalledOnce());
    expect(consentMocks.saveConsentDecisionToDb).toHaveBeenCalledWith(false);
    expect(posthogMocks.initPostHog).not.toHaveBeenCalled();
    expect(posthogMocks.captureEvent).not.toHaveBeenCalled();
    expect(posthogMocks.flushQueue).not.toHaveBeenCalled();
    expect(posthogMocks.clearQueue).toHaveBeenCalledOnce();
  });
});
