'use client';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { X, Download, Monitor, Smartphone } from 'lucide-react';
import ShareCard from './ShareCard';
import { toPng } from 'html-to-image';

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
  // Debug: log API_BASE for verification
  console.log('API_BASE', process.env.NEXT_PUBLIC_API_BASE);
  const cardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Vertical is coming soon; lock export dimensions to horizontal
  const target = useMemo(() => ({ w: 1200, h: 630 }), []);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Auto scale to fit viewport
  const recomputeScale = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const padding = 32; // internal safe padding
    const availW = vp.clientWidth - padding * 2;
    const availH = vp.clientHeight - padding * 2;
    const s = Math.min(availW / target.w, availH / target.h, 1);
    setScale(Math.max(0.3, s));
  }, [target.w, target.h]);

  useEffect(() => {
    recomputeScale();
    const ro = new ResizeObserver(recomputeScale);
    const el = viewportRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [recomputeScale, orientation]);

  const handleSavePNG = async () => {
    if (!cardRef.current || isSaving) return;
    setIsSaving(true);
    
    const originalSrcs: string[] = [];
    
    try {
      // Wait for fonts to be ready
      if (document.fonts) {
        await document.fonts.ready;
      }
      
      // Get the export root element
      const exportRoot = document.getElementById('wrapped-export-root');
      if (!exportRoot) {
        throw new Error('Export root element not found');
      }
      
      // Convert all image URLs in the export root to use proxy
      const images = exportRoot.querySelectorAll('img');
      
      images.forEach((img, index) => {
        originalSrcs[index] = img.src;
        const safeUrl = shareSafeUrl(img.src);
        
        // Canvas export guard: ensure no TMDB CDN URLs
        console.assert(
          !safeUrl.includes('://image.tmdb.org'), 
          'Share uses CDN, must proxy', 
          safeUrl
        );
        
        // Set crossOrigin before src for CORS
        img.crossOrigin = 'anonymous';
        img.src = safeUrl;
      });
      
      // Add export mode class to the specific card element, not the document
      exportRoot.classList.add('export-mode');
      
      // Wait a microtask for styles to apply
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const dataUrl = await toPng(exportRoot, {
        width: orientation === 'horizontal' ? 1200 : 630,
        height: orientation === 'horizontal' ? 630 : 1200,
        pixelRatio: 2,
        backgroundColor: '#0B1220',
        cacheBust: true,
        skipFonts: false
      });

      const a = document.createElement('a');
      a.download = 'letterboxd-wrapped.png';
      a.href = dataUrl;
      a.click();

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1600);
      
      // Trigger feedback modal after successful download
      if (onDownloadSuccess) {
        setTimeout(() => onDownloadSuccess(), 3000);
      }
    } catch (error) {
      console.error('Export failed:', error);
      // Silent error handling
    } finally {
      // Remove export mode class from the specific element
      const exportRoot = document.getElementById('wrapped-export-root');
      if (exportRoot) {
        exportRoot.classList.remove('export-mode');
        
        // Restore original image sources
        const images = exportRoot.querySelectorAll('img');
        images.forEach((img, index) => {
          if (originalSrcs && originalSrcs[index]) {
            img.src = originalSrcs[index];
          }
        });
      }
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      {/* Modal shell */}
      <div className="relative w-[95vw] max-w-6xl h-[92vh] bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white truncate">Share Your Wrapped</h2>
            <p className="text-sm text-slate-400 mt-0.5">Choose format and download</p>
          </div>

          {/* Format toggle (Vertical coming soon) */}
          <div className="flex items-center gap-2 bg-slate-800/70 border border-white/10 rounded-lg p-1">
            <button
              onClick={() => setOrientation('horizontal')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition ${
                orientation === 'horizontal'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Monitor size={16} />
              Horizontal <span className="opacity-70">(1200×630)</span>
            </button>
            <span className="flex items-center gap-2 px-3.5 py-2 rounded-md text-sm text-slate-400">
              <Smartphone size={16} /> Vertical <span className="opacity-60">(Coming soon)</span>
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview viewport */}
        <div ref={viewportRef} className="flex-1 min-h-0 p-6 flex items-center justify-center overflow-hidden">
          <div
            className="relative"
            style={{
              width: target.w * scale,
              height: target.h * scale,
            }}
          >
            <div
              ref={cardRef}
              className="origin-top-left"
              style={{
                width: target.w,
                height: target.h,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.4))',
              }}
            >
              <ShareCard {...cardProps} orientation={'horizontal'} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-800/30">
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              PNG • 2× quality • {target.w}×{target.h}
            </div>

            <div className="flex items-center gap-3">
              {showSuccess && (
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Downloaded!
                </div>
              )}
              <button
                onClick={handleSavePNG}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-semibold transition shadow-lg disabled:cursor-not-allowed"
              >
                <Download size={18} />
                {isSaving ? 'Generating…' : 'Download PNG'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
