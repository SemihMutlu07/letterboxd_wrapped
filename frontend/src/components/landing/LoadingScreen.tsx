'use client';
import { Film, X } from 'lucide-react';

type Props = {
  title?: string;
  message?: string;
  detail?: string;
  onCancel?: () => void;
};

export default function LoadingScreen({
  title = 'Analyzing Your Films',
  message = 'Preparing files, running analysis, and building your results.',
  detail = "Large ZIP files can take a little longer. We'll redirect automatically.",
  onCancel,
}: Props) {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-xl text-center rounded-3xl border border-slate-700/70 bg-slate-800/55 p-8 md:p-10 backdrop-blur-sm">
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg bg-slate-700/60 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-600 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        )}

        <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-orange-500/15 border border-orange-400/35 flex items-center justify-center">
          <Film className="h-7 w-7 text-orange-300 animate-pulse" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">{title}</h1>
        <p className="text-slate-300 mb-7">{message}</p>

        <div className="space-y-3 mb-6">
          <div className="h-2 rounded-full bg-slate-700/80 overflow-hidden">
            <div className="h-full w-2/3 bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 animate-[pulse_1.6s_ease-in-out_infinite]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-2 rounded-full bg-slate-700/80 overflow-hidden">
              <div className="h-full w-full bg-cyan-400/70 animate-[pulse_1.2s_ease-in-out_infinite]" />
            </div>
            <div className="h-2 rounded-full bg-slate-700/80 overflow-hidden">
              <div className="h-full w-full bg-pink-400/70 animate-[pulse_1.6s_ease-in-out_infinite]" />
            </div>
            <div className="h-2 rounded-full bg-slate-700/80 overflow-hidden">
              <div className="h-full w-full bg-violet-400/70 animate-[pulse_2s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-400">{detail}</p>
        <p className="mt-3 text-xs text-slate-500 text-center">Your raw files are never stored. With consent, only anonymous viewing stats are kept to improve the product.</p>
      </div>
    </div>
  );
}
