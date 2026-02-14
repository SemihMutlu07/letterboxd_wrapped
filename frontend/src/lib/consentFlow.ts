"use client";
import { upsertUserSession, type Consent} from '@/lib/supabase/sessions';
import { ensureSessionId, getUsernameWithSource, setConsent } from '@/lib/session-id';

export async function saveConsentDecisionToDb(accepted: boolean) {
    try {
        const sessionId = ensureSessionId();
        const { username, source } = getUsernameWithSource();
        const consent: Consent = accepted ? "accept" : "decline";

        if (process.env.NODE_ENV !== 'production') {
            console.debug('[consentFlow] session read', { session_id: sessionId, username, read_from: source });
        }
        
        // Save consent to sessionStorage
        setConsent(consent);
        
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
