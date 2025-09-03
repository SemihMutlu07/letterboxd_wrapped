import React, { useState, useEffect } from 'react';
import { testBackend } from '@/lib/api';

const BackendStatus: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const checkBackend = async () => {
      try {
        await testBackend();
        setStatus('connected');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    checkBackend();
  }, []);

  if (status === 'checking') {
    return (
      <div className="fixed top-4 right-4 bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm">
        🔄 Checking backend...
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div className="fixed top-4 right-4 bg-green-500 text-white px-3 py-2 rounded-lg text-sm">
        ✅ Backend connected
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 bg-red-500 text-white px-3 py-2 rounded-lg text-sm max-w-xs">
      ❌ Backend error: {error}
    </div>
  );
};

export default BackendStatus;
