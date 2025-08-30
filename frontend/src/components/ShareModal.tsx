'use client';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { X, Download, Monitor, Smartphone } from 'lucide-react';
import ShareCard from './ShareCard';
import { toPng } from 'html-to-image';

type Orientation = 'horizontal' | 'vertical';

type Props = {
  open: boolean;
  onClose: () => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  cardProps: Parameters<typeof ShareCard>[0];
};

export default function ShareModal({
  open,
  onClose,
  orientation,
  setOrientation,
  cardProps,
}: Props) {
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
    try {
      const dataUrl = await toPng(cardRef.current, {
        width: target.w,
        height: target.h,
        pixelRatio: 2,
        backgroundColor: '#0B1220',
        // neutralize preview transform
        style: { transform: 'scale(1)', transformOrigin: 'top left' },
        cacheBust: true,
        skipFonts: false,
      });

      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.download = `letterboxd-wrapped-${orientation}-${stamp}.png`;
      a.href = dataUrl;
      a.click();

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1600);
    } catch {
      // Silent error handling
    } finally {
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
