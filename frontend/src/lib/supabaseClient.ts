"use client";

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

// Enhanced error handling for Supabase configuration
function validateSupabaseConfig(url: string | undefined, anon: string | undefined): void {
  const missingVars = [];
  
  if (!url) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!anon) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  if (missingVars.length > 0) {
    const errorMessage = `Supabase configuration error: Missing ${missingVars.join(', ')}. `;
    
    if (typeof window !== 'undefined') {
      // Client-side: provide helpful guidance
      throw new Error(
        errorMessage + 
        'Please check your Netlify environment variables. ' +
        'If you are a developer, ensure these variables are set in your deployment environment.'
      );
    } else {
      // Server-side: more technical message
      throw new Error(
        errorMessage + 
        'Environment variables must be configured for Supabase integration.'
      );
    }
  }
  
  // Validate URL format
  try {
    new URL(url!);
  } catch {
    throw new Error('Invalid Supabase URL format. Please check NEXT_PUBLIC_SUPABASE_URL configuration.');
  }
  
  // Validate anon key format (basic check)
  if (anon!.length < 20) {
    throw new Error('Invalid Supabase anonymous key format. Please check NEXT_PUBLIC_SUPABASE_ANON_KEY configuration.');
  }
}

// Lazily create the client only when actually used, so build/prerender doesn't crash
export function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;


  try {
    validateSupabaseConfig(url, anon);
  } catch (error) {
    console.error('❌ Supabase configuration error:', error);
    throw error;
  }

  try {
    cachedClient = createClient(url!, anon!, { 
      auth: { persistSession: false },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'X-Client-Info': 'letterboxd-wrapped'
        }
      }
    });
    
    return cachedClient;
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    throw new Error('Failed to initialize Supabase client. Please check your configuration.');
  }
}

export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = getSupabase();
    
    const { count, error } = await supabase
      .from('feedback')
      .select('*', {head: true, count: 'exact'});
    
    if (error) {
      return false;
    }
    
    return typeof count === "number";
  } catch {
    return false;
  }
}