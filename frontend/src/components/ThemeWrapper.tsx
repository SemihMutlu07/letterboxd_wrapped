'use client';

/**
 * ThemeWrapper — applies theme CSS variables, background, overlays,
 * and injects CSS override rules that restyle ALL existing components
 * (HeroStats, Genres, etc.) without modifying them individually.
 */

import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '@/lib/theme';

/** Generate CSS override rules for the given theme. */
function themeCss(themeId: string): string {
  if (themeId === 'current') return '';

  const isVhs = themeId === 'vhs';
  const isBw = themeId === 'classic-bw';

  // Shared overrides for both non-current themes
  const sharedSurfaceBg = isVhs ? '#2a1a10' : '#2a2a2a';
  const sharedBorder = isVhs ? 'rgba(212,149,90,0.25)' : 'rgba(255,255,255,0.10)';
  const sharedText = isVhs ? '#f0e6d8' : '#e8e0d8';
  const sharedMuted = isVhs ? '#d4955a' : '#8a8a8a';
  const sharedMuted2 = isVhs ? '#b07a40' : '#6a6a6a';
  const sharedRadius = isVhs ? '10px' : '4px';

  // Color-specific stat card overrides (QuickFacts, etc.)
  const colorReplacements = isVhs
    ? {
        emerald: { bg: 'rgba(212,149,90,0.12)', border: 'rgba(212,149,90,0.25)', text: '#d4955a', text2: '#d4955a' },
        purple: { bg: 'rgba(212,149,90,0.08)', border: 'rgba(212,149,90,0.18)', text: '#b07a40', text2: '#b07a40' },
        yellow: { bg: 'rgba(212,149,90,0.10)', border: 'rgba(212,149,90,0.20)', text: '#d4955a', text2: '#d4955a' },
        cyan: { bg: 'rgba(212,149,90,0.08)', border: 'rgba(212,149,90,0.18)', text: '#b07a40', text2: '#b07a40' },
        orange: { bg: 'rgba(212,149,90,0.12)', border: 'rgba(212,149,90,0.25)', text: '#d4955a', text2: '#d4955a' },
        fuchsia: { bg: 'rgba(212,149,90,0.08)', border: 'rgba(212,149,90,0.18)', text: '#b07a40', text2: '#b07a40' },
        pink: { bg: 'rgba(212,149,90,0.10)', border: 'rgba(212,149,90,0.20)', text: '#d4955a', text2: '#d4955a' },
        rose: { bg: 'rgba(212,149,90,0.10)', border: 'rgba(212,149,90,0.20)', text: '#d4955a', text2: '#d4955a' },
        blue: { bg: 'rgba(212,149,90,0.08)', border: 'rgba(212,149,90,0.18)', text: '#b07a40', text2: '#b07a40' },
      }
    : isBw
    ? {
        emerald: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#c0b8b0', text2: '#c0b8b0' },
        purple: { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', text: '#8a8a8a', text2: '#8a8a8a' },
        yellow: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#c0b8b0', text2: '#c0b8b0' },
        cyan: { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', text: '#8a8a8a', text2: '#8a8a8a' },
        orange: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#c0b8b0', text2: '#c0b8b0' },
        fuchsia: { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', text: '#8a8a8a', text2: '#8a8a8a' },
        pink: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#c0b8b0', text2: '#c0b8b0' },
        rose: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#c0b8b0', text2: '#c0b8b0' },
        blue: { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', text: '#8a8a8a', text2: '#8a8a8a' },
      }
    : {};

  // Build color replacement CSS
  let colorCss = '';
  for (const [name, cols] of Object.entries(colorReplacements)) {
    colorCss += `
  [data-theme="${themeId}"] [class*="bg-${name}-500\\/10"],
  [data-theme="${themeId}"] [class*="bg-${name}-500\\/20"] { background: ${cols.bg} !important; }
  [data-theme="${themeId}"] [class*="border-${name}-500\\/20"],
  [data-theme="${themeId}"] [class*="border-${name}-500\\/30"] { border-color: ${cols.border} !important; }
  [data-theme="${themeId}"] .text-${name}-200 { color: ${cols.text2} !important; }
  [data-theme="${themeId}"] .text-${name}-400,
  [data-theme="${themeId}"] .text-${name}-500 { color: ${cols.text} !important; }
  [data-theme="${themeId}"] [class*="text-${name}-500"] { color: ${cols.text} !important; }`;
  }

  return `
/* ── Theme: ${themeId} ── */

/* Backgrounds */
[data-theme="${themeId}"] [class*="bg-slate-800"],
[data-theme="${themeId}"] [class*="bg-slate-900"] {
  background: ${sharedSurfaceBg} !important;
}
[data-theme="${themeId}"] [class*="bg-slate-700"] {
  background: ${isVhs ? '#1a0a08' : '#3a3a3a'} !important;
}

/* Borders */
[data-theme="${themeId}"] [class*="border-slate-"],
[data-theme="${themeId}"] [class*="border-white/"],
[data-theme="${themeId}"] [class*="border-white\\/"] {
  border-color: ${sharedBorder} !important;
}

/* Text colors */
[data-theme="${themeId}"] [class*="text-slate-"] {
  color: ${sharedMuted} !important;
}
[data-theme="${themeId}"] [class*="text-gray-"] {
  color: ${sharedMuted2} !important;
}
[data-theme="${themeId}"] .text-white {
  color: ${sharedText} !important;
}

/* Border radius — override rounded-2xl / rounded-xl */
[data-theme="${themeId}"] [class*="rounded-2xl"],
[data-theme="${themeId}"] [class*="rounded-xl"] {
  border-radius: ${sharedRadius} !important;
}
[data-theme="${themeId}"] [class*="rounded-lg"] {
  border-radius: ${isVhs ? '8px' : '4px'} !important;
}

/* Gradient buttons */
[data-theme="${themeId}"] [class*="from-blue-600"],
[data-theme="${themeId}"] [class*="from-orange-400"],
[data-theme="${themeId}"] [class*="from-pink-500"] {
  background: ${isVhs ? 'linear-gradient(135deg, #2a1a10, #1a0a08) !important' : 'linear-gradient(135deg, #3a3a3a, #2a2a2a) !important'};
  border: 1px solid ${sharedBorder} !important;
}

/* Purple/pink gradient backgrounds in hero */
[data-theme="${themeId}"] [class*="from-pink-500\\/20"],
[data-theme="${themeId}"] [class*="bg-gradient-to-r from-pink-500"] {
  background: ${sharedSurfaceBg} !important;
  border-color: ${sharedBorder} !important;
}

/* Cards / sections that use slate-800 base */
[data-theme="${themeId}"] [class*="bg-slate-800\\/"] {
  background: ${sharedSurfaceBg} !important;
}

/* Palette stat cards (QuickFacts colored boxes) */
${colorCss}

/* Filmstrip / bar chart backgrounds */
[data-theme="${themeId}"] [class*="bg-\\[\\#0a0a0a\\]"] {
  background: ${isVhs ? '#1a0a08' : '#2a2a2a'} !important;
}

/* CinemaScale / Section accent borders */
[data-theme="${themeId}"] [class*="border-emerald-"],
[data-theme="${themeId}"] [class*="border-purple-"],
[data-theme="${themeId}"] [class*="border-orange-"],
[data-theme="${themeId}"] [class*="border-cyan-"],
[data-theme="${themeId}"] [class*="border-fuchsia-"],
[data-theme="${themeId}"] [class*="border-yellow-"],
[data-theme="${themeId}"] [class*="border-pink-"] {
  border-color: ${sharedBorder} !important;
}

/* Rating stars and other colorful inline elements */
[data-theme="${themeId}"] .text-amber-400,
[data-theme="${themeId}"] [class*="text-amber-"] {
  color: ${sharedMuted} !important;
}

/* Skeleton / loading pulse backgrounds */
[data-theme="${themeId}"] [class*="animate-pulse"] {
  background: ${isVhs ? 'rgba(42,26,16,0.5)' : 'rgba(42,42,42,0.5)'} !important;
}
`;
}

export default function ThemeWrapper({ children }: { children: ReactNode }) {
  const { config } = useTheme();
  const theme = config.id;

  const style = useMemo(() => {
    const s: Record<string, string> = {};
    for (const [key, val] of Object.entries(config.cssVars)) {
      s[key] = val;
    }
    return s;
  }, [config.cssVars]);

  const cssOverrides = useMemo(() => themeCss(theme), [theme]);

  const isVhs = theme === 'vhs';
  const isBw = theme === 'classic-bw';

  return (
    <div
      data-theme={theme}
      className={`relative min-h-screen transition-colors duration-500 ${
        theme === 'current' ? 'bg-slate-900 text-white' :
        theme === 'vhs' ? 'bg-[#1a1410] text-[#f0e6d8]' :
        'bg-[#1a1a1a] text-[#e8e0d8]'
      }`}
      style={style}
    >
      {/* Injected CSS overrides for component restyling */}
      {cssOverrides && <style>{cssOverrides}</style>}

      {/* CRT scanlines for VHS */}
      {isVhs && (
        <div
          className="pointer-events-none fixed inset-0 z-[9999]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 5px)',
          }}
        />
      )}

      {/* Film grain for B&W — 16mm film grain */}
      {isBw && (
        <div
          className="pointer-events-none fixed inset-0 z-[9999]"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.045\'/%3E%3C/svg%3E")',
            backgroundSize: '200px 200px',
            opacity: 0.5,
            pointerEvents: 'none',
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* Current theme ambient glow */}
      {theme === 'current' && (
        <div className="fixed inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full filter blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full filter blur-[120px]" />
        </div>
      )}

      {children}
    </div>
  );
}
