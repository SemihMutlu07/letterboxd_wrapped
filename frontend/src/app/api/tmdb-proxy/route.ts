import { NextRequest, NextResponse } from 'next/server';

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w185';
const NUM_PAGES_TO_FETCH = 10;

const fetchWithRetry = async (url: string, retries = 3, backoff = 500) => {
    for (let i = 0; i < retries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                return response.json();
            }
            if (response.status >= 500) {
                console.warn(`TMDB Server Error (${response.status}) for URL: ${url}, attempt ${i + 1}`);
                if (i === retries - 1) throw new Error(`Final attempt failed with status ${response.status}`);
                await new Promise(resolve => setTimeout(resolve, backoff * (i + 1)));
            } else {
                throw new Error(`Request failed with status ${response.status}`);
            }
        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`Error fetching URL ${url} (attempt ${i + 1}/${retries}):`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, backoff * (i + 1)));
        }
    }
    return null;
};

export async function POST(request: NextRequest) {
    const { directors } = await request.json();

    if (!Array.isArray(directors) || directors.length === 0) {
        return NextResponse.json({ error: 'An array of director names is required' }, { status: 400 });
    }

    const apiKey = process.env.TMDB_API_KEY;

    if (!apiKey) {
        console.error("TMDB API key is missing on the server.");
        return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 });
    }

    try {
        const directorImageMap = new Map<string, string>();

        const pagePromises = Array.from({ length: NUM_PAGES_TO_FETCH }, (_, i) => 
            fetchWithRetry(`https://api.themoviedb.org/3/person/popular?api_key=${apiKey}&language=en-US&page=${i + 1}`)
        );

        const pages = await Promise.allSettled(pagePromises);
        
        pages.forEach(result => {
            if (result.status === 'fulfilled' && result.value?.results) {
                result.value.results.forEach((person: any) => {
                    if (person.profile_path) {
                        directorImageMap.set(person.name.toLowerCase(), person.profile_path);
                    }
                });
            } else if (result.status === 'rejected') {
                console.error("Failed to fetch a popular people page:", result.reason);
            }
        });

        const matchedImages: Record<string, string | null> = {};
        directors.forEach((directorName: string) => {
            const profilePath = directorImageMap.get(directorName.toLowerCase());
            matchedImages[directorName] = profilePath ? `${TMDB_IMAGE_BASE_URL}${profilePath}` : null;
        });

        return NextResponse.json({ images: matchedImages });
    } catch (error) {
        console.error('Error in TMDB proxy while fetching popular people:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 