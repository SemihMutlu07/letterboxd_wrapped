import { getSupabase } from '@/lib/supabaseClient';
import { getSessionId } from './session';

export async function ensureSessionRow() {
  const id = getSessionId();
  // minimal payload; add ua/path if you have those columns
  try {
    const supabase = getSupabase();
    await supabase
      .from('sessions')
      .insert({ id })
      .select('id')
      .single();
  } catch {
    // ignore race conditions and other errors
  }

  // If a unique-violation happens (same id), PostgREST returns 409.
  // You can switch to upsert if sessions has a unique PK on id:
  // .upsert({ id }, { onConflict: 'id', ignoreDuplicates: true })
}
