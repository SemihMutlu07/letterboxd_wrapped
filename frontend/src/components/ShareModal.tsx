'use client';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { toBlob } from 'html-to-image';
import ShareCard from './ShareCard';
import EditorialShareCard from '@/components/share/variants/EditorialShareCard';
import Variant3ShareCard from '@/components/share/variants/Variant3ShareCard';
import AppleHIGShareCard from '@/components/share/variants/AppleHIGShareCard';
import type { ShareCardData, ShareVariant } from '@/components/share/types';
import { useAdaptivePixelRatio } from '@/hooks/useDeviceMemory';
import { API_BASE } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const EXPORT_FILE_NAME = 'movies-wrapped.png';
const IOS_RE = /iPhone|iPad|iPod/i;
const ANDROID_RE = /Android/i;

function getPlatformInfo() {
  const ua = navigator.userAgent;
  const isIOS = IOS_RE.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = ANDROID_RE.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile/i.test(ua);
  return { isIOS, isAndroid, isMobile };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function exportToBlob(el: HTMLElement, w: number, h: number, pixelRatio: number, bg: string) {
  if (document.fonts) await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return await toBlob(el, {
    width: w,
    height: h,
    pixelRatio,
    backgroundColor: bg,
    cacheBust: true,
  });
}

async function shareToSystem(blob: Blob) {
  const { isMobile } = getPlatformInfo();
  if (!isMobile || !navigator.share) return false;
  const file = new File([blob], EXPORT_FILE_NAME, { type: 'image/png' });
  const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  try {
    if (canShareFiles) {
      await navigator.share({ files: [file], title: 'Movies Wrapped' });
      return true;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    throw error;
  }
  return false;
}

async function saveWithFilePicker(blob: Blob) {
  const { isMobile } = getPlatformInfo();
  if (isMobile || !window.isSecureContext) return false;
  type WindowWithFilePicker = Window & {
    showSaveFilePicker?: (opts: {
      suggestedName: string;
      types: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<any>;
  };
  const typedWindow = window as WindowWithFilePicker;
  if (typedWindow.showSaveFilePicker) {
    const handle = await typedWindow.showSaveFilePicker({
      suggestedName: EXPORT_FILE_NAME,
      types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  }
  return false;
}

function downloadFallback(blob: Blob) {
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

type Orientation = 'horizontal' | 'vertical';

const VARIANTS: { key: ShareVariant; label: string }[] = [
  { key: 'apple-hig', label: 'Apple' },
  { key: 'default', label: 'Wrapped' },
  { key: 'editorial', label: 'Editorial' },
  { key: 'variant-3', label: 'Clean' },
];

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

type Props = {
  open: boolean;
  onClose: () => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  cardProps: ShareCardData;
  onDownloadSuccess?: () => void;
};

export default function ShareModal({
  open,
  onClose,
  orientation,
  setOrientation,
  cardProps,
  onDownloadSuccess,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [variant, setVariant] = useState<ShareVariant>('apple-hig');
  const [scale, setScale] = useState(0.45);
  const [isSaving, setIsSaving] = useState(false);
  const [actorIdx, setActorIdx] = useState(0);
  const [directorIdx, setDirectorIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setActorIdx(0);
    setDirectorIdx(0);
    setVariant('apple-hig');
  }, [open]);

  useEffect(() => {
    setActorIdx(0);
    setDirectorIdx(0);
  }, [cardProps]);

  const effectiveCardProps = useMemo<ShareCardData>(() => ({
    ...cardProps,
    onScreenCrush: cardProps.topActors?.[actorIdx] ?? cardProps.onScreenCrush,
    favoriteDirector: cardProps.topDirectors?.[directorIdx] ?? cardProps.favoriteDirector,
  }), [cardProps, actorIdx, directorIdx]);

  const selectedCardKey = `${orientation}:${effectiveCardProps.onScreenCrush.name}:${effectiveCardProps.favoriteDirector.name}`;

  const adaptivePixelRatio = useAdaptivePixelRatio();
  const target = useMemo(() =>
    orientation === 'horizontal'
      ? { w: 1200, h: 630 }
      : { w: 630, h: 1200 }
  , [orientation]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Auto scale
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const padding = isMobile ? 24 : 40;
    const availW = window.innerWidth - padding * 2;
    const availH = window.innerHeight * 0.55; // 55% of viewport for card
    const s = Math.min(availW / target.w, availH / target.h, 1);
    const minScale = isMobile ? 0.32 : 0.40;
    setScale(Math.max(minScale, s));
  }, [target.w, target.h, open]);

  const handleSavePNG = async () => {
    if (!cardRef.current || isSaving) return;
    setIsSaving(true);
    const originalSrcs: string[] = [];
    try {
      const exportRoot = document.getElementById('wrapped-export-root');
      if (!exportRoot) throw new Error('Export root not found');
      const images = exportRoot.querySelectorAll('img');
      images.forEach((img, i) => {
        originalSrcs[i] = img.src;
        const safeUrl = shareSafeUrl(img.src);
        img.crossOrigin = 'anonymous';
        img.src = safeUrl;
      });
      const bg = variant === 'apple-hig' ? '#000000' : '#0B1220';
      let blob = await exportToBlob(exportRoot, target.w, target.h, adaptivePixelRatio, bg);
      if (!blob) { await delay(80); blob = await exportToBlob(exportRoot, target.w, target.h, adaptivePixelRatio, bg); }
      if (!blob) throw new Error('Export failed');
      let method: 'system_share' | 'file_picker' | 'download' = 'download';
      const shared = await shareToSystem(blob);
      if (shared) { method = 'system_share'; }
      else { const saved = await saveWithFilePicker(blob); if (saved) method = 'file_picker'; else downloadFallback(blob); }
      trackEvent('share_export_succeeded', { variant: orientation, method });
      onDownloadSuccess?.();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      const exportRoot = document.getElementById('wrapped-export-root');
      if (exportRoot) {
        const imgs = exportRoot.querySelectorAll('img');
        imgs.forEach((img, i) => { if (originalSrcs[i]) img.src = originalSrcs[i]; });
      }
      setIsSaving(false);
    }
  };

  if (!open) return null;

  const hasActors = (cardProps.topActors?.length ?? 0) >= 2;
  const hasDirectors = (cardProps.topDirectors?.length ?? 0) >= 2;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Bottom sheet on mobile, centered modal on desktop */}
      <div className="relative h-full md:h-auto md:max-h-[95vh] md:max-w-2xl md:mx-auto md:mt-8 flex flex-col bg-[#0f0f0f] md:rounded-3xl overflow-hidden">
        {/* Header: just close button */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-sm font-semibold text-slate-300">Share</span>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Card preview — takes most of the space */}
        <div className="flex-1 flex items-center justify-center px-4 py-2 overflow-hidden min-h-0">
          <div
            ref={cardRef}
            className="origin-top-left"
            style={{
              width: target.w,
              height: target.h,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {variant === 'default' && (
              <ShareCard key={selectedCardKey} {...effectiveCardProps} orientation={orientation} />
            )}
            {variant === 'editorial' && (
              <EditorialShareCard key={selectedCardKey} data={effectiveCardProps} orientation={orientation} />
            )}
            {variant === 'variant-3' && (
              <Variant3ShareCard key={selectedCardKey} data={effectiveCardProps} orientation={orientation} />
            )}
            {variant === 'apple-hig' && (
              <AppleHIGShareCard key={selectedCardKey} data={effectiveCardProps} orientation={orientation} />
            )}
          </div>
        </div>

        {/* Controls row */}
        <div className="px-5 py-3 space-y-3">
          {/* Variant + Orientation in one compact row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
              {VARIANTS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setVariant(v.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    variant === v.key
                      ? 'bg-white/15 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 ml-auto">
              <button
                onClick={() => setOrientation('vertical')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  orientation === 'vertical' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Vert
              </button>
              <button
                onClick={() => setOrientation('horizontal')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  orientation === 'horizontal' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Horiz
              </button>
            </div>
          </div>

          {/* Actor/Director swap — compact inline */}
          {(hasActors || hasDirectors) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {hasActors && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Actor:</span>
                  <div className="flex items-center gap-0.5">
                    {cardProps.topActors!.slice(0, 3).map((a, i) => (
                      <button
                        key={a.name}
                        onClick={() => setActorIdx(i)}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          actorIdx === i
                            ? 'text-pink-300 bg-pink-500/15'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {lastName(a.name)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {hasDirectors && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Director:</span>
                  <div className="flex items-center gap-0.5">
                    {cardProps.topDirectors!.slice(0, 3).map((d, i) => (
                      <button
                        key={d.name}
                        onClick={() => setDirectorIdx(i)}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          directorIdx === i
                            ? 'text-cyan-300 bg-cyan-500/15'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {lastName(d.name)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: single dominant CTA */}
        <div className="px-5 pb-6 pt-2">
          <button
            onClick={handleSavePNG}
            disabled={isSaving}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition active:scale-[0.98] ${
              isSaving ? 'opacity-60' : ''
            }`}
            style={{ background: isSaving ? '#333' : '#fff', color: isSaving ? '#888' : '#000' }}
          >
            <Download size={18} />
            {isSaving ? 'Download starting...' : 'Download PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}
