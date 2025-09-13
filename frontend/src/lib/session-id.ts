export function ensureSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('session_id');
  if (!id) { 
    id = (crypto?.randomUUID?.()) || '00000000-0000-4000-8000-000000000000'; 
    sessionStorage.setItem('session_id', id); 
  }
  return id;
}

export function getUsername(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('username') || sessionStorage.getItem('lb_username') || '';
}

export function setUsername(u: string) { 
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('username', u);
    // Keep lb_username for backward compatibility
    sessionStorage.setItem('lb_username', u);
  }
}

export function setConsent(c: 'accept'|'decline') { 
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('consent', c);
    // Keep old keys for backward compatibility
    sessionStorage.setItem('consentDecision', c);
    sessionStorage.setItem('consent_decision', c);
  }
}

export function getConsent(): 'accept'|'decline'|'' {
  if (typeof window === 'undefined') return '';
  const v = sessionStorage.getItem('consent') || 
            sessionStorage.getItem('consentDecision') || 
            sessionStorage.getItem('consent_decision') || '';
  return v === 'accept' || v === 'decline' ? v : '';
}
