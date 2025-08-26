'use client';

import JSZip from 'jszip';
import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Film, Star, Clock, Globe, HelpCircle, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface ProgressData {
  stage: string;
  message: string;
  progress: number;
  total: number;
}

export default function LetterboxdLanding() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const router = useRouter();

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
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isUploading) {
      intervalId = setInterval(async () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          const response = await fetch(`${apiUrl}/api/progress`);
          if (response.ok) {
            const progressData = await response.json();
            setProgress(progressData);
            
            // If analysis is complete, stop polling and redirect
            if (progressData.stage === 'complete') {
              clearInterval(intervalId);
              // Small delay to show completion message
              setTimeout(() => {
                router.push('/results');
              }, 1500);
            }
          }
        } catch (err) {
          console.error('Error fetching progress:', err);
        }
      }, 1500); // Poll every 1500ms
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isUploading, router]);

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

    setIsUploading(true);
    setError(null);
    setProgress({ stage: 'starting', message: 'Preparing analysis...', progress: 0, total: 1 });

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
        localStorage.setItem('letterboxdStats', JSON.stringify(result.stats));
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Analysis failed');
      }
    } catch (err) {
      console.error('Fetch error details:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setIsUploading(false);
      setProgress(null);
    }
  }, [zipFiles]);

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

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'extracting': return '📦';
      case 'loading': return '📁';
      case 'processing': return '🎬';
      case 'tmdb_matching': return '🔍';
      case 'tmdb_metadata': return '📊';
      case 'analyzing': return '🎯';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const getProgressPercentage = () => {
    if (!progress || progress.total === 0) return 0;
    return Math.min((progress.progress / progress.total) * 100, 100);
  };

  if (isUploading && progress) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center">
          {/* Header */}
          <h1 className="text-4xl font-bold mb-4">Analyzing Your Films</h1>
          <p className="text-xl text-gray-400 mb-8">Creating your comprehensive movie wrapped...</p>
          
          {/* Progress Circle */}
          <div className="relative w-32 h-32 mx-auto mb-8">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="rgb(55, 65, 81)"
                strokeWidth="8"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="rgb(249, 115, 22)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - getProgressPercentage() / 100)}`}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl">{getStageIcon(progress.stage)}</span>
            </div>
          </div>

          {/* Progress Details */}
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-semibold mb-2 text-orange-400">
              {progress.stage.charAt(0).toUpperCase() + progress.stage.slice(1).replace('_', ' ')}
            </h3>
            <p className="text-gray-300 mb-4">{progress.message}</p>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
              <div 
                className="bg-gradient-to-r from-orange-400 to-pink-500 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            <p className="text-sm text-gray-400">
              {progress.progress} / {progress.total} 
              {progress.total > 1 && ` (${Math.round(getProgressPercentage())}%)`}
            </p>
          </div>

          {/* Stage Indicators */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            {[
              { key: 'extracting', label: 'Extract', icon: '📦' },
              { key: 'loading', label: 'Load', icon: '📁' },
              { key: 'processing', label: 'Process', icon: '🎬' },
              { key: 'tmdb_matching', label: 'Match', icon: '🔍' },
              { key: 'tmdb_metadata', label: 'Enrich', icon: '📊' },
              { key: 'analyzing', label: 'Analyze', icon: '🎯' }
            ].map((stage, index) => {
              const isActive = progress.stage === stage.key;
              const isComplete = ['extracting', 'loading', 'processing', 'tmdb_matching', 'tmdb_metadata', 'analyzing'].indexOf(progress.stage) > index;
              
              return (
                <div 
                  key={stage.key}
                  className={`p-2 rounded-lg border transition-all ${
                    isActive 
                      ? 'bg-orange-500 border-orange-400 text-white' 
                      : isComplete
                      ? 'bg-green-600 border-green-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-400'
                  }`}
                >
                  <div className="text-lg mb-1">{stage.icon}</div>
                  <div className="font-medium">{stage.label}</div>
                </div>
              );
            })}
          </div>

          {/* Fun Facts */}
          <div className="mt-8 text-sm text-gray-400">
            <p>💡 Did you know? We&apos;re fetching data from The Movie Database (TMDb) to enrich your film collection with comprehensive metadata!</p>
          </div>
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

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="space-y-8">
          {/* Hero header */}
          <header className="text-center">
            <h1 className="font-black tracking-tight leading-tight text-[clamp(28px,6vw,56px)]">
              <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">Letterboxd</span>
              <span> Wrapped</span>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-slate-300 text-base sm:text-lg leading-relaxed">
              Upload your Letterboxd ZIP or drop the exported folder — we support Mac, Windows, iOS and Android.
            </p>
          </header>

          {/* Dropzone */}
          <section aria-label="Upload your Letterboxd data">
            {/* Desktop dropzone */}
            <div
              className="hidden sm:flex rounded-3xl border-2 border-dashed border-slate-600/60 bg-slate-800/40 p-8 lg:p-10 min-h-[220px] sm:min-h-[260px] items-center justify-center text-center cursor-pointer transition-colors shadow-none hover:shadow-lg hover:border-orange-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 max-w-3xl mx-auto"
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

            {/* Mobile upload CTA (no large dropzone) */}
            <div className="sm:hidden">
              <div className="mx-auto max-w-md bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 text-center">
                <div className="mb-2 h-10 w-10 rounded-xl bg-slate-700/60 ring-1 ring-white/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-200" />
                </div>
                <div className="text-sm text-slate-300 mb-3">Upload your Letterboxd export (.zip or .csv)</div>
                <button
                  onClick={() => document.getElementById('file-input')?.click()}
                  className="inline-flex items-center justify-center w-full min-h-[44px] rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                >
                  Choose files
                </button>
                <div className="mt-2 text-[12px] text-slate-400">Supports: ratings.csv, diary.csv, watchlist.csv, reviews.csv</div>
              </div>
            </div>

            {/* Optional folder picker for users whose export was auto-unzipped */}
            <div className="mt-3 hidden sm:flex justify-center">
              <button
                onClick={() => document.getElementById('dir-input')?.click()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50"
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 text-sm">
              <div className="h-full rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 text-center transition transform hover:-translate-y-[2px]">
                <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-slate-700/60 ring-1 ring-white/10 flex items-center justify-center">
                  <Film className="w-6 h-6 text-orange-400" />
                </div>
                <div className="font-semibold">Comprehensive Film Analysis</div>
                <div className="text-slate-400 text-sm mt-1">Trends, genres, directors.</div>
              </div>
              <div className="h-full rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 text-center transition transform hover:-translate-y-[2px]">
                <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-slate-700/60 ring-1 ring-white/10 flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-400" />
                </div>
                <div className="font-semibold">Rating Insights</div>
                <div className="text-slate-400 text-sm mt-1">Averages, distributions, favorites.</div>
              </div>
              <div className="h-full rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 text-center transition transform hover:-translate-y-[2px]">
                <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-slate-700/60 ring-1 ring-white/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-400" />
                </div>
                <div className="font-semibold">Time Statistics</div>
                <div className="text-slate-400 text-sm mt-1">Diary streaks and seasons.</div>
              </div>
              <div className="h-full rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 text-center transition transform hover:-translate-y-[2px]">
                <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-slate-700/60 ring-1 ring-white/10 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-green-400" />
                </div>
                <div className="font-semibold">Global Cinema</div>
                <div className="text-slate-400 text-sm mt-1">Countries, languages, regions.</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}