'use client';

import React, { useState, useCallback } from 'react';
import { Upload, Download, Settings, FileText, Smartphone, Monitor, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const LetterboxdLanding = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const steps = [
    {
      id: 1,
      title: "Go to Letterboxd Settings",
      description: "Navigate to letterboxd.com → Settings → Import & Export",
      icon: <Settings className="w-6 h-6" />,
      image: "/letterboxd-settings.png" // We'll add this image later
    },
    {
      id: 2,
      title: "Export Your Data",
      description: "Click 'Export Your Data' and wait for the download",
      icon: <Download className="w-6 h-6" />,
      image: "/letterboxd-export.png" // We'll add this image later
    },
    {
      id: 3,
      title: "Upload & Get Your Wrapped",
      description: "Upload your ZIP file here and see your movie year!",
      icon: <Upload className="w-6 h-6" />,
      image: "/letterboxd-upload.png" // We'll add this image later
    }
  ];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await handleFiles(files);
    }
  }, []);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        // Navigate to results page with the session ID
        router.push(`/results?session=${result.sessionId}`);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Letterboxd Wrapped</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Your Movie Year,
            <span className="bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
              {" "}Wrapped
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Transform your Letterboxd data into beautiful, shareable visuals. 
            See your movie statistics like never before.
          </p>
          
          {/* Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-3xl mx-auto">
            <div className="bg-gradient-to-br from-pink-500 to-orange-500 p-6 rounded-2xl text-white transform hover:scale-105 transition-transform">
              <h3 className="text-2xl font-bold mb-2">247</h3>
              <p className="text-sm opacity-90">Films Watched</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-6 rounded-2xl text-white transform hover:scale-105 transition-transform">
              <h3 className="text-2xl font-bold mb-2">4.2★</h3>
              <p className="text-sm opacity-90">Average Rating</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-teal-500 p-6 rounded-2xl text-white transform hover:scale-105 transition-transform">
              <h3 className="text-2xl font-bold mb-2">Drama</h3>
              <p className="text-sm opacity-90">Top Genre</p>
            </div>
          </div>

          {/* Device Support */}
          <div className="flex items-center justify-center space-x-8 mb-12">
            <div className="flex items-center space-x-2 text-gray-300">
              <Monitor className="w-5 h-5" />
              <span>Desktop</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-300">
              <Smartphone className="w-5 h-5" />
              <span>Mobile</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            How It Works
          </h2>
          
          {/* Step Navigation */}
          <div className="flex justify-center mb-8">
            <div className="flex space-x-4 bg-white/10 rounded-full p-2">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    currentStep === step.id
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Step {step.id}
                </button>
              ))}
            </div>
          </div>

          {/* Current Step Content */}
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 md:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                    {steps[currentStep - 1].icon}
                  </div>
                  <span className="text-orange-400 font-semibold">Step {currentStep}</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  {steps[currentStep - 1].title}
                </h3>
                <p className="text-gray-300 text-lg mb-6">
                  {steps[currentStep - 1].description}
                </p>
                
                {currentStep < 3 && (
                  <button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="flex items-center space-x-2 text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="relative">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="w-full h-48 bg-gray-700 rounded-xl flex items-center justify-center">
                    <span className="text-gray-400">Screenshot {currentStep}</span>
                  </div>
                </div>
                {currentStep === 1 && (
                  <div className="absolute top-4 right-4 bg-orange-500 text-white px-2 py-1 rounded text-xs">
                    letterboxd.com
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-8">Ready to See Your Wrapped?</h2>
          
          {/* Upload Zone */}
          <div 
            className={`bg-white/10 backdrop-blur-lg border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer group relative ${
              isDragging 
                ? 'border-orange-400 bg-orange-400/10' 
                : 'border-white/30 hover:border-orange-400'
            } ${isUploading ? 'pointer-events-none' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              multiple
              accept=".zip,.csv"
              onChange={handleFileInput}
              className="hidden"
            />
            
            {isUploading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full mb-4"></div>
                <h3 className="text-xl font-semibold text-white mb-2">Processing your data...</h3>
                <p className="text-gray-300">This may take a few moments</p>
              </div>
            ) : (
              <>
                <Upload className="w-16 h-16 text-white/60 group-hover:text-orange-400 mx-auto mb-4 transition-colors" />
                <h3 className="text-xl font-semibold text-white mb-2">Drop your Letterboxd ZIP file here</h3>
                <p className="text-gray-300 mb-4">or click to browse</p>
                <p className="text-sm text-gray-400">
                  Supports ZIP files or individual CSV files (ratings.csv, diary.csv)
                </p>
              </>
            )}
          </div>

          {/* Alternative Upload */}
          <div className="mt-6">
            <p className="text-gray-400 text-sm mb-4">Having trouble with ZIP files on mobile?</p>
            <button 
              className="text-orange-400 hover:text-orange-300 underline"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              Upload individual CSV files instead
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">
          Made for movie lovers. Not affiliated with Letterboxd.
        </p>
      </footer>
    </div>
  );
};

export default LetterboxdLanding;