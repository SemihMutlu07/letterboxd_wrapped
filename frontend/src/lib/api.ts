// API base configuration
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

// Build absolute URLs with query parameters
export function buildUrl(path: string, params: Record<string, string> = {}) {
  const u = new URL(path.startsWith('/') ? path : `/${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

// Search for person (director/actor) in TMDB
export async function searchPerson(name: string, role: 'director' | 'actor' = 'director') {
  const url = `${API_BASE}/api/tmdb/person/search?name=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}`;
  console.log('[search] GET', url);
  
  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.error(`[search] HTTP ${r.status} for ${name} (${role})`);
      return {
        found: false,
        message: `API error: ${r.status}`,
        name: name,
        url: null
      };
    }
    return r.json();
  } catch (error) {
    console.error(`[search] Network error for ${name} (${role}):`, error);
    return {
      found: false,
      message: 'Network error',
      name: name,
      url: null
    };
  }
}

// Analyze uploaded files
export async function analyzeFiles(formData: FormData) {
  const url = `${API_BASE}/api/analyze`;
  console.log('[analyze] POST', url);
  
  try {
    const r = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!r.ok) {
      console.error(`[analyze] HTTP ${r.status}`);
      throw new Error(`analyze ${r.status}`);
    }
    return r.json();
  } catch (error) {
    console.error('[analyze] Network error:', error);
    throw error;
  }
}

// Test backend connectivity
export async function testBackend() {
  const url = `${API_BASE}/`;
  console.log('[test] GET', url);
  
  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.error(`[test] HTTP ${r.status}`);
      throw new Error(`test ${r.status}`);
    }
    return r.json();
  } catch (error) {
    console.error('[test] Network error:', error);
    throw error;
  }
}
