'use client';

import JSZip from 'jszip';
import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Film, Star, Clock, Globe, HelpCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeFiles, testBackend } from '@/lib/api';
import { startAnalysis, finishAnalysis } from '@/lib/supabase/analysis_runs';
import { upsertUserSession } from '@/lib/supabase/sessions';
import { ensureSessionId, getUsername, setUsername, getConsent } from '@/lib/session-id';
import { trackEvent, trackConsentedEvent, trackFilmStats } from '@/lib/analytics';
import { parseLetterboxdUsername } from '@/lib/filename';



export default function LetterboxdLanding() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setDetectedUsername] = useState<string | null>(null);

  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

  const openFilePicker = useCallback(() => {
    (document.getElementById('file-input-desktop') ?? document.getElementById('file-input-mobile'))?.click();
  }, []);

  const openFolderPicker = useCallback(() => {
    const dirInput = document.getElementById('dir-input') as HTMLInputElement | null;
    if (dirInput && 'webkitdirectory' in dirInput) {
      dirInput.click();
      return;
    }
    openFilePicker();
  }, [openFilePicker]);

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
  const zipFiles = useCallback(async (files: FileList): Promise<File> => {
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
      setError('No files selected. Please choose your Letterboxd export files.');
      trackEvent('upload_error', { reason: 'no_files_selected' });
      return;
    }

    // Validate file types and sizes
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = ['.csv', '.zip', '.CSV', '.ZIP'];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size
      if (file.size > maxFileSize) {
        const sizeMb = (file.size / 1024 / 1024).toFixed(1);
        setError(`File "${file.name}" is too large (${sizeMb}MB). Maximum size is 50MB.`);
        trackEvent('upload_error', { reason: 'file_too_large', fileName: file.name, sizeMb });
        return;
      }
      
      // Check file type
      const hasValidExtension = allowedTypes.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      
      if (!hasValidExtension) {
        setError(`File "${file.name}" is not a supported format. Please upload .csv or .zip files only.`);
        trackEvent('upload_error', { reason: 'invalid_extension', fileName: file.name });
        return;
      }
    }

    // Extract username from CSV files using local parsing (faster than a network roundtrip)
    let detectedUsername: string | null = null;
    for (let i = 0; i < files.length; i++) {
      const parsed = parseLetterboxdUsername(files[i].name);
      if (parsed) {
        detectedUsername = parsed;
        break;
      }
    }
    
    if (detectedUsername) {
      setDetectedUsername(detectedUsername);
      setUsername(detectedUsername);
      
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
      // Hotfix: upload ZIP directly to avoid expensive client-side unzip+rezip.
      uploadFiles = [single];
    } else if (files.length === 1) {
      uploadFiles = [files[0]];
    } else if (Array.from(files).every((f) => /\.csv$/i.test(f.name))) {
      // Multi-CSV folders can be sent as-is for better responsiveness.
      uploadFiles = Array.from(files);
    } else {
      try {
        const payloadZip = await zipFiles(files);
        uploadFiles = [payloadZip];
      } catch {
        setError('Failed to prepare files for upload. Please try again.');
        setIsUploading(false);
        trackEvent('upload_error', { reason: 'zip_pack_failed' });
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

      const startedAt = performance.now();
      trackEvent('analysis_started', { hasZip: !!isZip, fileCount: files.length });

      const result = await analyzeFiles(formData);
      const durationMs = performance.now() - startedAt;

      localStorage.setItem('letterboxdStats', JSON.stringify(result.stats));

      // High-level, consented stats for PostHog
      trackConsentedEvent('analysis_completed', {
        total_films: result.stats.total_films,
        average_rating: result.stats.average_rating,
        days_watched: result.stats.days_watched,
        duration_ms: Math.round(durationMs),
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
            summary: {
              total_films: result.stats.total_films,
              analysis_date: result.stats.analysis_date,
            }
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
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      
      // Track failed analysis
      if (analysisRun && detectedUsername) {
        try {
          await finishAnalysis({
            id: analysisRun.id,
            ok: false,
            error_message: errorMessage,
          });
        } catch (analyticsError) {
          if (process.env.NODE_ENV === 'development') {
          }
        }
      }
      
      // Track failed analysis (PostHog)
      trackEvent('analysis_failed', { message: errorMessage });

      // Enhanced error messages for Mac users
      if (/No valid Letterboxd CSV files/i.test(errorMessage)) {
        setError(
          'No valid Letterboxd CSV files found. This often happens on Mac when Safari auto-extracts the ZIP. ' +
          'Try one of these solutions:\n\n' +
          '1. Use the "Or choose exported folder" option below\n' +
          '2. Use Chrome/Edge/Firefox instead of Safari\n' +
          '3. Re-upload the original ZIP file'
        );
      } else if (/Network error/i.test(errorMessage)) {
        setError(
          'Network connection error. Please check your internet connection and try again.'
        );
      } else if (/timeout/i.test(errorMessage)) {
        setError(
          'Request timed out. The server may be busy. Please try again in a few moments.'
        );
      } else if (/File too large/i.test(errorMessage)) {
        setError(
          'The file is too large to process. Please try with a smaller export or contact support.'
        );
      } else {
        setError(`Analysis failed: ${errorMessage}`);
      }
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
          {/* Hero header */}
          <header className="text-center">
            <h1 className="font-black tracking-tight leading-tight text-[clamp(28px,6vw,44px)]">
              <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">Movies Wrapped</span>
            </h1>
            <p className="mx-auto mt-1 text-slate-300 text-base leading-relaxed">
              Upload your Letterboxd ZIP, meaning your exported data from Letterboxd.
            </p>
            {/* Desktop disclaimer */}
            <div className="mt-4 mx-auto max-w-xl rounded-lg border border-white/30 bg-slate-800/40 px-3 py-2 text-slate-400 text-xs sm:text-sm">
              For the smoothest experience, I recommend using a desktop or laptop browser. The Letterboxd mobile app can sometimes block file downloads/exports :D, which may prevent uploading your data here.
            </div>
          </header>

          {/* Dropzone */}
          <section aria-label="Upload your Letterboxd data">
            {/* Desktop dropzone */}
            <div
              className="hidden sm:flex rounded-3xl border-2 border-dashed border-slate-600/60 bg-slate-800/40 p-6 md:p-8 min-h-[220px] sm:min-h-[260px] items-center justify-center text-center cursor-pointer transition-colors shadow-none hover:shadow-lg hover:border-orange-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 max-w-3xl mx-auto"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={openFolderPicker}
              role="button"
              tabIndex={0}
            >
              <input
                id="file-input-desktop"
                type="file"
                multiple
                accept=".zip,.csv,.CSV"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="flex flex-col items-center">
                <div className="mb-4 h-14 w-14 rounded-2xl bg-slate-700/60 ring-1 ring-white/10 flex items-center justify-center transition-colors">
                  <Upload className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-lg sm:text-xl font-semibold">Select a folder, or drag & drop a folder/zip.</p>
                <p className="mt-1 text-md text-slate-400">Supports exported folder, .zip, and .csv.</p>

              </div>
            </div>

            {/* Mobile upload CTA */}
            <div className="sm:hidden">
              <button
                onClick={openFolderPicker}
                className="w-full max-w-md mx-auto min-h-[44px] rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 flex items-center justify-center gap-3"
              >
                <Upload className="w-5 h-5" />
                Select a folder
              </button>
              <input
                id="file-input-mobile"
                type="file"
                multiple
                accept=".zip,.csv,.CSV"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            {/* Fallback file picker for direct ZIP/CSV selection */}
            <div className="mt-3 flex justify-center">
              <button
                onClick={openFilePicker}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50"
              >
                Or choose ZIP/CSV files
              </button>
            </div>
            <input
              id="dir-input"
              type="file"
              // @ts-expect-error non-standard but supported in Chromium/WebKit
              webkitdirectory=""
              directory=""
              multiple
              accept=".zip,.csv,.CSV"
              onChange={handleFileInput}
              className="hidden"
            />
          </section>

          {error && (
            <div className="mx-auto max-w-xl rounded-xl border border-red-700/70 bg-red-900/60 p-4">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* How to Export Section */}
          <section className="mx-auto w-full max-w-2xl text-left">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 px-4 sm:px-6 py-3 sm:py-4">
              <button
                onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
                className="w-full flex justify-between items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50"
              >
                <div className="flex items-center">
                  <HelpCircle className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="font-semibold text-base sm:text-lg text-gray-200">How to Export Your Letterboxd Data</span>
                </div>
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
                    <div className="mt-3 sm:mt-4 p-4 sm:p-5 rounded-xl border border-slate-700/60 bg-slate-800/40 text-slate-300 space-y-3 text-sm sm:text-base">
                      <p>Follow these steps on the Letterboxd App / Website to get your data:</p>
                      <ol className="list-decimal list-inside space-y-2 pl-1">
                        <li>Go to your <strong className="text-orange-400">Profile</strong> and click on <strong className="text-orange-400">Settings</strong>.</li>
                        <li>Select the <strong className="text-orange-400">Data</strong> tab from the settings menu (it&apos;s on the far right).</li>
                        <li>Click the <strong className="text-orange-400">Export Your Data</strong> button.</li>
                        <li>Your data will be prepared and a <strong className="text-orange-400">.zip file</strong> will download.</li>
                        <li>Once downloaded, just drag and drop the file here!</li>
                      </ol>
                      
                      <div className="mt-4 p-3 rounded-lg bg-orange-900/30 border border-orange-700/50">
                        <p className="text-sm font-medium text-orange-300 mb-2">📱 Mac Users:</p>
                        <ul className="text-xs text-orange-200 space-y-1">
                          <li>• Safari may auto-extract the ZIP into a folder</li>
                          <li>• If that happens, use &quot;Or choose exported folder&quot; option above</li>
                          <li>• Or use Chrome/Edge/Firefox for better ZIP handling</li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Features Preview */}
          <section>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 text-center transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50">
                <Film className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                <div className="font-medium text-sm">Film Analysis</div>
                <div className="text-slate-400 text-xs mt-1">Trends & genres</div>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 text-center transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50">
                <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <div className="font-medium text-sm">Rating Insights</div>
                <div className="text-slate-400 text-xs mt-1">Averages & favorites</div>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 text-center transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50">
                <Clock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <div className="font-medium text-sm">Time Stats</div>
                <div className="text-slate-400 text-xs mt-1">Streaks & seasons</div>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 text-center transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50">
                <Globe className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <div className="font-medium text-sm">Global Cinema</div>
                <div className="text-slate-400 text-xs mt-1">Countries & languages</div>
              </div>
            </div>
          </section>
        </div>
      </div>

    </div>
  );
}
