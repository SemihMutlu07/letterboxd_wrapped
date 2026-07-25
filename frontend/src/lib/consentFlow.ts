"use client";
import { upsertUserSession } from '@/lib/supabase/sessions';
import { ensureSessionId, getUsernameWithSource, setConsent } from '@/lib/session-id';

export async function saveConsentDecisionToDb(accepted: boolean) {
    try {
        const consent = accepted ? "accept" : "decline";
        setConsent(consent);

        // Declining is local-only: do not create an identifiable Supabase row.
        if (!accepted) return;

        const sessionId = ensureSessionId();
        const { username, source } = getUsernameWithSource();

        if (process.env.NODE_ENV !== 'production') {
            console.debug('[consentFlow] session read', { session_id: sessionId, username, read_from: source });
        }

        // If username is missing, skip database save but don't throw error
        if (!username) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Username missing, skipping consent database save');
            }
            return;
        }

        return await upsertUserSession({
            session_id: sessionId,
            username: username,
            consent,
            film_count: null,
            favorite_genre: null,
        });
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('Failed to save consent to database:', error);
        }
        // Don't throw - let the consent flow continue
    }
}
