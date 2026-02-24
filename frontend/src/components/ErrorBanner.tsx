'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, X, MessageSquare } from 'lucide-react';
import type { NormalizedError } from '@/lib/errors';

interface ErrorBannerProps {
  error: NormalizedError;
  onDismiss: () => void;
  onRetry?: () => void;
  onReport?: () => void;
}

export default function ErrorBanner({ error, onDismiss, onRetry, onReport }: ErrorBannerProps) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-700/50 bg-slate-800/90 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 h-9 w-9 rounded-xl bg-red-500/15 border border-red-400/30 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-red-200 text-sm">{error.title}</h3>
            <button
              onClick={onDismiss}
              className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-1 text-sm text-slate-300 leading-relaxed">{error.message}</p>

          {error.action && (
            <p className="mt-1.5 text-xs text-slate-400">{error.action}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs font-medium text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            )}

            {error.reason === 'unknown_error' && onReport && (
              <button
                onClick={onReport}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Report issue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
