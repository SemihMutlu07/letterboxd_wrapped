'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

export type DesignTheme = 'current' | 'vhs' | 'classic-bw' | 'apple';

export interface ThemeConfig {
  id: DesignTheme;
  label: string;
  cssVars: Record<string, string>;
}

const themes: Record<DesignTheme, ThemeConfig> = {
  current: {
    id: 'current',
    label: 'Current',
    cssVars: {
      '--theme-bg': '#0f172a',
      '--theme-surface': '#1e293b',
      '--theme-surface-2': '#334155',
      '--theme-border': 'rgba(255,255,255,0.08)',
      '--theme-text': '#f1f5f9',
      '--theme-muted': '#94a3b8',
      '--theme-muted-2': '#64748b',
      '--theme-accent': '#f97316',
      '--theme-accent-2': '#7c3aed',
      '--theme-accent-3': '#22c55e',
      '--theme-radius': '16px',
      '--theme-radius-sm': '12px',
    },
  },
  vhs: {
    id: 'vhs',
    label: 'VHS',
    cssVars: {
      '--theme-bg': '#1a1410',
      '--theme-surface': '#2a1a10',
      '--theme-surface-2': '#1a0a08',
      '--theme-border': 'rgba(212,149,90,0.25)',
      '--theme-text': '#f0e6d8',
      '--theme-muted': '#d4955a',
      '--theme-muted-2': '#b07a40',
      '--theme-accent': '#d4955a',
      '--theme-accent-2': '#b07a40',
      '--theme-accent-3': '#f0e6d8',
      '--theme-radius': '10px',
      '--theme-radius-sm': '8px',
    },
  },
  'classic-bw': {
    id: 'classic-bw',
    label: 'B&W',
    cssVars: {
      '--theme-bg': '#0c0a08',
      '--theme-surface': '#1a1816',
      '--theme-surface-2': '#2a2826',
      '--theme-border': 'rgba(232,221,208,0.10)',
      '--theme-text': '#e8ddd0',
      '--theme-muted': '#8a7a70',
      '--theme-muted-2': '#6a5e56',
      '--theme-accent': '#c8b8a8',
      '--theme-accent-2': '#a89888',
      '--theme-accent-3': '#e8ddd0',
      '--theme-radius': '2px',
      '--theme-radius-sm': '1px',
    },
  },
  apple: {
    id: 'apple',
    label: 'Apple',
    cssVars: {
      // Warm off-white system background — Apple's signature `secondarySystemBackground`-ish
      '--theme-bg': '#FBFAF7',
      '--theme-surface': '#FFFFFF',
      '--theme-surface-2': '#F2F2F7',     // Apple system gray 6
      '--theme-border': 'rgba(0,0,0,0.08)',
      '--theme-text': '#1D1D1F',          // Apple near-black
      '--theme-muted': '#6E6E73',         // Apple system gray
      '--theme-muted-2': '#86868B',       // Apple system gray 2
      '--theme-accent': '#0066CC',        // SF Blue, contrast-tuned for light bg
      '--theme-accent-2': '#1D1D1F',
      '--theme-accent-3': '#34C759',      // Apple system green
      '--theme-radius': '16px',
      '--theme-radius-sm': '12px',
    },
  },
};

// ─── Context ─────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: DesignTheme;
  config: ThemeConfig;
  setTheme: (t: DesignTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DesignTheme>('current');

  const setTheme = useCallback((t: DesignTheme) => {
    setThemeState(t);
  }, []);

  const config = themes[theme];

  const value = useMemo(() => ({ theme, config, setTheme }), [theme, config, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export { themes };
