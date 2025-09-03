'use client';

import { useState } from 'react';
// import { healthCheck } from '@/lib/api';

export default function TestPage() {
  const [result, setResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const testBackend = async () => {
    setLoading(true);
    try {
      // const response = await healthCheck();
      setResult({ ok: true, message: 'Health check disabled' });
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Backend Connectivity Test</h1>
        
        <button
          onClick={testBackend}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
        >
          {loading ? 'Testing...' : 'Test Backend Connection'}
        </button>

        {result && (
          <div className="mt-8 p-4 bg-gray-800 rounded">
            <h2 className="text-xl font-semibold mb-4">Result:</h2>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-800 rounded">
          <h2 className="text-xl font-semibold mb-4">Environment Info:</h2>
          <p><strong>API_BASE:</strong> {process.env.NEXT_PUBLIC_API_BASE || 'Not set'}</p>
          <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
        </div>
      </div>
    </div>
  );
}
