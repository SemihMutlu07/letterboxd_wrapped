"use client";

import { getSupabase } from "@/lib/supabaseClient";

export type DeviceType = "mobile" | "desktop" | "tablet" | "unknown";

export type FeedbackInsert = {
    session_id: string;
    username: string;
    contact?: string | null;
    message?: string | null;
    os?: string | null;
    device_type?: DeviceType | null;
};

export async function insertFeedback(input: FeedbackInsert) {

    const supabase = getSupabase();
    
    const payload = {
        session_id: input.session_id,
        username: input.username,
        contact: input.contact ?? null,
        message: input.message ?? null,
        os: input.os ?? null,
        device_type: input.device_type ?? null,
    };
    
    
    const {data, error} = await supabase
        .from("feedback")
        .insert(payload)
        .select()
        .single();

    if (error) {
        throw error;
    }
    
    return data;
}