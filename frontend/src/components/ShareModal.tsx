'use client';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { X, Download, Loader2, Plus, Minus, Scan } from 'lucide-react';
import { toBlob } from 'html-to-image';
import ShareCard from './ShareCard';
import OrientationToggle from '@/components/share/OrientationToggle';
import { useRafThrottle } from '@/hooks/useRafThrottle';
import { useAdaptivePixelRatio } from '@/hooks/useDeviceMemory';
import { trackEvent } from '@/lib/analytics';

// ---- Share helpers ----
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
    if (error instanceof DOMException && error.name === 'AbortError') {
      return true;
    }
    throw error;
  }

  return false;
}

async function saveWithFilePicker(blob: Blob) {
  const { isMobile } = getPlatformInfo();
  if (isMobile || !window.isSecureContext) return false;

  type FilePickerHandle = {
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  };
  type WindowWithFilePicker = Window & {
    showSaveFilePicker?: (opts: {
      suggestedName: string;
      types: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<FilePickerHandle>;
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
    // iOS Safari's default save path is via Share Sheet from the opened image.
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

// Helper function to ensure share/export URLs use proxy instead of TMDB CDN
function shareSafeUrl(u: string): string {
  if (!u) return u;
  
  // If already a full URL and it's TMDB CDN, convert to proxy
  if (u.startsWith('http') && u.includes('://image.tmdb.org')) {
    const url = new URL(u);
    const path = url.pathname;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
    if (API_BASE) {
      return `${API_BASE.replace(/\/$/, '')}/tmdb-proxy${path}`;
    }
  }
  
  // If it's a relative proxy URL, make it absolute
  if (u.startsWith('/tmdb-proxy/')) {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
    if (API_BASE) {
      return `${API_BASE.replace(/\/$/, '')}${u}`;
    }
  }
  
  // Otherwise return as-is
  return u;
}

type Orientation = 'horizontal' | 'vertical';

type Props = {
  open: boolean;
  onClose: () => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  cardProps: Parameters<typeof ShareCard>[0];
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
  // const dialogRef = useRef<HTMLDivElement>(null); // Unused for now
  const cardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Touch handling for pinch zoom
  
  // Zoom and Pan functionality
  const [userScale, setUserScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const lastPanPointRef = useRef({ x: 0, y: 0 });
  const pendingPanDeltaRef = useRef({ x: 0, y: 0 });
  const panRafRef = useRef<number | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelRafRef = useRef<number | null>(null);
  const canPan = userScale > 1.02;

  const flushPanDelta = useCallback(() => {
    panRafRef.current = null;
    const { x, y } = pendingPanDeltaRef.current;
    if (x === 0 && y === 0) return;
    pendingPanDeltaRef.current = { x: 0, y: 0 };
    setPanOffset(prev => ({ x: prev.x + x, y: prev.y + y }));
  }, []);

  // Mouse events for desktop panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canPan) return;
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPointRef.current.x;
      const deltaY = e.clientY - lastPanPointRef.current.y;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      pendingPanDeltaRef.current = {
        x: pendingPanDeltaRef.current.x + deltaX,
        y: pendingPanDeltaRef.current.y + deltaY
      };
      if (panRafRef.current === null) {
        panRafRef.current = requestAnimationFrame(flushPanDelta);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Touch events for mobile - removed swipe-down to close, added pinch zoom
  const [lastPinchDistance, setLastPinchDistance] = useState(0);
  
  const getDistance = (touch1: { clientX: number; clientY: number }, touch2: { clientX: number; clientY: number }) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && canPan) {
      const touch = e.touches[0];
      setIsPanning(true);
      lastPanPointRef.current = { x: touch.clientX, y: touch.clientY };
    } else if (e.touches.length === 2) {
      // Pinch zoom
      setIsPanning(false);
      setLastPinchDistance(getDistance(e.touches[0], e.touches[1]));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning) {
      const touch = e.touches[0];
      
      if (canPan) {
        e.preventDefault();
        // Panning
        const deltaX = touch.clientX - lastPanPointRef.current.x;
        const deltaY = touch.clientY - lastPanPointRef.current.y;
        lastPanPointRef.current = { x: touch.clientX, y: touch.clientY };
        pendingPanDeltaRef.current = {
          x: pendingPanDeltaRef.current.x + deltaX,
          y: pendingPanDeltaRef.current.y + deltaY
        };
        if (panRafRef.current === null) {
          panRafRef.current = requestAnimationFrame(flushPanDelta);
        }
      }
    } else if (e.touches.length === 2) {
      e.preventDefault();
      // Pinch zoom
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      if (lastPinchDistance > 0) {
        const scaleChange = currentDistance / lastPinchDistance;
        setUserScale(prev => Math.max(0.5, Math.min(3, prev * scaleChange)));
      }
      setLastPinchDistance(currentDistance);
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    setLastPinchDistance(0);
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    wheelDeltaRef.current += e.deltaY;
    if (wheelRafRef.current !== null) return;

    wheelRafRef.current = requestAnimationFrame(() => {
      const delta = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      wheelRafRef.current = null;
      const scaleFactor = Math.exp(-delta * 0.0015);
      setUserScale(prev => Math.max(0.5, Math.min(3, prev * scaleFactor)));
    });
  }, []);

  // Add wheel event listener with proper options
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      if (wheelRafRef.current !== null) cancelAnimationFrame(wheelRafRef.current);
      if (panRafRef.current !== null) cancelAnimationFrame(panRafRef.current);
    };
  }, [handleWheel]);

  const resetZoom = () => {
    setUserScale(1);
    setPanOffset({ x: 0, y: 0 });
  };


  // Performance hooks
  const adaptivePixelRatio = useAdaptivePixelRatio();
  // const isLowEndDevice = useIsLowEndDevice(); // Unused for now

  // Dynamic export dimensions based on orientation
  const target = useMemo(() => 
    orientation === 'horizontal' 
      ? { w: 1200, h: 630 } 
      : { w: 630, h: 1200 }
  , [orientation]);

  
  // Lock body scroll when open and prevent modal from closing on scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    // Prevent modal from closing on touch scroll
    const handleTouchMove = (e: TouchEvent) => {
      // Only prevent if touch is inside the modal
      const modal = document.querySelector('[data-modal="share-modal"]');
      if (modal && modal.contains(e.target as Node)) {
        e.stopPropagation();
      }
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [open]);

  // Auto scale to fit viewport with RAF throttling
  const recomputeScale = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    
    const isMobile = window.innerWidth < 768;
    const padding = isMobile ? 16 : 32;
    
    // Get actual viewport dimensions
    const availW = vp.clientWidth - padding * 2;
    const availH = vp.clientHeight - padding * 2;
    
    // Calculate scale based on available space
    let s = Math.min(availW / target.w, availH / target.h, 1);
    
    // Set minimum scales with mobile optimization
    let minScale;
    if (orientation === 'vertical') {
      minScale = isMobile ? 0.36 : 0.30;
    } else {
      // Horizontal mode: prioritize readability
      minScale = isMobile ? 0.30 : 0.34;
      
      // For horizontal on mobile, prioritize fitting width
      if (isMobile && availW / target.w < 0.4) {
        s = Math.max(0.30, availW / target.w);
      }
    }
    
    setScale(Math.max(minScale, s));
  }, [target.w, target.h, orientation]);

  const throttledRecomputeScale = useRafThrottle(recomputeScale, [target.w, target.h]);

  useEffect(() => {
    throttledRecomputeScale();
    
    // Create ResizeObserver with RAF throttling
    const rafRef = { current: null as number | null };
    const pendingEntriesRef = { current: [] as ResizeObserverEntry[] };
    
    const batchedCallback = (entries: ResizeObserverEntry[]) => {
      pendingEntriesRef.current.push(...entries);
      
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          if (pendingEntriesRef.current.length > 0) {
            throttledRecomputeScale();
            pendingEntriesRef.current = [];
          }
          rafRef.current = null;
        });
      }
    };
    
    const ro = new ResizeObserver(batchedCallback);
    const el = viewportRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [throttledRecomputeScale, orientation]);

  useEffect(() => {
    // Keep orientation switch predictable and easy to navigate.
    setUserScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsPanning(false);
  }, [orientation]);

  const zoomIn = useCallback(() => {
    setUserScale((prev) => Math.min(3, prev + 0.15));
  }, []);

  const zoomOut = useCallback(() => {
    setUserScale((prev) => Math.max(0.5, prev - 0.15));
  }, []);

  const handleSavePNG = async () => {
    if (!cardRef.current || isSaving) return;
    setIsSaving(true);
    setExportProgress(0);

    const originalSrcs: string[] = [];

    try {
      setExportProgress(10);

      // 1) Export root
      const exportRoot = document.getElementById('wrapped-export-root');
      if (!exportRoot) throw new Error('Export root element not found');

      // 2) Görselleri proxy'ye çevir (TMDB CORS guard) – SENDEKİ KALSIN
      setExportProgress(35);
      const images = exportRoot.querySelectorAll('img');
      images.forEach((img, i) => {
        originalSrcs[i] = img.src;
        const safeUrl = shareSafeUrl(img.src);
        img.crossOrigin = 'anonymous';
        img.src = safeUrl;
      });

      // 3) PNG blob üret
      setExportProgress(60);
      let blob = await exportToBlob(exportRoot, target.w, target.h, adaptivePixelRatio, '#0B1220');
      if (!blob) {
        await delay(80);
        blob = await exportToBlob(exportRoot, target.w, target.h, adaptivePixelRatio, '#0B1220');
      }
      if (!blob) throw new Error('Failed to export image');

      // 4) MOBIL: sistem paylaşım (galeriye kaydetmek için standart yol)
      setExportProgress(80);
      let method: 'system_share' | 'file_picker' | 'download' = 'download';
      const shared = await shareToSystem(blob);

      // 5) Destek yoksa — desktop: file picker; en son: normal download
      if (shared) {
        method = 'system_share';
      } else {
        const saved = await saveWithFilePicker(blob);
        if (saved) {
          method = 'file_picker';
        } else {
          downloadFallback(blob);
        }
      }

      // 6) UI feedback + analytics
      setExportProgress(100);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1600);
      trackEvent('share_exported', { variant: orientation, method });
      onDownloadSuccess?.();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      // img src'lerini geri al
      const exportRoot = document.getElementById('wrapped-export-root');
      if (exportRoot) {
        const imgs = exportRoot.querySelectorAll('img');
        imgs.forEach((img, i) => { if (originalSrcs[i]) img.src = originalSrcs[i]; });
      }
      setIsSaving(false);
      setExportProgress(0);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 p-4 md:p-8">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      {/* Modal shell */}
      <div 
        data-modal="share-modal"
        className="relative w-full max-w-6xl h-full bg-gradient-to-br from-slate-900/98 to-slate-800/95 backdrop-blur-2xl mx-auto rounded-2xl md:rounded-3xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-6 md:px-8 py-6 md:py-8 border-b border-slate-700/30">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5" />
          
          <div className="relative flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Share Your Wrapped
              </h2>
              <p className="text-slate-400 text-sm md:text-base">Export your cinematic journey as a beautiful image</p>
            </div>
            
            <button
              onClick={onClose}
              className="p-3 hover:bg-slate-700/50 rounded-xl transition-all duration-200 text-slate-400 hover:text-white group"
              aria-label="Close"
            >
              <X size={22} className="group-hover:rotate-90 transition-transform duration-200" />
            </button>
          </div>

          {/* Format toggle - centered below */}
          <OrientationToggle orientation={orientation} onChange={setOrientation} />
        </div>

        {/* Preview viewport */}
        <div 
          ref={viewportRef} 
          className={`relative flex-1 min-h-0 px-4 md:p-6 flex items-center justify-center overflow-hidden select-none ${
            isPanning ? 'cursor-grabbing' : (canPan ? 'cursor-grab' : 'cursor-default')
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: canPan ? 'none' : 'pinch-zoom' }}
        >
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-xl border border-slate-600/50 bg-slate-900/70 p-2 backdrop-blur">
            <button
              onClick={zoomOut}
              className="rounded-lg p-2 text-slate-200 hover:bg-slate-700/70 transition-colors"
              aria-label="Zoom out"
            >
              <Minus size={16} />
            </button>
            <div className="min-w-[64px] text-center text-xs font-semibold text-slate-200">
              {Math.round(userScale * 100)}%
            </div>
            <button
              onClick={zoomIn}
              className="rounded-lg p-2 text-slate-200 hover:bg-slate-700/70 transition-colors"
              aria-label="Zoom in"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={resetZoom}
              className="rounded-lg p-2 text-slate-200 hover:bg-slate-700/70 transition-colors"
              aria-label="Reset zoom"
            >
              <Scan size={16} />
            </button>
          </div>

          <div
            className={`relative flex-shrink-0 will-change-transform transition-transform ${isPanning ? 'duration-0' : 'duration-150'} ${orientation === 'horizontal' ? 'max-w-full' : ''}`}
            style={{
              width: target.w * scale,
              height: target.h * scale,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            }}
          >
            <div
              ref={cardRef}
              className="origin-top-left bg-slate-900 rounded-xl overflow-hidden"
              style={{
                width: target.w,
                height: target.h,
                transform: `scale(${scale * userScale})`,
                transformOrigin: 'top left',
                filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.4))',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <ShareCard {...cardProps} orientation={orientation} />
            </div>
            
          </div>
          
          {/* Zoom hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-slate-400 text-xs bg-slate-900/80 px-3 py-1 rounded-full">
            {typeof window !== 'undefined' && window.innerWidth < 768 
              ? (canPan ? 'Pinch to zoom • Drag to navigate' : 'Pinch to zoom for detail')
              : (canPan ? 'Scroll to zoom • Drag to navigate' : 'Scroll or buttons to zoom')
            }
          </div>
        </div>

        {/* Footer */}
        <div className="relative px-6 md:px-8 py-6 border-t border-slate-700/30 bg-gradient-to-r from-slate-800/40 to-slate-900/40 backdrop-blur-sm">
          {/* Subtle glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/3 to-purple-500/3" />
          
          <div className="relative flex items-center justify-center gap-4">
            {showSuccess && (
              <div className="flex items-center gap-3 text-green-400 font-medium bg-green-400/10 px-4 py-2 rounded-xl border border-green-400/20">
                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
                <span>Successfully downloaded!</span>
              </div>
            )}
            
            {isSaving && exportProgress > 0 && (
              <div className="flex items-center gap-3 text-blue-400 font-medium">
                <Loader2 size={20} className="animate-spin" />
                <span>Generating... {exportProgress}%</span>
              </div>
            )}
            
            <button
              onClick={handleSavePNG}
              disabled={isSaving}
              className="group flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 hover:from-blue-700 hover:via-purple-700 hover:to-purple-800 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-2xl font-bold transition-all duration-300 shadow-2xl hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-75 transform hover:scale-105 active:scale-95 min-w-[200px] border border-blue-500/20"
            >
              {isSaving ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  <span>Generating Image...</span>
                </>
              ) : (
                <>
                  <Download size={22} className="group-hover:translate-y-0.5 transition-transform duration-200" />
                  <span>Download PNG</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
