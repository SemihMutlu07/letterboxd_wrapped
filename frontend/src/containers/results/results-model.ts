import type { StatsData } from "@/containers/results/sections/types";

export type DecadeDatum = { decade: string; count: number };
export type RatingDatum = { ratingNum: number; label: string; count: number };
export type AnalysisRange = {
  actualRangeDays: number;
  dateRangeText: string;
};

function formatExactRange(
  startValue: string,
  endValue: string,
  totalDays?: number,
): AnalysisRange | null {
  const startDate = new Date(startValue);
  const endDate = new Date(endValue);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const calculatedDays = Math.max(
    1,
    Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / 86_400_000),
  );
  const startText = startDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const endText = endDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return {
    actualRangeDays: Math.max(1, totalDays || calculatedDays),
    dateRangeText:
      startText === endText
        ? `Analysed on ${startText}`
        : `Analysed from ${startText} to ${endText}`,
  };
}

export function buildAnalysisRange(stats: StatsData | null): AnalysisRange {
  const period = stats?.analysis_period;
  if (period) {
    if (period.start_date && period.end_date) {
      const exactRange = formatExactRange(
        period.start_date,
        period.end_date,
      );
      if (exactRange) return exactRange;
    }

    if (period.key === "month") {
      return {
        actualRangeDays: 30,
        dateRangeText: "Analysed over the past month",
      };
    }
    if (period.key === "lifetime") {
      return {
        actualRangeDays: Math.max(1, stats?.data_timeline?.total_days || 365),
        dateRangeText: "Analysed across your full Letterboxd history",
      };
    }
    return {
      actualRangeDays: 365,
      dateRangeText: "Analysed over the past year",
    };
  }

  const timeline = stats?.data_timeline;
  if (timeline?.earliest_date && timeline.latest_date) {
    const exactRange = formatExactRange(
      timeline.earliest_date,
      timeline.latest_date,
      timeline.total_days,
    );
    if (exactRange) return exactRange;
  }

  const monthlyHabits = stats?.monthly_viewing_habits;
  if (monthlyHabits?.length) {
    const sortedMonths = [...monthlyHabits].sort((a, b) =>
      a.month.localeCompare(b.month),
    );
    const firstMonth = sortedMonths[0].month;
    const lastMonth = sortedMonths[sortedMonths.length - 1].month;
    const parseMonth = (value: string) => {
      if (/^\d{4}-\d{2}$/.test(value)) return new Date(`${value}-01`);
      if (value.includes("/")) {
        const [month, year] = value.split("/");
        return new Date(Number.parseInt(year), Number.parseInt(month) - 1, 1);
      }
      return new Date(value);
    };
    const startDate = parseMonth(firstMonth);
    const endDate = parseMonth(lastMonth);

    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      const daysDiff =
        firstMonth === lastMonth
          ? 30
          : Math.max(
              1,
              Math.ceil(
                Math.abs(endDate.getTime() - startDate.getTime()) / 86_400_000,
              ),
            );
      const startText = startDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      const endText = endDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });

      return {
        actualRangeDays: daysDiff,
        dateRangeText:
          startText === endText
            ? `Analysed in ${startText}`
            : `Analysed from ${startText} to ${endText}`,
      };
    }
  }

  return {
    actualRangeDays: 365,
    dateRangeText: "Analysed over the past year",
  };
}

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
