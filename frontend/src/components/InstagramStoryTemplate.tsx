'use client';

import React, { useState, useRef } from 'react';
import { motion, Variants } from 'framer-motion';
import { Film, Star, Clock, TrendingUp, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

interface StoryData {
  totalFilms: number;
  averageRating: number;
  totalHours: number;
  topGenre: string;
  topDirector: string;
  userName: string;
}

const InstagramStoryTemplate = () => {
  const [isExporting, setIsExporting] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);

  // Sample data - replace with real data later
  const data: StoryData = {
    totalFilms: 247,
    averageRating: 4.2,
    totalHours: 412,
    topGenre: 'Drama',
    topDirector: 'Christopher Nolan',
    userName: 'semih'
  };

  const exportAsImage = async () => {
    if (!storyRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(storyRef.current, {
        width: 1080,
        height: 1920,
        scale: 2,
        backgroundColor: '#1a1a2e'
      });
      
      // Download the image
      const link = document.createElement('a');
      link.download = `${data.userName}-letterboxd-wrapped.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { y: 50, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  const numberVariants: Variants = {
    hidden: { scale: 0 },
    visible: {
      scale: 1,
      transition: { duration: 0.8, ease: 'easeOut' }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-8 p-8 bg-gray-900 min-h-screen">
      {/* Instagram Story Template */}
      <div 
        ref={storyRef}
        className="relative w-[540px] h-[960px] bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-hidden"
        style={{ aspectRatio: '9/16' }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 border border-white/20 rounded-full"></div>
          <div className="absolute top-40 right-8 w-20 h-20 border border-white/20 rounded-full"></div>
          <div className="absolute bottom-40 left-8 w-24 h-24 border border-white/20 rounded-full"></div>
        </div>

        <motion.div 
          className="relative z-10 h-full flex flex-col justify-center items-center p-8 text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-12">
            <h1 className="text-3xl font-bold text-white mb-2">
              @{data.userName}'s
            </h1>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
              Letterboxd Wrapped
            </h2>
            <p className="text-gray-300 text-lg mt-2">2024</p>
          </motion.div>

          {/* Main Stats */}
          <div className="space-y-8 w-full">
            {/* Films Watched */}
            <motion.div 
              variants={itemVariants}
              className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20"
            >
              <Film className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <motion.div variants={numberVariants}>
                <h3 className="text-6xl font-bold text-white mb-2">{data.totalFilms}</h3>
              </motion.div>
              <p className="text-gray-300 text-xl">Films Watched</p>
            </motion.div>

            {/* Two Column Stats */}
            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                variants={itemVariants}
                className="bg-gradient-to-br from-pink-500/20 to-orange-500/20 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
              >
                <Star className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
                <motion.div variants={numberVariants}>
                  <h4 className="text-3xl font-bold text-white mb-1">{data.averageRating}★</h4>
                </motion.div>
                <p className="text-gray-300 text-sm">Average Rating</p>
              </motion.div>

              <motion.div 
                variants={itemVariants}
                className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
              >
                <Clock className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <motion.div variants={numberVariants}>
                  <h4 className="text-3xl font-bold text-white mb-1">{data.totalHours}h</h4>
                </motion.div>
                <p className="text-gray-300 text-sm">Hours Watched</p>
              </motion.div>
            </div>

            {/* Top Genre */}
            <motion.div 
              variants={itemVariants}
              className="bg-gradient-to-r from-green-500/20 to-teal-500/20 backdrop-blur-lg rounded-3xl p-6 border border-white/20"
            >
              <TrendingUp className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <h4 className="text-2xl font-bold text-white mb-1">You're a</h4>
              <motion.div variants={numberVariants}>
                <h3 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-transparent mb-1">
                  {data.topGenre}
                </h3>
              </motion.div>
              <p className="text-gray-300">Devotee</p>
            </motion.div>

            {/* Favorite Director */}
            <motion.div 
              variants={itemVariants}
              className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
            >
              <p className="text-gray-300 text-lg mb-2">Your most-watched director:</p>
              <motion.div variants={numberVariants}>
                <h4 className="text-2xl font-bold text-white">{data.topDirector}</h4>
              </motion.div>
            </motion.div>
          </div>

          {/* Footer */}
          <motion.div variants={itemVariants} className="mt-8">
            <p className="text-gray-400 text-sm">#LetterboxdWrapped</p>
          </motion.div>
        </motion.div>
      </div>

      {/* Export Button */}
      <button
        onClick={exportAsImage}
        disabled={isExporting}
        className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-8 py-3 rounded-xl font-semibold hover:scale-105 transition-transform disabled:opacity-50"
      >
        <Download className="w-5 h-5" />
        <span>{isExporting ? 'Exporting...' : 'Download as PNG'}</span>
      </button>

      {/* Preview Info */}
      <div className="text-center text-gray-400 max-w-md">
        <p className="text-sm">
          This Instagram Story template (1080x1920) is ready to share! 
          The exported image will be high-resolution and perfect for Instagram Stories.
        </p>
      </div>
    </div>
  );
};

export default InstagramStoryTemplate;