"use client";

import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  captureEvent,
  clearQueue,
  flushQueue,
  getFlagVariant,
  initPostHog,
} from '@/lib/posthog';
import { saveConsentDecisionToDb } from '@/lib/consentFlow';

interface PreResultsConsentModalProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  sessionId: string;
}

export default function PreResultsConsentModal({
  open,
  onAccept,
  onDecline,
}: PreResultsConsentModalProps) {
  const reduce = useReducedMotion();
  const [variant, setVariant] = useState<'control' | 'friendly'>('control');
  const [startTime, setStartTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) setStartTime(performance.now());
  }, [open]);

  useEffect(() => {
    let alive = true;
    getFlagVariant('consent_modal_variant', 'control').then((value) => {
      if (alive) setVariant((value as 'control' | 'friendly') ?? 'control');
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleDecision = async (decision: 'accept' | 'decline') => {
    const msToDecision = Math.round(performance.now() - startTime);
    setIsSubmitting(true);

    await saveConsentDecisionToDb(decision === 'accept');

    if (decision === 'accept') {
      initPostHog();
      captureEvent('consent_decision', {
        decision,
        ab_variant: variant,
        ms_to_decision: msToDecision,
      });
      flushQueue();
      onAccept();
    } else {
      clearQueue();
      onDecline();
    }

    setIsSubmitting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className={`relative w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900/95 p-5 text-white shadow-2xl sm:p-6 ${reduce ? '' : 'transition-transform'}`}
      >
        <div className="mb-4">
          <h2 id="consent-title" className="text-xl font-bold tracking-tight sm:text-2xl">
            {variant === 'friendly' ? 'Help us make this better' : 'Help us improve Movies Wrapped'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
            With your permission, we save your Letterboxd username and aggregate viewing stats
            such as film totals, average rating, and top genres and directors. We also collect
            anonymous usage events. We do not save film lists, titles, reviews, or review text.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            className="min-h-[44px] flex-1 rounded-xl bg-slate-800 px-4 py-2 font-semibold hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handleDecision('decline')}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'No, just continue'}
          </button>
          <button
            className="min-h-[44px] flex-1 rounded-xl bg-orange-500 px-4 py-2 font-semibold hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handleDecision('accept')}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'Yes, help improve'}
          </button>
        </div>
      </div>
    </div>
  );
}
