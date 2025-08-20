import { NextRequest, NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  console.log(`🎬 TMDB API Request for director: ${name}`);

  if (!name) {
    return NextResponse.json({ error: 'Name parameter is required' }, { status: 400 });
  }

  if (!TMDB_API_KEY) {
    console.warn('❌ TMDB_API_KEY not configured, director photos will not be available');
    console.warn('📝 Please add TMDB_API_KEY to your .env.local file');
    console.warn('🔗 Get your API key from: https://www.themoviedb.org/settings/api');
    return NextResponse.json({ profile_path: null, error: 'API key not configured' });
  }

  try {
    console.log(`🔍 Searching TMDB for: ${name}`);
    const response = await fetch(
      `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&include_adult=false`
    );

    if (!response.ok) {
      console.error(`❌ TMDB API error: ${response.status}`);
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`📊 TMDB results for ${name}:`, data.results?.length || 0, 'results');
    
    // Return the first result if available
    if (data.results && data.results.length > 0) {
      const person = data.results[0];
      console.log(`✅ Found director: ${person.name} - Photo: ${person.profile_path ? 'Yes' : 'No'}`);
      return NextResponse.json({
        profile_path: person.profile_path,
        name: person.name,
        known_for_department: person.known_for_department
      });
    }

    console.log(`⚠️ No results found for director: ${name}`);
    return NextResponse.json({ profile_path: null });
  } catch (error) {
    console.error('❌ Error fetching person from TMDB:', error);
    return NextResponse.json({ profile_path: null });
  }
}
