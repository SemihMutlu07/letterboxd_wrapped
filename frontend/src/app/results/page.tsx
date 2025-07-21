'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Film, Star, Clock, TrendingUp } from 'lucide-react';

interface LetterboxdStats {
  totalFilms: number;
  averageRating: number;
  totalRuntime: number;
  topGenres: Array<{ name: string; count: number }>;
  topDirectors: Array<{ name: string; count: number }>;
  // Add more fields as we implement them
}

export default function ResultsPage() {
  const [stats, setStats] = useState<LetterboxdStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    // For now, let's simulate the data loading
    // Later this will fetch from our backend
    setTimeout(() => {
      setStats({
        totalFilms: 247,
        averageRating: 4.2,
        totalRuntime: 24580, // minutes
        topGenres: [
          { name: 'Drama', count: 89 },
          { name: 'Comedy', count: 56 },
          { name: 'Thriller', count: 43 },
          { name: 'Horror', count: 31 },
          { name: 'Romance', count: 28 }
        ],
        topDirectors: [
          { name: 'Christopher Nolan', count: 8 },
          { name: 'Quentin Tarantino', count: 7 },
          { name: 'Martin Scorsese', count: 6 },
          { name: 'Denis Villeneuve', count: 5 },
          { name: 'Jordan Peele', count: 4 }
        ]
      });
      setLoading(false);
    }, 2000);
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Analyzing Your Movies...</h2>
          <p className="text-gray-300">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Oops! Something went wrong</h2>
          <p className="text-gray-300">{error || 'Failed to load your stats'}</p>
        </div>
      </div>
    );
  }

  const hoursWatched = Math.round(stats.totalRuntime / 60);
  const daysWatched = Math.round(hoursWatched / 24 * 10) / 10;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              Your <span className="bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
                Letterboxd Wrapped
              </span>
            </h1>
            <p className="text-xl text-gray-300">Here's your movie year in numbers</p>
          </div>

          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-gradient-to-br from-pink-500 to-orange-500 p-6 rounded-2xl text-white">
              <Film className="w-8 h-8 mb-3" />
              <h3 className="text-3xl font-bold mb-1">{stats.totalFilms}</h3>
              <p className="text-sm opacity-90">Films Watched</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-6 rounded-2xl text-white">
              <Star className="w-8 h-8 mb-3" />
              <h3 className="text-3xl font-bold mb-1">{stats.averageRating}★</h3>
              <p className="text-sm opacity-90">Average Rating</p>
            </div>
            
            <div className="bg-gradient-to-br from-green-500 to-teal-500 p-6 rounded-2xl text-white">
              <Clock className="w-8 h-8 mb-3" />
              <h3 className="text-3xl font-bold mb-1">{hoursWatched}h</h3>
              <p className="text-sm opacity-90">{daysWatched} days of movies</p>
            </div>
            
            <div className="bg-gradient-to-br from-yellow-500 to-red-500 p-6 rounded-2xl text-white">
              <TrendingUp className="w-8 h-8 mb-3" />
              <h3 className="text-3xl font-bold mb-1">{stats.topGenres[0].name}</h3>
              <p className="text-sm opacity-90">Top Genre</p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Top Genres */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8">
              <h3 className="text-2xl font-bold text-white mb-6">Your Top Genres</h3>
              <div className="space-y-4">
                {stats.topGenres.map((genre, index) => (
                  <div key={genre.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-orange-400 font-bold">{index + 1}</span>
                      <span className="text-white">{genre.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-white/20 rounded-full h-2">
                        <div 
                          className="bg-orange-400 h-2 rounded-full" 
                          style={{width: `${(genre.count / stats.topGenres[0].count) * 100}%`}}
                        ></div>
                      </div>
                      <span className="text-gray-300 text-sm">{genre.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Directors */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8">
              <h3 className="text-2xl font-bold text-white mb-6">Your Favorite Directors</h3>
              <div className="space-y-4">
                {stats.topDirectors.map((director, index) => (
                  <div key={director.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-orange-400 font-bold">{index + 1}</span>
                      <span className="text-white">{director.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-white/20 rounded-full h-2">
                        <div 
                          className="bg-orange-400 h-2 rounded-full" 
                          style={{width: `${(director.count / stats.topDirectors[0].count) * 100}%`}}
                        ></div>
                      </div>
                      <span className="text-gray-300 text-sm">{director.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Share Section */}
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-6">Share Your Wrapped</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <button className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform">
                Instagram Story
              </button>
              <button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform">
                Twitter Card
              </button>
              <button className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform">
                Download PNG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}