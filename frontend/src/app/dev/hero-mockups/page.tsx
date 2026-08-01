'use client';

import React from 'react';
import { Info, Sparkles, Film, Star, Clock, Calendar } from 'lucide-react';

export default function HeroMockupsPage() {
  const dummyData = {
    username: 'semihmutsuz',
    avatarUrl: 'https://a.ltrbxd.com/resized/avatar/upload/3/6/8/9/4/5/7/shard/av-256-0-256-0-crop.jpg',
    totalFilms: 482,
    avgRatingLabel: '3.8★',
    topGenre: 'Drama',
    timePct: '14.2%',
    hoursLabel: '964h',
    favoriteDecade: { name: "1970s", count: 124 },
  };

  return (
    <div className="min-h-screen bg-[#0a0c0f] text-white p-6 md:p-12 space-y-16 max-w-6xl mx-auto">
      <div className="text-center space-y-3 border-b border-white/10 pb-8">
        <span className="text-xs uppercase tracking-[0.3em] text-orange-400 font-semibold">Visual Redesign Exploration</span>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight">HeroStats Art Directions</h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
          Comparing 3 distinct dark, Letterboxd-adjacent visual systems for the representative <code className="text-orange-300 bg-white/5 px-2 py-0.5 rounded">HeroStats</code> section.
        </p>
      </div>

      {/* OPTION A */}
      <section id="option-a" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 mb-2">Option A</span>
            <h2 className="text-2xl font-bold">Cinephile Darkroom</h2>
            <p className="text-xs text-slate-400">Deep filmic dark slate (#14181c), Letterboxd accent triad (orange/green/cyan), tactile glowing borders & monospaced stats.</p>
          </div>
        </div>

        <div className="bg-[#14181c] p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Ambient lighting glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-[#00e054]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-center gap-6 max-w-4xl mx-auto w-full">
            {/* User Badge */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#00e054] via-[#ff8000] to-[#40bcf4] rounded-full blur opacity-40 group-hover:opacity-100 transition duration-300" />
                <div className="relative h-24 w-24 md:h-28 md:w-28 rounded-full bg-slate-800 p-1">
                  <div className="w-full h-full rounded-full bg-slate-700 grid place-items-center text-3xl font-black text-white">S</div>
                </div>
              </div>
              <span className="px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-sm md:text-base font-bold text-white tracking-wide shadow-sm">
                @{dummyData.username}
              </span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 flex-1 w-full">
              {/* Films */}
              <div className="bg-[#1c232c] border border-white/10 hover:border-white/20 rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center min-h-[120px] transition-all hover:scale-[1.02] shadow-lg group">
                <div className="text-xs uppercase tracking-widest text-slate-400 font-medium mb-1">Films</div>
                <div className="text-3xl md:text-4xl font-black text-white group-hover:text-orange-400 transition-colors">{dummyData.totalFilms}</div>
              </div>

              {/* Rating */}
              <div className="bg-[#1c232c] border border-white/10 hover:border-amber-500/30 rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center min-h-[120px] transition-all hover:scale-[1.02] shadow-lg group">
                <div className="text-xs uppercase tracking-widest text-slate-400 font-medium mb-1">Avg Rating</div>
                <div className="text-3xl md:text-4xl font-black text-amber-400 flex items-center gap-1">
                  {dummyData.avgRatingLabel}
                </div>
              </div>

              {/* Genre */}
              <div className="bg-[#1c232c] border border-[#00e054]/20 hover:border-[#00e054]/40 rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center min-h-[120px] transition-all hover:scale-[1.02] shadow-lg group">
                <div className="text-xs uppercase tracking-widest text-[#00e054]/80 font-medium mb-1">Top Genre</div>
                <div className="text-2xl md:text-3xl font-black text-[#00e054] flex items-center gap-1.5">
                  <Film className="w-5 h-5" />
                  {dummyData.topGenre}
                </div>
              </div>

              {/* Time Spent */}
              <div className="relative bg-gradient-to-br from-orange-500/15 to-orange-600/5 border border-orange-500/30 hover:border-orange-500/50 rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center min-h-[120px] transition-all hover:scale-[1.02] shadow-lg">
                <Info className="absolute top-3 right-3 w-4 h-4 text-orange-400/60" />
                <div className="text-3xl md:text-4xl font-black text-orange-400 mb-1">{dummyData.timePct}</div>
                <div className="text-[10px] md:text-xs uppercase tracking-wider text-orange-200/80 font-medium text-center leading-tight">
                  Waking time on films
                </div>
              </div>

              {/* Hours */}
              <div className="bg-[#1c232c] border border-[#40bcf4]/20 hover:border-[#40bcf4]/40 rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center min-h-[120px] transition-all hover:scale-[1.02] shadow-lg group">
                <div className="text-xs uppercase tracking-widest text-[#40bcf4]/80 font-medium mb-1">Hours Watched</div>
                <div className="text-3xl md:text-4xl font-black text-[#40bcf4]">{dummyData.hoursLabel}</div>
              </div>

              {/* Decade */}
              <div className="bg-[#1c232c] border border-purple-500/20 hover:border-purple-500/40 rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center min-h-[120px] transition-all hover:scale-[1.02] shadow-lg group">
                <div className="text-3xl md:text-4xl font-black text-purple-400 mb-1">{dummyData.favoriteDecade.name}</div>
                <div className="text-[10px] md:text-xs uppercase tracking-wider text-purple-300/70 font-medium">
                  {dummyData.favoriteDecade.count} films • Peak Decade
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OPTION B */}
      <section id="option-b" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-2">Option B</span>
            <h2 className="text-2xl font-bold">Modern Editorial Cinema</h2>
            <p className="text-xs text-slate-400">High-fashion matte charcoal (#121316), ultra-refined razor-thin borders (1px rule-lines), glowing gold & Letterboxd orange accents.</p>
          </div>
        </div>

        <div className="bg-[#121316] p-6 md:p-8 rounded-3xl border border-white/[0.12] shadow-2xl relative">
          <div className="flex flex-col md:flex-row items-center gap-6 max-w-4xl mx-auto w-full">
            {/* User Badge */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <div className="h-24 w-24 md:h-28 md:w-28 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 p-1 flex items-center justify-center">
                <div className="w-full h-full rounded-xl bg-[#191c22] grid place-items-center text-3xl font-black text-amber-400">S</div>
              </div>
              <span className="px-4 py-1.5 rounded-lg bg-[#191c22] border border-white/10 text-xs md:text-sm font-semibold tracking-wider text-slate-200">
                @{dummyData.username}
              </span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 flex-1 w-full">
              <div className="bg-[#181a20] border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center min-h-[110px] hover:border-orange-500/50 transition">
                <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Films</div>
                <div className="text-3xl font-extrabold text-white">{dummyData.totalFilms}</div>
              </div>

              <div className="bg-[#181a20] border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center min-h-[110px] hover:border-amber-400/50 transition">
                <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Avg Rating</div>
                <div className="text-3xl font-extrabold text-amber-400">{dummyData.avgRatingLabel}</div>
              </div>

              <div className="bg-[#181a20] border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center min-h-[110px] hover:border-emerald-400/50 transition">
                <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Top Genre</div>
                <div className="text-2xl font-extrabold text-emerald-400">{dummyData.topGenre}</div>
              </div>

              <div className="bg-[#1f222b] border border-orange-500/40 rounded-xl p-4 flex flex-col items-center justify-center min-h-[110px]">
                <div className="text-3xl font-extrabold text-orange-400 mb-0.5">{dummyData.timePct}</div>
                <div className="text-[10px] uppercase tracking-widest text-orange-200/90 text-center font-medium">Waking Time</div>
              </div>

              <div className="bg-[#181a20] border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center min-h-[110px] hover:border-sky-400/50 transition">
                <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Hours</div>
                <div className="text-3xl font-extrabold text-sky-400">{dummyData.hoursLabel}</div>
              </div>

              <div className="bg-[#181a20] border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center min-h-[110px] hover:border-purple-400/50 transition">
                <div className="text-3xl font-extrabold text-purple-400 mb-0.5">{dummyData.favoriteDecade.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-purple-300/80 font-medium">Peak Decade</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OPTION C */}
      <section id="option-c" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 mb-2">Option C</span>
            <h2 className="text-2xl font-bold">Neon Marquee & Midnight Canvas</h2>
            <p className="text-xs text-slate-400">Midnight slate background (#0f1419), glassmorphic cards with dual gradient edge borders (cyan & orange neon highlights).</p>
          </div>
        </div>

        <div className="bg-[#0f1419] p-6 md:p-8 rounded-3xl border border-cyan-500/20 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-center gap-6 max-w-4xl mx-auto w-full">
            {/* User Badge */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <div className="h-24 w-24 md:h-28 md:w-28 rounded-full bg-white/[0.03] border-2 border-cyan-400/40 p-1 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <div className="w-full h-full rounded-full bg-slate-800 grid place-items-center text-3xl font-black text-cyan-300">S</div>
              </div>
              <span className="px-4 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-xs md:text-sm font-bold text-cyan-300 tracking-wider">
                @{dummyData.username}
              </span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 flex-1 w-full">
              <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-cyan-500/40 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[110px] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Films</div>
                <div className="text-3xl font-black text-white">{dummyData.totalFilms}</div>
              </div>

              <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[110px] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Avg Rating</div>
                <div className="text-3xl font-black text-amber-400">{dummyData.avgRatingLabel}</div>
              </div>

              <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-[#00e054]/40 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[110px] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Top Genre</div>
                <div className="text-2xl font-black text-[#00e054]">{dummyData.topGenre}</div>
              </div>

              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 backdrop-blur-md border border-orange-500/40 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[110px] shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                <div className="text-3xl font-black text-orange-400 mb-0.5">{dummyData.timePct}</div>
                <div className="text-[10px] uppercase tracking-widest text-orange-200 font-bold text-center">Waking Time</div>
              </div>

              <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-cyan-400/40 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[110px] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Hours</div>
                <div className="text-3xl font-black text-cyan-400">{dummyData.hoursLabel}</div>
              </div>

              <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-purple-400/40 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[110px] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div className="text-3xl font-black text-purple-400 mb-0.5">{dummyData.favoriteDecade.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-purple-300/80 font-bold">Peak Decade</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
