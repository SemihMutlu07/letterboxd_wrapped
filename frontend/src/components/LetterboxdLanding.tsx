'use client';

import JSZip from 'jszip';
import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Film, Star, Clock, Globe, HelpCircle, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import PreResultsConsentModal from './PreResultsConsentModal';
import { getSessionId } from '../lib/session';
import { markConsentModalAsShown } from '../lib/sessionUtils';
import { trackEvent } from '../lib/analytics';
import { ensureSessionRow } from '../lib/sessions';



export default function LetterboxdLanding() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const router = useRouter();

  // Initialize session ID and ensure session row exists on component mount
  useEffect(() => {
    const initSession = async () => {
      const id = getSessionId();
      setSessionId(id);
      
      // Ensure session row exists in database
      try {
        await ensureSessionRow();
      } catch (err) {
        console.error('Failed to ensure session row:', err);
      }
    };
    
    initSession();
  }, []);

  // Test backend connectivity on component mount
  useEffect(() => {
    const testBackend = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/`); // FastAPI root endpoint
        if (!response.ok) {
          throw new Error(`Backend test failed with status: ${response.status}`);
        }
      } catch (err) {
        console.error('Backend connectivity test failed:', err);
      }
    };
    testBackend();
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
    if (!files || files.length === 0) return;

    // Track file upload
    trackEvent('files_uploaded', {
      file_count: files.length,
      file_types: Array.from(files).map(f => f.type || 'unknown'),
      total_size: Array.from(files).reduce((sum, f) => sum + f.size, 0)
    });

    setIsUploading(true);
    setError(null);

    let payloadZip: File;
    const single = files.length === 1 ? files[0] : null;
    const isZip = single && /\.zip$/i.test(single.name);
    if (isZip && single) {
      payloadZip = single;
    } else {
      payloadZip = await zipFiles(files);
    }

    const formData = new FormData();
    formData.append('files', payloadZip);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Landing] Analysis completed, saving stats to localStorage');
        console.log('[Landing] Stats keys:', result.stats ? Object.keys(result.stats) : 'no stats');
        localStorage.setItem('letterboxdStats', JSON.stringify(result.stats));
        console.log('[Landing] Stats saved to localStorage');
        
        // Track analysis completion with consent-gated film stats
        trackEvent('analysis_started', { 
          has_stats: !!result.stats,
          stats_keys: result.stats ? Object.keys(result.stats) : []
        });
        
        // Navigate directly to results page since analysis is complete
        console.log('[Landing] Navigating to results page');
        router.push('/results');
        

      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Analysis failed');
      }
    } catch (err) {
      console.error('Fetch error details:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      setIsUploading(false);
      
      // Track error
      trackEvent('analysis_error', { 
        error: errorMessage,
        stage: 'upload'
      });
    }
  }, [zipFiles, router]);

  const handleConsentAccept = () => {
    markConsentModalAsShown();
    setShowConsentModal(false);
    trackEvent('consent_given', { decision: 'accept' });
    router.push('/results');
  };

  const handleConsentDecline = () => {
    markConsentModalAsShown();
    setShowConsentModal(false);
    trackEvent('consent_given', { decision: 'decline' });
    router.push('/results');
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
        // Handle folder drop (macOS Finder) or multiple files
        const entry = (items[0] as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry })?.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          const zip = new JSZip();
          const addRecursively = async (ent: FileSystemEntry, prefix: string) => {
            if (ent.isFile) {
              const f: File = await new Promise((resolve) => (ent as FileSystemFileEntry).file(resolve));
              zip.file(`${prefix}${ent.name}`, f);
            } else if (ent.isDirectory) {
              const reader = (ent as FileSystemDirectoryEntry).createReader();
              const readAll = async () => {
                const batch: FileSystemEntry[] = await new Promise((r) => reader.readEntries(r));
                if (!batch || batch.length === 0) return;
                for (const child of batch) await addRecursively(child, `${prefix}${ent.name}/`);
                await readAll();
              };
              await readAll();
            }
          };
          await addRecursively(entry, '');
          const blob = await zip.generateAsync({ type: 'blob' });
          const zipped = new File([blob], 'letterboxd-export.zip', { type: 'application/zip' });
          const dt = new DataTransfer();
          dt.items.add(zipped);
          handleFiles(dt.files);
        } else {
          handleFiles(e.dataTransfer.files);
        }
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  }, [handleFiles]);



  if (isUploading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-4xl font-bold mb-4">Analyzing Your Films</h1>
          <p className="text-xl text-gray-400 mb-8">Creating your comprehensive movie wrapped...</p>
          
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-400 mx-auto mb-8"></div>
          
          <p className="text-gray-300">Please wait while we process your data...</p>
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
              <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">Letterboxd</span>
              <span> Wrapped</span>
            </h1>
            <p className="mx-auto mt-1 text-slate-300 text-base leading-relaxed">
              Upload your Letterboxd ZIP or drop the exported folder.
            </p>
          </header>

          {/* Dropzone */}
          <section aria-label="Upload your Letterboxd data">
            {/* Desktop dropzone */}
            <div
              className="hidden sm:flex rounded-3xl border-2 border-dashed border-slate-600/60 bg-slate-800/40 p-6 md:p-8 min-h-[220px] sm:min-h-[260px] items-center justify-center text-center cursor-pointer transition-colors shadow-none hover:shadow-lg hover:border-orange-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 max-w-3xl mx-auto"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
              role="button"
              tabIndex={0}
            >
              <input
                id="file-input"
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
                <p className="text-lg sm:text-xl font-semibold">Drop your export here</p>
                <p className="mt-1 text-sm text-slate-400">.zip, exported folder, or multiple .csv files</p>
                <p className="mt-1 text-xs text-slate-400">Supports: ratings.csv, diary.csv, watchlist.csv, reviews.csv</p>
              </div>
            </div>

            {/* Mobile upload CTA */}
            <div className="sm:hidden">
              <button
                onClick={() => document.getElementById('file-input')?.click()}
                className="w-full max-w-md mx-auto min-h-[44px] rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 flex items-center justify-center gap-3"
              >
                <Upload className="w-5 h-5" />
                Export your folder
              </button>
              <input
                id="file-input"
                type="file"
                multiple
                accept=".zip,.csv,.CSV"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            {/* Optional folder picker for users whose export was auto-unzipped */}
            <div className="mt-3 hidden sm:flex justify-center">
              <button
                onClick={() => document.getElementById('dir-input')?.click()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50"
              >
                Or choose exported folder
              </button>
              <input
                id="dir-input"
                type="file"
                // @ts-expect-error non-standard but supported in Chromium/WebKit
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
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

      {/* Pre-results Consent Modal */}
      <PreResultsConsentModal
        open={showConsentModal}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
        sessionId={sessionId}
      />
    </div>
  );
}