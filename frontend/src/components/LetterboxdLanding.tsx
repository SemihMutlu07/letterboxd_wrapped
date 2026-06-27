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

const T = {
  darkblue:"#2776F5",
  paper: "#F1ECDE",
  card: "#FBF8EF",
  ink: "#100F0C",
  lime: "#AEE63E",
  amber: "#F2B33D",
  cyan: "#53CFE6",
  purple: "#A98BEA",
  red: "#E8463A",
  muted: "#6F6E63",
  darkamber:"#e16517",
  lines:"#cdcdcd"
};
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, "Cascadia Code", "Courier New", monospace';
const shadow = (n: number) => `${n}px ${n}px 0 ${T.ink}`;

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
  const [showAlert, setShowAlert] = useState(false);

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
      // RSS-first preview is SUSPENDED on the desktop_server branch. The desktop
      // worker scrapes the full profile from a residential IP, so we go straight
      // to the complete scrape like the original flow. rssPreview() is kept in
      // lib/api.ts and can be re-enabled in one line.
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
    <div style={{
      minHeight: '100vh',
      background: T.paper,
      backgroundImage: `
        linear-gradient(0deg, transparent 24%, ${T.lines} 25%, ${T.lines} 26%, transparent 27%, transparent 74%, ${T.lines} 75%, ${T.lines} 76%, transparent 77%, transparent),
        linear-gradient(90deg, transparent 24%, ${T.lines} 25%, ${T.lines} 26%, transparent 27%, transparent 74%, ${T.lines} 75%, ${T.lines} 76%, transparent 77%, transparent)
      `,
      backgroundSize: '50px 50px',
      color: T.ink,
      fontFamily: SERIF,
      paddingBottom: 40
    }}>
      {/* Hero section */}
      <div style={{ paddingTop: 40, paddingBottom: 40, textAlign: 'center', borderBottom: `2.5px solid ${T.ink}` }}>
        <div style={{ maxWidth: 720, margin: '0 auto', paddingLeft: 20, paddingRight: 20 }}>
          <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 56, lineHeight: 1, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Film Wrapped
          </h1>
          <p style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>
            Your Letterboxd Year
          </p>
          
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', paddingLeft: 20, paddingRight: 20, paddingTop: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Username input section */}
          <section style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 24, boxShadow: shadow(3) }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 36, marginBottom: 12 }}>Enter your username</h2>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12, maxWidth: 500, margin: '0 auto 12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: MONO, fontWeight: 700, fontSize: 18, color: T.ink }}>@</span>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleScrape();
                  }}
                  onFocus={(e) => {
                    const input = e.target as HTMLInputElement;
                    input.style.borderColor = '#000000';
                    input.style.background = '#e4dbcd';
                  }}
                  onBlur={(e) => {
                    const input = e.target as HTMLInputElement;
                    input.style.borderColor = T.ink;
                    input.style.background = T.paper;
                  }}
                  placeholder="username"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    width: '100%',
                    border: `2.5px solid ${T.ink}`,
                    background: T.paper,
                    padding: '10px 12px 10px 34px',
                    fontFamily: MONO,
                    fontSize: 18,
                    fontWeight: 700,
                    color: T.ink,
                    boxShadow: shadow(2),
                    outline: 'none',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!usernameInput.trim()) {
                    setShowAlert(true);
                    return;
                  }
                  void handleScrape();
                }}
                style={{
                  fontFamily: MONO,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '10px 14px',
                  border: `2.5px solid ${T.ink}`,
                  background: T.lime,
                  color: T.ink,
                  cursor: 'pointer',
                  boxShadow: shadow(2),
                  transition: 'all 90ms',
                }}
                onMouseEnter={(e) => {
                  const btn = e.target as HTMLButtonElement;
                  btn.style.background = T.amber;
                  btn.style.boxShadow = shadow(3);
                  btn.style.transform = 'translate(-1px, -1px)';
                }}
                onMouseLeave={(e) => {
                  const btn = e.target as HTMLButtonElement;
                  btn.style.background = T.lime;
                  btn.style.boxShadow = shadow(2);
                  btn.style.transform = 'none';
                }}
              >
                Analyze
              </button>
            </div>

            {/* Secondary: upload export & compare watchlists */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(true);
                  setError(null);
                  trackEvent('upload_modal_opened');
                }}
                style={{
                  fontFamily: MONO,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '10px 14px',
                  border: `2.5px solid ${T.ink}`,
                  background: T.cyan,
                  color: T.ink,
                  cursor: 'pointer',
                  boxShadow: shadow(2),
                  transition: 'all 90ms',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget;
                  btn.style.background = T.darkblue;
                  btn.style.boxShadow = shadow(3);
                  btn.style.transform = 'translate(-1px, -1px)';
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget;
                  btn.style.background = T.cyan;
                  btn.style.boxShadow = shadow(2);
                  btn.style.transform = 'none';
                }}
              >
                <Upload className="h-4 w-4" />
                Upload
              </button>
              <Link
                href="/watchlist"
                style={{
                  fontFamily: MONO,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '10px 14px',
                  border: `2.5px solid ${T.ink}`,
                  background: T.amber,
                  color: T.ink,
                  cursor: 'pointer',
                  boxShadow: shadow(2),
                  transition: 'all 90ms',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.darkamber;
                  e.currentTarget.style.boxShadow = shadow(3);
                  e.currentTarget.style.transform = 'translate(-1px, -1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = T.amber;
                  e.currentTarget.style.boxShadow = shadow(2);
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <Users className="h-4 w-4" />
                Compare
              </Link>
            </div>
          </section>

          {backendOffline && (
            <div style={{ border: `2.5px solid ${T.ink}`, background: T.amber, padding: 16, textAlign: 'center', boxShadow: shadow(2) }}>
              <p style={{ fontFamily: MONO, fontSize: 14, color: T.ink,fontWeight:600 }}>
                ⚠ Backend server is starting up. Analysis may not work immediately.
              </p>
            </div>
          )}

          {error && <ErrorBanner error={error} onDismiss={() => setError(null)} onRetry={() => setError(null)} />}

          {/* Inside Your Wrapped */}
          <section>
            <h2 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, textAlign: 'center', marginBottom: 24 }}>Inside Your Wrapped</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <div
                style={{
                  border: `2.5px solid ${T.ink}`,
                  background: T.card,
                  padding: 16,
                  textAlign: 'center',
                  boxShadow: shadow(2),
                  transition: 'all 90ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.lime;
                  e.currentTarget.style.boxShadow = shadow(3);
                  e.currentTarget.style.transform = 'translate(-1px, -1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = T.card;
                  e.currentTarget.style.boxShadow = shadow(2);
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <Film className="w-6 h-6 mx-auto mb-2" style={{ color: T.ink }} />
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', marginBottom: 4, color: T.ink }}>Film Analysis</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: T.muted, lineHeight: 1.4 }}>Trends across genres & decades.</div>
              </div>
              <div
                style={{
                  border: `2.5px solid ${T.ink}`,
                  background: T.card,
                  padding: 16,
                  textAlign: 'center',
                  boxShadow: shadow(2),
                  transition: 'all 90ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.amber;
                  e.currentTarget.style.boxShadow = shadow(3);
                  e.currentTarget.style.transform = 'translate(-1px, -1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = T.card;
                  e.currentTarget.style.boxShadow = shadow(2);
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <Star className="w-6 h-6 mx-auto mb-2" style={{ color: T.ink }} />
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', marginBottom: 4, color: T.ink }}>Rating Patterns</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: T.muted, lineHeight: 1.4 }}>How you judge films.</div>
              </div>
              <div
                style={{
                  border: `2.5px solid ${T.ink}`,
                  background: T.card,
                  padding: 16,
                  textAlign: 'center',
                  boxShadow: shadow(2),
                  transition: 'all 90ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.cyan;
                  e.currentTarget.style.boxShadow = shadow(3);
                  e.currentTarget.style.transform = 'translate(-1px, -1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = T.card;
                  e.currentTarget.style.boxShadow = shadow(2);
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: T.ink }} />
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', marginBottom: 4, color: T.ink }}>Time Statistics</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: T.muted, lineHeight: 1.4 }}>Your viewing rhythm.</div>
              </div>
              <div
                style={{
                  border: `2.5px solid ${T.ink}`,
                  background: T.card,
                  padding: 16,
                  textAlign: 'center',
                  boxShadow: shadow(2),
                  transition: 'all 90ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.purple;
                  e.currentTarget.style.boxShadow = shadow(3);
                  e.currentTarget.style.transform = 'translate(-1px, -1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = T.card;
                  e.currentTarget.style.boxShadow = shadow(2);
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <Globe className="w-6 h-6 mx-auto mb-2" style={{ color: T.ink }} />
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', marginBottom: 4, color: T.ink }}>Global Cinema</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: T.muted, lineHeight: 1.4 }}>Countries & languages.</div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Debug overlay */}
      {showDebug && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 15, 12, 0.9)', padding: 16 }}>
          <div style={{ position: 'relative', maxHeight: '80vh', width: '100%', maxWidth: 640, overflow: 'auto', border: `2.5px solid ${T.ink}`, background: T.paper, padding: 20, boxShadow: shadow(4), color: T.ink, fontFamily: MONO, fontSize: 11 }}>
            <button
              onClick={() => setShowDebug(false)}
              style={{
                position: 'absolute',
                right: 12,
                top: 12,
                padding: 4,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: T.muted,
              }}
            >
              <X className="size-4" />
            </button>
            <h3 style={{ marginBottom: 12, fontFamily: SERIF, fontWeight: 700, fontSize: 16 }}>
              {debugError ? 'Scrape Error' : 'Raw Response'}
            </h3>
            <pre style={{ overflow: 'auto', padding: 12, background: T.card, border: `1px solid ${T.muted}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
              {JSON.stringify(debugError ? { error: debugError } : debugResult, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Upload Export modal — optional path; opens from secondary link */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 15, 12, 0.95)', padding: 16 }}>
          <div
            style={{ position: 'absolute', inset: 0 }}
            onClick={() => setShowUploadModal(false)}
            aria-hidden
          />
          <div style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            maxWidth: 640,
            maxHeight: '92vh',
            overflowY: 'auto',
            border: `2.5px solid ${T.ink}`,
            background: T.paper,
            backgroundImage: `
              linear-gradient(0deg, transparent 24%, ${T.card} 25%, ${T.card} 26%, transparent 27%, transparent 74%, ${T.card} 75%, ${T.card} 76%, transparent 77%, transparent),
              linear-gradient(90deg, transparent 24%, ${T.card} 25%, ${T.card} 26%, transparent 27%, transparent 74%, ${T.card} 75%, ${T.card} 76%, transparent 77%, transparent)
            `,
            backgroundSize: '50px 50px',
            padding: 24,
            boxShadow: shadow(4),
            color: T.ink,
            fontFamily: SERIF
          }}>
            <button
              onClick={() => setShowUploadModal(false)}
              aria-label="Close upload"
              style={{
                position: 'absolute',
                right: 12,
                top: 12,
                width: 40,
                height: 40,
                display: 'grid',
                placeItems: 'center',
                border: `2.5px solid ${T.ink}`,
                background: T.card,
                cursor: 'pointer',
                transition: 'all 90ms',
                boxShadow: shadow(2),
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = T.lime;
                e.currentTarget.style.boxShadow = shadow(3);
                e.currentTarget.style.transform = 'translate(-1px, -1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = T.card;
                e.currentTarget.style.boxShadow = shadow(2);
                e.currentTarget.style.transform = 'none';
              }}
            >
              <X className="size-4" />
            </button>

            <div style={{ marginBottom: 20, paddingRight: 40 }}>
              <h3 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 28, marginBottom: 12 }}>Upload your Letterboxd export</h3>
              <p style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: T.muted }}>For complete analysis. Follow the steps below.</p>
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

      {/* Alert dialog */}
      {showAlert && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 15, 12, 0.9)', padding: 16 }}>
          <div style={{ position: 'relative', width: '100%',display: 'flex',alignItems: 'center',justifyContent: 'center',flexDirection:'column', maxWidth: 400, border: `2.5px solid ${T.ink}`, background: T.card, padding: 24, boxShadow: shadow(4), color: T.ink }}>
            <h2 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 25, marginBottom: 12 }}>Please enter a username</h2>
            <p style={{ fontFamily: MONO, fontSize: 15, color: T.muted, marginBottom: 20,marginLeft:30 }}>To analyze a public Letterboxd profile, enter a username above.</p>
            <button
              type="button"
              onClick={() => setShowAlert(false)}
              style={{
                width:120,
                height:45,
                fontFamily: MONO,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '10px 14px',
                border: `2.5px solid ${T.ink}`,
                background: T.lime,
                color: T.ink,
                cursor: 'pointer',
                boxShadow: shadow(2),
                transition: 'all 90ms',
              }}
              onMouseEnter={(e) => {
                const btn = e.target as HTMLButtonElement;
                btn.style.background = T.amber;
                btn.style.boxShadow = shadow(3);
                btn.style.transform = 'translate(-1px, -1px)';
              }}
              onMouseLeave={(e) => {
                const btn = e.target as HTMLButtonElement;
                btn.style.background = T.lime;
                btn.style.boxShadow = shadow(2);
                btn.style.transform = 'none';
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
