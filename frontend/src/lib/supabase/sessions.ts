"use client";

import { getSupabase } from "@/lib/supabaseClient";

export type Consent = "accept" | "decline";

export type UserSessionInsert = {
    session_id: string;
    username: string;
    consent: Consent;
    film_count: number | null;
    favorite_genre: string | null;
};

export async function upsertUserSession(input: UserSessionInsert) {
    if (!input.session_id || !input.username || (input.consent !== "accept" && input.consent !== "decline")) {
        throw new Error("invalid payload, check session_id, username, and consent.");
    }
    
    
    const supabase = getSupabase();
    const { error } = await supabase
        .from("user_sessions")
        .upsert({
            session_id: input.session_id,
            username: input.username,
            consent: input.consent,
            film_count: input.film_count ?? null,
            favorite_genre: input.favorite_genre ?? null,
        }, { 
            onConflict: "session_id", 
            ignoreDuplicates: false
        });
    
    if (error) {
        throw error;
    }
    
}