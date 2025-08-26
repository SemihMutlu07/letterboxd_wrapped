  'use client';

  import { useRouter, useSearchParams } from 'next/navigation';
  import { useEffect, useState, Suspense, useMemo } from 'react';
  import { motion, AnimatePresence, LazyMotion, domAnimation, useReducedMotion } from 'framer-motion';
  import { CheckCircle, AlertTriangle, Film, BarChart2, Star, Users, Globe, Languages, Calendar as CalendarIcon, Clapperboard, Server } from 'lucide-react';
  import ConsentModal from '@/components/ConsentModal';

  interface RawProgressEvent {
    message: string;
  }

  // Trivia removed (unused)

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
    // Removed unused icon state
    const [completedStages, setCompletedStages] = useState<string[]>([]);
    const [discoveries, setDiscoveries] = useState<{ type: 'insight' | 'warning' | 'achievement' | 'fun_fact'; message: string; icon: React.ReactNode; timestamp: number }[]>([]);
    // const [trivia, setTrivia] = useState<string>(triviaSeed[0]);
    const [error, setError] = useState<string | null>(null);
    const [processingSpeed, setProcessingSpeed] = useState<'normal' | 'slow'>('normal');
    // const [filmCount, setFilmCount] = useState<number | null>(null);
    const [consentOpen, setConsentOpen] = useState(false);
    const reduce = useReducedMotion();

    // Narrative beats
    const stageNarratives = useMemo(() => ({
      0: "Let's see what stories you've collected...",
      20: 'Interesting... you have quite the collection here...',
      40: 'Patterns emerging. Directors leaving their mark... ',
      60: 'Your taste is getting clearer. Distinct, bold.',
      80: 'Almost there. The picture is becoming clear...',
      95: 'Final touches on your cinematic portrait...',
      100: 'Your year in film is ready. Lights up.'
    }), []);

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
          const { friendlyMessage, progress } = parseProgress('📊 complete: Analysis complete! Returning stats. (1/1)');
          
          setMessage(friendlyMessage);
          setProgress(progress);
          
          setCompletedStages(prev => [...prev, 'Finalizing']);
          // Consent gate: show modal before navigating to results
          const gateSeen = sessionStorage.getItem('consentGateSeen');
          if (gateSeen === '1') {
            setTimeout(() => { router.push(`/results?session=${sessionId}`); }, 1200);
          } else {
            setConsentOpen(true);
          }
          eventSource.close();
          return;
        }
        
        const { stage, friendlyMessage, progress: newProgress } = parseProgress(rawData.message);
        
        setMessage(friendlyMessage);
        setProgress(newProgress);
        
        
        if (stage !== currentStage && !completedStages.includes(stage)) {
          setCompletedStages(prev => [...prev, stage]);
          setCurrentStage(stage);
        }

        // Create small discoveries from the message content
        const now = Date.now();
        if (friendlyMessage.toLowerCase().includes('genre')) {
          setDiscoveries(prev => [...prev.slice(-6), { type: 'insight', message: 'Mapping your top genres...', icon: <Clapperboard size={16} />, timestamp: now }]);
        }
        if (friendlyMessage.toLowerCase().includes('director')) {
          setDiscoveries(prev => [...prev.slice(-6), { type: 'insight', message: 'Auteur detection in progress…', icon: <Users size={16} />, timestamp: now }]);
        }
        if (friendlyMessage.toLowerCase().includes('analyzing')) {
          setDiscoveries(prev => [...prev.slice(-6), { type: 'fun_fact', message: 'Reading your reels… counting frames…', icon: <Film size={16} />, timestamp: now }]);
        }
      };

      eventSource.onerror = (err) => {
        if (process.env.NODE_ENV !== 'production') console.error('EventSource failed:', err);
        setError('A connection error occurred. Please check your connection and try again.');
        eventSource.close();
      };

      const speedTimer = setTimeout(() => setProcessingSpeed('slow'), 20000);

      return () => {
        eventSource.close();
        clearTimeout(speedTimer);
      };
    }, [sessionId, router, currentStage, completedStages]);

    return (
      <div className="min-h-screen text-white flex items-center justify-center p-0 font-sans relative overflow-hidden"
        style={{ background: 'radial-gradient(80% 60% at 50% 10%, rgba(139,0,0,0.25), transparent), #1a0505' }}
      >
        <ConsentModal
          open={consentOpen}
          onAccept={(choices) => {
            sessionStorage.setItem('consentGateSeen', '1');
            sessionStorage.setItem('consentChoices', JSON.stringify(choices));
            router.push(`/results?session=${sessionId}`);
          }}
          onSkip={() => {
            sessionStorage.setItem('consentGateSeen', '1');
            router.push(`/results?session=${sessionId}`);
          }}
        />
        {/* Film grain and vignette */}
        <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 300px rgba(0,0,0,0.8)' }} />
        <div className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100%25\' height=\'100%25\'%3E%3Cfilter id=\'g\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/feFilter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23g)\'/%3E%3C/svg%3E")' }} />
        {/* Dust particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i} className="absolute block w-[2px] h-[2px] bg-white/40 rounded-full"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `float ${8 + Math.random() * 12}s linear infinite`,
                animationDelay: `${Math.random() * 5}s`,
                opacity: 0.5
              }}
            />
          ))}
        </div>
        <motion.div 
          initial={reduce ? undefined : { opacity: 0, scale: 0.95 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={reduce ? undefined : { duration: 0.5 }}
          className="w-full max-w-5xl bg-black/30 backdrop-blur-xl rounded-[28px] p-6 md:p-10 shadow-2xl border border-white/10 mx-4"
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
                {/* Header */}
                <div className="text-center mb-4 md:mb-6">
                  <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">Developing Your Film Reel</h1>
                  <p className="text-red-200/90 md:text-red-200 mt-1">Darkroom active — please keep still.</p>
                </div>

                {/* Speed/Warning */}
                {processingSpeed === 'slow' && (
                  <div className="text-sm bg-red-900/40 border border-red-800/40 rounded-xl p-3 mb-4">
                    ⚠️ Large library detected — this might take a moment.
                  </div>
                )}

                {/* Film Strip Development (desktop only) */}
                <div className="hidden md:block relative overflow-hidden rounded-2xl border border-red-800/30 bg-black/30 p-4">
                  <div className="grid grid-cols-6 gap-3">
                    {['Opening the Vault','Reading the Reels','Auteur Detection','Genre Mapping','World Tour','Final Touches'].map((title, idx) => {
                      const pct = Math.round(progress);
                      const developed = pct >= (idx + 1) * 16;
                      return (
                        <div key={idx} className={`relative aspect-[3/4] rounded-lg overflow-hidden ring-1 ${developed ? 'ring-red-400/50' : 'ring-white/10'} bg-gradient-to-b from-red-900/40 to-black`}>
                          <div className={`absolute inset-0 ${developed ? 'opacity-100' : 'opacity-20'} transition-opacity duration-700`} style={{ backgroundImage: 'linear-gradient(transparent 75%, rgba(0,0,0,0.8))' }} />
                          <div className="absolute bottom-2 left-2 right-2 text-[10px] uppercase tracking-widest text-red-200/80">{title}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Sprockets */}
                  <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-b from-black to-red-950" />
                  <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-b from-black to-red-950" />
                </div>

                {/* Live Discovery Feed (collapsed on mobile) */}
                <div className="mt-4 md:mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="hidden md:block bg-black/30 rounded-xl border border-white/10 p-4">
                    <div className="text-xs uppercase tracking-widest text-red-200/70 mb-2">Live Discoveries</div>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      <AnimatePresence initial={false}>
                        {discoveries.slice(-6).map(d => (
                          <motion.div key={d.timestamp}
                            initial={reduce ? undefined : { opacity: 0, y: 8 }}
                            animate={reduce ? undefined : { opacity: 1, y: 0 }}
                            exit={reduce ? undefined : { opacity: 0, y: -8 }}
                            className="text-sm text-red-100/90 flex items-center gap-2"
                          >
                            {d.icon}<span>{d.message}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="hidden md:flex bg-black/30 rounded-xl border border-white/10 p-4 flex-col">
                    <div className="text-xs uppercase tracking-widest text-red-200/70 mb-2">Darkroom Notes</div>
                    <AnimatePresence mode="wait">
                      <motion.div key={currentStage}
                        initial={reduce ? undefined : { opacity: 0, y: 20, filter: 'blur(10px)' }}
                        animate={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={reduce ? undefined : { opacity: 0, y: -20, filter: 'blur(10px)' }}
                        className="text-sm text-red-100/90"
                        aria-live="polite"
                      >
                        {message}
                      </motion.div>
                    </AnimatePresence>
                    <div className="text-xs text-red-300/70 mt-2">{stageNarratives[Math.floor(progress / 20) * 20 as 0|20|40|60|80|100]}</div>
                  </div>
                </div>

                {/* Compact live line for mobile */}
                <div className="md:hidden mt-3 text-center text-sm text-red-200/90" aria-live="polite">
                  {message} • {Math.min(100, Math.max(0, Math.round(progress)))}%
                </div>

                {/* Segmented progress and ETA */}
                <div className="mt-4 md:mt-6">
                  <div className="grid grid-cols-2 gap-2 text-[11px] mb-1 text-red-200">
                    <div>Metadata</div>
                    <div>Analysis</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-3 md:h-2 rounded bg-red-950/60 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, Math.round(progress)))}><div className="h-full bg-red-500" style={{ width: `${Math.min(progress, 20) * 5}%` }} /></div>
                    <div className="h-3 md:h-2 rounded bg-red-950/60 overflow-hidden"><div className="h-full bg-red-400" style={{ width: `${progress > 20 ? ((progress - 20) / 80) * 100 : 0}%` }} /></div>
                  </div>
                  <div className="mt-2 text-right text-xs text-red-200">~ {Math.max(0, Math.round((100 - progress) / 2))} seconds remaining</div>
                </div>

                {/* Technical details collapsible */}
                <details className="mt-6 text-sm text-red-100/90">
                  <summary className="cursor-pointer select-none text-red-200/80">🤓 Show nerdy details</summary>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {[message, ...discoveries.map(d => d.message)].slice(0, 10).map((m, i) => (
                      <div key={i} className="opacity-90">• {m}</div>
                    ))}
                  </div>
                </details>

                {/* Skeleton preview when close to done (desktop only) */}
                {progress > 60 && (
                  <div className="hidden md:block mt-6 bg-black/30 border border-white/10 rounded-xl p-4">
                    <div className="text-xs uppercase tracking-widest text-red-200/70 mb-2">Preview</div>
                    <div className="opacity-60 blur-sm" style={{ opacity: progress / 100 }}>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-16 bg-white/10 rounded" />
                        <div className="h-16 bg-white/10 rounded" />
                        <div className="h-16 bg-white/10 rounded" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Abort / fallback */}
                {progress > 30 && (
                  <div className="mt-6 text-center">
                    <button className="px-4 py-2 rounded-md bg-red-700/70 border border-red-500/40 text-white text-sm">
                      Skip detailed analysis — get basic stats now
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  export default function LoadingPage() {
    return (
      <LazyMotion features={domAnimation}>
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
      </LazyMotion>
    );
  }