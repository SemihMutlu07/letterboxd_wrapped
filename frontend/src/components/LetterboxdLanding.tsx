'use client';

import JSZip from 'jszip';
import Link from 'next/link';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Users, X, UserRound, Sparkles, PartyPopper } from 'lucide-react';
import {
  analyzeFiles,
  parseLetterboxdUsername,
  scrapeProfile,
  testBackend,
  type AnalysisPeriod,
  type ScrapeProgress,
} from '@/lib/api';
import { ERROR_CODE_HINTS } from '@/lib/api';
import { persistStats } from '@/lib/stats-storage';
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
import { POSTER_GAME_MOVIES, type PosterGameMovie } from '@/lib/posterGameData';

const POSTER_GAME_MAX_LEVEL = 5;
// Points for a correct guess, indexed by how many wrong guesses/hints were used first.
const POSTER_ROUND_POINTS = [100, 80, 60, 40, 20];

const USERNAME_PLACEHOLDER_EXAMPLES = [
  'semihmutsuz',
  'watchthemengo',
  'denisvilleneuve',
  'meryl_streep',
  'quentintarantino',
  'timothee_chalamet',
  'christophernolan',
  'zendaya',
];

function useTypewriterPlaceholder(examples: string[], active: boolean): string {
  const [placeholder, setPlaceholder] = useState(examples[0] ?? '');

  useEffect(() => {
    if (!active || examples.length === 0) return;

    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      const word = examples[wordIndex];
      if (!deleting) {
        charIndex += 1;
        setPlaceholder(word.slice(0, charIndex));
        if (charIndex === word.length) {
          deleting = true;
          timeoutId = setTimeout(tick, 1400);
          return;
        }
        timeoutId = setTimeout(tick, 90);
      } else {
        charIndex -= 1;
        setPlaceholder(word.slice(0, charIndex));
        if (charIndex === 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % examples.length;
          timeoutId = setTimeout(tick, 400);
          return;
        }
        timeoutId = setTimeout(tick, 40);
      }
    };

    timeoutId = setTimeout(tick, 90);
    return () => clearTimeout(timeoutId);
  }, [active, examples]);

  return active ? placeholder : (examples[0] ?? '');
}

function drawShuffledMovie(deckRef: React.MutableRefObject<PosterGameMovie[]>, indexRef: React.MutableRefObject<number>): PosterGameMovie {
  if (indexRef.current >= deckRef.current.length) {
    const shuffled = [...POSTER_GAME_MOVIES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    deckRef.current = shuffled;
    indexRef.current = 0;
  }
  const movie = deckRef.current[indexRef.current];
  indexRef.current += 1;
  return movie;
}

export default function LetterboxdLanding() {
  const [isUploading, setIsUploading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress | null>(null);
  // Pixelated poster guessing game, shown while scraping.
  const [posterRound, setPosterRound] = useState<PosterGameMovie | null>(null);
  const [posterLevel, setPosterLevel] = useState(0);
  const [posterScore, setPosterScore] = useState(0);
  const [posterWrongGuesses, setPosterWrongGuesses] = useState(0);
  const [posterRevealed, setPosterRevealed] = useState(false);
  const [posterRoundsPlayed, setPosterRoundsPlayed] = useState(0);
  const shuffledDeckRef = useRef<PosterGameMovie[]>([]);
  const deckIndexRef = useRef(0);
  const [resultReady, setResultReady] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameFocused, setUsernameFocused] = useState(false);
  const usernamePlaceholder = useTypewriterPlaceholder(USERNAME_PLACEHOLDER_EXAMPLES, !usernameFocused && usernameInput.length === 0);
  const [analysisPeriod] = useState<AnalysisPeriod>('year');
  const [error, setError] = useState<NormalizedError | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
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

  const drawNextRound = useCallback(() => {
    const movie = drawShuffledMovie(shuffledDeckRef, deckIndexRef);
    setPosterLevel(0);
    setPosterWrongGuesses(0);
    setPosterRevealed(false);
    setPosterRound(movie);
  }, []);

  // Kick off the first poster round once scraping starts.
  useEffect(() => {
    if (isScraping && !posterRound) {
      drawNextRound();
    }
  }, [isScraping, posterRound, drawNextRound]);

  const handleWrongGuess = useCallback(() => {
    setPosterWrongGuesses((prev) => prev + 1);
    setPosterLevel((prev) => {
      const next = Math.min(prev + 1, POSTER_GAME_MAX_LEVEL);
      if (next >= POSTER_GAME_MAX_LEVEL) {
        setPosterRevealed(true);
        setPosterRoundsPlayed((prev) => prev + 1);
        setTimeout(() => drawNextRound(), 2000);
      }
      return next;
    });
  }, [drawNextRound]);

  const handleCorrectGuess = useCallback(() => {
    const points = POSTER_ROUND_POINTS[Math.min(posterWrongGuesses, POSTER_ROUND_POINTS.length - 1)];
    setPosterScore((prev) => prev + points);
    setPosterRoundsPlayed((prev) => prev + 1);
    setPosterRevealed(true);
    setTimeout(() => drawNextRound(), 1200);
  }, [drawNextRound, posterWrongGuesses]);

  // Only attach poster-game stats when the user actually played a round.
  const withPosterGameStats = useCallback(
    (stats: object) =>
      posterRoundsPlayed > 0
        ? { ...stats, poster_game_score: posterScore, poster_game_rounds: posterRoundsPlayed }
        : stats,
    [posterRoundsPlayed, posterScore]
  );

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

    const hasPersistenceConsent = getConsent() === 'accept';

    if (detectedUsername) {
      setDetectedUsername(detectedUsername);
      setUsername(detectedUsername);
      if (hasPersistenceConsent) {
        // Fire-and-forget — Supabase analytics shouldn't block the upload UI.
        try {
          await upsertUserSession({ session_id: ensureSessionId(), username: detectedUsername, consent: 'accept', film_count: null, favorite_genre: null });
        } catch (err) {
          console.warn('[supabase] session upsert failed (non-blocking):', err);
        }
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
      if (hasPersistenceConsent && username) {
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
      persistStats(withPosterGameStats(result.stats));

      trackConsentedEvent('analyze_succeeded', { total_films: result.stats.total_films, duration_ms: Math.round(durationMs) });
      trackFilmStats({ total_films: result.stats.total_films, total_countries: result.stats.total_countries, average_rating: result.stats.average_rating });

      if (analysisRun && detectedUsername) {
        try {
          await finishAnalysis({ id: analysisRun.id, ok: true, summary: buildSummaryForPersistence(result.stats as Record<string, unknown>) });
          await upsertUserSession({
            session_id: sessionId,
            username: detectedUsername,
            consent: 'accept',
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
    setPosterRound(null);
    setPosterLevel(0);
    setPosterScore(0);
    setPosterWrongGuesses(0);
    setPosterRevealed(false);
    shuffledDeckRef.current = [];
    deckIndexRef.current = 0;
    setResultReady(null);
    setError(null);
    trackEvent('analyze_started', { username, method: 'scrape', analysis_period: analysisPeriod });

    const sessionId = ensureSessionId();
    const hasPersistenceConsent = getConsent() === 'accept';
    let analysisRun: { id: string } | null = null;
    let startedAt = 0;
    try {
      if (hasPersistenceConsent) {
        try {
          const runId = crypto?.randomUUID?.();
          analysisRun = await startAnalysis({ id: runId, session_id: sessionId, username });
        } catch { /* analytics failure is non-fatal */ }
      }

      startedAt = performance.now();
      // The desktop worker scrapes the full profile from a residential IP.
      const method = 'scrape' as const;
      const result = await scrapeProfile(username, analysisPeriod, undefined, setScrapeProgress);
      const returnedUsername = (result.stats as { scraped_username?: string })?.scraped_username;
      if (returnedUsername && returnedUsername !== username) {
        throw new Error(`Username mismatch: requested @${username}, got @${returnedUsername}`);
      }
      setUsername(username);
      persistStats(withPosterGameStats(result.stats));

      trackConsentedEvent('analyze_succeeded', { total_films: result.stats.total_films, method });

      if (analysisRun) {
        try {
          await finishAnalysis({ id: analysisRun.id, ok: true, summary: buildSummaryForPersistence(result.stats as Record<string, unknown>) });
          await upsertUserSession({
            session_id: sessionId,
            username,
            consent: 'accept',
            film_count: result.stats.total_films || null,
            favorite_genre: result.stats.favorite_genre?.name || null,
          });
        } catch { /* analytics failure is non-fatal */ }
      }

      setResultReady(resultPath(username));
    } catch (err) {
      console.error('[scrape] analysis failed:', err);
      const normalized = normalizeError(err);
      if (analysisRun) {
        try { await finishAnalysis({ id: analysisRun.id, ok: false, error_message: normalized.message }); } catch { /* silent */ }
      }
      trackEvent('analyze_failed', { reason: normalized.reason, duration_ms: startedAt > 0 ? Math.round(performance.now() - startedAt) : 0, method: 'scrape' });
      setError(normalized);
      setIsScraping(false);

      // Surface a single, structured diagnostics line in the console so any user
      // (or agent reading the console later) immediately sees why the scraper failed.
      if (err instanceof Error && 'code' in err) {
        console.error('[scrape] failure diagnostics:', {
          username,
          reason: normalized.reason,
          error_code: (err as { code?: string }).code,
          hint: ERROR_CODE_HINTS[(err as { code?: string }).code ?? ''] ?? 'No hint available for this code',
          message: err.message,
          action: normalized.action,
        });
      }
    }
  }, [analysisPeriod, usernameInput]);

  const handleCancel = useCallback(() => {
    setIsUploading(false);
    setIsScraping(false);
    setScrapeProgress(null);
    setPosterRound(null);
    setPosterLevel(0);
    setPosterScore(0);
    setPosterWrongGuesses(0);
    setPosterRevealed(false);
    shuffledDeckRef.current = [];
    deckIndexRef.current = 0;
    setResultReady(null);
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
        posterGame={
          posterRound
            ? {
                movie: posterRound,
                level: posterLevel,
                maxLevel: POSTER_GAME_MAX_LEVEL,
                wrongGuesses: posterWrongGuesses,
                score: posterScore,
                nextPoints: POSTER_ROUND_POINTS[Math.min(posterWrongGuesses, POSTER_ROUND_POINTS.length - 1)],
                onWrongGuess: handleWrongGuess,
                onCorrectGuess: handleCorrectGuess,
                revealedAnswer: posterRevealed,
              }
            : null
        }
        resultReady={resultReady}
      />
    );
  }

  return (
    <div className="relative min-h-screen text-white" style={{ backgroundColor: '#1e252d' }}>
      <style>{`
        @keyframes watchlist-pulse {
          0%, 100% {
            box-shadow: 0 0 8px 0 rgba(255, 127, 0, 0.15);
            border-color: rgba(255, 255, 255, 0.2);
          }
          50% {
            box-shadow: 0 0 20px 4px rgba(255, 127, 0, 0.30);
            border-color: rgba(255, 127, 0, 0.5);
          }
        }
        .watchlist-glow {
          animation: watchlist-pulse 2.5s ease-in-out infinite;
        }
      `}</style>
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-72 w-72 sm:h-96 sm:w-96 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(63, 188, 243, 0.15)' }} />
        <div className="absolute -bottom-24 -right-20 h-80 w-80 sm:h-[28rem] sm:w-[28rem] rounded-full blur-3xl" style={{ backgroundColor: 'rgba(255, 127, 0, 0.15)' }} />
      </div>

      <div className="relative mx-auto max-w-[720px] px-4 py-10 sm:py-14">
        <div className="space-y-10">
          {/* Hero */}
          <header className="text-center">
            <h1 className="font-black tracking-tight leading-[0.95] text-[clamp(36px,8vw,64px)] text-white">
              Movies Wrapped
            </h1>
            <p className="mx-auto mt-4 text-lg sm:text-xl leading-relaxed text-white/80">Your Letterboxd year, re-edited.</p>
          </header>

          {/* Username — primary CTA */}
          <section aria-label="Enter your Letterboxd username">
            <div className="mx-auto max-w-xl rounded-3xl p-7 sm:p-9 text-center backdrop-blur-sm" style={{ borderWidth: 1, borderColor: '#1f262e', backgroundColor: 'rgba(27, 28, 30, 0.4)' }}>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Just type your username</h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleScrape();
                }}
                className="mx-auto mt-8 flex max-w-lg flex-col gap-4 sm:flex-row"
              >
                <label className="relative flex-1">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-semibold text-white/40">@</span>
                  <input
                    type="text"
                    name="username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onFocus={() => setUsernameFocused(true)}
                    onBlur={() => setUsernameFocused(false)}
                    placeholder={usernamePlaceholder}
                    autoFocus
                    autoComplete="username"
                    spellCheck={false}
                    className="w-full rounded-2xl py-5 pl-11 pr-5 text-lg font-semibold text-white placeholder:text-white/40 placeholder:font-normal focus:outline-none transition-shadow"
                    style={{ borderWidth: 1, borderColor: 'rgba(255, 127, 0, 0.4)', backgroundColor: 'rgba(30, 37, 45, 0.7)', boxShadow: usernameFocused ? '0 0 0 2px rgba(255, 127, 0, 0.6)' : undefined }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={!usernameInput.trim()}
                  className="rounded-2xl px-8 py-5 text-lg font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed"
                  style={usernameInput.trim()
                    ? { backgroundColor: '#ff7f00', color: '#1b1c1e' }
                    : { backgroundColor: '#1f262e', color: 'rgba(255,255,255,0.4)' }}
                >
                  Analyze →
                </button>
              </form>

            </div>

            {/* Secondary: upload export */}
            <div className="mt-6 grid gap-3 sm:flex sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(true);
                  setError(null);
                  trackEvent('upload_modal_opened');
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-medium text-white/70 transition hover:text-white active:scale-[0.98] sm:w-auto"
                style={{ borderWidth: 1, borderColor: '#1f262e', backgroundColor: 'rgba(27, 28, 30, 0.4)' }}
              >
                <Upload className="h-5 w-5" />
                Upload export
              </button>
              <Link
                href="/watchlist"
                className="watchlist-glow inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-medium text-white transition active:scale-[0.98] sm:w-auto"
                style={{ borderWidth: 1, borderColor: 'rgba(255, 127, 0, 0.3)', backgroundColor: 'rgba(27, 28, 30, 0.5)' }}
              >
                <Users className="h-5 w-5" />
                Compare two watchlists
              </Link>
            </div>
          </section>

          {/* How it works */}
          <section aria-label="How it works" className="mx-auto grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: UserRound, title: 'Enter username', desc: 'Type your Letterboxd handle or upload your export.', color: '#ff8000' },
              { icon: Sparkles, title: 'We analyze', desc: 'We crunch every film, rating, and genre you logged.', color: '#00e054' },
              { icon: PartyPopper, title: 'Get your Wrapped', desc: 'A shareable recap of your year in film.', color: '#40bcf4' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className="rounded-2xl p-5 text-center"
                style={{ borderWidth: 1, borderColor: '#1f262e', backgroundColor: 'rgba(27, 28, 30, 0.4)' }}
              >
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ borderWidth: 1, borderColor: `${color}40`, backgroundColor: `${color}1a` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/50">{desc}</p>
              </div>
            ))}
          </section>

          {backendOffline && (
            <div className="mx-auto max-w-xl rounded-2xl p-4 text-center" style={{ borderWidth: 1, borderColor: 'rgba(255, 127, 0, 0.4)', backgroundColor: 'rgba(255, 127, 0, 0.1)' }}>
              <p className="text-sm" style={{ color: '#ff7f00' }}>
                ⚠ Backend server is starting up. Analysis may not work immediately.
              </p>
            </div>
          )}

          {error && <ErrorBanner error={error} onDismiss={() => setError(null)} onRetry={() => setError(null)} />}
        </div>
      </div>

      {/* Upload Export modal — optional path; opens from secondary link */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/75 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setShowUploadModal(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl" style={{ borderWidth: 1, borderColor: '#1f262e', backgroundColor: 'rgba(30, 37, 45, 0.95)' }}>
            <button
              onClick={() => setShowUploadModal(false)}
              aria-label="Close upload"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:text-white"
              style={{ borderWidth: 1, borderColor: '#1f262e', backgroundColor: 'rgba(27, 28, 30, 0.6)' }}
            >
              <X className="size-4" />
            </button>

            <div className="mb-5 pr-12">
              <h3 className="text-xl font-bold tracking-tight sm:text-2xl text-white">Upload your Letterboxd export</h3>
              <p className="mt-1 text-sm text-white/50">For the most complete analysis. Follow the steps below to get your file.</p>
            </div>

            <ExportInstructions />

            <div className="mt-6">
              <UploadZone onFiles={handleFiles} />
            </div>

            <p className="mt-4 text-center text-xs text-white/40">
              Prefer the quick path? Close this and just type your username.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
