// create only if missing
export function initErrorCapture(): void {
  if (typeof window === 'undefined') return;
  // no-op stub; real impl can attach window.onerror / unhandledrejection
}
