'use client';

import JSZip from 'jszip';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Film, Star, Clock, Globe, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeFiles, testBackend } from '@/lib/api';
import { startAnalysis, finishAnalysis, buildSummaryForPersistence } from '@/lib/supabase/analysis_runs';
import { upsertUserSession } from '@/lib/supabase/sessions';
import { ensureSessionId, getUsername, setUsername, getConsent } from '@/lib/session-id';
import { trackEvent, trackConsentedEvent, trackFilmStats } from '@/lib/analytics';
import { parseLetterboxdUsername } from '@/lib/filename';
import { normalizeError, type NormalizedError } from '@/lib/errors';
import ErrorBanner from '@/components/ErrorBanner';

const APP_VERSION = '1.0.0';

export default function LetterboxdLanding() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<NormalizedError | null>(null);
  const [, setDetectedUsername] = useState<string | null>(null);

  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);

  // webkitdirectory is non-standard — set it imperatively to avoid TS errors
  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
  }, []);

  const openFilePicker = useCallback(() => {
    document.getElementById('file-input')?.click();
  }, []);

  const openFolderPicker = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  // Track initial session on page load
  useEffect(() => {
    const trackInitialSession = async () => {
      try {
        // Get or create session ID
        let sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) {
          sessionId = crypto?.randomUUID?.() ?? `session_${Date.now()}`;
          sessionStorage.setItem('session_id', sessionId);
        }

        // Get device info
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const os = /windows/i.test(ua) ? "Windows" :
                  /mac os x|macintosh/i.test(ua) ? "macOS" : 
                  /iphone|ios|ipad/i.test(ua) ? "iOS" :
                  /android/i.test(ua) ? "Android" :
                  /linux/i.test(ua) ? "Linux" : "Unknown";
        
        const device_type = /iphone|ipod|android.*mobile/i.test(ua) ? "mobile" :
                           /ipad|tablet|android(?!.*mobile)/i.test(ua) ? "tablet" : "desktop";

        // Save initial session (without username yet) - TEMPORARILY DISABLED due to RLS
        // await upsertUserSession({
        //   session_id: sessionId,
        //   username: 'anonymous', // Will be updated when username is detected
        //   consent: 'decline', // Default until consent is given
        //   film_count: null,
        //   favorite_genre: null,
        // });

      } catch (error) {
      }
    };

    trackInitialSession();
  }, []);





  // Test backend connectivity on component mount
  useEffect(() => {
    const testBackendConnectivity = async () => {
            try {
        await testBackend();
        trackEvent('backend_health_check_ok');
      } catch {
        // Silent error handling
        trackEvent('backend_health_check_failed');
      }
    };
    testBackendConnectivity();
  }, []);

  // Poll progress endpoint during upload
  // Polling removed - analysis is now synchronous

  // Package arbitrary selection (zip, csvs, or folder) into a single .zip for backend compatibility
  const zipFiles = useCallback(async (files: FileList | File[]): Promise<File> => {
    const zip = new JSZip();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath && (f as File & { webkitRelativePath?: string }).webkitRelativePath!.length > 0 ? (f as File & { webkitRelativePath?: string }).webkitRelativePath! : f.name;
      zip.file(rel, f);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    return new File([content], 'letterboxd-export.zip', { type: 'application/zip' });
  }, []);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      setError({
        title: 'No files selected',
        message: 'Please choose your Letterboxd export files.',
        reason: 'no_files_selected',
      });
      trackEvent('upload_failed', { reason: 'no_files_selected', step: 'validation' });
      return;
    }

    // Detect folder upload: webkitRelativePath is only set by webkitdirectory inputs
    const isFolderUpload = Array.from(files).some(
      (f) => !!(f as File & { webkitRelativePath?: string }).webkitRelativePath
    );

    // Validate file types and sizes
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = ['.csv', '.zip', '.utc'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Folder uploads may contain system files (.DS_Store, etc.) — skip non-CSV silently
      if (isFolderUpload && !/\.csv$/i.test(file.name)) continue;

      // Multi-file selection (not folder): skip non-CSV/ZIP/UTC silently
      if (!isFolderUpload && files.length > 1 && !allowedTypes.some(ext => file.name.toLowerCase().endsWith(ext))) continue;

      // Check file size
      if (file.size > maxFileSize) {
        const sizeMb = (file.size / 1024 / 1024).toFixed(1);
        setError({
          title: 'File too large',
          message: `"${file.name}" is ${sizeMb} MB. Maximum size is 50 MB.`,
          action: 'Try exporting a smaller date range or compressing the file.',
          reason: 'file_too_large',
        });
        trackEvent('upload_failed', { reason: 'file_too_large', step: 'validation' });
        return;
      }

      // Check file type
      const hasValidExtension = allowedTypes.some(ext =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (!hasValidExtension) {
        setError({
          title: 'Unsupported file',
          message: `"${file.name}" is not a supported format. Please upload .csv, .zip, or .utc files.`,
          reason: 'invalid_file_type',
        });
        trackEvent('upload_failed', { reason: 'invalid_extension', step: 'validation' });
        return;
      }
    }

    // Extract username from uploaded names/paths using local parsing.
    let detectedUsername: string | null = null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File & { webkitRelativePath?: string };
      const relativePath = file.webkitRelativePath || '';
      const pathParts = relativePath ? relativePath.split('/').filter(Boolean) : [];

      const candidates = [
        file.name,
        relativePath,
        pathParts[0] || '',
      ];

      for (const candidate of candidates) {
        const parsed = parseLetterboxdUsername(candidate);
        if (parsed) {
          detectedUsername = parsed;
          break;
        }
      }

      if (detectedUsername) break;
    }
    
    if (detectedUsername) {
      setDetectedUsername(detectedUsername);
      setUsername(detectedUsername);
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[upload] persisted username', { username: detectedUsername });
      }
      
      // Update session with detected username
      try {
        const sessionId = ensureSessionId();
        await upsertUserSession({
          session_id: sessionId,
          username: detectedUsername,
          consent: getConsent() || 'decline',
          film_count: null,
          favorite_genre: null,
        });
      } catch (error) {
      }
    }

    setIsUploading(true);
    trackEvent('upload_started', { fileCount: files.length });
    setError(null);

    let uploadFiles: File[] = [];
    const single = files.length === 1 ? files[0] : null;
    const isZip = single && /\.zip$/i.test(single.name);

    if (isZip && single) {
      // Single ZIP — send directly, no re-packing needed.
      uploadFiles = [single];
    } else if (isFolderUpload) {
      // Folder selected via webkitdirectory: filter to CSV files only (skips system
      // files) and ZIP with relative paths so the backend receives the full directory
      // structure. Without this, files like likes/reviews.csv and root reviews.csv
      // would collide when saved flat and the wrong content would be analysed.
      const csvFiles = Array.from(files).filter((f) => /\.csv$/i.test(f.name));
      if (csvFiles.length === 0) {
        setError({
          title: 'No CSV files found',
          message: 'The selected folder contains no Letterboxd CSV files.',
          action: 'Make sure you selected the extracted Letterboxd export folder.',
          reason: 'no_csv_files',
        });
        setIsUploading(false);
        trackEvent('upload_failed', { reason: 'no_csv_in_folder', step: 'preparation' });
        return;
      }
      try {
        const payloadZip = await zipFiles(csvFiles);
        uploadFiles = [payloadZip];
      } catch {
        setError({
          title: 'Failed to prepare folder',
          message: 'Could not package the selected folder for upload.',
          action: 'Please try again or upload the original .zip file instead.',
          reason: 'unknown_error',
        });
        setIsUploading(false);
        trackEvent('upload_failed', { reason: 'zip_pack_failed', step: 'preparation' });
        return;
      }
    } else if (files.length === 1) {
      uploadFiles = [files[0]];
    } else if (Array.from(files).every((f) => /\.csv$/i.test(f.name))) {
      uploadFiles = Array.from(files);
    } else {
      try {
        const payloadZip = await zipFiles(files);
        uploadFiles = [payloadZip];
      } catch {
        setError({
          title: 'Failed to prepare files',
          message: 'Could not package the selected files for upload.',
          action: 'Please try again or upload as a single ZIP.',
          reason: 'unknown_error',
        });
        setIsUploading(false);
        trackEvent('upload_failed', { reason: 'zip_pack_failed', step: 'preparation' });
        return;
      }
    }

    const formData = new FormData();
    uploadFiles.forEach((file) => {
      formData.append('files', file);
    });

    const sessionId = ensureSessionId();
    const username = getUsername();
    let analysisRun: { id: string } | null = null;
    // Hoisted so duration_ms is available in both success and failure paths.
    let startedAt = 0;

    try {
      // Start analysis tracking
      if (username) {
        try {
          const runId = crypto?.randomUUID?.();
          analysisRun = await startAnalysis({
            id: runId,
            session_id: sessionId,
            username: username,
          });
        } catch (analyticsError) {
        }
      }

      startedAt = performance.now();
      trackEvent('analysis_started', { hasZip: !!isZip, fileCount: files.length });

      const result = await analyzeFiles(formData);
      const durationMs = performance.now() - startedAt;

      if (detectedUsername) {
        setUsername(detectedUsername);
      }

      localStorage.setItem('letterboxdStats', JSON.stringify(result.stats));

      // High-level, consented stats for PostHog
      trackConsentedEvent('analyze_completed', {
        total_films: result.stats.total_films,
        duration_ms: Math.round(durationMs),
        ok: true,
      });
      trackFilmStats({
        total_films: result.stats.total_films,
        total_countries: result.stats.total_countries,
        average_rating: result.stats.average_rating,
      });

      // Finish analysis tracking
      if (analysisRun && detectedUsername) {
        try {
          await finishAnalysis({
            id: analysisRun.id,
            ok: true,
            summary: buildSummaryForPersistence(result.stats as Record<string, unknown>),
          });

          // Update user session with film count and genre
          await upsertUserSession({
            session_id: sessionId,
            username: detectedUsername,
            consent: sessionStorage.getItem('consent_decision') === 'accept' ? 'accept' : 'decline',
            film_count: result.stats.total_films || null,
            favorite_genre: result.stats.favorite_genre?.name || null,
          });
        } catch (analyticsError) {
          if (process.env.NODE_ENV === 'development') {
          }
        }
      }
      
      // Keep loading screen visible until results page mounts
      
      // Small delay to ensure localStorage is written
      setTimeout(() => {
        window.location.href = '/results';
      }, 100);
    } catch (err) {
      const normalized = normalizeError(err);

      // Track failed analysis
      if (analysisRun && detectedUsername) {
        try {
          await finishAnalysis({
            id: analysisRun.id,
            ok: false,
            error_message: normalized.message,
          });
        } catch (analyticsError) {
          if (process.env.NODE_ENV === 'development') {
          }
        }
      }

      // Schema mirrors the success payload: { ok, duration_ms, total_films }
      trackEvent('analyze_completed', {
        ok: false,
        reason: normalized.reason,
        duration_ms: startedAt > 0 ? Math.round(performance.now() - startedAt) : 0,
        total_films: null,
      });

      setError(normalized);
      setIsUploading(false);
    }
  }, [zipFiles]);


  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  }, [handleFiles]);



  if (isUploading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xl text-center rounded-3xl border border-slate-700/70 bg-slate-800/55 p-8 md:p-10 backdrop-blur-sm">
          <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-orange-500/15 border border-orange-400/35 flex items-center justify-center">
            <Film className="h-7 w-7 text-orange-300 animate-pulse" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Analyzing Your Films</h1>
          <p className="text-slate-300 mb-7">Preparing files, running analysis, and building your results.</p>

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

          <p className="text-sm text-slate-400">Large ZIP files can take a little longer. We&apos;ll redirect automatically.</p>
          <p className="mt-3 text-xs text-slate-500 text-center">Your raw files are never stored. With consent, only anonymous viewing stats are kept to improve the product.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-900 text-white">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-purple-600/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 h-80 w-80 sm:h-[28rem] sm:w-[28rem] rounded-full bg-orange-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[720px] px-4 py-8 sm:py-12">
        <div className="space-y-8">
          {/* Hero */}
          <header className="text-center">
            <h1 className="font-black tracking-tight leading-tight text-[clamp(28px,6vw,44px)]">
              <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">Movies Wrapped</span>
            </h1>
            <p className="mx-auto mt-2 text-slate-300 text-base leading-relaxed">
              Your Letterboxd year, re-edited.
            </p>
            <p className="mx-auto mt-3 text-slate-500 text-xs sm:text-sm">
              For the smoothest experience, use a desktop browser.
              The Letterboxd mobile app may block ZIP downloads.
            </p>
            <p className="mx-auto mt-2 text-slate-600 text-[11px] sm:text-xs">
              Version {APP_VERSION}
            </p>
          </header>

          {/* Upload area */}
          <section aria-label="Upload your Letterboxd data">
            <div
              className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 md:p-8 transition-all duration-300 hover:border-orange-400/30 hover:shadow-[0_0_40px_-12px_rgba(251,146,60,0.12)] max-w-3xl mx-auto cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={openFilePicker}
            >
              <input
                id="file-input"
                type="file"
                multiple
                accept=".zip,.csv,.CSV"
                onChange={handleFileInput}
                className="hidden"
              />
              {/* Folder picker — webkitdirectory set via ref in useEffect */}
              <input
                ref={folderInputRef}
                type="file"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />

              {/* Drop hint */}
              <div className="flex flex-col items-center py-4">
                <div className="mb-4 h-12 w-12 rounded-2xl bg-orange-500/10 border border-orange-400/25 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-orange-300" />
                </div>
                <p className="text-xl sm:text-2xl font-bold tracking-tight">Begin Your Cinema Reveal</p>
                <p className="mt-1.5 text-sm text-slate-400">Drop a file here, or click to pick a ZIP</p>
                <button
                  onClick={(e) => { e.stopPropagation(); openFolderPicker(); }}
                  className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
                >
                  or select an extracted folder
                </button>
              </div>
            </div>
          </section>

          {error && (
            <ErrorBanner
              error={error}
              onDismiss={() => setError(null)}
              onRetry={() => setError(null)}
            />
          )}

          {/* How to Export — collapsible */}
          <section className="mx-auto w-full max-w-2xl text-left">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 px-4 sm:px-6 py-3 sm:py-4">
              <button
                onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
                className="w-full flex justify-between items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 hover:opacity-80 transition-opacity"
              >
                <span className="font-semibold text-base sm:text-lg text-gray-200">How to Export Your Letterboxd Data</span>
                <motion.div
                  animate={{ rotate: isInstructionsOpen ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </motion.div>
              </button>
              <AnimatePresence>
                {isInstructionsOpen && (
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

          {/* Inside Your Wrapped */}
          <section>
            <h2 className="text-center text-lg font-semibold text-slate-300 mb-4">Inside Your Wrapped</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 text-center transition hover:bg-slate-800/60">
                <Film className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                <div className="font-medium text-sm">Film Analysis</div>
                <div className="text-slate-400 text-xs mt-1">Trends across genres and decades.</div>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 text-center transition hover:bg-slate-800/60">
                <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <div className="font-medium text-sm">Rating Patterns</div>
                <div className="text-slate-400 text-xs mt-1">How you judge the films you watch.</div>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 text-center transition hover:bg-slate-800/60">
                <Clock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <div className="font-medium text-sm">Time Statistics</div>
                <div className="text-slate-400 text-xs mt-1">Your viewing rhythm across the years.</div>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 text-center transition hover:bg-slate-800/60">
                <Globe className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <div className="font-medium text-sm">Global Cinema</div>
                <div className="text-slate-400 text-xs mt-1">Countries and languages that shape your taste.</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
