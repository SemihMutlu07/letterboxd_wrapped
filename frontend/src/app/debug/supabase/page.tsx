'use client';
import { getSupabase } from '@/lib/supabaseClient';
import { ensureSessionId, getUsername, setUsername, setConsent } from '@/lib/session-id';
import { upsertUserSession } from '@/lib/supabase/sessions';
import { startAnalysis, finishAnalysis } from '@/lib/supabase/analysis_runs';
import { insertFeedback } from '@/lib/supabase/feedback';

export default function Page() {
  async function checkTables() {
    const sb = getSupabase();
    const checks = [
      sb.from('user_sessions').select('session_id', { head: true, count: 'exact' }),
      sb.from('analysis_runs').select('id', { head: true, count: 'exact' }),
      sb.from('feedback').select('id', { head: true, count: 'exact' }),
    ];
    const res = await Promise.allSettled(checks);
    console.log('📊 Table checks:', res);
    alert('Open console for table check results');
  }

  async function testUserSession() {
    try {
      const sessionId = ensureSessionId();
      setUsername('test-user');
      setConsent('accept');
      
      await upsertUserSession({
        session_id: sessionId,
        username: 'test-user',
        consent: 'accept',
        film_count: 100,
        favorite_genre: 'Drama',
      });
      
      alert('✅ User session test successful');
    } catch (error) {
      console.error('❌ User session test failed:', error);
      alert('❌ User session test failed - check console');
    }
  }

  async function testAnalysisRun() {
    try {
      const sessionId = ensureSessionId();
      const username = getUsername() || 'test-user';
      const runId = crypto?.randomUUID?.();
      
      // Start
      await startAnalysis({
        id: runId,
        session_id: sessionId,
        username: username,
      });
      
      // Finish
      await finishAnalysis({
        id: runId!,
        ok: true,
        summary: { test: true },
      });
      
      alert('✅ Analysis run test successful');
    } catch (error) {
      console.error('❌ Analysis run test failed:', error);
      alert('❌ Analysis run test failed - check console');
    }
  }

  async function testFeedback() {
    try {
      const sessionId = ensureSessionId();
      const username = getUsername() || 'test-user';
      
      await insertFeedback({
        session_id: sessionId,
        username: username,
        contact: 'test@example.com',
        message: 'Test feedback message',
        os: 'Windows',
        device_type: 'desktop',
      });
      
      alert('✅ Feedback test successful');
    } catch (error) {
      console.error('❌ Feedback test failed:', error);
      alert('❌ Feedback test failed - check console');
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Supabase Debug Page</h1>
      
      <div className="space-y-4 max-w-md">
        <button 
          onClick={checkTables} 
          className="w-full px-4 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          Check Table Access
        </button>
        
        <button 
          onClick={testUserSession} 
          className="w-full px-4 py-3 rounded bg-green-600 hover:bg-green-700 text-white font-medium"
        >
          Test User Session
        </button>
        
        <button 
          onClick={testAnalysisRun} 
          className="w-full px-4 py-3 rounded bg-purple-600 hover:bg-purple-700 text-white font-medium"
        >
          Test Analysis Run
        </button>
        
        <button 
          onClick={testFeedback} 
          className="w-full px-4 py-3 rounded bg-orange-600 hover:bg-orange-700 text-white font-medium"
        >
          Test Feedback
        </button>
      </div>
      
      <div className="mt-8 text-sm text-slate-400">
        <p>Session ID: {ensureSessionId()}</p>
        <p>Username: {getUsername() || 'Not set'}</p>
      </div>
    </div>
  );
}
