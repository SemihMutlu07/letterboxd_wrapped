"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import Link from "next/link";
import PreResultsConsentModal from "@/components/PreResultsConsentModal";
import type { ShareCardData } from "@/components/share/types";
import type { StatsData } from "@/containers/results/sections/types";

import { ThemeProvider } from "@/lib/theme";
import ThemeWrapper from "@/components/ThemeWrapper";
import type { FeedbackFabRef } from "@/components/FeedbackFab";
import { searchPerson } from "@/lib/api";
import {
  getTmdbImageUrl,
  trackEvent,
} from "@/lib/analytics";
import {
  buildDecadeData,
  buildRatingData,
  getRuntimeHours,
} from "@/containers/results/results-model";
import { ResultsContent } from "@/containers/results/ResultsContent";
import { useResultsSession } from "@/containers/results/useResultsSession";

export { ResultsContent };

// Note: StatsData is imported from @/containers/results/sections/types

/**
 * Client-side fallback when backend sinefil_meter is missing.
 * Mirrors the cine_v2 model with the data available in LetterboxdStats.
 * Shannon entropy computed from the top-N counts the backend provides.
 */
const calcCinephileScore = (s?: StatsData | null) => {
  if (!s) return 45;

  const log2 = Math.log2;

  const entropy = (counts: number[]): number => {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    return -counts
      .filter((c) => c > 0)
      .reduce((h, c) => {
        const p = c / total;
        return h + p * log2(p);
      }, 0);
  };

  const normEntropy = (counts: number[]): number => {
    const n = counts.filter((c) => c > 0).length;
    if (n <= 1) return 0;
    const maxH = log2(n);
    return maxH > 0 ? entropy(counts) / maxH : 0;
  };

  const topShare = (counts: number[], n = 1) => {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    return (
      counts
        .sort((a, b) => b - a)
        .slice(0, n)
        .reduce((a, b) => a + b, 0) / total
    );
  };

  const countries = (s.top_countries || []).map((c) => c.count);
  const decades = (s.decades || [])
    .filter((d) => d.decade !== "Unknown")
    .map((d) => d.count);
  const languages = (s.top_languages || []).map((l) => l.count);
  const genres = (s.top_genres || []).map((g) => g.count);
  const directors = (s.top_directors || []).map((d) => d.count);
  const total = s.total_films || 1;

  // Geography (0-25)
  const geoNorm = normEntropy(countries);
  const geoDom = topShare([...countries]) > 0.8 ? 0.6 : 1.0;
  const geo = Math.min(25, Math.round(geoNorm * geoDom * 25));

  // Temporal (0-20): decade entropy (12) + age bonus (8)
  const decNorm = normEntropy(decades);
  const decPts = Math.min(12, Math.round(decNorm * 12));
  // Rough median-year estimate from decade midpoints
  const decadeEntries = (s.decades || []).filter((d) => d.decade !== "Unknown");
  let agePts = 0;
  if (decadeEntries.length > 0) {
    const totalD = decadeEntries.reduce((a, d) => a + d.count, 0);
    const weightedYear =
      decadeEntries.reduce((a, d) => {
        const y = parseInt(String(d.decade).replace("s", ""));
        return a + (isNaN(y) ? 0 : (y + 5) * d.count);
      }, 0) / (totalD || 1);
    const yearsBack = Math.max(0, 2026 - weightedYear);
    agePts = Math.min(8, Math.round((yearsBack / 40) * 8));
  }
  const temporal = Math.min(20, decPts + agePts);

  // Languages (0-15)
  const langNorm = normEntropy(languages);
  const langDom = topShare([...languages]) > 0.85 ? 0.5 : 1.0;
  const lang = Math.min(15, Math.round(langNorm * langDom * 15));

  // Volume (0-15)
  const vol = Math.min(15, Math.round(Math.log10(Math.max(1, total)) * 6));

  // Genres (0-15)
  const genreNorm = normEntropy(genres);
  const genre = Math.min(15, Math.round(genreNorm * 15));

  // Directors (0-10)
  const top3Dir = topShare([...directors], 3);
  const dir = Math.min(10, Math.round((1 - top3Dir) * 12));

  return Math.max(0, Math.min(100, geo + temporal + lang + vol + genre + dir));
};

export default function ResultsPage() {
  const {
    stats,
    loading,
    isMobile,
    username,
    sessionId,
    showConsent,
    recordConsentDecision,
  } = useResultsSession();

  // share
  const [showShareModal, setShowShareModal] = useState(false);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "vertical",
  );
  const [directorImageUrl, setDirectorImageUrl] = useState<string>("");

  // feedback
  const feedbackRef = useRef<FeedbackFabRef>(null);
  const [hasTriggeredFeedback, setHasTriggeredFeedback] = useState(false);

  // Derived data - maintain hook order
  const decadeData = useMemo(() => buildDecadeData(stats), [stats]);
  const decadeMax = useMemo(
    () => Math.max(0, ...decadeData.map((d) => d.count)),
    [decadeData],
  );

  const ratingsArr = useMemo(() => buildRatingData(stats), [stats]);
  const ratingMax = useMemo(
    () => Math.max(0, ...ratingsArr.map((d) => d.count)),
    [ratingsArr],
  );

  // Date range calculation
  const { actualRangeDays, dateRangeText } = useMemo(() => {
    // Use data_timeline if available
    if (
      stats?.data_timeline?.earliest_date &&
      stats?.data_timeline?.latest_date
    ) {
      try {
        const startDate = new Date(stats.data_timeline.earliest_date);
        const endDate = new Date(stats.data_timeline.latest_date);

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          const daysDiff = Math.max(1, stats.data_timeline.total_days || 1);

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
            actualRangeDays: daysDiff,
            dateRangeText:
              startText === endText
                ? `Analysed on ${startText}`
                : `Analysed from ${startText} to ${endText}`,
          };
        }
      } catch {
        // Silent error handling
      }
    }

    // Fallback to monthly habits
    const monthlyHabits = stats?.monthly_viewing_habits;
    if (monthlyHabits && monthlyHabits.length > 0) {
      try {
        const sortedMonths = [...monthlyHabits].sort((a, b) =>
          a.month.localeCompare(b.month),
        );
        const firstMonth = sortedMonths[0].month;
        const lastMonth = sortedMonths[sortedMonths.length - 1].month;

        // Parse month formats
        let startDate, endDate;

        if (firstMonth.includes("-") && firstMonth.length >= 7) {
          startDate = new Date(
            firstMonth + (firstMonth.length === 7 ? "-01" : ""),
          );
          endDate = new Date(lastMonth + (lastMonth.length === 7 ? "-01" : ""));
        } else if (firstMonth.includes("/")) {
          const [month, year] = firstMonth.split("/");
          startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const [endMonth, endYear] = lastMonth.split("/");
          endDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, 1);
        } else if (/^\d{4}-\d{2}$/.test(firstMonth)) {
          startDate = new Date(firstMonth + "-01");
          endDate = new Date(lastMonth + "-01");
        } else {
          startDate = new Date(firstMonth);
          endDate = new Date(lastMonth);
        }

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          let daysDiff = Math.max(
            1,
            Math.ceil(diffTime / (1000 * 60 * 60 * 24)),
          );

          if (firstMonth === lastMonth) {
            daysDiff = 30;
          }

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
      } catch {
        // Silent error handling
      }
    }

    // Default fallback
    return {
      actualRangeDays: 365,
      dateRangeText: "Analysed over the past year",
    };
  }, [stats?.data_timeline, stats?.monthly_viewing_habits]);

  const runtimeHours = useMemo(() => getRuntimeHours(stats), [stats]);

  const timePct = useMemo(() => {
    const safeRangeDays = Math.max(1, actualRangeDays);

    // Calculate based on waking hours
    const wakingHoursPerDay = 16;
    const totalWakingHours = safeRangeDays * wakingHoursPerDay;

    let percentage = Math.round((runtimeHours / totalWakingHours) * 100);

    // Adjust for short periods
    if (safeRangeDays <= 30) {
      const totalAvailableHours = safeRangeDays * 24;
      percentage = Math.round((runtimeHours / totalAvailableHours) * 100);
    }

    return `${Math.min(percentage, 100)}%`;
  }, [runtimeHours, actualRangeDays]);

  const cineScore = useMemo(
    () =>
      Math.max(
        0,
        Math.min(100, stats?.sinefil_meter?.score ?? calcCinephileScore(stats)),
      ),
    [stats],
  );

  // Build top actors & directors list, ensuring no duplicate person across both roles
  const topActors = useMemo(() => {
    return (stats?.top_actors || []).slice(0, 5).map((a) => ({
      name: a.name,
      headshotUrl: getTmdbImageUrl(a.profile_path) || "",
      count: a.count,
    }));
  }, [stats]);

  const topDirectors = useMemo(() => {
    const actorsSet = new Set(
      (stats?.top_actors || []).slice(0, 5).map((a) => a.name),
    );
    return (stats?.top_directors || [])
      .filter((d) => !actorsSet.has(d.name))
      .slice(0, 5)
      .map((d) => ({
        name: d.name,
        headshotUrl: getTmdbImageUrl(d.profile_path) || "",
        count: d.count,
      }));
  }, [stats]);

  const shareCardData = useMemo<ShareCardData>(() => {
    // Avoid crush being same person as director
    const actorIdx = 0;
    let directorIdx = 0;

    // If first actor === first director, try next director
    if (
      topActors.length > 0 &&
      topDirectors.length > 0 &&
      topActors[0].name === topDirectors[0].name
    ) {
      directorIdx = topDirectors.length > 1 ? 1 : 0;
    }

    const filmSource = stats?.favorite_films?.length
      ? stats.favorite_films
      : (stats?.rated_films ?? []);
    const topFilms = filmSource.slice(0, 5).map((f) => ({
      title: f.title,
      year: f.year ? String(f.year) : "",
      posterPath:
        f.poster_path && f.poster_path.length > 0 ? f.poster_path : null,
    }));

    const topReviewWords = (stats?.review_analysis?.word_frequency ?? [])
      .filter(({ word }) => word && word.trim().length > 0)
      .slice(0, 3)
      .map(({ word, count }) => ({ word, count }));

    const outlier = stats?.rating_outlier_film;
    const ratingOutlierFilm = outlier
      ? {
          title: outlier.title,
          year: outlier.year != null ? String(outlier.year) : "",
          posterPath:
            outlier.poster_path && outlier.poster_path.length > 0
              ? outlier.poster_path
              : null,
          userRating: outlier.user_rating,
          avgRating: outlier.avg_rating,
          delta: outlier.delta,
        }
      : undefined;

    return {
      onScreenCrush: topActors[actorIdx] || {
        name: "Unknown Actor",
        headshotUrl: "",
        count: 0,
      },
      favoriteDirector: topDirectors[directorIdx] || {
        name: "Unknown Director",
        headshotUrl: "",
        count: 0,
      },
      watchedFilms: stats?.total_films || 0,
      spentDays: Math.round(runtimeHours / 24),
      spentHours: Math.round(runtimeHours),
      timePercent: Number.parseInt(timePct, 10) || 0,
      cinemaScale: cineScore,
      personaLabel: stats?.cinematic_persona?.persona || "",
      minutesAverage: Math.round(stats?.average_runtime || 0),
      mostCommonRating: stats?.most_common_rating || 3.5,
      peakDecade: stats?.favorite_decade?.name || "2020s",
      peakDecadeCount: stats?.favorite_decade?.count || 0,
      topActors,
      topDirectors,
      topFilms,
      topReviewWords,
      ratingOutlierFilm,
      username: username || undefined,
    };
  }, [
    stats,
    topActors,
    topDirectors,
    cineScore,
    timePct,
    username,
    runtimeHours,
  ]);

  // Load director headshot with lazy loading
  const loadDirectorImage = useCallback(async () => {
    const nm = stats?.most_watched_director?.name;
    if (!nm) return;

    if (process.env.NEXT_PUBLIC_API_BASE) {
      try {
        const data = await searchPerson(nm, "director");
        if (data.found && data.url) {
          const imageUrl = getTmdbImageUrl(data.url);
          if (imageUrl && !directorImageUrl) {
            setDirectorImageUrl(imageUrl);
          }
        }
      } catch {
        // Silent
      }
    }
  }, [stats?.most_watched_director?.name, directorImageUrl]);

  useEffect(() => {
    loadDirectorImage();
  }, [loadDirectorImage]);

  useEffect(() => {
    // Analytics for results viewed
    if (stats) {
      trackEvent("results_viewed_unified", {
        total_films: stats.total_films,
        cine_score: cineScore,
      });
    }
  }, [stats, cineScore]);

  if (loading) return <div className="min-h-screen bg-[#1e252d]" />;
  if (
    !stats ||
    (typeof stats === "object" && Object.keys(stats).length === 0)
  ) {
    return (
      <div className="min-h-screen bg-[#1e252d] flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No data found</h2>
          <p className="text-gray-400">
            {username
              ? `No local result data found for @${username}.`
              : "Please upload your Letterboxd data first."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold transition-colors"
          >
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <ThemeProvider>
        <ThemeWrapper>
          <ResultsContent
          stats={stats}
          sessionId={sessionId}
          username={username}
          dateRangeText={dateRangeText}
          timePct={timePct}
          runtimeHours={runtimeHours}
          decadeData={decadeData}
          decadeMax={decadeMax}
          isMobile={isMobile}
          ratingsArr={ratingsArr}
          ratingMax={ratingMax}
          cineScore={cineScore}
          showShareModal={showShareModal}
          setShowShareModal={setShowShareModal}
          shareCardData={shareCardData}
          orientation={orientation}
          setOrientation={setOrientation}
          hasTriggeredFeedback={hasTriggeredFeedback}
          setHasTriggeredFeedback={setHasTriggeredFeedback}
          feedbackRef={feedbackRef}
          />
        </ThemeWrapper>
      </ThemeProvider>
      <PreResultsConsentModal
        open={showConsent}
        sessionId={sessionId}
        onAccept={() => recordConsentDecision("accept")}
        onDecline={() => recordConsentDecision("decline")}
      />
    </>
  );
}
