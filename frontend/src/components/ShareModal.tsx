'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';

import type { ShareCardData } from '@/components/share/types';
import { shareVariantsForOrientation } from '@/components/share/registry';
import { normalizeShareCardData } from '@/components/share/viewModel';

import { SHARE_EXPORT_CONFIG } from '@/components/share/modal/exportUtils';
import { CanonicalExportCard } from '@/components/share/modal/CanonicalExportCard';
import { ShareModalHeader } from '@/components/share/modal/ShareModalHeader';
import { ShareModalSidebar } from '@/components/share/modal/ShareModalSidebar';
import { VariantRail } from '@/components/share/modal/VariantRail';
import { useShareExport } from '@/components/share/modal/useShareExport';
import type { ShareModalProps } from '@/components/share/modal/types';

export {
  exportExactPng,
  readPngDimensions,
  resolveExportBackground,
  SHARE_EXPORT_CONFIG,
} from '@/components/share/modal/exportUtils';
export { shareSafeUrl } from '@/components/share/modal/shareActions';

export default function ShareModal({
  open,
  onClose,
  orientation,
  setOrientation,
  cardProps,
  onDownloadSuccess,
}: ShareModalProps) {
  const availableVariants = useMemo(
    () => shareVariantsForOrientation(orientation),
    [orientation],
  );
  const railRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pageW, setPageW] = useState(0);
  const [pageH, setPageH] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [actorIdx, setActorIdx] = useState(0);
  const [directorIdx, setDirectorIdx] = useState(0);
  const [swapOpen, setSwapOpen] = useState(false);
  const [showSwapHint, setShowSwapHint] = useState(false);
  const [hintFading, setHintFading] = useState(false);
  const [showUsername, setShowUsername] = useState(true);
  const [exportError, setExportError] = useState<string | null>(null);

  const activeVariant = availableVariants[
    Math.max(0, Math.min(availableVariants.length - 1, activeIdx))
  ];
  const variantKey = activeVariant.key;
  const variantLabel = activeVariant.label;

  useEffect(() => {
    if (!open) return;
    setActorIdx(0);
    setDirectorIdx(0);
    setActiveIdx(0);
    setSwapOpen(false);
    setShowUsername(true);
    setExportError(null);
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [orientation]);

  useEffect(() => {
    setActorIdx(0);
    setDirectorIdx(0);
  }, [cardProps]);

  const effectiveCardProps = useMemo<ShareCardData>(() => normalizeShareCardData({
    ...cardProps,
    onScreenCrush: cardProps.topActors?.[actorIdx] ?? cardProps.onScreenCrush,
    favoriteDirector: cardProps.topDirectors?.[directorIdx] ?? cardProps.favoriteDirector,
    username: showUsername ? cardProps.username : undefined,
  }), [cardProps, actorIdx, directorIdx, showUsername]);

  const dismissSwapHint = useCallback(() => {
    setHintFading(true);
    setTimeout(() => setShowSwapHint(false), 300);
  }, []);

  useEffect(() => {
    if (!open) return;
    const hasActors = (cardProps.topActors?.length ?? 0) >= 2;
    const hasDirectors = (cardProps.topDirectors?.length ?? 0) >= 2;
    const swapTrigger = hasActors || hasDirectors;
    if (!swapTrigger) return;
    setShowSwapHint(true);
    setHintFading(false);
    const t = setTimeout(() => setHintFading(true), 4500);
    const t2 = setTimeout(() => setShowSwapHint(false), 5000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [open, cardProps]);

  useEffect(() => {
    if (!showSwapHint) return;
    const demoHasActors = (cardProps.topActors?.length ?? 0) >= 2;
    const demoHasDirectors = (cardProps.topDirectors?.length ?? 0) >= 2;
    const setDemoIdx = demoHasActors ? setActorIdx : demoHasDirectors ? setDirectorIdx : null;
    if (!setDemoIdx) return;
    const t1 = setTimeout(() => setDemoIdx(1), 1200);
    const t2 = setTimeout(() => setDemoIdx(0), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showSwapHint, cardProps]);

  useEffect(() => {
    if (!showSwapHint) return;
    const t1 = setTimeout(() => setSwapOpen(true), 800);
    const t2 = setTimeout(() => setSwapOpen(false), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showSwapHint]);

  const target = useMemo(() => {
    const config = SHARE_EXPORT_CONFIG[orientation];
    return { w: config.domWidth, h: config.domHeight };
  }, [orientation]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isSaving) return;
      if (swapOpen) {
        setSwapOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isSaving, onClose, swapOpen]);

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

  const { handleSavePNG } = useShareExport({
    orientation,
    variantKey,
    isSaving,
    setIsSaving,
    setExportError,
    onDownloadSuccess,
  });

  if (!open) return null;

  const hasActors = (cardProps.topActors?.length ?? 0) >= 2;
  const hasDirectors = (cardProps.topDirectors?.length ?? 0) >= 2;
  const showSwapTrigger = hasActors || hasDirectors;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/80" onClick={() => { if (!isSaving) onClose(); }} />

      <CanonicalExportCard
        variantKey={variantKey}
        data={effectiveCardProps}
        orientation={orientation}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="relative flex h-full flex-col overflow-hidden bg-[#0f0f0f] md:mx-auto md:mt-6 md:h-[calc(100vh-3rem)] md:max-h-[920px] md:w-[calc(100vw-3rem)] md:max-w-[1180px] md:rounded-3xl"
      >
        <ShareModalHeader
          variantLabel={variantLabel}
          activeIdx={activeIdx}
          variantCount={availableVariants.length}
          isSaving={isSaving}
          onClose={onClose}
        />

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:bg-black/20">
            <VariantRail
              railRef={railRef}
              availableVariants={availableVariants}
              activeIdx={activeIdx}
              pageW={pageW}
              pageH={pageH}
              target={target}
              effectiveCardProps={effectiveCardProps}
              orientation={orientation}
              isSaving={isSaving}
              onScroll={handleRailScroll}
              onJumpTo={jumpTo}
            />
          </div>

          <ShareModalSidebar
            cardProps={cardProps}
            orientation={orientation}
            setOrientation={setOrientation}
            isSaving={isSaving}
            showSwapTrigger={showSwapTrigger}
            hasActors={hasActors}
            hasDirectors={hasDirectors}
            swapOpen={swapOpen}
            setSwapOpen={setSwapOpen}
            showSwapHint={showSwapHint}
            hintFading={hintFading}
            dismissSwapHint={dismissSwapHint}
            actorIdx={actorIdx}
            directorIdx={directorIdx}
            setActorIdx={setActorIdx}
            setDirectorIdx={setDirectorIdx}
            showUsername={showUsername}
            setShowUsername={setShowUsername}
            exportError={exportError}
            onSave={handleSavePNG}
          />
        </div>
      </div>
    </div>
  );
}
