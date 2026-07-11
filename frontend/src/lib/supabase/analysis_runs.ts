"use client";

import { getSupabase } from "@/lib/supabaseClient";

/** Ensures object is JSON-serializable (no functions, undefined, etc.). */
function safeJsonSanitize(obj: unknown): Record<string, unknown> {
    try {
        const str = JSON.stringify(obj);
        if (!str) return {};
        const parsed = JSON.parse(str);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function sliceTop<T>(arr: T[] | undefined, n: number): T[] {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, Math.max(0, n));
}

/** Build small preview for list views: totals + top5 genres/directors + personas + dates. */
function buildPreview(details: Record<string, unknown>, schemaVersion: string): Record<string, unknown> {
    return {
        schema_version: schemaVersion,
        totals: {
            total_films: details.total_films ?? null,
            days_watched: details.days_watched ?? null,
            average_rating: details.average_rating ?? null,
            total_countries: details.total_countries ?? null,
            average_runtime: details.average_runtime ?? null,
        },
        top_genres: sliceTop(details.top_genres as { name: string; count: number }[] | undefined, 5),
        top_directors: sliceTop(details.top_directors as { name: string; count: number }[] | undefined, 5),
        personas: {
            sinefil_meter: details.sinefil_meter ?? null,
            cinematic_persona: details.cinematic_persona ?? null,
            runtime_persona: details.runtime_persona ?? null,
            favorite_genre: details.favorite_genre ?? null,
            favorite_decade: details.favorite_decade ?? null,
            most_watched_director: details.most_watched_director ?? null,
        },
        dates: {
            analysis_date: details.analysis_date ?? null,
            data_timeline: details.data_timeline ?? null,
        },
    };
}

/** Drop third-party liker names/avatars from the copy we persist.
 * Aggregate signals (likes / likers_complete) are kept; the live result the
 * user sees in this session is untouched. */
function redactLikers(details: unknown): void {
    if (!details || typeof details !== "object") return;
    const ra = (details as Record<string, unknown>).review_analysis;
    if (!ra || typeof ra !== "object") return;
    for (const key of ["reviews", "top_liked_reviews"] as const) {
        const list = (ra as Record<string, unknown>)[key];
        if (!Array.isArray(list)) continue;
        for (const review of list) {
            if (review && typeof review === "object" && "likers" in review) {
                (review as Record<string, unknown>).likers = [];
            }
        }
    }
}

/** Build summary payload: details (full results) + preview (small subset for listings). */
export function buildSummaryForPersistence(stats: Record<string, unknown>): Record<string, unknown> {
    const sanitized = safeJsonSanitize(stats);
    redactLikers(sanitized);
    const schema_version = "results_v1";
    const saved_at = new Date().toISOString();

    return {
        schema_version,
        saved_at,
        details: sanitized,
        preview: buildPreview(sanitized, schema_version),
    };
}

/** Extract full results for rendering; supports legacy flat summary. */
export function getDetailsFromSummary(summary: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!summary || typeof summary !== "object") return null;
    if ("details" in summary && summary.details && typeof summary.details === "object") {
        return summary.details as Record<string, unknown>;
    }
    return summary as Record<string, unknown>;
}

/** Extract preview for list views; returns null if no preview. */
export function getPreviewFromSummary(summary: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!summary || typeof summary !== "object") return null;
    if ("preview" in summary && summary.preview && typeof summary.preview === "object") {
        return summary.preview as Record<string, unknown>;
    }
    return null;
}

export type AnalysisStartInput = {
    session_id: string;
    username: string;
    started_at?: string | null;
};

export type AnalysisFinishInput = {
    id: string;
    ok?: boolean | null;
    error_message?: string | null;
    summary?: Record<string, unknown> | null;
    finished_at?: string | null;
};

export async function startAnalysis(input: AnalysisStartInput & { id?: string }) {
    const supabase = getSupabase();
    const payload = {
        id: input.id ?? crypto?.randomUUID?.() ?? `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        session_id: input.session_id,
        username: input.username,
        started_at: input.started_at ?? new Date().toISOString(),
    };
    
    
    const { error } = await supabase
        .from("analysis_runs")
        .insert(payload);
    
    if (error) {
        throw new Error(`Analysis start failed: ${error.message || error.code || 'Unknown error'}`);
    }
    
    return { id: payload.id };
}

/**
 * Extract queryable metrics from the summary payload for the extracted columns
 * (total_films, sinefil_meter, cinematic_persona, average_rating, total_countries).
 * Falls back to available values; missing fields become null.
 */
function extractMetrics(summaryPayload: Record<string, unknown> | null): {
    total_films: number | null;
    sinefil_meter: number | null;
    cinematic_persona: string | null;
    average_rating: number | null;
    total_countries: number | null;
} {
    // Reuse the shared details accessor (handles null + legacy-flat summaries).
    // Producers always emit sinefil_meter/cinematic_persona as objects, so a single
    // typed cast + optional chaining is enough — no bare-scalar fallbacks needed.
    const details = getDetailsFromSummary(summaryPayload) as {
        total_films?: number | null;
        sinefil_meter?: { score?: number | null } | null;
        cinematic_persona?: { persona?: string | null } | null;
        average_rating?: number | null;
        total_countries?: number | null;
    } | null;

    return {
        total_films: details?.total_films ?? null,
        sinefil_meter: details?.sinefil_meter?.score ?? null,
        cinematic_persona: details?.cinematic_persona?.persona ?? null,
        average_rating: details?.average_rating ?? null,
        total_countries: details?.total_countries ?? null,
    };
}

export async function finishAnalysis(input: AnalysisFinishInput) {
    const supabase = getSupabase();
    const summaryPayload = (() => {
        if (!input.summary) return null;
        if ("preview" in input.summary && "details" in input.summary) {
            return input.summary;
        }
        return buildSummaryForPersistence(input.summary);
    })();

    // Extract queryable metric columns from the summary (for cross-user SQL queries)
    const metrics = extractMetrics(summaryPayload);
    
    
    const { error } = await supabase
        .from("analysis_runs")
        .update({
            ok: input.ok ?? null,
            error_message: input.error_message ?? null,
            summary: summaryPayload,
            finished_at: input.finished_at ?? new Date().toISOString(),
            total_films: metrics.total_films,
            sinefil_meter: metrics.sinefil_meter,
            cinematic_persona: metrics.cinematic_persona,
            average_rating: metrics.average_rating,
            total_countries: metrics.total_countries,
        })
        .eq("id", input.id)
        .select('id');
    
    if (error) {
        throw error;
    }
    
}
