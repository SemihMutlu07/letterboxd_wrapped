"use client";

import React from 'react';
import { X } from 'lucide-react';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  values: { storeLocal: boolean; allowDiagnostics: boolean; allowAnalytics: boolean };
  onChange: (v: SettingsDrawerProps['values']) => void;
}

export default function SettingsDrawer({ open, onClose, values, onChange }: SettingsDrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-slate-900 text-white border-l border-slate-700/60 shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Ayarlar</h3>
          <button aria-label="Close" onClick={onClose} className="p-2 rounded-md hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={values.storeLocal} onChange={(e)=>onChange({ ...values, storeLocal: e.target.checked })} />
            <span>Analiz verilerini cihazımda sakla</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={values.allowDiagnostics} onChange={(e)=>onChange({ ...values, allowDiagnostics: e.target.checked })} />
            <span>Hata olursa tanı paketi paylaşımı</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={values.allowAnalytics} onChange={(e)=>onChange({ ...values, allowAnalytics: e.target.checked })} />
            <span>Anonim kullanım istatistikleri (opt-in)</span>
          </label>
        </div>
        <div className="mt-6 text-sm text-slate-300">Bu ayarlar yalnızca bu cihazda geçerlidir.</div>
      </aside>
    </div>
  );
}
