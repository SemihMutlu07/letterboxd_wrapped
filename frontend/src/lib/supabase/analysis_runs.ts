"use client";

import { getSupabase } from "@/lib/supabaseClient";

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

export async function finishAnalysis(input: AnalysisFinishInput) {
    const supabase = getSupabase();
    
    
    const { error } = await supabase
        .from("analysis_runs")
        .update({
            ok: input.ok ?? null,
            error_message: input.error_message ?? null,
            summary: input.summary ?? null,
            finished_at: input.finished_at ?? new Date().toISOString(),
        })
        .eq("id", input.id)
        .select('id');
    
    if (error) {
        throw error;
    }
    
}