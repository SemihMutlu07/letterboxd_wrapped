'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Film, Star, Clock, Globe, HelpCircle, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function LetterboxdLanding() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const router = useRouter();
  
  
  const handleFile = useCallback(async (file: File) => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
        const formData = new FormData();
        formData.append('file', file, file.name);

        const xhr = new XMLHttpRequest();
        // The path needs to include the filename for the serverless function to work correctly
        xhr.open('POST', `/api/analyze/${file.name}`, true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            setLoading(false);
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.status === 'success') {
                        localStorage.setItem('letterboxdStats', JSON.stringify(response.stats));
                        router.push('/results');
                    } else {
                        setError(response.message || 'Analysis failed. Please try again.');
                    }
                } catch (e) {
                    setError('Failed to parse server response.');
                }
            } else {
                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    setError(`Error: ${errorResponse.message || xhr.statusText}`);
                } catch (e) {
                    setError(`Error: ${xhr.statusText}. Please check the file and try again.`);
                }
            }
        };

        xhr.onerror = () => {
            setLoading(false);
            setError('An unexpected error occurred during upload. Please check your network and try again.');
        };

        xhr.send(formData);

    } catch (err: any) {
        setLoading(false);
        setError(err.message || 'An unexpected error occurred.');

    }
  }, [router]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-4xl font-bold mb-4">Analyzing Your Films</h1>
          <p className="text-xl text-gray-400 mb-8">Please wait while we process your data...</p>
          
          <div className="relative w-32 h-32 mx-auto mb-8">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="rgb(55, 65, 81)" strokeWidth="8" fill="none" />
              <circle
                cx="50" cy="50" r="40" stroke="rgb(249, 115, 22)" strokeWidth="8" fill="none"
                strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - uploadProgress / 100)}`}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold">
              {uploadProgress}%
            </div>
          </div>
          <p className="text-lg text-gray-300">
            {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
          </p>
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
}