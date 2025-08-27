"use client";

import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { MessageSquare, X, Upload, CheckCircle } from 'lucide-react';
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

  const [showSuccessToast, setShowSuccessToast] = React.useState(false);
  const [, setSuccess] = React.useState(false);

  const MAX_CHARACTERS = 500;
  const characterCount = text.length;
  const isOverLimit = characterCount > MAX_CHARACTERS;

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
    if (isOverLimit) {
      setError('Mesaj çok uzun. Lütfen 500 karakterden az yazın.');
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
    
    // Track feedback submission
    // trackEvent('feedback_submitted', { // TODO: Re-enable when analytics is ready
    //   type,
    //   include_names: includeNames,
    //   message_length: text.length
    // });
    
    setSuccess(true);
    setShowSuccessToast(true);
    
    // Auto-close panel after success
    setTimeout(() => {
      setOpen(false);
      setShowSuccessToast(false);
      setSuccess(false);
      setText('');
    }, 1200);
    
    setIsSubmitting(false);
  };

  return (
    <>
      <button
        aria-label="Feedback"
        onClick={() => {
          setOpen(true);
          // trackAnalyticsEvent('feedback_open'); // TODO: Re-enable when analytics is ready
        }}
        disabled={isSubmitting}
        className={`fixed bottom-4 right-4 z-40 min-h-[44px] rounded-full text-white font-semibold px-4 py-2 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 transition-all duration-200 ${
          isSubmitting 
            ? 'bg-orange-400 cursor-not-allowed scale-95' 
            : 'bg-orange-500 hover:bg-orange-600 hover:scale-105'
        }`}
      >
        {isSubmitting ? (
          <div className="inline-block mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <MessageSquare className="inline-block mr-2" size={18} />
        )}
        {isSubmitting ? 'Gönderiliyor...' : 'Geri Bildirim'}
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
                             <div className="relative">
                 <textarea
                   value={text}
                   onChange={(e) => setText(e.target.value)}
                   placeholder="Açıklama..."
                   disabled={isSubmitting}
                   className={`w-full min-h-[120px] rounded-xl bg-slate-800 border p-3 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 transition-all duration-200 ${
                     isOverLimit 
                       ? 'border-red-500 focus-visible:ring-red-400/60' 
                       : 'border-slate-700 focus:border-orange-400'
                   } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                 />
                 <div className={`absolute bottom-2 right-2 text-xs font-medium ${
                   isOverLimit ? 'text-red-400' : 'text-slate-400'
                 }`}>
                   {characterCount}/{MAX_CHARACTERS}
                 </div>
               </div>
                             <label className="flex items-center gap-2 text-sm">
                 <input 
                   type="checkbox" 
                   checked={attachDiag} 
                   onChange={(e)=>setAttachDiag(e.target.checked)}
                   disabled={isSubmitting}
                   className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-400/60"
                 />
                 Tanı paketini ekle ({sessionId ?? 'no-session'})
               </label>
               <label className="flex items-center gap-2 text-sm">
                 <input 
                   type="checkbox" 
                   checked={includeNames} 
                   onChange={(e)=>setIncludeNames(e.target.checked)}
                   disabled={isSubmitting}
                   className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-400/60"
                 />
                 İsim/geçmiş içerebilir (opsiyonel)
               </label>
               {error && (
                 <div className="text-sm text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg p-2">
                   {error}
                 </div>
               )}
                             <div className="flex items-center justify-end gap-2">
                 <button 
                   className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 transition-colors" 
                   onClick={()=>setOpen(false)}
                   disabled={isSubmitting}
                 >
                   İptal
                 </button>
                 <button 
                   disabled={isSubmitting || isOverLimit || !text.trim()} 
                   onClick={handleSubmit} 
                   className={`px-4 py-2 rounded-xl text-white font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 transition-all duration-200 ${
                     isSubmitting || isOverLimit || !text.trim()
                       ? 'bg-orange-400 cursor-not-allowed opacity-50' 
                       : 'bg-orange-500 hover:bg-orange-600 hover:scale-105'
                   }`}
                 >
                   {isSubmitting ? (
                     <>
                       <div className="inline-block mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                       Gönderiliyor...
                     </>
                   ) : (
                     <>
                       <Upload className="inline-block mr-2" size={16} />
                       Gönder
                     </>
                   )}
                 </button>
               </div>
            </div>
          </div>
                 </div>
       )}

       {/* Success Toast */}
       {showSuccessToast && (
         <div className="fixed bottom-20 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg border border-green-500/30 animate-in slide-in-from-bottom-2 duration-300">
           <div className="flex items-center gap-2">
             <CheckCircle className="w-5 h-5" />
             <span className="font-medium">Geri bildirim gönderildi!</span>
           </div>
         </div>
       )}
     </>
   );
 }
