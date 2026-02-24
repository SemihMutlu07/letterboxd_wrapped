// API base configuration
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '');

// Build absolute URLs with query parameters
export function buildUrl(path: string, params: Record<string, string> = {}) {
  const u = new URL(path.startsWith('/') ? path : `/${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

// Enhanced error handling utility
function handleApiError(error: unknown, context: string): Error {
  if (error instanceof Error) {
    // Network errors
    if (error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      return new Error(`Network error: Unable to connect to ${context}. The server may still be starting or your internet connection may be down.`);
    }
    
    // HTTP errors
    if (error.message.includes('analyze') || error.message.includes('test')) {
      const statusMatch = error.message.match(/(\d+)/);
      const status = statusMatch ? statusMatch[1] : 'unknown';
      
      switch (status) {
        case '404':
          return new Error(`${context} not found. The service may be temporarily unavailable.`);
        case '500':
          return new Error(`Server error in ${context}. Please try again later.`);
        case '413':
          return new Error(`File too large for ${context}. Please try with smaller files.`);
        case '429':
          return new Error(`Too many requests to ${context}. Please wait a moment and try again.`);
        default:
          return new Error(`${context} failed (${status}). Please try again.`);
      }
    }
    
    return error;
  }
  
  // Unknown errors
  return new Error(`Unexpected error in ${context}: ${String(error)}`);
}

// Search for person (director/actor) in TMDB
export async function searchPerson(name: string, role: 'director' | 'actor' = 'director') {
  const url = `${API_BASE}/api/tmdb/person/search?name=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}`;
  
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!r.ok) {
      throw new Error(`TMDB search ${r.status}`);
    }
    
    const data = await r.json();
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from TMDB search');
    }
    
    return data;
  } catch (error) {
    const enhancedError = handleApiError(error, 'TMDB search');
    
    // Return a structured error response
    return {
      found: false,
      message: enhancedError.message,
      name: name,
      url: null,
      error: enhancedError.message
    };
  }
}

// Analyze uploaded files
export async function analyzeFiles(formData: FormData) {
  const url = `${API_BASE}/api/analyze`;
  
  try {
    // Validate form data
    if (!formData || formData.entries().next().done) {
      throw new Error('No files provided for analysis');
    }
    
    const r = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    
    if (!r.ok) {
      let detail = '';
      try {
        const body = await r.json();
        // detail can be a string or an object { error_code, message }
        if (typeof body.detail === 'string') {
          detail = body.detail;
        } else if (body.detail && typeof body.detail === 'object') {
          detail = body.detail.message || body.detail.error_code || '';
        }
      } catch {
        // body wasn't JSON — fall through to status code
      }
      throw new Error(detail || `analyze ${r.status}`);
    }

    const data = await r.json();

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from analysis service');
    }

    if (data.status === 'error') {
      throw new Error(data.detail || 'Analysis failed');
    }
    
    return data;
  } catch (error) {
    throw handleApiError(error, 'file analysis');
  }
}

// Test backend connectivity with retry for concurrent startup
export async function testBackend(retries = 5, delayMs = 2000) {
  const url = `${API_BASE}/`;
  if (process.env.NODE_ENV === 'development') {
    console.log('[api] backend health URL:', url);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const r = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!r.ok) {
        throw new Error(`test ${r.status}`);
      }

      const data = await r.json();

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response from backend health check');
      }

      return data;
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (!isLastAttempt) {
        // Wait before retrying — backend may still be booting
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Backend connection timeout. The server may still be starting up.');
      }

      const enhancedError = handleApiError(error, 'the backend');

      if (process.env.NODE_ENV === 'development') {
        console.error('Backend connectivity test failed after retries:', enhancedError);
      }

      throw enhancedError;
    }
  }
}

// Parse Letterboxd username from filename
export async function parseLetterboxdUsername(filename: string) {
  try {
    const url = `${API_BASE}/api/parse-username`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename }),
    });
    
    if (!r.ok) {
      throw new Error(`parse-username ${r.status}`);
    }
    
    const data = await r.json();
    
    // Validate response structure
    if (!data || typeof data !== 'object' || !('username' in data)) {
      throw new Error('Invalid response from username parsing service');
    }
    
    return data;
  } catch (error) {
    const enhancedError = handleApiError(error, 'username parsing');
    
    // Return a structured error response
    return {
      username: null,
      error: enhancedError.message
    };
  }
}
