'use client';
import { useEffect, useState } from 'react';
import { Film, X } from 'lucide-react';

const T = {
  darkblue: "#2776F5",
  paper: "#F1ECDE",
  card: "#FBF8EF",
  ink: "#100F0C",
  lime: "#AEE63E",
  amber: "#F2B33D",
  cyan: "#53CFE6",
  purple: "#A98BEA",
  red: "#E8463A",
  muted: "#6F6E63",
  darkamber: "#e16517",
  lines: "#cdcdcd"
};
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, "Cascadia Code", "Courier New", monospace';
const shadow = (n: number) => `${n}px ${n}px 0 ${T.ink}`;

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

type Props = {
  title?: string;
  message?: string;
  detail?: string;
  onCancel?: () => void;
  mode?: 'upload' | 'scrape';
  estimatedFilms?: number;
  /** Typical total duration in seconds (hardcoded or from historical data). */
  typicalSeconds?: number;
};

const FUN_MESSAGES = [
  "naber?",
  "The drama çok kötü değil miydi?",
  "500 film altında izleyenlerin sonuç ekranı gelmiyormuş doğru mu?",
  "2 cümleden fazla inceleme atıyor musun ona bakıyoruz.",
  "bu loading ekranına kaç kere baktın hadi söyle",
  "Her yıl aynı filmi 5 kere izleyenler kulübü başkanı mısın?",
  "Letterboxd'a film eklemek izlemekten daha eğlenceli geliyor sana da mı öyle?",
  "Şu ana kadar hiç 1 yıldız verdiğin film oldu mu?",
  "Enter the void mu izlesem yoksa 90 günlük yaz tatil mi?",
  "Senin favori filmine arkadaşın 'eh işte' dediğinde hissettiklerin.",
  "Daha önce bir filmi sırf posteri güzel diye izledin mi?",
  "3 saatlik filmleri 'bir ara izlerim' diye listeye eklemek.",
  "IMDb puanı 8 üstü olup da sevmediğin tek film hangisi?",
  "En çok hangi film için 'abartılıyor' dedin söyle.",
  "Letterboxd'da takip ettiğin ve her yorumuna katıldığın kişi kim?",
  "Bir filmi sırf popüler diye izlemeyenlerden misin yoksa tam tersi?",
  "Hangi filmi izlerken 'acaba bitse de uyusam' dedin?",
  "Hiç film arasında geçiş yapıp birini yarım bıraktın mı?",
  "Bir filmi en fazla kaç kere izledin?",
  "İzlediğin en kötü filmi savunabilir misin?",
  "Şu listendeki filmlerin yarısını izlememiş olman çok normal.",
  "Haftada 10 film izleyenler var, sen kaçtasın?",
  "Filmi başlatıp 10 dakikada kapatanlardan mısın?",
  "Bir film için 'bunu herkese izletmeliyim' dediğin anı hatırlıyor musun?",
  // Add more fun messages here
];

export default function LoadingScreen({
  title = 'Analyzing Your Films',
  message = 'Preparing files, running analysis, and building your results.',
  detail = "Large ZIP files can take a little longer. We'll redirect automatically.",
  onCancel,
  mode = 'upload',
  estimatedFilms,
  typicalSeconds,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [funMessageIndex, setFunMessageIndex] = useState(0);
  const isScrape = mode === 'scrape';

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isScrape) return;
    const interval = setInterval(() => {
      setFunMessageIndex((i) => (i + 1) % FUN_MESSAGES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isScrape]);

  const defaultTypical = isScrape ? 30 : 45;
  const typical = typicalSeconds ?? defaultTypical;
  const remaining = Math.max(0, typical - elapsed);
  const pct = Math.min(100, Math.round((elapsed / typical) * 100));

  const displayTitle = isScrape ? 'Scanning Your Profile' : title;
  const displayMessage = isScrape
    ? estimatedFilms && estimatedFilms > 0
      ? `Reading ${estimatedFilms.toLocaleString()} public films from Letterboxd...`
      : 'Reading your public Letterboxd diary and film list...'
    : message;
  const displayDetail = isScrape
    ? `Elapsed ${formatElapsed(elapsed)}. Most profiles finish in under a minute.`
    : `Elapsed ${formatElapsed(elapsed)}. Most exports finish in under a minute.`;

  return (
    <div style={{ minHeight: '100vh', background: T.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Giant rotating fun message — big, unexpected, attention-grabbing */}
      {isScrape && (
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <p
            key={funMessageIndex}
            style={{
              fontSize: 18,
              fontWeight: 600,
              fontStyle: 'italic',
              lineHeight: 1.4,
              letterSpacing: '0.02em',
              color: T.muted,
              transition: 'opacity 500ms'
            }}
          >
            {FUN_MESSAGES[funMessageIndex]}
          </p>
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', maxWidth: 600, textAlign: 'center', border: `2.5px solid ${T.ink}`, background: T.card, padding: 32, boxShadow: shadow(4) }}>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              position: 'absolute',
              right: 16,
              top: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: `2.5px solid ${T.ink}`,
              background: T.red,
              padding: '8px 12px',
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: T.ink,
              cursor: 'pointer',
              transition: 'all 90ms',
              boxShadow: shadow(2)
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.darkamber;
              e.currentTarget.style.boxShadow = shadow(3);
              e.currentTarget.style.transform = 'translate(-1px, -1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = T.red;
              e.currentTarget.style.boxShadow = shadow(2);
              e.currentTarget.style.transform = 'none';
            }}
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        )}

        <div style={{ margin: '0 auto 24px', height: 56, width: 56, border: `2.5px solid ${T.amber}`, background: T.amber + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Film style={{ height: 28, width: 28, color: T.amber, animation: 'pulse 2s ease-in-out infinite' }} />
        </div>
        <h1 style={{ fontSize: 36, fontFamily: SERIF, fontWeight: 900, color: T.ink, marginBottom: 12 }}>{displayTitle}</h1>
        <p style={{ fontSize: 16, color: T.ink, marginBottom: 8 }}>{displayMessage}</p>

        {isScrape && (
          <p style={{ marginBottom: 20, fontSize: 14, color: T.muted, fontStyle: 'italic', transition: 'opacity 500ms' }}>
            {FUN_MESSAGES[funMessageIndex]}
          </p>
        )}

        {/* Progress + remaining time */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            <span style={{ color: T.muted }}>Typical</span>
            <span style={{ color: T.ink }}>{formatElapsed(typical)}</span>
          </div>
          <div style={{ height: 8, border: `2.5px solid ${T.ink}`, background: T.paper, overflow: 'hidden', boxShadow: shadow(1) }}>
            <div
              style={{
                height: '100%',
                background: `linear-gradient(to right, ${T.amber}, ${T.darkamber}, ${T.amber})`,
                transition: 'width 1000ms',
                width: `${pct}%`
              }}
            />
          </div>
          {remaining > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              <span style={{ color: T.muted }}>Remaining (est.)</span>
              <span style={{ color: T.amber, fontWeight: 700 }}>{formatElapsed(remaining)}</span>
            </div>
          )}
          {remaining <= 0 && (
            <div style={{ fontSize: 11, textAlign: 'center', color: T.amber, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              Almost there... wrapping up
            </div>
          )}
        </div>

        <p style={{ fontSize: 14, color: T.muted, marginTop: 16 }}>{displayDetail}</p>

        {elapsed > typical && (
          <p style={{ marginTop: 12, fontSize: 11, color: T.amber, animation: 'pulse 2s ease-in-out infinite', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            Having a little trouble — bigger libraries can take a bit longer. Hang tight.
          </p>
        )}
      </div>
    </div>
  );
}
