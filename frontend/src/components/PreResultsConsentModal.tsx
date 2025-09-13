"use client";

import React, { useState, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { initPostHog, captureEvent } from '@/lib/posthog';
import { getFlagVariant } from '@/lib/posthog';
import { saveConsentDecisionToDb } from '@/lib/consentFlow';


interface PreResultsConsentModalProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  sessionId: string;
}

export default function PreResultsConsentModal({ open, onAccept, onDecline }: PreResultsConsentModalProps) {
  const reduce = useReducedMotion();
  const [variant, setVariant] = useState<'control' | 'friendly'>('control');
  const [startTime, setStartTime] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStartTime(performance.now());
    }
  }, [open]);

  // Feature flag A/B testing
  useEffect(() => {
    let alive = true;
    
    const loadVariant = async () => {
      try {
        if (!alive) return;
        
        const flagVariant = await getFlagVariant('consent_modal_variant', 'control');
        setVariant((flagVariant as 'control' | 'friendly') ?? 'control');
        
        // Capture view event with error handling
        try {
          captureEvent('consent_modal_view', { variant: flagVariant });
        } catch (analyticsError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Failed to capture consent modal view:', analyticsError);
          }
        }
      } catch (error) {
        if (!alive) return;
        
        if (process.env.NODE_ENV === 'development') {
          console.warn('Feature flag loading failed, using control variant:', error);
        }
        
        setVariant('control');
        
        // Still try to capture the view event
        try {
          captureEvent('consent_modal_view', { variant: 'control' });
        } catch (analyticsError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Failed to capture consent modal view (fallback):', analyticsError);
          }
        }
      }
    };

    loadVariant();
    
    return () => { alive = false };
  }, []);

  const handleDecision = async (decision: 'accept' | 'decline') => {
    const msToDecision = Math.round(performance.now() - startTime);
    setIsSubmitting(true);

    try {
      await saveConsentDecisionToDb(decision === 'accept');
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error submitting consent:', err);
      }
      // Don't block navigation on error, just log and continue
    }

    if (decision === 'accept') {
      try {
        initPostHog();
      } catch (initError) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('PostHog initialization failed:', initError);
        }
      }
      
      try {
        captureEvent('consent_decision', {
          decision,
          ab_variant: variant,
          ms_to_decision: msToDecision,
        });
      } catch (analyticsError) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to capture consent decision:', analyticsError);
        }
      }
    }

    // Save consent decision to sessionStorage
    try {
      sessionStorage.setItem('consent_decision', decision);
    } catch (storageError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to save consent to sessionStorage:', storageError);
      }
    }

    // Call the appropriate callback
    if (decision === 'accept') {
      onAccept();
    } else {
      onDecline();
    }
    
    setIsSubmitting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <div className={`relative w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900/95 p-5 sm:p-6 text-white shadow-2xl ${reduce ? '' : 'transition-transform'}`}>
                 <div className="mb-4">
           <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
             {variant === 'friendly' 
               ? 'Help us make this better'
               : 'Help us improve your experience'
             }
           </h2>
           <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
             {variant === 'friendly'
               ? "Share anonymous usage so we can improve."
               : "We'd love to learn from your Letterboxd data to make this tool even better. Your data will be anonymized and used only for improving the analysis."
             }
           </p>
         </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            className="flex-1 min-h-[44px] rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleDecision('accept')}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'Yes, help improve'}
          </button>
          <button
            className="flex-1 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleDecision('decline')}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'No, just continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
