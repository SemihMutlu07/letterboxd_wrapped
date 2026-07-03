'use client';

import JSZip from 'jszip';
import Link from 'next/link';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Film, Star, Clock, Globe, Upload, Users, Bug, X } from 'lucide-react';
import { analyzeFiles, parseLetterboxdUsername, scrapeProfile, testBackend, type ScrapeProgress } from '@/lib/api';
import { startAnalysis, finishAnalysis, buildSummaryForPersistence } from '@/lib/supabase/analysis_runs';
import { upsertUserSession } from '@/lib/supabase/sessions';
import { ensureSessionId, getUsername, setUsername, getConsent } from '@/lib/session-id';
import { resultPath } from '@/lib/routes';
import { trackEvent, trackConsentedEvent, trackFilmStats } from '@/lib/analytics';
import { normalizeError, type NormalizedError } from '@/lib/errors';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingScreen from '@/components/landing/LoadingScreen';
import UploadZone from '@/components/landing/UploadZone';
import ExportInstructions from '@/components/landing/ExportInstructions';

export default function LetterboxdLanding() {
  const [isUploading, setIsUploading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress | null>(null);
  // Guess-your-stat game (wait UX B). Ref so the in-flight scrape handler reads the
  // latest guess (it's submitted mid-scrape, after the handler's closure is fixed).
  const [guess, setGuessState] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{ guess: number; actual: number } | null>(null);
  const guessRef = useRef<number | null>(null);
  const setGuess = useCallback((n: number) => { guessRef.current = n; setGuessState(n); }, []);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [error, setError] = useState<NormalizedError | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [, setDetectedUsername] = useState<string | null>(null);
  const [debugResult, setDebugResult] = useState<object | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Track initial session on page load
  useEffect(() => {
    const trackInitialSession = async () => {
      try {
        let sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) {
          sessionId = crypto?.randomUUID?.() ?? `session_${Date.now()}`;
          sessionStorage.setItem('session_id', sessionId);
        }
      } catch {
        // silent
      }
    };
    trackInitialSession();
  }, []);

  // Test backend connectivity on component mount
  useEffect(() => {
    const testBackendConnectivity = async () => {
      try {
        await testBackend();
        setBackendOffline(false);
        trackEvent('app_opened');
      } catch {
        setBackendOffline(true);
        trackEvent('app_opened', { backend_offline: true });
      }
    };
    testBackendConnectivity();
  }, []);

  // ESC closes the upload modal + lock body scroll while it's open
  useEffect(() => {
    if (!showUploadModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowUploadModal(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showUploadModal]);

  const zipFiles = useCallback(async (files: FileList | File[]): Promise<File> => {
    const zip = new JSZip();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath?.length
        ? (f as File & { webkitRelativePath?: string }).webkitRelativePath!
        : f.name;
      zip.file(rel, f);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    return new File([content], 'letterboxd-export.zip', { type: 'application/zip' });
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) {
      setError({ title: 'No files selected', message: 'Please choose your Letterboxd export files.', reason: 'no_files_selected' });
      trackEvent('analyze_failed', { reason: 'no_files_selected', step: 'validation' });
      return;
    }

    const isFolderUpload = Array.from(files).some(
      (f) => !!(f as File & { webkitRelativePath?: string }).webkitRelativePath,
    );

    const maxFileSize = 50 * 1024 * 1024;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (isFolderUpload && !/\.csv$/i.test(file.name)) continue;
      if (file.size > maxFileSize) {
        const sizeMb = (file.size / 1024 / 1024).toFixed(1);
        setError({ title: 'File too large', message: `"${file.name}" is ${sizeMb} MB. Maximum size is 50 MB.`, action: 'Try exporting a smaller date range or compressing the file.', reason: 'file_too_large' });
        trackEvent('analyze_failed', { reason: 'file_too_large', step: 'validation' });
        return;
      }
      const hasValidExtension = ['.csv', '.zip'].some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!hasValidExtension) {
        setError({ title: 'Unsupported file', message: `"${file.name}" is not a supported format. Please upload .csv or .zip files only.`, reason: 'invalid_file_type' });
        trackEvent('analyze_failed', { reason: 'invalid_extension', step: 'validation' });
        return;
      }
    }

    // Show loading immediately so the user knows the drop registered.
    // Anything async (Supabase upsert, network calls) happens after this.
    setIsUploading(true);
    setError(null);
    trackEvent('analyze_started', { fileCount: files.length, method: 'upload' });

    // Detect username
    let detectedUsername: string | null = null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File & { webkitRelativePath?: string };
      const relativePath = file.webkitRelativePath || '';
      const pathParts = relativePath ? relativePath.split('/').filter(Boolean) : [];
      for (const candidate of [file.name, relativePath, pathParts[0] || '']) {
        if (!candidate) continue;
        const { username: parsed } = await parseLetterboxdUsername(candidate);
        if (parsed) { detectedUsername = parsed; break; }
      }
      if (detectedUsername) break;
    }

    if (detectedUsername) {
      setDetectedUsername(detectedUsername);
      setUsername(detectedUsername);
      // Fire-and-forget — Supabase analytics shouldn't block the upload UI.
      try {
        await upsertUserSession({ session_id: ensureSessionId(), username: detectedUsername, consent: getConsent() || 'decline', film_count: null, favorite_genre: null });
      } catch (err) {
        console.warn('[supabase] session upsert failed (non-blocking):', err);
      }
    }

    let uploadFiles: File[] = [];
    const single = files.length === 1 ? files[0] : null;
    const isZip = single && /\.zip$/i.test(single.name);

    if (isZip && single) {
      uploadFiles = [single];
    } else if (isFolderUpload) {
      const csvFiles = Array.from(files).filter((f) => /\.csv$/i.test(f.name));
      if (csvFiles.length === 0) {
        setError({ title: 'No CSV files found', message: 'The selected folder contains no Letterboxd CSV files.', action: 'Make sure you selected the extracted Letterboxd export folder.', reason: 'no_csv_files' });
        setIsUploading(false);
        trackEvent('analyze_failed', { reason: 'no_csv_in_folder', step: 'preparation' });
        return;
      }
      try {
        uploadFiles = [await zipFiles(csvFiles)];
      } catch (err) {
        console.error('[upload] folder zip packaging failed:', err);
        setError({ title: 'Failed to prepare folder', message: 'Could not package the selected folder for upload.', action: 'Please try again or upload the original .zip file instead.', reason: 'unknown_error' });
        setIsUploading(false);
        trackEvent('analyze_failed', { reason: 'zip_pack_failed', step: 'preparation' });
        return;
      }
    } else if (files.length === 1) {
      uploadFiles = [files[0]];
    } else if (Array.from(files).every((f) => /\.csv$/i.test(f.name))) {
      uploadFiles = Array.from(files);
    } else {
      try {
        uploadFiles = [await zipFiles(files)];
      } catch (err) {
        console.error('[upload] file zip packaging failed:', err);
        setError({ title: 'Failed to prepare files', message: 'Could not package the selected files for upload.', action: 'Please try again or upload as a single ZIP.', reason: 'unknown_error' });
        setIsUploading(false);
        trackEvent('analyze_failed', { reason: 'zip_pack_failed', step: 'preparation' });
        return;
      }
    }

    const formData = new FormData();
    uploadFiles.forEach((file) => formData.append('files', file));

    const sessionId = ensureSessionId();
    const username = getUsername();
    let analysisRun: { id: string } | null = null;
    let startedAt = 0;

    try {
      if (username) {
        try {
          const runId = crypto?.randomUUID?.();
          analysisRun = await startAnalysis({ id: runId, session_id: sessionId, username });
        } catch { /* analytics failure is non-fatal */ }
      }

      startedAt = performance.now();
      trackEvent('analyze_started', { hasZip: !!isZip, fileCount: files.length, method: 'upload' });

      const result = await analyzeFiles(formData);
      const durationMs = performance.now() - startedAt;

      if (detectedUsername) setUsername(detectedUsername);
      // Per-tab storage avoids the cross-tab race where a concurrent scrape's
      // result overwrites this tab's data on a shared localStorage key.
      sessionStorage.setItem('letterboxdStats', JSON.stringify(result.stats));

      trackConsentedEvent('analyze_succeeded', { total_films: result.stats.total_films, duration_ms: Math.round(durationMs) });
      trackFilmStats({ total_films: result.stats.total_films, total_countries: result.stats.total_countries, average_rating: result.stats.average_rating });

      if (analysisRun && detectedUsername) {
        try {
          await finishAnalysis({ id: analysisRun.id, ok: true, summary: buildSummaryForPersistence(result.stats as Record<string, unknown>) });
          await upsertUserSession({
            session_id: sessionId,
            username: detectedUsername,
            consent: sessionStorage.getItem('consent_decision') === 'accept' ? 'accept' : 'decline',
            film_count: result.stats.total_films || null,
            favorite_genre: result.stats.favorite_genre?.name || null,
          });
        } catch { /* analytics failure is non-fatal */ }
      }

      setTimeout(() => { window.location.href = resultPath(detectedUsername); }, 100);
    } catch (err) {
      console.error('[upload] analysis failed:', err);
      const normalized = normalizeError(err);
      if (analysisRun && detectedUsername) {
        try { await finishAnalysis({ id: analysisRun.id, ok: false, error_message: normalized.message }); } catch { /* silent */ }
      }
      trackEvent('analyze_failed', { reason: normalized.reason, duration_ms: startedAt > 0 ? Math.round(performance.now() - startedAt) : 0 });
      setError(normalized);
      setIsUploading(false);
    }
  }, [zipFiles]);

  const handleScrape = useCallback(async () => {
    let raw = usernameInput.trim();

    // Extract username if a full Letterboxd URL was pasted
    const urlMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?letterboxd\.com\/([a-zA-Z0-9_]+)/);
    if (urlMatch) {
      raw = urlMatch[1];
    }

    const username = raw.replace(/^@/, '').toLowerCase();
    if (!username) {
      setError({ title: 'No username', message: 'Please enter your Letterboxd username.', reason: 'no_username' });
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      setError({ title: 'Invalid username', message: 'Letterboxd usernames can only contain lowercase letters, numbers, and underscores. You can also paste your full Letterboxd profile URL.', reason: 'invalid_username' });
      return;
    }

    setIsScraping(true);
    setScrapeProgress(null);
    setGuessState(null);
    setReveal(null);
    guessRef.current = null;
    setError(null);
    trackEvent('analyze_started', { username, method: 'scrape' });

    const sessionId = ensureSessionId();
    let analysisRun: { id: string } | null = null;
    let startedAt = 0;
    try {
      try {
        const runId = crypto?.randomUUID?.();
        analysisRun = await startAnalysis({ id: runId, session_id: sessionId, username });
      } catch { /* analytics failure is non-fatal */ }

      startedAt = performance.now();
      // The desktop worker scrapes the full profile from a residential IP.
      const method = 'scrape' as const;
      const result = await scrapeProfile(username, undefined, setScrapeProgress);
      const returnedUsername = (result.stats as { scraped_username?: string })?.scraped_username;
      if (returnedUsername && returnedUsername !== username) {
        throw new Error(`Username mismatch: requested @${username}, got @${returnedUsername}`);
      }
      setUsername(username);
      sessionStorage.setItem('letterboxdStats', JSON.stringify(result.stats));

      trackConsentedEvent('analyze_succeeded', { total_films: result.stats.total_films, method });

      if (analysisRun) {
        try {
          await finishAnalysis({ id: analysisRun.id, ok: true, summary: buildSummaryForPersistence(result.stats as Record<string, unknown>) });
          await upsertUserSession({
            session_id: sessionId,
            username,
            consent: sessionStorage.getItem('consent_decision') === 'accept' ? 'accept' : 'decline',
            film_count: result.stats.total_films || null,
            favorite_genre: result.stats.favorite_genre?.name || null,
          });
        } catch { /* analytics failure is non-fatal */ }
      }

      // If the user played the guess game, show the reveal briefly before redirect.
      const actualFilms = result.stats.total_films ?? 0;
      const playedGuess = guessRef.current;
      if (playedGuess != null && actualFilms > 0) {
        setReveal({ guess: playedGuess, actual: actualFilms });
        setTimeout(() => { window.location.href = resultPath(username); }, 3500);
      } else {
        setTimeout(() => { window.location.href = resultPath(username); }, 100);
      }
    } catch (err) {
      console.error('[scrape] analysis failed:', err);
      const normalized = normalizeError(err);
      if (analysisRun) {
        try { await finishAnalysis({ id: analysisRun.id, ok: false, error_message: normalized.message }); } catch { /* silent */ }
      }
      trackEvent('analyze_failed', { reason: normalized.reason, duration_ms: startedAt > 0 ? Math.round(performance.now() - startedAt) : 0, method: 'scrape' });
      setError(normalized);
      setIsScraping(false);
    }
  }, [usernameInput]);

  const handleDebug = useCallback(async () => {
    let raw = usernameInput.trim();

    // Extract username if a full Letterboxd URL was pasted
    const urlMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?letterboxd\.com\/([a-zA-Z0-9_]+)/);
    if (urlMatch) {
      raw = urlMatch[1];
    }

    const username = raw.replace(/^@/, '').toLowerCase();
    if (!username || !/^[a-z0-9_]+$/.test(username)) {
      setDebugError('Please enter a valid Letterboxd username or profile URL.');
      setShowDebug(true);
      return;
    }

    setDebugResult(null);
    setDebugError(null);
    try {
      const result = await scrapeProfile(username);
      setDebugResult(result);
    } catch (err) {
      setDebugError(err instanceof Error ? err.message : String(err));
    }
    setShowDebug(true);
  }, [usernameInput]);

  const handleCancel = useCallback(() => {
    setIsUploading(false);
    setIsScraping(false);
    setScrapeProgress(null);
    setGuessState(null);
    setReveal(null);
    guessRef.current = null;
    setError(null);
  }, []);

  if (isUploading) return <LoadingScreen onCancel={handleCancel} typicalSeconds={45} />;
  if (isScraping) {
    return (
      <LoadingScreen
        onCancel={handleCancel}
        mode="scrape"
        typicalSeconds={30}
        events={scrapeProgress?.trace_events}
        onGuess={setGuess}
        guess={guess}
        reveal={reveal}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-900 text-white">
      <style>{`
        @keyframes watchlist-pulse {
          0%, 100% {
            box-shadow: 0 0 8px 0 rgba(251, 146, 60, 0.15);
            border-color: rgba(148, 163, 184, 0.4);
          }
          50% {
            box-shadow: 0 0 20px 4px rgba(251, 146, 60, 0.30);
            border-color: rgba(251, 146, 60, 0.5);
          }
        }
        .watchlist-glow {
          animation: watchlist-pulse 2.5s ease-in-out infinite;
        }
      `}</style>
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-purple-600/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 h-80 w-80 sm:h-[28rem] sm:w-[28rem] rounded-full bg-orange-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[720px] px-4 py-10 sm:py-14">
        <div className="space-y-10">
          {/* Hero */}
          <header className="text-center">
            <h1 className="font-black tracking-tight leading-[0.95] text-[clamp(36px,8vw,64px)]">
              <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">Movies Wrapped</span>
            </h1>
            <p className="mx-auto mt-4 text-slate-300 text-lg sm:text-xl leading-relaxed">Your Letterboxd year, re-edited.</p>
            <p className="mx-auto mt-2 text-slate-500 text-sm">Just type your username — no downloads, no uploads.</p>
          </header>

          {/* Username — primary CTA */}
          <section aria-label="Enter your Letterboxd username">
            <div className="mx-auto max-w-xl rounded-3xl border border-slate-700/50 bg-slate-800/40 p-7 sm:p-9 text-center backdrop-blur-sm">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-400/25 bg-orange-500/10">
                <Globe className="h-8 w-8 text-orange-300" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Just type your username</h2>
              <p className="mt-2 text-sm text-slate-400">We read your public Letterboxd diary — no downloads, no uploads.</p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleScrape();
                }}
                className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:flex-row"
              >
                <label className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-slate-500">@</span>
                  <input
                    type="text"
                    name="username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="your_username"
                    autoFocus
                    autoComplete="username"
                    spellCheck={false}
                    className="w-full rounded-2xl border border-slate-600/70 bg-slate-900/70 py-3.5 pl-9 pr-4 text-base text-white placeholder:text-slate-500 focus:border-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!usernameInput.trim()}
                  className="rounded-2xl bg-orange-400 px-6 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-orange-300 active:scale-[0.98] disabled:bg-slate-700 disabled:text-slate-500"
                >
                  Analyze →
                </button>
              </form>

              <button
                type="button"
                onClick={() => void handleDebug()}
                disabled={!usernameInput.trim()}
                className="mt-5 inline-flex items-center gap-1.5 text-[11px] text-slate-600 transition hover:text-slate-400 disabled:opacity-30"
              >
                <Bug className="size-3" />
                Debug — show raw response
              </button>
            </div>

            {/* Secondary: upload export */}
            <div className="mt-5 grid gap-2.5 sm:flex sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(true);
                  setError(null);
                  trackEvent('upload_modal_opened');
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-800/40 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-orange-400/40 hover:bg-slate-800/60 hover:text-orange-200 active:scale-[0.98] sm:w-auto"
              >
                <Upload className="h-4 w-4" />
                Upload export
              </button>
              <Link
                href="/watchlist"
                className="watchlist-glow inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-600/70 bg-slate-800/50 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-orange-400/50 hover:bg-slate-800/70 hover:text-orange-200 active:scale-[0.98] sm:w-auto"
              >
                <Users className="h-4 w-4" />
                Compare two watchlists
              </Link>
            </div>
          </section>

          {backendOffline && (
            <div className="mx-auto max-w-xl rounded-2xl border border-amber-700/50 bg-amber-900/20 p-4 text-center">
              <p className="text-sm text-amber-200">
                ⚠ Backend server is starting up. Analysis may not work immediately.
              </p>
            </div>
          )}

          {error && <ErrorBanner error={error} onDismiss={() => setError(null)} onRetry={() => setError(null)} />}

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

      {/* Debug overlay */}
      {showDebug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-700/60 bg-slate-900 p-5">
            <button
              onClick={() => setShowDebug(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <X className="size-4" />
            </button>
            <h3 className="mb-3 text-base font-semibold text-slate-200">
              {debugError ? 'Scrape Error' : 'Raw Scrape Response'}
            </h3>
            <pre className="overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-300">
              {JSON.stringify(debugError ? { error: debugError } : debugResult, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Upload Export modal — optional path; opens from secondary link */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/75 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setShowUploadModal(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-slate-700/60 bg-slate-900/95 p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setShowUploadModal(false)}
              aria-label="Close upload"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-slate-700/60 bg-slate-800/60 text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <X className="size-4" />
            </button>

            <div className="mb-5 pr-12">
              <h3 className="text-xl font-bold tracking-tight sm:text-2xl">Upload your Letterboxd export</h3>
              <p className="mt-1 text-sm text-slate-400">For the most complete analysis. Follow the steps below to get your file.</p>
            </div>

            <ExportInstructions />

            <div className="mt-6">
              <UploadZone onFiles={handleFiles} />
            </div>

            <p className="mt-4 text-center text-xs text-slate-500">
              Prefer the quick path? Close this and just type your username.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
