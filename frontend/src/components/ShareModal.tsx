'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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

export default function ShareModal({ open, onClose, orientation, setOrientation, cardProps }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [scale, setScale] = useState(0.6);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const target = orientation === 'horizontal' ? { w: 1200, h: 630 } : { w: 630, h: 1200 };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    
    switch (e.key) {
      case 'Escape':
        if (isZoomed) {
          setIsZoomed(false);
        } else {
          onClose();
        }
        break;
      case 'ArrowLeft':
        if (!isZoomed && orientation === 'vertical') setOrientation('horizontal');
        break;
      case 'ArrowRight':
        if (!isZoomed && orientation === 'horizontal') setOrientation('vertical');
        break;
      case 'z':
      case 'Z':
        setIsZoomed(!isZoomed);
        break;
    }
  }, [open, orientation, isZoomed, onClose, setOrientation]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const calculateScale = () => {
      const padding = 40;
      const headerHeight = 90;
      const footerHeight = 60;
      
      const availableW = el.clientWidth - padding * 2;
      const availableH = el.clientHeight - headerHeight - footerHeight - padding * 2;
      
      const scaleW = availableW / target.w;
      const scaleH = availableH / target.h;
      
      const maxScale = orientation === 'vertical' ? 0.65 : 0.7;
      const optimalScale = Math.min(scaleW, scaleH, maxScale);
      
      setScale(Math.max(0.2, optimalScale));
    };

    calculateScale();
    const ro = new ResizeObserver(calculateScale);
    ro.observe(el);
    
    return () => ro.disconnect();
  }, [orientation, target.w, target.h]);

  const handleSavePNG = async () => {
    if (!cardRef.current || isSaving) return;
    
    setIsSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        width: target.w,
        height: target.h,
        pixelRatio: 2,
        backgroundColor: '#0B1220',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });
      
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      link.download = `letterboxd-wrapped-${date}.png`;
      link.href = dataUrl;
      link.click();
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save image:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-md" 
        onClick={onClose}
      />
      
      <div 
        ref={containerRef}
        className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl w-[min(1400px,98vw)] h-[98vh] overflow-hidden shadow-2xl border border-white/10"
      >
        <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-slate-800/80 to-slate-700/80 backdrop-blur-sm border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Share Your Wrapped
            </h2>
            <p className="text-slate-300 text-sm">
              Create stunning images for social media
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/60 rounded-xl p-1 border border-white/10">
              <button
                onClick={() => setOrientation('horizontal')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  orientation === 'horizontal' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Horizontal
              </button>
              <button
                onClick={() => setOrientation('vertical')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  orientation === 'vertical' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Vertical
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {showSuccess && (
              <div className="text-green-400 text-sm font-medium animate-pulse">
                ✓ Downloaded!
              </div>
            )}
            
            <button
              onClick={handleSavePNG}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-xl font-semibold text-base transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 transform hover:scale-105 disabled:transform-none border border-white/10"
            >
              <Download size={18} />
              {isSaving ? 'Saving...' : 'Download PNG'}
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              <button
                onClick={() => setIsZoomed(!isZoomed)}
                className="p-2 bg-slate-800/80 hover:bg-slate-700/80 rounded-lg transition-colors text-slate-300 hover:text-white backdrop-blur-sm border border-white/10"
                title={isZoomed ? "Zoom out (Z)" : "Zoom in (Z)"}
              >
                {isZoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
              </button>
              <button
                onClick={() => setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal')}
                className="p-2 bg-slate-800/80 hover:bg-slate-700/80 rounded-lg transition-colors text-slate-300 hover:text-white backdrop-blur-sm border border-white/10"
                title="Rotate (←/→)"
              >
                <RotateCcw size={18} />
              </button>
            </div>

            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-3xl scale-110" />
              
              <div
                className="relative transition-all duration-500 ease-out flex items-center justify-center"
                style={{ 
                  transform: isZoomed ? 'scale(1.3)' : `scale(${scale})`,
                  cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                  maxWidth: '100%',
                  maxHeight: '100%'
                }}
                onClick={() => setIsZoomed(!isZoomed)}
              >
                <div className="origin-center">
                  <ShareCard ref={cardRef} {...cardProps} orientation={orientation} />
                </div>
              </div>

              {isZoomed && (
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                  Zoomed • Click to exit
                </div>
              )}
            </div>
          </div>

          <div className="px-8 py-4 bg-gradient-to-r from-slate-800/40 to-slate-700/40 backdrop-blur-sm border-t border-white/10">
            <div className="text-center text-slate-400 text-xs">
              <p>Format: PNG • Quality: 2x • Size: {target.w}×{target.h} • Use arrow keys to switch • Z to zoom • ESC to close</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
