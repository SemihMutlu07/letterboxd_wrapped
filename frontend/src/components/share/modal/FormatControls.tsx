'use client';

import { X, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useI18n } from '@/i18n/I18nProvider';

import type { Orientation } from './types';

type FormatControlsProps = {
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  isSaving: boolean;
  showSwapTrigger: boolean;
  showSwapHint: boolean;
  hintFading: boolean;
  swapOpen: boolean;
  onSwapToggle: () => void;
  onDismissSwapHint: () => void;
};

export function FormatControls({
  orientation,
  setOrientation,
  isSaving,
  showSwapTrigger,
  showSwapHint,
  hintFading,
  swapOpen,
  onSwapToggle,
  onDismissSwapHint,
}: FormatControlsProps) {
  const { t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('share.formatGroup')}
      className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
    >
      <div className="grid min-w-0 grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
        <button
          onClick={() => setOrientation('vertical')}
          disabled={isSaving}
          aria-pressed={orientation === 'vertical'}
          className={`min-h-11 min-w-0 rounded-lg px-2 py-2 text-[12px] font-semibold leading-tight [overflow-wrap:anywhere] transition-colors ${
            orientation === 'vertical' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('share.story')}
        </button>
        <button
          onClick={() => setOrientation('horizontal')}
          disabled={isSaving}
          aria-pressed={orientation === 'horizontal'}
          className={`min-h-11 min-w-0 rounded-lg px-2 py-2 text-[12px] font-semibold leading-tight [overflow-wrap:anywhere] transition-colors ${
            orientation === 'horizontal' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('share.landscape')}
        </button>
      </div>
      {showSwapTrigger && (
        <div className="relative">
          <AnimatePresence>
            {showSwapHint && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                animate={{ opacity: hintFading ? 0 : 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 bottom-full z-20 mb-2 flex max-w-[min(18rem,calc(100vw-2.5rem))] items-center gap-2 rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 shadow-lg backdrop-blur"
              >
                <span className="text-xs text-slate-300">{t('share.swapHint')}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDismissSwapHint(); }}
                  className="text-slate-500 hover:text-white transition-colors leading-none"
                  aria-label={t('share.dismissHint')}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
                <div className="absolute -bottom-1.5 right-3 w-3 h-3 rotate-45 bg-[#1a1a1a] border-r border-b border-white/10" />
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={onSwapToggle}
            disabled={isSaving}
            aria-label={t('share.tune')}
            className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${
              swapOpen ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {showSwapHint && !hintFading && (
              <span className="absolute inset-0 rounded-full border border-white/20 animate-ping" />
            )}
            <Sliders size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
