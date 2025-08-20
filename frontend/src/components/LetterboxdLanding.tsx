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
      const rel = (f as any).webkitRelativePath && (f as any).webkitRelativePath.length > 0 ? (f as any).webkitRelativePath : f.name;
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
        const entry = (items[0] as any).webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          const zip = new JSZip();
          const addRecursively = async (ent: any, prefix: string) => {
            if (ent.isFile) {
              const f: File = await new Promise((resolve) => ent.file(resolve));
              zip.file(`${prefix}${ent.name}`, f);
            } else if (ent.isDirectory) {
              const reader = ent.createReader();
              const readAll = async () => {
                const batch: any[] = await new Promise((r) => reader.readEntries(r));
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

interface CustomFileSystemDirectoryReader extends FileSystemDirectoryReader {
    createReader(): FileSystemDirectoryReader;
}

interface CustomFileSystemFileEntry extends FileSystemFileEntry {
    file(callback: (file: File) => void): void;
}
async function readAllDirectoryEntries(directoryReader: CustomFileSystemDirectoryReader): Promise<CustomFileSystemFileEntry[]> {
    const entries: CustomFileSystemFileEntry[] = [];
    let readEntries: CustomFileSystemFileEntry[] = await readEntriesPromise(directoryReader);
    while (readEntries.length > 0) {
        entries.push(...readEntries);
        readEntries = await readEntriesPromise(directoryReader);
    }
    return entries;
}

async function readEntriesPromise(directoryReader: CustomFileSystemDirectoryReader): Promise<CustomFileSystemFileEntry[]> {
    return new Promise((resolve, reject) => {
        directoryReader.readEntries(resolve as (value: FileSystemEntry[]) => void, reject);
    });
}


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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-5xl font-bold mb-4">Letterboxd Wrapped</h1>
        <p className="text-xl text-gray-400 mb-8">Upload your Letterboxd ZIP or drop the exported folder — we support Mac, Windows, iOS and Android.</p>
        
        <div 
          className="bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-12 cursor-pointer hover:border-green-400 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
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
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg mb-2">Drop your .zip, exported folder, or select multiple .csv files</p>
            <p className="text-sm text-gray-500">Supports: ratings.csv, diary.csv, watchlist.csv, reviews.csv</p>
          </div>
        </div>

        {/* Optional folder picker for users whose export was auto-unzipped */}
        <div className="mt-3">
          <button
            onClick={() => document.getElementById('dir-input')?.click()}
            className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Or choose exported folder
          </button>
          <input
            id="dir-input"
            type="file"
            // @ts-ignore non-standard but supported in Chromium/WebKit
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-lg">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* How to Export Section */}
        <div className="mt-8 w-full max-w-xl mx-auto text-left">
          <button
            onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
            className="w-full flex justify-between items-center p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center">
              <HelpCircle className="w-5 h-5 mr-3 text-gray-400" />
              <span className="font-semibold text-gray-200">How to Export Your Letterboxd Data</span>
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
                <div className="mt-2 p-6 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 space-y-3">
                  <p>Follow these steps on the Letterboxd website to get your data:</p>
                  <ol className="list-decimal list-inside space-y-2">
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

        {/* Features Preview */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-800 p-4 rounded-lg">
            <Film className="w-8 h-8 text-orange-400 mx-auto mb-2" />
            <p className="text-gray-300">Comprehensive Film Analysis</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <Star className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-gray-300">Rating Insights</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-gray-300">Time Statistics</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <Globe className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-gray-300">Global Cinema</p>
          </div>
        </div>
      </div>
    </div>
  );
}