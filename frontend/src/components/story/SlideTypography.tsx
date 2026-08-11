'use client';

import type { ReactNode } from 'react';

export function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-300">{children}</p>;
}

export function Big({ children }: { children: ReactNode }) {
  return <p className="mt-3 break-words hyphens-auto text-[clamp(2.1rem,10vw,4.5rem)] font-black leading-[0.95] text-stone-50 md:mt-4">{children}</p>;
}

export function Sub({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`mt-3 text-base text-stone-400 ${className}`}>{children}</p>;
}
