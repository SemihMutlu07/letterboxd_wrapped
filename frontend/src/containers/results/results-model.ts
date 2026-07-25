import type { StatsData } from "@/containers/results/sections/types";

export type DecadeDatum = { decade: string; count: number };
export type RatingDatum = { ratingNum: number; label: string; count: number };

export function buildDecadeData(stats: StatsData | null): DecadeDatum[] {
  return [...(stats?.decades ?? [])]
    .filter((item) => item.decade && item.decade !== "Unknown")
    .sort(
      (a, b) =>
        Number.parseInt(String(a.decade).replace("s", "")) -
        Number.parseInt(String(b.decade).replace("s", "")),
    )
    .map((item) => ({
      ...item,
      decade: String(item.decade).includes("s")
        ? item.decade
        : `${item.decade}s`,
    }));
}

export function buildRatingData(stats: StatsData | null): RatingDatum[] {
  return Object.entries(stats?.rating_distribution ?? {})
    .map(([rating, count]) => ({
      ratingNum: Number.parseFloat(rating),
      label: `${rating}★`,
      count,
    }))
    .sort((a, b) => a.ratingNum - b.ratingNum);
}

export function getRuntimeHours(stats: StatsData | null): number {
  if (stats?.total_runtime && Number.isFinite(stats.total_runtime)) {
    return stats.total_runtime / 60;
  }
  if (stats?.hours_watched && Number.isFinite(stats.hours_watched)) {
    return stats.hours_watched;
  }
  if (stats?.days_watched && Number.isFinite(stats.days_watched)) {
    return stats.days_watched * 24;
  }
  return 0;
}
