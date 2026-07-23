'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Compass, Bookmark, PlayCircle, Sparkles } from 'lucide-react';
import { getUsername } from '@/lib/session-id';
import { resultPath } from '@/lib/routes';

export default function AppHeader() {
  const pathname = usePathname();
  const username = typeof window !== 'undefined' ? getUsername() : null;

  const resultsHref = username ? resultPath(username) : '/results';

  const navItems = [
    { label: 'Wrapped', href: resultsHref, icon: Sparkles, active: pathname?.startsWith('/results') },
    { label: 'Watchlist', href: '/watchlist', icon: Bookmark, active: pathname?.startsWith('/watchlist') },
    { label: 'Find Film', href: '/findfilm', icon: Compass, active: pathname?.startsWith('/findfilm') },
    { label: 'Story', href: '/story', icon: PlayCircle, active: pathname?.startsWith('/story') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#14181c]/85 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo & Title */}
        <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-90">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 shadow-md shadow-orange-500/20">
            <Film className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-bold tracking-tight text-white text-base">
            Movies <span className="text-orange-400 font-extrabold">Wrapped</span>
          </span>
        </Link>

        {/* Global Surface Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                  item.active
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${item.active ? 'text-orange-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
