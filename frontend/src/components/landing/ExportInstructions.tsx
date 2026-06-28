'use client';
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExportInstructions() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="mx-auto w-full max-w-2xl text-left">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 px-4 sm:px-6 py-3 sm:py-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex justify-between items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 hover:opacity-80 transition-opacity"
        >
          <span className="font-semibold text-base sm:text-lg text-gray-200">How to Export Your Letterboxd Data</span>
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
                  <li>Go to your <strong className="text-orange-400">Profile</strong> &rarr; <strong className="text-orange-400">Settings</strong></li>
                  <li>Open the <strong className="text-orange-400">Data</strong> tab</li>
                  <li>Click <strong className="text-orange-400">Export Your Data</strong></li>
                  <li>A <strong className="text-orange-400">.zip file</strong> will download</li>
                  <li>Upload it here</li>
                </ol>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
