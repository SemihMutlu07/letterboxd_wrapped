export function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('consentDecision') === 'accept';
}
export function saveConsentDecision(d: 'accept' | 'decline'): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('consentDecision', d);
}

// Additional functions needed by components
export function hasConsentModalBeenShown(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('consent_modal_shown') === 'true';
}

export function markConsentModalAsShown(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('consent_modal_shown', 'true');
}
