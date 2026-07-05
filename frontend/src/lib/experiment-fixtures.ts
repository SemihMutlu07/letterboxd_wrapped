"use client";

import { resultPath } from "@/lib/routes";
import { getDetailsFromSummary, type CachedAnalysisRun, type CachedRunPreview } from "@/lib/supabase/analysis_runs";

type FixtureIndexRow = Omit<CachedRunPreview, "started_at"> & {
  started_at?: string | null;
  found: boolean;
  file: string;
};

type LocalFixtureIndex = {
  generated_at: string;
  source: string;
  users: Record<string, FixtureIndexRow>;
};

export type ExperimentAccount = CachedRunPreview & {
  displayName: string;
  caption: string;
  accent: string;
};

const ACCOUNT_META: Record<string, Pick<ExperimentAccount, "displayName" | "caption" | "accent">> = {
  semihmutsuz: {
    displayName: "Semih",
    caption: "Emotional masochism, auteur loops, and Letterboxd archaeology.",
    accent: "#ff8a3d",
  },
  emirermis: {
    displayName: "Emir",
    caption: "A compact archive with cleaner ratings and cinephile balance.",
    accent: "#64b4bf",
  },
  mertefesenturk: {
    displayName: "Mert Efe",
    caption: "A broad watch history built for comparison and story cards.",
    accent: "#d8b56d",
  },
  baris_saydam: {
    displayName: "Barış",
    caption: "Massive archive energy: thousands of films, dense signal.",
    accent: "#d95f4f",
  },
  isilaykolik: {
    displayName: "Işılay",
    caption: "High-rating warmth with enough range for persona reveals.",
    accent: "#7bbf86",
  },
};

const LOCAL_FIXTURE_LOADERS: Record<string, () => Promise<{ default: CachedAnalysisRun }>> = {
  semihmutsuz: () => import("../../dev-fixtures/analysis-runs/semihmutsuz.json"),
  emirermis: () => import("../../dev-fixtures/analysis-runs/emirermis.json"),
  mertefesenturk: () => import("../../dev-fixtures/analysis-runs/mertefesenturk.json"),
  baris_saydam: () => import("../../dev-fixtures/analysis-runs/baris_saydam.json"),
  isilaykolik: () => import("../../dev-fixtures/analysis-runs/isilaykolik.json"),
};

export async function getLocalFixtureByUsername(username: string): Promise<CachedAnalysisRun | null> {
  const clean = username.trim().replace(/^@/, "").toLowerCase();
  const loader = LOCAL_FIXTURE_LOADERS[clean];
  if (!loader) return null;
  return (await loader()).default;
}

export async function getLocalFixturePreviews(): Promise<ExperimentAccount[]> {
  const mod = await import("../../dev-fixtures/analysis-runs/index.json");
  const index = mod.default as LocalFixtureIndex;

  return Object.values(index.users)
    .filter((row) => row.found)
    .map(({ found: _found, file: _file, ...row }) => {
      const meta = ACCOUNT_META[row.username] ?? {
        displayName: `@${row.username}`,
        caption: "Cached experiment fixture.",
        accent: "#ff8a3d",
      };
      return { started_at: null, ...row, ...meta };
    })
    .sort((a, b) => String(b.finished_at ?? "").localeCompare(String(a.finished_at ?? "")));
}

export async function loadExperimentAccount(username: string): Promise<CachedAnalysisRun> {
  const cached = await getLocalFixtureByUsername(username);
  if (!cached) throw new Error(`No local experiment fixture found for @${username}.`);
  const details = getDetailsFromSummary(cached.summary);
  if (!details) throw new Error(`Fixture for @${username} has no readable summary.details payload.`);

  // ── Client-side enrichment: backfill derive-edilebilir review alanlarını ────
  // Fixture'lar eski backend kodundan üretildiği için slug, review_url, date,
  // likes_url gibi alanlar eksik olabilir. Bu adım mevcut text'ten türetilebilen
  // alanları doldurur. Slug içermeyen review'ler Letterboxd'e linklenemez ama
  // sort/filter çalışır.
  const ra = (details as Record<string, unknown>).review_analysis as Record<string, unknown> | undefined;
  if (ra?.reviews && Array.isArray(ra.reviews)) {
    ra.reviews = (ra.reviews as Record<string, unknown>[]).map((r) => {
      const text = String(r.text ?? "");
      const derived: Record<string, unknown> = {};
      // word_count: tercihen scraped'den, yoksa text'ten split
      if (r.word_count == null) derived.word_count = text ? text.split(/\s+/).length : 0;
      // text_length: scraped'den veya text.length
      if (r.text_length == null) derived.text_length = text.length;
      // has_likes_page: slug varsa True
      if (r.has_likes_page == null) derived.has_likes_page = Boolean(r.slug);
      // likes: null/undefined → 0 normalize
      if (r.likes == null) derived.likes = 0;
      return { ...r, ...derived };
    });
    // Analog olarak top_liked_reviews'te de like_count normalize et
    if (ra.top_liked_reviews && Array.isArray(ra.top_liked_reviews)) {
      ra.top_liked_reviews = (ra.top_liked_reviews as Record<string, unknown>[]).map((r) => ({
        ...r,
        like_count: typeof r.like_count === "number" ? r.like_count : 0,
      }));
    }
  }

  sessionStorage.setItem("letterboxdStats", JSON.stringify(details));
  sessionStorage.setItem("username", cached.username);
  sessionStorage.setItem("lb_username", cached.username);
  return cached;
}

export async function openExperimentAccount(username: string) {
  const cached = await loadExperimentAccount(username);
  window.location.href = resultPath(cached.username);
}

export async function openExperimentStory(username: string) {
  const cached = await loadExperimentAccount(username);
  window.location.href = `/experiment/story?u=${encodeURIComponent(cached.username)}`;
}
