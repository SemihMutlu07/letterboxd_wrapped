import { getSupabase } from '@/lib/supabaseClient';
import { getSessionId } from './session';
import { ensureSessionRow } from './sessions';

export async function saveConsentDecision(
  accepted: boolean, 
  variant: 'A' | 'B', 
  msToDecision: number, 
  meta?: Record<string, unknown>
) {
  try {
    // Ensure session row exists first
    await ensureSessionRow();

    const session_id = getSessionId();
    const payload = {
      session_id,                                     // UUID
      decision: accepted ? 'accept' : 'decline',      // must exist in consents
      variant,
      ms_to_decision: msToDecision,
      meta: meta || {}
    };

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('consents')
      .insert(payload)
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Failed to insert consent data:', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Error saving consent decision:', err);
    throw err;
  }
}
