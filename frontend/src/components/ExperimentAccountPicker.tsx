"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clapperboard, Film, Gauge, Loader2, Sparkles, Star, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  getLocalFixturePreviews,
  openExperimentAccount,
  openExperimentStory,
  type ExperimentAccount,
} from "@/lib/experiment-fixtures";

const loadingLines = [
  "Pulling diary scraps...",
  "Sorting emotional damage by runtime...",
  "Finding the month the plot changed...",
  "Cutting a personal cinema dossier...",
];

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
}

function formatRating(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "—";
}

export default function ExperimentAccountPicker() {
  const [accounts, setAccounts] = useState<ExperimentAccount[]>([]);
  const [status, setStatus] = useState("Loading local fixtures...");
  const [loadingUser, setLoadingUser] = useState<string | null>(null);

  useEffect(() => {
    getLocalFixturePreviews()
      .then((fixtures) => {
        setAccounts(fixtures);
        setStatus(`${fixtures.length} cached dossiers ready. No scrape, no desktop worker.`);
      })
      .catch((err: unknown) => {
        setStatus(err instanceof Error ? err.message : "Could not load experiment fixtures.");
      });
  }, []);

  const loadingCopy = useMemo(() => {
    if (!loadingUser) return null;
    const idx = Math.abs(loadingUser.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % loadingLines.length;
    return loadingLines[idx];
  }, [loadingUser]);

  const handleOpen = async (username: string, mode: "dossier" | "story") => {
    setLoadingUser(username);
    setStatus(`Preparing @${username}...`);
    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await (mode === "story" ? openExperimentStory(username) : openExperimentAccount(username));
    } catch (err) {
      setLoadingUser(null);
      setStatus(err instanceof Error ? err.message : "Could not open this fixture.");
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#0d111f] text-[#fff7ed]">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,122,26,0.22),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(100,180,191,0.18),transparent_26%),linear-gradient(135deg,#101624_0%,#17120f_48%,#060606_100%)]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(245,215,168,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(245,215,168,.08)_1px,transparent_1px)] [background-size:46px_46px]" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 md:px-8 md:py-8">
        <header className="grid gap-5 border-b border-[#f5d7a8]/[0.1] pb-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#f5d7a8]/[0.14] bg-black/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-[#d8b56d]">
              <Clapperboard className="h-3.5 w-3.5" />
              Experiment branch
            </p>
            <h1 className="max-w-4xl text-[clamp(48px,10vw,132px)] font-black leading-[0.82] tracking-normal">
              Pick the
              <span className="block text-[#ff7a1a]">dossier.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-[#b6a99a] md:text-base">
              Cached Supabase runs are bundled as local fixtures for this branch. Choose one account and open the redesigned results instantly.
            </p>
          </div>

          <div className="rounded-[24px] border border-[#f5d7a8]/[0.12] bg-[#17120f]/80 p-5 shadow-2xl shadow-black/25">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d8b56d]">No username input</p>
            <p className="mt-2 text-sm leading-6 text-[#d6c6b4]">
              This branch does not scrape or call the desktop worker from the first screen. It only opens known cached accounts.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#8d7f70]">
              <span className="rounded-full border border-[#f5d7a8]/[0.12] px-3 py-1">fixture</span>
              <span className="rounded-full border border-[#f5d7a8]/[0.12] px-3 py-1">story-ready</span>
              <span className="rounded-full border border-[#f5d7a8]/[0.12] px-3 py-1">workerless</span>
            </div>
          </div>
        </header>

        {loadingUser && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 overflow-hidden rounded-full border border-[#ff8a3d]/25 bg-[#ff8a3d]/10 px-4 py-3"
          >
            <motion.div
              initial={{ x: "-20%" }}
              animate={{ x: "110%" }}
              transition={{ repeat: Infinity, duration: 1.25, ease: "easeInOut" }}
              className="h-1 w-24 rounded-full bg-[linear-gradient(90deg,#ff8a3d,#d8b56d,#64b4bf)]"
            />
            <p className="mt-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#ffd49a]">
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingCopy}
            </p>
          </motion.div>
        )}

        <section className="grid flex-1 gap-4 py-6 md:grid-cols-2 xl:grid-cols-5">
          {accounts.map((account, index) => (
            <motion.div
              key={account.username}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.32 }}
              className="group relative min-h-[360px] overflow-hidden rounded-[26px] border border-[#f5d7a8]/[0.12] bg-[#17120f]/85 p-5 text-left shadow-2xl shadow-black/20 transition-all duration-200 hover:-translate-y-1 hover:border-[#f5d7a8]/[0.24]"
            >
              <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ background: `radial-gradient(circle at 30% 15%, ${account.accent}33, transparent 40%)` }} />
              <div className="absolute inset-y-0 left-0 w-9 border-r border-[#f5d7a8]/[0.08] bg-black/20">
                <div className="grid h-full grid-rows-8 gap-2 px-2 py-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-[2px] border border-[#f5d7a8]/[0.12] bg-[#f5d7a8]/[0.05]" />
                  ))}
                </div>
              </div>

              <div className="relative z-10 ml-8 flex h-full flex-col">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-[#f5d7a8]/[0.12] bg-black/20 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#b6a99a]">
                    @{account.username}
                  </span>
                  <Sparkles className="h-4 w-4" style={{ color: account.accent }} />
                </div>

                <div className="mt-8">
                  <p className="text-[11px] font-black uppercase tracking-[0.26em]" style={{ color: account.accent }}>
                    Cached run
                  </p>
                  <h2 className="mt-2 text-4xl font-black leading-none md:text-5xl">{account.displayName}</h2>
                  <p className="mt-4 min-h-[72px] text-sm leading-6 text-[#b6a99a]">{account.caption}</p>
                </div>

                <div className="mt-auto grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Metric icon={Film} label="Films" value={formatNumber(account.total_films)} />
                    <Metric icon={Gauge} label="Cine" value={formatNumber(account.sinefil_meter)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric icon={Star} label="Avg" value={formatRating(account.average_rating)} />
                    <Metric icon={UsersRound} label="Countries" value={formatNumber(account.total_countries)} />
                  </div>
                  <p className="pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8d7f70]">
                    {account.cinematic_persona ?? "Persona pending"} · {account.finished_at?.slice(0, 10) ?? "cached"}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => void handleOpen(account.username, "dossier")}
                      disabled={Boolean(loadingUser)}
                      className="rounded-full border border-[#f5d7a8]/[0.16] bg-black/20 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#fff7ed] transition-colors hover:border-[#f5d7a8]/[0.32] disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
                    >
                      Open Dossier
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpen(account.username, "story")}
                      disabled={Boolean(loadingUser)}
                      className="rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#0d111f] transition-colors disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
                      style={{ backgroundColor: account.accent }}
                    >
                      Open Story
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </section>

        <footer className="border-t border-[#f5d7a8]/[0.08] py-4 text-xs text-[#8d7f70]">
          {status}
        </footer>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#f5d7a8]/[0.1] bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8d7f70]">{label}</span>
        <Icon className="h-3.5 w-3.5 text-[#d8b56d]" />
      </div>
      <p className="mt-3 text-2xl font-black leading-none text-[#fff7ed]">{value}</p>
    </div>
  );
}
