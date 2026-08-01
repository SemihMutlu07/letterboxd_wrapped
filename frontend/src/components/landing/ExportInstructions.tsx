'use client';
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';

export default function ExportInstructions() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n();

  return (
    <section className="mx-auto w-full max-w-2xl text-left">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 px-4 sm:px-6 py-3 sm:py-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex justify-between items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 hover:opacity-80 transition-opacity"
        >
          <span className="font-semibold text-base sm:text-lg text-gray-200">{t('landing.export.title')}</span>
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-3 sm:mt-4 text-slate-300 space-y-3 text-sm sm:text-base">
                <ol className="list-decimal list-inside space-y-2 pl-1">
                  <li>{t('landing.export.step1.before')} <strong className="text-orange-400">{t('landing.export.step1.profile')}</strong> &rarr; <strong className="text-orange-400">{t('landing.export.step1.settings')}</strong></li>
                  <li>{t('landing.export.step2.before')} <strong className="text-orange-400">{t('landing.export.step2.data')}</strong> {t('landing.export.step2.after')}</li>
                  <li>{t('landing.export.step3.before')} <strong className="text-orange-400">{t('landing.export.step3.action')}</strong></li>
                  <li>{t('landing.export.step4.before')} <strong className="text-orange-400">{t('landing.export.step4.file')}</strong> {t('landing.export.step4.after')}</li>
                  <li>{t('landing.export.step5')}</li>
                </ol>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
