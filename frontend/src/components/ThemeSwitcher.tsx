'use client';

import React from 'react';
import { useTheme, type DesignTheme } from '@/lib/theme';

const OPTIONS: { id: DesignTheme; label: string }[] = [
  { id: 'current', label: '1 · Current' },
  // VHS and B&W Classic themes removed from selection.
  // Apple theme disabled: contrast/readability issues on light bg need a redesign pass.
  // { id: 'apple', label: '4 · Apple' },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-center gap-1.5 p-1 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setTheme(opt.id)}
          className="relative px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200"
          style={{
            background: theme === opt.id
              ? 'rgba(255,255,255,0.12)'
              : 'transparent',
            color: theme === opt.id ? '#fff' : 'rgba(255,255,255,0.5)',
            border: theme === opt.id
              ? '1px solid rgba(255,255,255,0.15)'
              : '1px solid transparent',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
