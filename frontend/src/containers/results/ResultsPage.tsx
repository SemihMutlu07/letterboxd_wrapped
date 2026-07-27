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
  buildAnalysisRange,
  buildDecadeData,
  buildRatingData,
  getRuntimeHours,
} from "@/containers/results/results-model";
import { ResultsContent } from "@/containers/results/ResultsContent";
import { useResultsSession } from "@/containers/results/useResultsSession";

export { ResultsContent };

// Note: StatsData is imported from @/containers/results/sections/types

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

  const { actualRangeDays, dateRangeText } = useMemo(
    () => buildAnalysisRange(stats),
    [stats],
  );

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

  const cineScore = useMemo(() => {
    const score = stats?.sinefil_meter?.score;
    return score == null ? undefined : Math.max(0, Math.min(100, score));
  }, [stats]);

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
      cinemaScale: cineScore ?? 0,
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
