"use client";

import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { MessageSquare, X, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface FeedbackFabProps {
  sessionId?: string | null;
}

export default function FeedbackFab({ sessionId }: FeedbackFabProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<'bug' | 'idea' | 'general'>('bug');
  const [text, setText] = React.useState('');
  const [attachDiag, setAttachDiag] = React.useState(true);
  const [includeNames, setIncludeNames] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const resolvedSessionId = React.useMemo(() => {
    if (sessionId !== undefined) return sessionId;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('session');
    }
    return null;
  }, [sessionId]);

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError('Lütfen bir mesaj yazın');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    const payload: {
      session_id: string | null;
      message: string;
      include_names: boolean;
      user_agent: string | null;
      path: string | null;
    } = {
      session_id: resolvedSessionId ?? null,
      message: text,
      include_names: includeNames,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      path: typeof location !== 'undefined' ? location.pathname : null,
    };

    const { data, error } = await supabase
      .from('feedback')
      .insert(payload)
      .select('id,created_at')
      .single();

    if (error) {
      setError('Gönderilemedi, tekrar deneyin');
      setIsSubmitting(false);
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.info('[feedback] inserted', data?.id, data?.created_at);
    }
    setSuccess(true);
    setText('');
    setIsSubmitting(false);
  };

  return (
    <>
      <button
        aria-label="Feedback"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 min-h-[44px] rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
      >
        <MessageSquare className="inline-block mr-2" size={18} /> Geri Bildirim
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className={`absolute bottom-0 right-0 left-0 mx-auto max-w-xl rounded-t-2xl bg-slate-900 text-white border-t border-slate-700/60 p-4 shadow-2xl ${reduce ? '' : 'transition-transform'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Geri Bildirim</h3>
              <button aria-label="Close" className="p-2 rounded-md hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex gap-2">
                {(['bug','idea','general'] as const).map(v => (
                  <button key={v} onClick={() => setType(v)} className={`px-3 py-1.5 rounded-full text-sm border ${type===v? 'bg-orange-500 text-white border-orange-400' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
                    {v === 'bug' ? 'Hata' : v === 'idea' ? 'Öneri' : 'Genel'}
                  </button>
                ))}
              </div>
              <textarea
                value={text}
                onChange={(e)=>setText(e.target.value)}
                placeholder="Açıklama..."
                className="w-full min-h-28 rounded-lg bg-slate-800 border border-slate-700 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={attachDiag} onChange={(e)=>setAttachDiag(e.target.checked)} />
                Tanı paketini ekle ({sessionId ?? 'no-session'})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeNames} onChange={(e)=>setIncludeNames(e.target.checked)} />
                İsim/geçmiş içerebilir (opsiyonel)
              </label>
              {error && <div className="text-sm text-red-400">{error}</div>}
              {success && <div className="text-sm text-green-400">Gönderildi!</div>}
              <div className="flex items-center justify-end gap-2">
                <button className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60" onClick={()=>setOpen(false)}>İptal</button>
                <button disabled={isSubmitting} onClick={handleSubmit} className={`px-4 py-2 rounded-xl text-white font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 ${isSubmitting? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}>
                  <Upload className="inline-block mr-2" size={16} /> {isSubmitting? 'Gönderiliyor...' : 'Gönder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
