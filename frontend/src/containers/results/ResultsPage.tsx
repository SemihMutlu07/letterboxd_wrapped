"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import Link from "next/link";
import type { ShareCardData } from "@/components/share/types";
import type { StatsData } from "@/containers/results/sections/types";

import { ThemeProvider } from "@/lib/theme";
import ThemeWrapper from "@/components/ThemeWrapper";
import type { FeedbackFabRef } from "@/components/FeedbackFab";
import {
  getTmdbImageUrl,
  trackEvent,
} from "@/lib/analytics";
import {
  buildAnalysisRange,
  buildDecadeData,
  buildRatingData,
  getRuntimeHours,
} from "@/containers/results/results-model";
import { ResultsContent } from "@/containers/results/ResultsContent";
import { useResultsSession } from "@/containers/results/useResultsSession";
import { useI18n } from "@/i18n/I18nProvider";
import { localizePath } from "@/i18n/routing";
import { toggleClass, trackToggleChanged } from "@/containers/results/sections/section-utils";

export { ResultsContent };

// Note: StatsData is imported from @/containers/results/sections/types

export default function ResultsPage() {
  const { locale, t } = useI18n();
  const {
    stats,
    loading,
    isMobile,
    username,
    sessionId,
  } = useResultsSession();

  // stats window toggle (all-time vs last 12 months, computed once during the scrape)
  const [statsWindow, setStatsWindow] = useState<"lifetime" | "year">("lifetime");
  const activeStats =
    statsWindow === "year" && stats?.last_12_months ? stats.last_12_months : stats;
  const handleStatsWindowChange = (next: "lifetime" | "year") => {
    setStatsWindow(next);
    trackToggleChanged("stats_window", next);
  };

  // share
  const [showShareModal, setShowShareModal] = useState(false);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "vertical",
  );

  // feedback
  const feedbackRef = useRef<FeedbackFabRef>(null);
  const [hasTriggeredFeedback, setHasTriggeredFeedback] = useState(false);

  // Derived data - maintain hook order
  const decadeData = useMemo(() => buildDecadeData(activeStats), [activeStats]);
  const decadeMax = useMemo(
    () => Math.max(0, ...decadeData.map((d) => d.count)),
    [decadeData],
  );

  const ratingsArr = useMemo(() => buildRatingData(activeStats), [activeStats]);
  const ratingMax = useMemo(
    () => Math.max(0, ...ratingsArr.map((d) => d.count)),
    [ratingsArr],
  );

  const { actualRangeDays, dateRangeText } = useMemo(
    () => buildAnalysisRange(activeStats),
    [activeStats],
  );

  const runtimeHours = useMemo(() => getRuntimeHours(activeStats), [activeStats]);

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

  const cineScore = useMemo(() => {
    const score = activeStats?.sinefil_meter?.score;
    return score == null ? undefined : Math.max(0, Math.min(100, score));
  }, [activeStats]);

  // Build top actors & directors list, ensuring no duplicate person across both roles
  const topActors = useMemo(() => {
    return (activeStats?.top_actors || []).slice(0, 5).map((a) => ({
      name: a.name,
      headshotUrl: getTmdbImageUrl(a.profile_path) || "",
      count: a.count,
    }));
  }, [activeStats]);

  const topDirectors = useMemo(() => {
    const actorsSet = new Set(
      (activeStats?.top_actors || []).slice(0, 5).map((a) => a.name),
    );
    return (activeStats?.top_directors || [])
      .filter((d) => !actorsSet.has(d.name))
      .slice(0, 5)
      .map((d) => ({
        name: d.name,
        headshotUrl: getTmdbImageUrl(d.profile_path) || "",
        count: d.count,
      }));
  }, [activeStats]);

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

    const filmSource = activeStats?.favorite_films?.length
      ? activeStats.favorite_films
      : (activeStats?.rated_films ?? []);
    const topFilms = filmSource.slice(0, 5).map((f) => ({
      title: f.title,
      year: f.year ? String(f.year) : "",
      posterPath:
        f.poster_path && f.poster_path.length > 0 ? f.poster_path : null,
    }));

    const topReviewWords = (activeStats?.review_analysis?.word_frequency ?? [])
      .filter(({ word }) => word && word.trim().length > 0)
      .slice(0, 3)
      .map(({ word, count }) => ({ word, count }));

    const milestones = (activeStats?.milestones ?? []).map((m) => ({
      ordinal: m.ordinal,
      title: m.title,
      year: m.year != null ? String(m.year) : "",
      posterPath: m.poster_path && m.poster_path.length > 0 ? m.poster_path : null,
    }));

    const outlier = activeStats?.rating_outlier_film;
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
      year: new Date().getFullYear(),
      writtenReviews: activeStats?.review_analysis?.reviews_with_text ?? 0,
      genres: (activeStats?.top_genres ?? []).slice(0, 5).map(({ name }) => name),
      onScreenCrush: topActors[actorIdx] || {
        name: t('results.people.unknownActor'),
        headshotUrl: "",
        count: 0,
      },
      favoriteDirector: topDirectors[directorIdx] || {
        name: t('results.people.unknownDirector'),
        headshotUrl: "",
        count: 0,
      },
      watchedFilms: activeStats?.total_films || 0,
      spentDays: Math.round(runtimeHours / 24),
      spentHours: Math.round(runtimeHours),
      timePercent: Number.parseInt(timePct, 10) || 0,
      cinemaScale: cineScore ?? 0,
      personaLabel: activeStats?.cinematic_persona?.persona || "",
      minutesAverage: Math.round(activeStats?.average_runtime || 0),
      mostCommonRating: activeStats?.most_common_rating || 3.5,
      peakDecade: activeStats?.favorite_decade?.name || "2020s",
      peakDecadeCount: activeStats?.favorite_decade?.count || 0,
      topActors,
      topDirectors,
      topFilms,
      topReviewWords,
      ratingOutlierFilm,
      milestones,
      username: username || undefined,
    };
  }, [
    activeStats,
    topActors,
    topDirectors,
    cineScore,
    timePct,
    username,
    runtimeHours,
    t('results.people.unknownActor'),
    t('results.people.unknownDirector'),
  ]);

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
          <h2 className="text-2xl font-bold mb-4">{t('results.empty.noData')}</h2>
          <p className="text-gray-400">
            {username
              ? t('results.empty.noUserData', { username })
              : t('results.empty.uploadFirst')}
          </p>
          <Link
            href={localizePath('/', locale)}
            className="mt-6 inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold transition-colors"
          >
            {t('results.empty.goBack')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ThemeWrapper>
        {stats.last_12_months && (
          <div className="sticky top-0 z-40 flex justify-center py-3 bg-[#1e252d]/90 backdrop-blur">
            <div className="flex items-center gap-1 p-0.5 bg-slate-800/60 border border-slate-700/30 rounded-full">
              <button
                className={toggleClass(statsWindow === "lifetime")}
                onClick={() => handleStatsWindowChange("lifetime")}
              >
                {t('results.window.allTime')}
              </button>
              <button
                className={toggleClass(statsWindow === "year")}
                onClick={() => handleStatsWindowChange("year")}
              >
                {t('results.window.last12Months')}
              </button>
            </div>
          </div>
        )}
        <ResultsContent
        stats={activeStats ?? stats}
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
  );
}
