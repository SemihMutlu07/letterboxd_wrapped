'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type FloatingPanelProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  /** Preferred placement; flipped on collision. */
  prefer?: 'above' | 'below';
};

export type PanelPos = { top: number; left: number; placement: 'above' | 'below' };

const GAP = 12;
const PAD = 12;

export function computePosition(
  anchor: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height'>,
  panel: { width: number; height: number },
  prefer: 'above' | 'below',
  viewport: { width: number; height: number },
): PanelPos {
  const vw = viewport.width;
  const vh = viewport.height;
  const fitsBelow = anchor.bottom + GAP + panel.height <= vh - PAD;
  const fitsAbove = anchor.top - GAP - panel.height >= PAD;

  let placement: 'above' | 'below' = prefer;
  if (prefer === 'below' && !fitsBelow && fitsAbove) placement = 'above';
  else if (prefer === 'above' && !fitsAbove && fitsBelow) placement = 'below';
  else if (!fitsBelow && !fitsAbove) {
    placement = vh - PAD - anchor.bottom >= anchor.top - PAD ? 'below' : 'above';
  }

  let top = placement === 'below'
    ? anchor.bottom + GAP
    : anchor.top - panel.height - GAP;

  // Clamping to the viewport must not pull the panel back over the anchor.
  if (placement === 'below') {
    top = Math.max(top, anchor.bottom + GAP);
    top = Math.min(top, Math.max(PAD, vh - panel.height - PAD));
  } else {
    top = Math.min(top, anchor.top - panel.height - GAP);
    top = Math.max(top, PAD);
  }

  let left = anchor.right - panel.width;
  if (left < PAD) left = PAD;
  if (left + panel.width > vw - PAD) left = Math.max(PAD, vw - panel.width - PAD);

  return { top, left, placement };
}

/**
 * Portal-based floating panel with collision-aware placement.
 * Avoids overflow:hidden ancestors clipping absolute drawers.
 */
export function FloatingPanel({
  open,
  anchorRef,
  onClose,
  children,
  prefer = 'below',
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PanelPos | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const rect = panel.getBoundingClientRect();
    setPos(computePosition(
      anchor,
      { width: rect.width || 280, height: rect.height || 120 },
      prefer,
      { width: window.innerWidth, height: window.innerHeight },
    ));
  }, [anchorRef, prefer]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    reposition();
  }, [open, reposition, children]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const observer = panel ? new ResizeObserver(() => reposition()) : null;
    if (panel && observer) observer.observe(panel);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('touchstart', onPointer);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('touchstart', onPointer);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, onClose, anchorRef, reposition]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      data-placement={pos?.placement ?? prefer}
      className="fixed z-[200] w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-[#1a1a1a]/95 px-4 py-3 text-xs shadow-2xl backdrop-blur"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
