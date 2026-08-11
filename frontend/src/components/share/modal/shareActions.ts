import { API_BASE } from '@/lib/api';

import { EXPORT_FILE_NAME } from './constants';
import { getPlatformInfo } from './platform';

export function shareSafeUrl(u: string): string {
  if (!u) return u;
  if (u.startsWith('http') && u.includes('://image.tmdb.org')) {
    const url = new URL(u);
    if (API_BASE) return `${API_BASE.replace(/\/$/, '')}/tmdb-proxy${url.pathname}`;
  }
  if (u.startsWith('/tmdb-proxy/')) {
    if (API_BASE) return `${API_BASE.replace(/\/$/, '')}${u}`;
  }
  return u;
}

export async function shareToSystem(blob: Blob) {
  const { isMobile } = getPlatformInfo();
  if (!isMobile || !navigator.share) return 'unavailable' as const;
  const file = new File([blob], EXPORT_FILE_NAME, { type: 'image/png' });
  const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  try {
    if (canShareFiles) {
      await navigator.share({ files: [file], title: 'Movies Wrapped' });
      return 'shared' as const;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled' as const;
    throw error;
  }
  return 'unavailable' as const;
}

export async function saveWithFilePicker(blob: Blob) {
  const { isMobile } = getPlatformInfo();
  if (isMobile || !window.isSecureContext) return 'unavailable' as const;
  type WindowWithFilePicker = Window & {
    showSaveFilePicker?: (opts: {
      suggestedName: string;
      types: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<any>;
  };
  const typedWindow = window as WindowWithFilePicker;
  if (!typedWindow.showSaveFilePicker) return 'unavailable' as const;
  try {
    const handle = await typedWindow.showSaveFilePicker({
      suggestedName: EXPORT_FILE_NAME,
      types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return 'saved' as const;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled' as const;
    throw error;
  }
}

export function downloadFallback(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const { isIOS } = getPlatformInfo();
  if (isIOS) {
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = EXPORT_FILE_NAME;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
