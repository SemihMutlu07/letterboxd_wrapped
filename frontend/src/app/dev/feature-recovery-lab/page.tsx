'use client';

import { useState } from 'react';
import { ArrowUpRight, Check, Circle, Code2, Monitor, Smartphone } from 'lucide-react';
import AppHeader from '@/components/AppHeader';

type Viewport = 'desktop' | 'mobile';
type Period = 'month' | 'year' | 'lifetime';

const features = [
  ['navigation', 'Navigation'],
  ['period', 'Analysis period'],
  ['share', 'Share preferences'],
  ['reviews', 'Review fallback'],
  ['metadata', 'Route metadata'],
] as const;

const periods: { value: Period; label: string; detail: string }[] = [
  { value: 'month', label: '1 month', detail: 'Recent activity' },
  { value: 'year', label: '1 year', detail: 'Current default' },
  { value: 'lifetime', label: 'All time', detail: 'Full history' },
];

function Status({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'ready' }) {
  const styles = {
    neutral: 'border-white/10 bg-white/[0.04] text-slate-400',
    warning: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    ready: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles[tone]}`}>{children}</span>;
}

function Section({
  id,
  number,
  eyebrow,
  title,
  summary,
  status,
  children,
}: {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  summary: string;
  status: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 border-b border-white/8 py-10 first:pt-0 last:border-0 sm:py-14">
      <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-400">
            <span>{number}</span>
            <span className="h-px w-5 bg-orange-400/50" />
            <span>{eyebrow}</span>
          </div>
          <h2 className="text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{summary}</p>
        </div>
        <div className="lg:pt-1">{status}</div>
      </div>
      {children}
    </section>
  );
}

function Preview({ viewport, children, label }: { viewport: Viewport; children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0e11] p-2 shadow-[0_24px_80px_-36px_rgba(0,0,0,0.9)] sm:p-3">
      <div className="mb-2 flex items-center justify-between px-1.5 py-1">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-red-400/60" />
          <span className="h-2 w-2 rounded-full bg-amber-400/60" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">{label}</span>
      </div>
      <div
        className={`mx-auto overflow-hidden rounded-xl border border-white/8 bg-[#14181c] transition-[max-width] duration-300 ${
          viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-none'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function FeatureRecoveryLabPage() {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [period, setPeriod] = useState<Period>('year');
  const [swapOpen, setSwapOpen] = useState(true);

  return (
    <main className="min-h-screen bg-[#111315] text-white">
      <div className="border-b border-white/8 bg-[radial-gradient(circle_at_80%_-20%,rgba(249,115,22,0.14),transparent_38%)]">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-400">
                <Code2 className="h-4 w-4" />
                Local decision lab
              </div>
              <h1 className="max-w-3xl text-balance text-4xl font-black tracking-[-0.035em] sm:text-5xl lg:text-6xl">
                Recover the useful parts.
                <span className="block text-slate-500">Leave the clutter behind.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Five lost or broken behaviors, shown as working interface decisions. Nothing here ships until you choose it.
              </p>
            </div>

            <div className="inline-flex w-fit rounded-xl border border-white/10 bg-black/30 p-1" aria-label="Preview viewport">
              {(['desktop', 'mobile'] as const).map((item) => {
                const Icon = item === 'desktop' ? Monitor : Smartphone;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={viewport === item}
                    onClick={() => setViewport(item)}
                    className={`flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold capitalize transition ${viewport === item ? 'bg-orange-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[190px_minmax(0,1fr)] lg:px-10 lg:py-14">
        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Recovery index</p>
            <nav aria-label="Recovery lab sections" className="space-y-1">
              {features.map(([id, label], index) => (
                <a key={id} href={`#${id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2 text-xs text-slate-500 transition hover:bg-white/[0.04] hover:text-white">
                  <span className="font-mono text-[10px] text-slate-700 group-hover:text-orange-400">0{index + 1}</span>
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-8 border-t border-white/8 pt-5 text-xs leading-5 text-slate-600">
              Prototype only
              <br />
              No production wiring
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <Section id="navigation" number="01" eyebrow="Wayfinding" title="Bring back one clear route between tools." summary="Wrapped and Watchlist became isolated screens. The recovered header restores orientation without turning into a large product navbar." status={<Status tone="ready">Ready to restore</Status>}>
            <Preview viewport={viewport} label="Results / Watchlist shell">
              <AppHeader />
              <div className="grid min-h-40 place-items-center px-6 text-center">
                <p className="text-xs text-slate-600">The page keeps its own visual identity below the shared navigation.</p>
              </div>
            </Preview>
          </Section>

          <Section id="period" number="02" eyebrow="Input" title="Let people choose the story they want to see." summary="The API still supports month, year and lifetime. The missing control only needs to make that existing choice visible again." status={<Status tone="ready">Backend supported</Status>}>
            <Preview viewport={viewport} label="Landing input">
              <div className="mx-auto max-w-2xl p-5 sm:p-8">
                <p className="mb-3 text-xs font-semibold text-slate-300">Analysis period</p>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/25 p-1.5">
                  {periods.map((option) => (
                    <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => setPeriod(option.value)} className={`min-w-0 rounded-lg px-2 py-2.5 text-center transition ${period === option.value ? 'bg-orange-400 text-slate-950 shadow-lg shadow-orange-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                      <span className="block text-xs font-bold sm:text-sm">{option.label}</span>
                      <span className={`mt-0.5 hidden text-[10px] sm:block ${period === option.value ? 'text-slate-800' : 'text-slate-600'}`}>{option.detail}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Preview>
          </Section>

          <Section id="share" number="03" eyebrow="Share card preferences" title="Keep share preferences inside the visible sidebar." summary="The control already exists. This prototype changes its placement so preferences open below the trigger on desktop and remain reachable on narrow screens." status={<Status tone="neutral">Placement fix</Status>}>
            <Preview viewport={viewport} label="Share modal">
              <div className={`grid min-h-[360px] ${viewport === 'desktop' ? 'grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px]' : 'grid-cols-1'}`}>
                <div className="grid place-items-center bg-[radial-gradient(circle,rgba(249,115,22,0.12),transparent_55%)] p-6">
                  <div className="aspect-[1.6/1] w-full max-w-md rounded-xl border border-orange-300/20 bg-[#191612] shadow-2xl">
                    <div className="flex h-full flex-col justify-between p-5">
                      <span className="text-xs font-bold uppercase tracking-widest text-orange-300">Movies Wrapped</span>
                      <p className="text-2xl font-black">A year in film.</p>
                    </div>
                  </div>
                </div>
                <div className="relative border-t border-white/8 bg-[#111519] p-4 sm:p-5 md:border-l md:border-t-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">Share card preferences</p>
                  <button type="button" onClick={() => setSwapOpen((open) => !open)} aria-expanded={swapOpen} className="mt-4 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-xs font-semibold text-slate-200 hover:border-white/20">
                    Actor &amp; director
                    <span className="text-slate-500">{swapOpen ? '−' : '+'}</span>
                  </button>
                  {swapOpen && (
                    <div className="mt-2 rounded-xl border border-orange-400/20 bg-orange-400/[0.06] p-3">
                      <p className="text-xs font-semibold text-white">Featured people</p>
                      <div className="mt-3 space-y-2">
                        {['Actor · Emma Stone', 'Director · Bong Joon-ho'].map((item) => <button key={item} type="button" className="block w-full rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-left text-[11px] text-slate-300 hover:border-orange-400/30">{item}</button>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Preview>
          </Section>

          <Section id="reviews" number="04" eyebrow="Review insights" title="Do not hide insights the backend already knows." summary="Keep the longest-review fallback visible and show how many distinct reviews the most loyal fan liked." status={<Status tone="ready">Approved direction</Status>}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 opacity-65">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-400">Current</span><Circle className="h-4 w-4 text-slate-700" /></div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/8 bg-[#151a21] p-4"><strong className="text-3xl text-orange-400">12</strong><p className="mt-1 text-xs text-slate-500">written reviews</p></div>
                  <div className="grid place-items-center rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-700">Missing card</div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.035] p-5">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-emerald-300">Recovered</span><Check className="h-4 w-4 text-emerald-300" /></div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/8 bg-[#151a21] p-4"><strong className="text-3xl text-orange-400">12</strong><p className="mt-1 text-xs text-slate-500">written reviews</p></div>
                  <div className="rounded-xl border border-white/8 bg-[#151a21] p-4"><strong className="text-3xl text-orange-400">140</strong><p className="mt-1 text-xs text-slate-500">words in longest</p></div>
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-orange-400/20 bg-orange-400/[0.06] p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-amber-600 text-xs font-black text-slate-950">BK</div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-300">Most loyal fan</p>
                    <p className="truncate text-sm font-semibold text-white">berkankaya</p>
                  </div>
                  <div className="ml-auto shrink-0 text-right">
                    <strong className="text-2xl text-orange-300">7</strong>
                    <p className="text-[10px] text-slate-500">reviews liked</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section id="metadata" number="05" eyebrow="Invisible infrastructure" title="Every public page should identify itself." summary="Canonical and Open Graph URLs currently point back to the homepage. This is a code correction, so the lab shows the expected route mapping instead of a fake visual preview." status={<Status tone="neutral">No UI change</Status>}>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e11]">
              {[['/results', '/results'], ['/watchlist', '/watchlist']].map(([route, canonical], index) => (
                <div key={route} className={`grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-4 sm:px-5 ${index > 0 ? 'border-t border-white/8' : ''}`}>
                  <div className="min-w-0"><code className="text-sm font-semibold text-white">{route}</code><p className="mt-1 truncate text-xs text-slate-600">canonical · og:url</p></div>
                  <div className="flex items-center gap-2 text-xs text-emerald-300"><Check className="h-4 w-4" /><code>{canonical}</code><ArrowUpRight className="h-3.5 w-3.5" /></div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
