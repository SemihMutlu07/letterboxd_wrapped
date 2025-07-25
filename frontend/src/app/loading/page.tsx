'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Loader, AlertTriangle } from 'lucide-react';

interface ProgressEvent {
  step: string;
  message: string;
  progress?: number;
  total?: number;
}

const movieFacts = [
  "The first movie to use CGI was Westworld in 1973.",
  "The 'Wilhelm scream' is a stock sound effect used in over 400 films.",
  "Toto's salary for The Wizard of Oz was $125 a week, while Judy Garland's was $500.",
  "The word 'mafia' is never said in The Godfather.",
  "Disneyland has a secret basketball court inside the Matterhorn."
];

export default function LoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [status, setStatus] = useState<ProgressEvent>({ step: 'INIT', message: 'Preparing your analysis...' });
  const [currentFact, setCurrentFact] = useState(movieFacts[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      router.push('/');
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const eventSource = new EventSource(`${backendUrl}/api/progress/${sessionId}`);

    eventSource.onmessage = (event) => {
      const data: ProgressEvent = JSON.parse(event.data);
      setStatus(data);

      if (data.step === 'COMPLETE') {
        setTimeout(() => {
          router.push(`/results?session=${sessionId}`);
        }, 2000); // Wait 2 seconds before redirecting
        eventSource.close();
      }

      if (data.step === 'ERROR') {
        setError(data.message);
        eventSource.close();
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      setError('A connection error occurred. Please try again.');
      eventSource.close();
    };

    const factInterval = setInterval(() => {
      setCurrentFact(movieFacts[Math.floor(Math.random() * movieFacts.length)]);
    }, 5000);

    return () => {
      eventSource.close();
      clearInterval(factInterval);
    };
  }, [sessionId, router]);

  const progressPercentage = (status.progress && status.total) 
    ? (status.progress / status.total) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center"
      >
        {error ? (
          <>
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Analysis Failed</h2>
            <p className="text-gray-300">{error}</p>
          </>
        ) : status.step === 'COMPLETE' ? (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">All Done!</h2>
            <p className="text-gray-300">Redirecting to your results...</p>
          </>
        ) : (
          <>
            <Loader className="w-16 h-16 text-orange-400 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-white mb-2">Analyzing Your Year in Film...</h2>
            
            <p className="text-gray-300 min-h-[40px]">{status.message}</p>
            
            {status.step === 'ENRICH' && status.progress && status.total && (
              <div className="w-full bg-white/20 rounded-full h-4 my-4">
                <motion.div 
                  className="bg-gradient-to-r from-orange-400 to-pink-500 h-4 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
            )}
            
            <div className="text-sm text-gray-400 mt-6 min-h-[40px]">
              <p>&quot;{currentFact}&quot;</p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
} 