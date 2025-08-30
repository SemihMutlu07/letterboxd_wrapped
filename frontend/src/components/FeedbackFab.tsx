"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { getSupabase } from '@/lib/supabaseClient';
import { initPostHog, captureEvent } from '@/lib/posthog';

type Category = 'bug' | 'idea' | 'general';
type Privacy = 'anonymous' | 'identified';

interface FeedbackFabProps {
  sessionId: string; // TEXT kolonu ile uyumlu
}

const QUICK_SUGGESTIONS: Record<Category, string[]> = {
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

function safeGetSessionStorage(key: string) {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function FeedbackFab({ sessionId }: FeedbackFabProps) {
  const reduce = useReducedMotion();

  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<Category>('general');
  const [message, setMessage] = useState('');
  const [privacyMode, setPrivacyMode] = useState<Privacy>('anonymous');
  const [contact, setContact] = useState('');

  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_LENGTH = 500;
  const isOverLimit = message.length > MAX_LENGTH;
  const isEmpty = message.trim().length === 0;

  // Derived username (Letterboxd) – tek kaynaktan, otomatik
  const lbUsername = safeGetSessionStorage('lb_username') || '';

  // Body scroll lock + autofocus
  useEffect(() => {
    if (!isOpen) return;
    textareaRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Kısayollar
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && handleClose();
    const onCmdEnter = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    document.addEventListener('keydown', onEsc);
    document.addEventListener('keydown', onCmdEnter);
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.removeEventListener('keydown', onCmdEnter);
    };
  }, [isOpen, isEmpty, isOverLimit, isSubmitting, message, category, privacyMode, contact]);

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    initPostHog();
    if (safeGetSessionStorage('consent_decision') === 'accept') {
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
    setContact('');
    setIsSubmitting(false);
    setShowSuccess(false);
  }, [isSubmitting]);

  const addSuggestion = (suggestion: string) => {
    const sep = message && !message.endsWith(' ') ? ' ' : '';
    const next = (message + sep + suggestion).slice(0, MAX_LENGTH);
    setMessage(next);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleSubmit = useCallback(async () => {
    if (isEmpty || isOverLimit || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Payload – display_name zorunlu değil; identified seçiliyse lbUsername kullanıyoruz, yoksa null
      const basePayload: any = {
        session_id: sessionId,
        message: message.trim(),
        category, // 'bug' | 'idea' | 'general'
      };

      if (privacyMode === 'identified') {
        basePayload.display_name = lbUsername || null;
        basePayload.contact = contact || null;
        basePayload.source_username = lbUsername || null;
      }

      if (includeDiagnostics) {
        basePayload.user_agent = navigator.userAgent;
        basePayload.path = window.location.pathname;
        basePayload.timestamp = new Date().toISOString();
        basePayload.viewport = `${window.innerWidth}x${window.innerHeight}`;
      }

      const supabase = getSupabase();
      const { error, data } = await supabase.from('feedback').insert(basePayload).select();

      if (error) {
        // Bilinen supabase hata kodları için kullanıcı dostu mesaj
        const map: Record<string, string> = {
          '23505': 'You have already submitted feedback with this session. Please wait before submitting again.',
          '23502': 'Missing required information. Please fill in all required fields.',
          '23514': 'Invalid data provided. Please check your input and try again.',
          '42P01': 'Database configuration error. Please contact support.',
          '42501': 'Permission denied. Please contact support.'
        };
        throw new Error(map[error.code as string] || `Database error: ${error.message}`);
      }

      setShowSuccess(true);

      if (safeGetSessionStorage('consent_decision') === 'accept') {
        try {
          captureEvent('feedback_submitted', {
            category,
            privacy_mode: privacyMode,
            has_contact: Boolean(contact)
          });
        } catch { /* analytics düşse bile form başarılı */ }
      }

      if (!reduce) {
        try {
          confetti({ particleCount: 30, spread: 70, origin: { y: 0.6 } });
        } catch { /* görsel efekt sorunları yoksayılır */ }
      }

      setTimeout(() => handleClose(), 1000);
    } catch (err: any) {
      alert(`Feedback submission failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [isEmpty, isOverLimit, isSubmitting, sessionId, message, category, privacyMode, contact, reduce, handleClose, lbUsername]);

  return (
    <>
      {/* FAB */}
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

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              aria-hidden="true"
            />
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
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Category</label>
                  <div className="flex gap-2">
                    {([
                      { key: 'bug', label: '🐞 Bug', color: 'from-red-500 to-red-600' },
                      { key: 'idea', label: '💡 Idea', color: 'from-blue-500 to-blue-600' },
                      { key: 'general', label: '✨ General', color: 'from-purple-500 to-purple-600' }
                    ] as const).map(({ key, label, color }) => (
                      <button
                        key={key}
                        onClick={() => setCategory(key)}
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

                {/* Message */}
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
                      placeholder="Tell us what you think... (Enter: send, Shift+Enter: newline)"
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
                    {QUICK_SUGGESTIONS[category].map((s, i) => (
                      <button
                        key={i}
                        onClick={() => addSuggestion(s)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDiagnostics}
                      onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                      className="mt-1 w-4 h-4 text-orange-500 bg-slate-800 border-slate-600 rounded focus:ring-orange-400/60"
                    />
                    <div className="flex-1">
                      <span className="text-sm text-slate-300">Attach diagnostics</span>
                      <p className="text-xs text-slate-500 mt-1">
                        Browser info, page path, timestamp, viewport (debug için faydalı).
                      </p>
                    </div>
                  </label>

                  {/* Privacy */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Privacy</label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="privacy"
                          value="anonymous"
                          checked={privacyMode === 'anonymous'}
                          onChange={(e) => setPrivacyMode(e.target.value as Privacy)}
                          className="w-4 h-4 text-orange-500 bg-slate-800 border-slate-600 focus:ring-orange-400/60"
                        />
                        <div>
                          <span className="text-sm text-slate-300">Send anonymously</span>
                          <p className="text-xs text-slate-500">No name, no contact.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="privacy"
                          value="identified"
                          checked={privacyMode === 'identified'}
                          onChange={(e) => setPrivacyMode(e.target.value as Privacy)}
                          className="w-4 h-4 text-orange-500 bg-slate-800 border-slate-600 focus:ring-orange-400/60"
                        />
                        <div className="flex-1">
                          <span className="text-sm text-slate-300">Share with name</span>
                          <p className="text-xs text-slate-500">
                            Uses your parsed Letterboxd username {lbUsername ? `(“${lbUsername}”)` : '(if available)'}.
                          </p>

                          {/* Identified details */}
                          {privacyMode === 'identified' && (
                            <div className="mt-3 space-y-3 pl-7 border-l-2 border-slate-700">
                              {/* Display Name gizli – otomatik dolu */}
                              {lbUsername ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">Name</span>
                                  <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm">
                                    {lbUsername}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">
                                  Username not detected from file name; we’ll still accept your feedback.
                                </p>
                              )}

                              {/* Contact (optional) */}
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
                      </label>
                    </div>
                  </div>
                </div>

                {/* Privacy notice */}
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
