'use client';

import JSZip from 'jszip';
import React, { useState, useCallback, useEffect } from 'react';
import { Film, Star, Clock, Globe } from 'lucide-react';
import { analyzeFiles, testBackend } from '@/lib/api';
import { startAnalysis, finishAnalysis, buildSummaryForPersistence } from '@/lib/supabase/analysis_runs';
import { upsertUserSession } from '@/lib/supabase/sessions';
import { ensureSessionId, getUsername, setUsername, getConsent } from '@/lib/session-id';
import { trackEvent, trackConsentedEvent, trackFilmStats } from '@/lib/analytics';
import { parseLetterboxdUsername } from '@/lib/filename';
import { normalizeError, type NormalizedError } from '@/lib/errors';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingScreen from '@/components/landing/LoadingScreen';
import UploadZone from '@/components/landing/UploadZone';
import ExportInstructions from '@/components/landing/ExportInstructions';

const APP_VERSION = '1.0.0';

export default function LetterboxdLanding() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<NormalizedError | null>(null);
  const [, setDetectedUsername] = useState<string | null>(null);

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
        trackEvent('backend_health_check_ok');
      } catch {
        trackEvent('backend_health_check_failed');
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

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      setError({ title: 'No files selected', message: 'Please choose your Letterboxd export files.', reason: 'no_files_selected' });
      trackEvent('upload_failed', { reason: 'no_files_selected', step: 'validation' });
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
        trackEvent('upload_failed', { reason: 'file_too_large', step: 'validation' });
        return;
      }
      const hasValidExtension = ['.csv', '.zip'].some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!hasValidExtension) {
        setError({ title: 'Unsupported file', message: `"${file.name}" is not a supported format. Please upload .csv or .zip files only.`, reason: 'invalid_file_type' });
        trackEvent('upload_failed', { reason: 'invalid_extension', step: 'validation' });
        return;
      }
    }

    // Detect username
    let detectedUsername: string | null = null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File & { webkitRelativePath?: string };
      const relativePath = file.webkitRelativePath || '';
      const pathParts = relativePath ? relativePath.split('/').filter(Boolean) : [];
      for (const candidate of [file.name, relativePath, pathParts[0] || '']) {
        const { parseLetterboxdUsername: parseLocal } = await import('@/lib/filename');
        const parsed = parseLocal(candidate);
        if (parsed) { detectedUsername = parsed; break; }
      }
      if (detectedUsername) break;
    }

    if (detectedUsername) {
      setDetectedUsername(detectedUsername);
      setUsername(detectedUsername);
      try {
        await upsertUserSession({ session_id: ensureSessionId(), username: detectedUsername, consent: getConsent() || 'decline', film_count: null, favorite_genre: null });
      } catch { /* silent */ }
    }

    setIsUploading(true);
    trackEvent('upload_started', { fileCount: files.length });
    setError(null);

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
        trackEvent('upload_failed', { reason: 'no_csv_in_folder', step: 'preparation' });
        return;
      }
      try {
        uploadFiles = [await zipFiles(csvFiles)];
      } catch {
        setError({ title: 'Failed to prepare folder', message: 'Could not package the selected folder for upload.', action: 'Please try again or upload the original .zip file instead.', reason: 'unknown_error' });
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
        uploadFiles = [await zipFiles(files)];
      } catch {
        setError({ title: 'Failed to prepare files', message: 'Could not package the selected files for upload.', action: 'Please try again or upload as a single ZIP.', reason: 'unknown_error' });
        setIsUploading(false);
        trackEvent('upload_failed', { reason: 'zip_pack_failed', step: 'preparation' });
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
      trackEvent('analysis_started', { hasZip: !!isZip, fileCount: files.length });

      const result = await analyzeFiles(formData);
      const durationMs = performance.now() - startedAt;

      if (detectedUsername) setUsername(detectedUsername);
      localStorage.setItem('letterboxdStats', JSON.stringify(result.stats));

      trackConsentedEvent('analyze_completed', { total_films: result.stats.total_films, duration_ms: Math.round(durationMs), ok: true });
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
      trackEvent('analyze_completed', { ok: false, reason: normalized.reason, duration_ms: startedAt > 0 ? Math.round(performance.now() - startedAt) : 0, total_films: null });
      setError(normalized);
      setIsUploading(false);
    }
  }, [zipFiles]);

  if (isUploading) return <LoadingScreen />;

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

          <UploadZone onFiles={handleFiles} />

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
    </div>
  );
}
