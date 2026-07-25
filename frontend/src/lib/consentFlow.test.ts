import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionMocks = vi.hoisted(() => ({
  ensureSessionId: vi.fn(() => 'session-1'),
  getUsernameWithSource: vi.fn(() => ({ username: 'alice', source: 'username' as const })),
  setConsent: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  upsertUserSession: vi.fn(),
}));

vi.mock('@/lib/session-id', () => sessionMocks);
vi.mock('@/lib/supabase/sessions', () => supabaseMocks);

import { saveConsentDecisionToDb } from './consentFlow';

describe('saveConsentDecisionToDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.upsertUserSession.mockResolvedValue(undefined);
  });

  it('keeps decline local-only', async () => {
    await saveConsentDecisionToDb(false);

    expect(sessionMocks.setConsent).toHaveBeenCalledWith('decline');
    expect(sessionMocks.ensureSessionId).not.toHaveBeenCalled();
    expect(sessionMocks.getUsernameWithSource).not.toHaveBeenCalled();
    expect(supabaseMocks.upsertUserSession).not.toHaveBeenCalled();
  });

  it('stores accept locally before persisting the consent row', async () => {
    await saveConsentDecisionToDb(true);

    expect(sessionMocks.setConsent).toHaveBeenCalledWith('accept');
    expect(supabaseMocks.upsertUserSession).toHaveBeenCalledWith({
      session_id: 'session-1',
      username: 'alice',
      consent: 'accept',
      film_count: null,
      favorite_genre: null,
    });
    expect(sessionMocks.setConsent.mock.invocationCallOrder[0]).toBeLessThan(
      supabaseMocks.upsertUserSession.mock.invocationCallOrder[0],
    );
  });
});
