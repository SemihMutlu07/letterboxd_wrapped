'use client';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Sliders } from 'lucide-react';
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
  const railRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pageW, setPageW] = useState(0);
  const [pageH, setPageH] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [actorIdx, setActorIdx] = useState(0);
  const [directorIdx, setDirectorIdx] = useState(0);
  const [swapOpen, setSwapOpen] = useState(false);

  const variantKey = VARIANTS[Math.max(0, Math.min(VARIANTS.length - 1, activeIdx))].key;

  useEffect(() => {
    if (!open) return;
    setActorIdx(0);
    setDirectorIdx(0);
    setActiveIdx(0);
    setSwapOpen(false);
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

  const adaptivePixelRatio = useAdaptivePixelRatio();
  const target = useMemo(() =>
    orientation === 'horizontal'
      ? { w: 1200, h: 630 }
      : { w: 675, h: 1200 }
  , [orientation]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Measure rail viewport so ScaledCard can fit each page
  useEffect(() => {
    if (!open) return;
    const el = railRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setPageW(rect.width);
      setPageH(rect.height || el.parentElement?.clientHeight || window.innerHeight * 0.5);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Keep rail aligned to active page when pageW or orientation changes
  useLayoutEffect(() => {
    const el = railRef.current;
    if (!el || pageW === 0) return;
    el.scrollLeft = activeIdx * pageW;
  }, [pageW, orientation, activeIdx]);

  const handleRailScroll: React.UIEventHandler<HTMLDivElement> = () => {
    const el = railRef.current;
    if (!el || pageW === 0) return;
    const idx = Math.round(el.scrollLeft / pageW);
    setActiveIdx((prev) => (prev === idx ? prev : idx));
  };

  const jumpTo = (idx: number) => {
    const el = railRef.current;
    if (!el || pageW === 0) return;
    el.scrollTo({ left: idx * pageW, behavior: 'smooth' });
    setActiveIdx(idx);
  };

  const findExportRoot = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[data-active="true"] [data-export-root="true"]');

  const handleSavePNG = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const originalSrcs: string[] = [];
    try {
      const exportRoot = findExportRoot();
      if (!exportRoot) throw new Error('Export root not found');
      const images = Array.from(exportRoot.querySelectorAll('img'));
      images.forEach((img, i) => {
        originalSrcs[i] = img.src;
        const safeUrl = shareSafeUrl(img.src);
        img.crossOrigin = 'anonymous';
        img.src = safeUrl;
      });
      // Wait for any in-flight decodes so the snapshot captures pixels, not blanks
      await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
      const bg = variantKey === 'apple-hig' ? '#000000' : '#0B1220';
      let blob = await exportToBlob(exportRoot, target.w, target.h, adaptivePixelRatio, bg);
      if (!blob) { await delay(80); blob = await exportToBlob(exportRoot, target.w, target.h, adaptivePixelRatio, bg); }
      if (!blob) throw new Error('Export failed');
      let method: 'system_share' | 'file_picker' | 'download' = 'download';
      const shared = await shareToSystem(blob);
      if (shared) { method = 'system_share'; }
      else { const saved = await saveWithFilePicker(blob); if (saved) method = 'file_picker'; else downloadFallback(blob); }
      trackEvent('share_export_succeeded', { variant: variantKey, orientation, method });
      onDownloadSuccess?.();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      const exportRoot = findExportRoot();
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
  const showSwapTrigger = hasActors || hasDirectors;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Bottom sheet on mobile, centered modal on desktop */}
      <div className="relative h-full md:h-auto md:min-h-[520px] md:max-h-[95vh] md:max-w-[480px] md:mx-auto md:mt-8 flex flex-col bg-[#0f0f0f] md:rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-sm font-semibold text-white/90">Share</span>
          <button
            onClick={onClose}
            className="grid place-items-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Rail — horizontal swipeable variant gallery */}
        <div
          ref={railRef}
          onScroll={handleRailScroll}
          className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory min-h-0"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', minHeight: 280 }}
        >
          <div className="flex h-full" style={{ width: pageW > 0 ? `${pageW * VARIANTS.length}px` : '100%' }}>
            {VARIANTS.map((v, i) => {
              const isActive = i === activeIdx;
              const inBudget = Math.abs(i - activeIdx) <= 1;
              return (
                <section
                  key={v.key}
                  data-variant={v.key}
                  data-active={isActive}
                  className="shrink-0 snap-center snap-always flex items-center justify-center px-4"
                  style={{ width: pageW || '100%', height: '100%' }}
                >
                  {inBudget && pageW > 0 && pageH > 0 && (
                    <VariantPage
                      variantKey={v.key}
                      target={target}
                      pageW={pageW}
                      pageH={pageH}
                      data={effectiveCardProps}
                      orientation={orientation}
                    />
                  )}
                </section>
              );
            })}
          </div>
        </div>

        {/* Page indicator dots */}
        <div className="flex items-center justify-center gap-1.5 pt-2 pb-1">
          {VARIANTS.map((v, i) => (
            <button
              key={v.key}
              onClick={() => jumpTo(i)}
              aria-label={`Go to ${v.label}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>

        {/* Footer controls */}
        <div className="relative px-5 pb-6 pt-3 space-y-3">
          {/* Swap drawer (slides up over CTA region when open) */}
          {showSwapTrigger && swapOpen && (
            <div className="absolute left-0 right-0 bottom-full mx-5 mb-2 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur px-4 py-3 space-y-2 text-xs">
              {hasActors && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-16 shrink-0">Actor</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {cardProps.topActors!.slice(0, 3).map((a, i) => (
                      <button
                        key={a.name}
                        onClick={() => setActorIdx(i)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                          actorIdx === i
                            ? 'text-pink-300 bg-pink-500/15'
                            : 'text-slate-400 hover:text-slate-200 bg-white/5'
                        }`}
                      >
                        {lastName(a.name)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {hasDirectors && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-16 shrink-0">Director</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {cardProps.topDirectors!.slice(0, 3).map((d, i) => (
                      <button
                        key={d.name}
                        onClick={() => setDirectorIdx(i)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                          directorIdx === i
                            ? 'text-cyan-300 bg-cyan-500/15'
                            : 'text-slate-400 hover:text-slate-200 bg-white/5'
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

          {/* Orientation + swap trigger */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setOrientation('vertical')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  orientation === 'vertical' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Vert
              </button>
              <button
                onClick={() => setOrientation('horizontal')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  orientation === 'horizontal' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Horiz
              </button>
            </div>
            {showSwapTrigger && (
              <button
                onClick={() => setSwapOpen((s) => !s)}
                aria-label="Tune actor and director"
                className={`grid place-items-center w-9 h-9 rounded-full transition ${
                  swapOpen ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Sliders size={16} />
              </button>
            )}
          </div>

          {/* Single dominant CTA */}
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

/* ─── ScaledCard: fixes the transform-origin layout bug ─── */
type ScaledCardProps = {
  target: { w: number; h: number };
  pageW: number;
  pageH: number;
  children: React.ReactNode;
};

function ScaledCard({ target, pageW, pageH, children }: ScaledCardProps) {
  if (!pageW || !pageH) return null;
  const availW = Math.max(0, pageW - 16);   // section already has px-4 horizontal padding
  const availH = Math.max(0, pageH - 16);
  const scale = Math.max(0.05, Math.min(availW / target.w, availH / target.h, 1));
  return (
    <div
      className="relative"
      style={{ width: target.w * scale, height: target.h * scale }}
    >
      <div
        style={{
          width: target.w,
          height: target.h,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── VariantPage: memoised wrapper so swap reruns only the active variant ─── */
type VariantPageProps = {
  variantKey: ShareVariant;
  target: { w: number; h: number };
  pageW: number;
  pageH: number;
  data: ShareCardData;
  orientation: Orientation;
};

const VariantPage = React.memo(function VariantPage({
  variantKey,
  target,
  pageW,
  pageH,
  data,
  orientation,
}: VariantPageProps) {
  return (
    <ScaledCard target={target} pageW={pageW} pageH={pageH}>
      {variantKey === 'apple-hig' && <AppleHIGShareCard data={data} orientation={orientation} />}
      {variantKey === 'default' && <ShareCard {...data} orientation={orientation} />}
      {variantKey === 'editorial' && <EditorialShareCard data={data} orientation={orientation} />}
      {variantKey === 'variant-3' && <Variant3ShareCard data={data} orientation={orientation} />}
    </ScaledCard>
  );
});
