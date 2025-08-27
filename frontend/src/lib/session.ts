// create only if missing
export function getSessionId(): string {
  if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000000';
  let id = sessionStorage.getItem('session_id');
  if (!id) {
    id = (crypto?.randomUUID?.() ?? `session_${Date.now()}`);
    sessionStorage.setItem('session_id', id);
  }
  return id;
}
