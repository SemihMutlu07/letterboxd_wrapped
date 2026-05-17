'use client';

import JSZip from 'jszip';
import Link from 'next/link';
import React, { useState, useCallback, useEffect } from 'react';
import { Film, Star, Clock, Globe, Upload, Users, Bug, X } from 'lucide-react';
import { analyzeFiles, parseLetterboxdUsername, scrapeProfile, testBackend } from '@/lib/api';
import { startAnalysis, finishAnalysis, buildSummaryForPersistence } from '@/lib/supabase/analysis_runs';
import { upsertUserSession } from '@/lib/supabase/sessions';
import { ensureSessionId, getUsername, setUsername, getConsent } from '@/lib/session-id';
import { trackEvent, trackConsentedEvent, trackFilmStats } from '@/lib/analytics';
import { normalizeError, type NormalizedError } from '@/lib/errors';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingScreen from '@/components/landing/LoadingScreen';
import UploadZone from '@/components/landing/UploadZone';
import ExportInstructions from '@/components/landing/ExportInstructions';

const APP_VERSION = '0.0.1';

export default function LetterboxdLanding() {
  const [isUploading, setIsUploading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [inputMode, setInputMode] = useState<'upload' | 'username'>('upload');
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
      } catch {
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
      } catch {
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
      localStorage.setItem('letterboxdStats', JSON.stringify(result.stats));

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

      setTimeout(() => { window.location.href = '/results'; }, 100);
    } catch (err) {
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
    const username = usernameInput.trim().replace(/^@/, '').toLowerCase();
    if (!username) {
      setError({ title: 'No username', message: 'Please enter your Letterboxd username.', reason: 'no_username' });
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      setError({ title: 'Invalid username', message: 'Letterboxd usernames can only contain lowercase letters, numbers, and underscores.', reason: 'invalid_username' });
      return;
    }

    setIsScraping(true);
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
      const result = await scrapeProfile(username);
      const durationMs = performance.now() - startedAt;
      setUsername(username);
      localStorage.setItem('letterboxdStats', JSON.stringify(result.stats));

      trackConsentedEvent('analyze_succeeded', { total_films: result.stats.total_films, method: 'scrape' });

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

      setTimeout(() => { window.location.href = '/results'; }, 100);
    } catch (err) {
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
    const username = usernameInput.trim().replace(/^@/, '').toLowerCase();
    if (!username) return;
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
    setError(null);
  }, []);

  if (isUploading) return <LoadingScreen onCancel={handleCancel} typicalSeconds={45} />;
  if (isScraping) {
    return (
      <LoadingScreen
        onCancel={handleCancel}
        mode="scrape"
        typicalSeconds={30}
      />
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
            <p className="mx-auto mt-2 text-slate-300 text-base leading-relaxed">Your Letterboxd year, re-edited.</p>
            <p className="mx-auto mt-3 text-slate-500 text-xs sm:text-sm">For the smoothest experience, use a desktop browser. The Letterboxd mobile app may block ZIP downloads.</p>
            <p className="mx-auto mt-2 text-slate-600 text-[11px] sm:text-xs">Version {APP_VERSION}</p>
          </header>

          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setInputMode('upload');
                setError(null);
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                inputMode === 'upload'
                  ? 'border-orange-400/40 bg-orange-500/20 text-orange-200'
                  : 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="h-4 w-4" />
              Upload Export
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMode('username');
                setError(null);
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                inputMode === 'username'
                  ? 'border-orange-400/40 bg-orange-500/20 text-orange-200'
                  : 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="h-4 w-4" />
              Enter Username
            </button>
          </div>

          <div className="flex justify-center">
            <Link
              href="/watchlist"
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/30 px-4 py-2 text-xs font-semibold text-slate-400 transition hover:border-orange-400/40 hover:text-orange-200"
            >
              <Users className="h-4 w-4" />
              Compare two watchlists
            </Link>
          </div>

          {inputMode === 'upload' ? (
            <UploadZone onFiles={handleFiles} />
          ) : (
            <section aria-label="Enter your Letterboxd username">
              <div className="mx-auto max-w-3xl rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/25 bg-orange-500/10">
                  <Globe className="h-7 w-7 text-orange-300" />
                </div>
                <p className="text-xl font-bold tracking-tight sm:text-2xl">Analyze By Username</p>
                <p className="mt-2 text-sm text-slate-400">Use this if you want a quick scan from a public Letterboxd profile.</p>
                <div className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
                  <label className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">@</span>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleScrape();
                      }}
                      placeholder="your_username"
                      className="w-full rounded-xl border border-slate-600/70 bg-slate-900/70 py-3 pl-8 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleScrape()}
                    disabled={!usernameInput.trim()}
                    className="rounded-xl bg-orange-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300 disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    Analyze
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">Public profile scans are less complete than official exports, but useful for fast tests.</p>
                <button
                  type="button"
                  onClick={() => void handleDebug()}
                  disabled={!usernameInput.trim()}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300 disabled:opacity-30"
                >
                  <Bug className="size-3.5" />
                  Debug — show raw response
                </button>
              </div>
            </section>
          )}

          {backendOffline && (
            <div className="mx-auto max-w-xl rounded-2xl border border-amber-700/50 bg-amber-900/20 p-4 text-center">
              <p className="text-sm text-amber-200">
                ⚠ Backend server is starting up. Analysis may not work immediately.
              </p>
            </div>
          )}

          {error && <ErrorBanner error={error} onDismiss={() => setError(null)} onRetry={() => setError(null)} />}

          <ExportInstructions />

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
    </div>
  );
}
