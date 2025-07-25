'use client';

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

  // Poll progress endpoint during upload
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isUploading) {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/progress`);
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
      }, 500); // Poll every 500ms
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isUploading, router]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setProgress({ stage: 'starting', message: 'Preparing analysis...', progress: 0, total: 1 });
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        // Save stats to localStorage to pass to the results page
        localStorage.setItem('letterboxdStats', JSON.stringify(result.stats));
        // The redirect will happen via the progress polling
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setIsUploading(false);
      setProgress(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

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
        <p className="text-xl text-gray-400 mb-8">Upload your Letterboxd ZIP file to see your comprehensive year in review.</p>
        
        <div 
          className="bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-12 cursor-pointer hover:border-green-400 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".zip"
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="flex flex-col items-center">
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg mb-2">Drop your ZIP file here or click to browse</p>
            <p className="text-sm text-gray-500">Supports: ratings.csv, diary.csv, watchlist.csv, reviews.csv</p>
          </div>
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