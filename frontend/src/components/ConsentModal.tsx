"use client";

import React, { useEffect, useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';

interface ConsentModalProps {
  open: boolean;
  onAccept: (choices: { storeLocal: boolean; allowDiagnostics: boolean; allowAnalytics: boolean }) => void;
  onSkip: () => void;
  onDetails?: () => void;
  locale?: 'tr' | 'en';
}

export default function ConsentModal({ open, onAccept, onSkip, onDetails, locale }: ConsentModalProps) {
  const reduce = useReducedMotion();
  const [storeLocal, setStoreLocal] = React.useState(true);
  const [allowDiagnostics, setAllowDiagnostics] = React.useState(false);
  const [allowAnalytics, setAllowAnalytics] = React.useState(false);

  const lang: 'tr' | 'en' = useMemo(() => {
    if (locale) return locale;
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr')) return 'tr';
    return 'en';
  }, [locale]);

  useEffect(() => {
    if (!open) return;
  }, [open]);

  const t = (key: string) => {
    const tr: Record<string, string> = {
      title: 'Veri saklama ve iyileştirme izni',
      desc: 'Sonuçları daha iyi hale getirmek için bazı verileri cihazınızda saklayabiliriz. İsterseniz bir sorun olduğunda anonim bir tanı paketi paylaşabilirsiniz.',
      opt1: 'Analiz verilerini cihazımda sakla',
      opt2: 'Hata olursa tanı paketini paylaşmama izin ver',
      opt3: 'Anonim kullanım istatistiklerini gönder (isteğe bağlı)',
      continue: 'Devam et',
      showOnly: 'Sadece sonuçları göster',
      details: 'Ayrıntılar'
    };
    const en: Record<string, string> = {
      title: 'Consent for data storage and improvement',
      desc: 'To improve your results, we can store some data on your device. You can also share an anonymized diagnostics package when something goes wrong.',
      opt1: 'Store analysis data on my device',
      opt2: 'Allow sharing a diagnostics package if errors occur',
      opt3: 'Send anonymous usage stats (optional)',
      continue: 'Continue',
      showOnly: 'Show results only',
      details: 'Details'
    };
    return (lang === 'tr' ? tr : en)[key] ?? key;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <div className={`relative w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900/95 p-5 sm:p-6 text-white shadow-2xl ${reduce ? '' : 'transition-transform'}`}>
        <div className="mb-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-1 text-sm sm:text-base text-slate-300 leading-relaxed">{t('desc')}</p>
        </div>

        <div className="mt-3 space-y-2">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={storeLocal} onChange={(e) => setStoreLocal(e.target.checked)} />
            <span className="text-sm sm:text-base">{t('opt1')}</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={allowDiagnostics} onChange={(e) => setAllowDiagnostics(e.target.checked)} />
            <span className="text-sm sm:text-base">{t('opt2')}</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={allowAnalytics} onChange={(e) => setAllowAnalytics(e.target.checked)} />
            <span className="text-sm sm:text-base">{t('opt3')}</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="min-h-[44px] rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
              onClick={() => onAccept({ storeLocal, allowDiagnostics, allowAnalytics })}
            >
              {t('continue')}
            </button>
            <button
              className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
              onClick={onSkip}
            >
              {t('showOnly')}
            </button>
          </div>
          {onDetails && (
            <button
              className="text-sm text-slate-300 underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 rounded-md px-2 py-1"
              onClick={onDetails}
            >
              {t('details')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
