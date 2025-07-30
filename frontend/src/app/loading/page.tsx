'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, Film, BarChart2, Star, Users, Globe, Languages, Calendar as CalendarIcon, Clapperboard, Server } from 'lucide-react';

interface RawProgressEvent {
  message: string;
}

const movieQuotes = [
  "I'm going to make him an offer he can't refuse.",
  "May the Force be with you.",
  "Here's looking at you, kid.",
  "I'll be back.",
  "You can't handle the truth!",
  "Houston, we have a problem.",
  "There's no place like home.",
  "The first rule of Fight Club is: You do not talk about Fight Club.",
  "To infinity and beyond!",
  "Keep your friends close, but your enemies closer."
];

const friendlyMessages: { [key: string]: string } = {
  tmdb_metadata: 'Collecting movie metadata...',
  analyzing: 'Generating comprehensive statistics...',
  'Basic stats': 'Analyzing your watch patterns...',
  'Rating analysis': 'Crunching the ratings...',
  'Runtime analysis': 'Calculating total watch time...',
  'Director analysis': 'Investigating your favorite directors...',
  'Genre analysis': 'Exploring your top genres...',
  'Decade analysis': 'Traveling through film history...',
  'Country analysis': 'Mapping your cinematic world...',
  'Language analysis': 'Tuning into languages...',
  'Cast analysis': 'Assembling your favorite cast...',
  'Analysis complete!': 'Finalizing your results...',
  complete: 'All done! Get ready for your results.'
};

const stageIcons: { [key: string]: React.ReactNode } = {
  tmdb_metadata: <Server size={18} />,
  analyzing: <BarChart2 size={18} />,
  'Basic stats': <Film size={18} />,
  'Rating analysis': <Star size={18} />,
  'Runtime analysis': <Clapperboard size={18} />,
  'Director analysis': <Users size={18} />,
  'Genre analysis': <BarChart2 size={18} />,
  'Decade analysis': <CalendarIcon size={18} />,
  'Country analysis': <Globe size={18} />,
  'Language analysis': <Languages size={18} />,
  'Cast analysis': <Users size={18} />,
  'Analysis complete!': <CheckCircle size={18} />,
  complete: <CheckCircle size={18} />
};

const parseProgress = (message: string): { stage: string; friendlyMessage: string; progress: number, icon: React.ReactNode } => {
  const match = message.match(/📊\s*([^:]+):\s*(.*?)\s*\((\d+)\/(\d+)\)/);
  if (match) {
    const [, key, msg, current, total] = match;
    const stage = key.trim();
    const subStage = msg.replace('complete', '').trim();
    
    let friendlyMessage = friendlyMessages[subStage] || friendlyMessages[stage] || msg;
    const icon = stageIcons[subStage] || stageIcons[stage] || <BarChart2 size={18} />;

    const baseProgress = stage === 'tmdb_metadata' ? 0 : 20;
    const stageProgress = stage === 'tmdb_metadata' ? 20 : 80;

    let progress = baseProgress + ((parseInt(current) / parseInt(total)) * stageProgress);

    if (stage === 'complete') {
      progress = 100;
      friendlyMessage = friendlyMessages.complete;
    }
    
    return { stage: subStage || stage, friendlyMessage, progress, icon };
  }

  // Fallback for initial or non-matching messages
  return { stage: 'Initializing', friendlyMessage: 'Preparing your cinematic review...', progress: 0, icon: <Film size={18} /> };
};


function LoadingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [currentStage, setCurrentStage] = useState('Initializing');
  const [message, setMessage] = useState('Preparing your cinematic review...');
  const [progress, setProgress] = useState(0);
  const [currentIcon, setCurrentIcon] = useState<React.ReactNode>(<Film size={18} />);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [currentQuote, setCurrentQuote] = useState(movieQuotes[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      router.push('/');
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const eventSource = new EventSource(`${backendUrl}/api/progress/${sessionId}`);

    eventSource.onmessage = (event) => {
      const rawData: RawProgressEvent = JSON.parse(event.data);

      if (rawData.message.includes('ERROR')) {
        setError(rawData.message.replace('ERROR:', '').trim());
        eventSource.close();
        return;
      }
      
      if (rawData.message.includes('Analysis complete! Returning stats.')) {
        const { friendlyMessage, progress, icon } = parseProgress('📊 complete: Analysis complete! Returning stats. (1/1)');
        
        setMessage(friendlyMessage);
        setProgress(progress);
        setCurrentIcon(icon);
        setCompletedStages(prev => [...prev, 'Finalizing']);
        
        setTimeout(() => {
          router.push(`/results?session=${sessionId}`);
        }, 1500);
        eventSource.close();
        return;
      }
      
      const { stage, friendlyMessage, progress: newProgress, icon } = parseProgress(rawData.message);
      
      setMessage(friendlyMessage);
      setProgress(newProgress);
      setCurrentIcon(icon);
      
      if (stage !== currentStage && !completedStages.includes(stage)) {
        setCompletedStages(prev => [...prev, stage]);
        setCurrentStage(stage);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      setError('A connection error occurred. Please check your connection and try again.');
      eventSource.close();
    };

    const quoteInterval = setInterval(() => {
      setCurrentQuote(movieQuotes[Math.floor(Math.random() * movieQuotes.length)]);
    }, 5000);

    return () => {
      eventSource.close();
      clearInterval(quoteInterval);
    };
  }, [sessionId, router, currentStage, completedStages]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-2xl border border-white/10"
      >
        <AnimatePresence>
          {error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-white mb-3">Analysis Failed</h2>
              <p className="text-slate-300 text-lg">{error}</p>
            </motion.div>
          ) : progress === 100 ? (
            <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-6 animate-pulse" />
              <h2 className="text-4xl font-extrabold text-white mb-3">All Done!</h2>
              <p className="text-slate-300 text-xl">Preparing your cinematic universe...</p>
            </motion.div>
          ) : (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                  Your <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">Letterboxd</span> Wrapped
                </h1>
                <p className="text-slate-300 text-lg mt-3">Please wait while we analyze your film history...</p>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="w-full bg-slate-700/50 rounded-full h-3.5">
                  <motion.div 
                    className="bg-gradient-to-r from-purple-500 to-orange-500 h-3.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
                <div className="flex justify-between text-sm font-medium text-slate-400 mt-2">
                  <div className="flex items-center gap-2">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={message}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-2"
                      >
                         {currentIcon}
                         <span>{message}</span>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <span className="font-bold text-white">{Math.round(progress)}%</span>
                </div>
              </div>
              
              {/* Animated Quote */}
              <div className="text-center bg-black/20 p-4 rounded-xl mt-10 min-h-[60px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentQuote}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5 }}
                    className="text-slate-300 italic text-md"
                  >
                    &quot;{currentQuote}&quot;
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default function LoadingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Clapperboard className="w-16 h-16 text-orange-400 mx-auto mb-4 animate-spin" />
          <h2 className="text-2xl font-bold">Loading...</h2>
        </div>
      </div>
    }>
      <LoadingContent />
    </Suspense>
  );
}