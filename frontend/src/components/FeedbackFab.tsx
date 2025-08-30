"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import { getSupabase } from '@/lib/supabaseClient';
import { initPostHog, captureEvent } from '@/lib/posthog';
import confetti from 'canvas-confetti';

interface FeedbackFabProps {
  sessionId: string;
}

const QUICK_SUGGESTIONS = {
  bug: [
    "The date analysis seems incorrect",
    "Actor images aren't loading properly",
    "The app crashed when I uploaded my file",
    "Results are taking too long to load"
  ],
  idea: [
    "It would be great to see my watchlist stats",
    "Could you add support for TV shows?",
    "I'd love to compare with friends",
    "More detailed genre breakdowns please"
  ],
  general: [
    "Great work on this tool!",
    "The UI is really intuitive",
    "Thanks for making this free",
    "Keep up the good work"
  ]
};

export default function FeedbackFab({ sessionId }: FeedbackFabProps) {
  const reduce = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<'bug' | 'idea' | 'general'>('general');
  const [message, setMessage] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [privacyMode, setPrivacyMode] = useState<'anonymous' | 'identified'>('anonymous');
  const [displayName, setDisplayName] = useState('');
  const [contact, setContact] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_LENGTH = 500;
  const isOverLimit = message.length > MAX_LENGTH;
  const isEmpty = message.trim().length === 0;

  // Prefill display name with parsed Letterboxd username if available
  useEffect(() => {
    if (privacyMode === 'identified' && !displayName) {
      const lbUsername = sessionStorage.getItem('lb_username');
      if (lbUsername) {
        setDisplayName(lbUsername);
      }
    }
  }, [privacyMode, displayName]);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle Enter key in textarea
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    initPostHog();
    const consentDecision = sessionStorage.getItem('consent_decision');
    if (consentDecision === 'accept') {
      captureEvent('feedback_opened');
    }
  };

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setIsOpen(false);
    setMessage('');
    setCategory('general');
    setIncludeDiagnostics(true);
    setPrivacyMode('anonymous');
    setDisplayName('');
    setContact('');
    setIsSubmitting(false);
    setShowSuccess(false);
  }, [isSubmitting]);

  const handleSubmit = useCallback(async () => {
    if (isEmpty || isOverLimit || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const payload = {
        session_id: sessionId,
        message: message.trim(),
        category, // 'bug' | 'idea' | 'general'
        user_agent: navigator.userAgent,
        path: window.location.pathname,
        ...(privacyMode === 'identified' && {
          display_name: displayName || null,
          contact: contact || null,
          source_username: sessionStorage.getItem('lb_username') || null
        })
      };

      const supabase = getSupabase();
      const { error, data } = await supabase
        .from('feedback')
        .insert(payload)
        .select();

      if (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Supabase error:', error);
        }
        
        // Handle specific Supabase errors
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('You have already submitted feedback with this session. Please wait before submitting again.');
        } else if (error.code === '23502') { // Not null violation
          throw new Error('Missing required information. Please fill in all required fields.');
        } else if (error.code === '23514') { // Check constraint violation
          throw new Error('Invalid data provided. Please check your input and try again.');
        } else if (error.code === '42P01') { // Table doesn't exist
          throw new Error('Database configuration error. Please contact support.');
        } else if (error.code === '42501') { // Insufficient privilege
          throw new Error('Permission denied. Please contact support.');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        } else {
          throw new Error(`Database error: ${error.message}`);
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('Feedback submitted successfully:', data);
      }

      setShowSuccess(true);
      
      // Capture PostHog event if consent given
      const consentDecision = sessionStorage.getItem('consent_decision');
      if (consentDecision === 'accept') {
        try {
          captureEvent('feedback_submitted', { 
            category,
            privacy_mode: privacyMode === 'anonymous' ? 'anonymous' : 'identified'
          });
        } catch (analyticsError) {
          // Don't fail feedback submission if analytics fails
          if (process.env.NODE_ENV === 'development') {
            console.warn('Analytics error:', analyticsError);
          }
        }
      }

      // Confetti animation
      if (!reduce) {
        try {
          confetti({
            particleCount: 30,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (confettiError) {
          // Don't fail if confetti doesn't work
          if (process.env.NODE_ENV === 'development') {
            console.warn('Confetti error:', confettiError);
          }
        }
      }

      // Auto close after success
      setTimeout(() => {
        handleClose();
      }, 1200);

    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error submitting feedback:', error);
      }
      
      // Show more specific error information
      let errorMessage = 'Failed to send feedback. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('Detailed error:', errorMessage);
      }
      
      // Show user-friendly error message
      alert(`Feedback submission failed: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [isEmpty, isOverLimit, isSubmitting, sessionId, message, category, privacyMode, displayName, contact, reduce, handleClose]);

  const addSuggestion = (suggestion: string) => {
    const currentText = message;
    const separator = currentText && !currentText.endsWith(' ') ? ' ' : '';
    setMessage(currentText + separator + suggestion);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Keyboard event handlers
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose, handleSubmit]);

  return (
    <>
      {/* FAB Button */}
      <motion.button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-orange-500 hover:bg-orange-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400/60 focus:ring-offset-2 focus:ring-offset-slate-900"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Send feedback"
      >
        <svg className="w-6 h-6 text-white mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </motion.button>

      {/* Modal/Sheet */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              aria-hidden="true"
            />

            {/* Modal Content */}
                         <motion.div
               ref={modalRef}
               className="relative w-full max-w-4xl mx-auto bg-slate-900 rounded-2xl shadow-xl border border-slate-700/60 overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-700/60">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Send Feedback</h2>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    aria-label="Close feedback"
                  >
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

                             {/* Content */}
               <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Category Chips */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Category</label>
                  <div className="flex gap-2">
                    {[
                      { key: 'bug', label: '🐞 Bug', color: 'from-red-500 to-red-600' },
                      { key: 'idea', label: '💡 Idea', color: 'from-blue-500 to-blue-600' },
                      { key: 'general', label: '✨ General', color: 'from-purple-500 to-purple-600' }
                    ].map(({ key, label, color }) => (
                      <button
                        key={key}
                        onClick={() => setCategory(key as typeof category)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                          category === key
                            ? `bg-gradient-to-r ${color} text-white shadow-lg`
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Textarea */}
                <div>
                  <label htmlFor="feedback-message" className="block text-sm font-medium text-slate-300 mb-2">
                    Message
                  </label>
                  <div className="relative">
                                         <textarea
                       ref={textareaRef}
                       id="feedback-message"
                       value={message}
                       onChange={(e) => setMessage(e.target.value)}
                       onKeyDown={handleTextareaKeyDown}
                       placeholder="Tell us what you think... (Press Enter to send, Shift+Enter for new line)"
                       className="w-full min-h-[150px] px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400/60 focus:border-transparent"
                       maxLength={MAX_LENGTH}
                     />
                    <div className="absolute bottom-2 right-2 text-xs text-slate-500">
                      {message.length}/{MAX_LENGTH}
                    </div>
                  </div>
                </div>

                {/* Quick Suggestions */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Quick suggestions</label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_SUGGESTIONS[category].map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => addSuggestion(suggestion)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3">
                                     <label className="flex items-start gap-3 cursor-pointer">
                     <input
                       type="checkbox"
                       checked={includeDiagnostics}
                       onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                       className="mt-1 w-4 h-4 text-orange-500 bg-slate-800 border-slate-600 rounded focus:ring-orange-400/60"
                     />
                     <div className="flex-1">
                       <span className="text-sm text-slate-300">Attach diagnostics</span>
                       <div className="relative group">
                         <button
                           type="button"
                           className="flex items-center gap-1 mt-1 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                           onClick={(e) => e.preventDefault()}
                         >
                           <span>What&apos;s this?</span>
                           <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                           </svg>
                         </button>
                         
                         {/* Tooltip */}
                         <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                           <div className="text-xs text-slate-300 leading-relaxed">
                             <p className="font-medium mb-1">Diagnostics include:</p>
                             <ul className="space-y-1 text-slate-400">
                               <li>• Browser & device info</li>
                               <li>• Session ID for tracking</li>
                               <li>• Current page path</li>
                               <li>• Timestamp</li>
                             </ul>
                             <p className="mt-2 text-slate-500">
                               This helps us debug issues faster and improve the tool.
                             </p>
                           </div>
                           {/* Arrow */}
                           <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                         </div>
                       </div>
                     </div>
                   </label>

                                     {/* Privacy Mode Selection */}
                   <div>
                     <label className="block text-sm font-medium text-slate-300 mb-3">Privacy</label>
                     <div className="space-y-3">
                       <label className="flex items-center gap-3 cursor-pointer">
                         <input
                           type="radio"
                           name="privacy"
                           value="anonymous"
                           checked={privacyMode === 'anonymous'}
                           onChange={(e) => setPrivacyMode(e.target.value as 'anonymous' | 'identified')}
                           className="w-4 h-4 text-orange-500 bg-slate-800 border-slate-600 focus:ring-orange-400/60"
                         />
                         <div>
                           <span className="text-sm text-slate-300">Send anonymously</span>
                           <p className="text-xs text-slate-500">Send feedback anonymously</p>
                         </div>
                       </label>
                       
                       <label className="flex items-center gap-3 cursor-pointer">
                         <input
                           type="radio"
                           name="privacy"
                           value="identified"
                           checked={privacyMode === 'identified'}
                           onChange={(e) => setPrivacyMode(e.target.value as 'anonymous' | 'identified')}
                           className="w-4 h-4 text-orange-500 bg-slate-800 border-slate-600 focus:ring-orange-400/60"
                         />
                         <div>
                           <span className="text-sm text-slate-300">Share with name</span>
                           <p className="text-xs text-slate-500">Share with your name and contact</p>
                         </div>
                       </label>
                     </div>
                   </div>

                   {/* Identified User Fields */}
                   {privacyMode === 'identified' && (
                     <div className="space-y-3 pl-7 border-l-2 border-slate-700">
                       <div>
                         <label htmlFor="display-name" className="block text-sm font-medium text-slate-300 mb-2">
                           Display Name
                         </label>
                         <input
                           id="display-name"
                           type="text"
                           value={displayName}
                           onChange={(e) => setDisplayName(e.target.value)}
                           placeholder="Your name or username"
                           className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/60 focus:border-transparent"
                         />
                       </div>
                       
                       <div>
                         <label htmlFor="contact" className="block text-sm font-medium text-slate-300 mb-2">
                           Contact (Optional)
                         </label>
                         <input
                           id="contact"
                           type="text"
                           value={contact}
                           onChange={(e) => setContact(e.target.value)}
                           placeholder="Email or @handle"
                           className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/60 focus:border-transparent"
                         />
                       </div>
                       
                       
                     </div>
                   )}
                </div>

                                 {/* Privacy Notice */}
                 <div className="text-xs text-slate-500 text-center py-2 border-t border-slate-700/60">
                   Your feedback helps us create better movie insights. No ads, just better recommendations! 🎬
                 </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-700/60 bg-slate-800/50">
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isEmpty || isOverLimit || isSubmitting}
                    className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Gönderiliyor…
                      </>
                    ) : (
                      'Send Feedback'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Feedback sent! Thank you.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
