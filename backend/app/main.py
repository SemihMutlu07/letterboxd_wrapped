# backend/app/main.py
import os
import json
import zipfile
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from collections import Counter, defaultdict
from datetime import datetime, timedelta
import asyncio
import aiohttp
import aiofiles
import time
import hashlib
from dotenv import load_dotenv
from pathlib import Path
import warnings
from contextlib import asynccontextmanager

warnings.filterwarnings('ignore')

load_dotenv()


CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,https://letterboxd-wrapped.netlify.app").split(',')

# --- Application Lifespan (for aiohttp session) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create a persistent aiohttp session
    # We increase the connection limit to allow more concurrent requests to TMDb
    app.state.aiohttp_session = aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(limit_per_host=20) 
    )
    print("🚀 FastAPI app startup: aiohttp session created.")
    yield
    # Shutdown: Gracefully close the session
    await app.state.aiohttp_session.close()
    print("🌙 FastAPI app shutdown: aiohttp session closed.")

# --- Configuration & Setup ---
app = FastAPI(
    title="Letterboxd Wrapped API - High-Speed Edition",
    lifespan=lifespan
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
if not TMDB_API_KEY:
    raise RuntimeError("TMDB_API_KEY not found in .env file")

CACHE_DIR = Path("tmdb_cache")
CACHE_DIR.mkdir(exist_ok=True)

print("🎬 LETTERBOXD WRAPPED - High-Speed Backend Edition")
print("=" * 60)

# Global progress tracking
current_progress = {
    "stage": "idle",
    "message": "Ready to analyze",
    "progress": 0,
    "total": 0
}

def update_progress(stage: str, message: str, progress: int = 0, total: int = 0):
    """Update global progress state"""
    global current_progress
    current_progress.update({
        "stage": stage,
        "message": message,
        "progress": progress,
        "total": total
    })
    print(f"📊 {stage}: {message} ({progress}/{total})")

# --- Enhanced TMDB Client Logic (Async) ---
async def tmdb_get(session: aiohttp.ClientSession, endpoint: str, params: dict = None, cache: bool = True):
    """Asynchronously GET from TMDb API with disk caching and concurrency."""
    params = params or {}
    # Add API key to every request
    params['api_key'] = TMDB_API_KEY
    
    params_str = json.dumps(params, sort_keys=True)
    cache_key_hash = hashlib.md5(f"{endpoint}{params_str}".encode()).hexdigest()
    cache_file = CACHE_DIR / f"{cache_key_hash}.json"

    if cache and cache_file.exists():
        try:
            async with aiofiles.open(cache_file, 'r', encoding='utf-8') as f:
                return json.loads(await f.read())
        except Exception:
            pass  # If cache is corrupted, fetch fresh data
    
    url = f"https://api.themoviedb.org/3/{endpoint}"
    try:
        async with session.get(url, params=params) as response:
            response.raise_for_status()
            data = await response.json()
            
            # Asynchronously save to cache
            async with aiofiles.open(cache_file, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(data, ensure_ascii=False, indent=2))
            
            # A smaller sleep is fine now due to controlled concurrency
            await asyncio.sleep(0.05)
            return data
    except aiohttp.ClientError as e:
        print(f"Error fetching {url}: {e}")
        return None

async def resolve_tmdb_id(session: aiohttp.ClientSession, title: str, year: Optional[int] = None) -> Optional[int]:
    """Asynchronously find TMDb ID for a film."""
    query_params = {'query': title, 'include_adult': 'false'}
    if year and not pd.isna(year):
        query_params['year'] = int(year)

    try:
        data = await tmdb_get(session, 'search/movie', query_params)
        results = data.get('results', []) if data else []
        
        if not results and year:
            # Try without year if no results
            data = await tmdb_get(session, 'search/movie', {'query': title, 'include_adult': 'false'})
            results = data.get('results', []) if data else []
        
        return results[0]['id'] if results else None
    except Exception:
        return None

async def fetch_comprehensive_film_details(session: aiohttp.ClientSession, tmdb_id: int) -> Dict[str, Any]:
    """Fetch comprehensive film details from TMDb by running API calls concurrently."""
    if pd.isna(tmdb_id):
        return {}

    try:
        # Concurrently fetch details, credits, and keywords for a single film
        tasks = {
            "details": tmdb_get(session, f'movie/{int(tmdb_id)}'),
            "credits": tmdb_get(session, f'movie/{int(tmdb_id)}/credits'),
            "keywords": tmdb_get(session, f'movie/{int(tmdb_id)}/keywords')
        }
        results = await asyncio.gather(*tasks.values())
        details, credits, keywords = results
        
        if not details:
            return {}

        # The rest of this function is fast, synchronous data processing
        directors = [c['name'] for c in credits.get('crew', []) if c['job'] == 'Director'] if credits else []
        writers = [c['name'] for c in credits.get('crew', []) if c['job'] in ['Writer', 'Screenplay', 'Story']] if credits else []
        cast = [c['name'] for c in credits.get('cast', [])[:10]] if credits else []
        genres = [g['name'] for g in details.get('genres', [])]
        countries = [c['name'] for c in details.get('production_countries', [])]
        companies = [c['name'] for c in details.get('production_companies', [])]
        keyword_list = [k['name'] for k in keywords.get('keywords', [])] if keywords else []
        
        release_date = details.get('release_date', '')
        decade = None
        if release_date:
            try:
                year = int(release_date[:4])
                decade = f"{(year // 10) * 10}s"
            except ValueError:
                pass

        return {
            'tmdb_id': tmdb_id, 'title': details.get('title', ''), 'original_title': details.get('original_title', ''),
            'release_date': release_date, 'runtime': details.get('runtime'), 'language': details.get('original_language'),
            'budget': details.get('budget', 0), 'revenue': details.get('revenue', 0), 'popularity': details.get('popularity', 0),
            'vote_average': details.get('vote_average', 0), 'vote_count': details.get('vote_count', 0), 'decade': decade,
            'tagline': details.get('tagline', ''), 'overview': details.get('overview', ''),
            'director': directors[0] if directors else None, 'directors': directors, 'writers': writers, 'cast': cast,
            'genres': genres, 'countries': countries, 'companies': companies, 'keywords': keyword_list,
            'adult': details.get('adult', False), 'status': details.get('status', ''),
            'poster_path': details.get('poster_path', ''), 'backdrop_path': details.get('backdrop_path', '')
        }
    except Exception as e:
        print(f"Error fetching comprehensive details for ID {tmdb_id}: {e}")
        return {'tmdb_id': tmdb_id}

# --- Data Processing Logic (File I/O part remains synchronous) ---
def extract_files(upload_file: UploadFile) -> Dict[str, str]:
    """Extract CSV files from uploaded ZIP"""
    update_progress("extracting", "Extracting ZIP file...", 0, 1)
    
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    file_path = upload_dir / upload_file.filename
    with open(file_path, "wb") as buffer:
        buffer.write(upload_file.file.read())

    extract_dir = upload_dir / upload_file.filename.replace('.zip', '_extracted')
    extract_dir.mkdir(exist_ok=True)
    
    with zipfile.ZipFile(file_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
        
    csv_files = {}
    for item in os.listdir(extract_dir):
        if any(required in item.lower() for required in ['ratings.csv', 'diary.csv', 'watchlist.csv', 'reviews.csv', 'films.csv']):
            csv_files[item.lower()] = os.path.join(extract_dir, item)
            
    update_progress("extracting", f"Found CSV files: {list(csv_files.keys())}", 1, 1)
    return csv_files

async def process_comprehensive_letterboxd_data(session: aiohttp.ClientSession, csv_files: Dict[str, str]) -> Dict[str, Any]:
    """Process Letterboxd data with high-speed, concurrent analysis."""
    
    update_progress("loading", "Loading CSV data files...", 0, 4)
    
    # --- Load all CSV files ---
    ratings_df = pd.read_csv(csv_files['ratings.csv']) if 'ratings.csv' in csv_files else pd.DataFrame()
    diary_df = pd.read_csv(csv_files['diary.csv']) if 'diary.csv' in csv_files else pd.DataFrame()
    watchlist_df = pd.read_csv(csv_files['watchlist.csv']) if 'watchlist.csv' in csv_files else pd.DataFrame()
    reviews_df = pd.read_csv(csv_files['reviews.csv']) if 'reviews.csv' in csv_files else pd.DataFrame()

    if ratings_df.empty and diary_df.empty:
        raise ValueError("❌ No usable data found. Need at least ratings.csv or diary.csv")

    # --- Film Dataset Creation (Synchronous Pandas) ---
    all_films = []
    # Combine ratings and diary, standardizing column names
    if not ratings_df.empty:
        df = ratings_df.rename(columns={'Name': 'title', 'Year': 'year', 'Rating': 'rating'})
        all_films.extend(df.to_dict('records'))
    if not diary_df.empty:
        df = diary_df.rename(columns={'Name': 'title', 'Year': 'year', 'Rating': 'rating'})
        # Avoid duplicating films if they are in both ratings and diary
        if not all_films:
            all_films.extend(df.to_dict('records'))
        else:
            # Add only diary entries for films not already present from ratings
            temp_df = pd.DataFrame(all_films)
            merged_df = df.merge(temp_df[['title', 'year']], on=['title', 'year'], how='left', indicator=True)
            all_films.extend(merged_df[merged_df['_merge'] == 'left_only'].to_dict('records'))

    films_df = pd.DataFrame(all_films)
    unique_films = films_df[['title', 'year']].drop_duplicates().reset_index(drop=True)
    update_progress("processing", f"Found {len(unique_films)} unique films", 1, 3)

    # --- Concurrent TMDb ID Resolution ---
    update_progress("tmdb_matching", "Matching films to TMDb (fast)...", 0, len(unique_films))
    resolve_tasks = [resolve_tmdb_id(session, row['title'], row['year']) for _, row in unique_films.iterrows()]
    tmdb_ids = await asyncio.gather(*resolve_tasks)
    unique_films['tmdb_id'] = tmdb_ids
    match_rate = unique_films['tmdb_id'].notna().mean() * 100
    update_progress("tmdb_matching", f"Matched {match_rate:.1f}% of films", len(unique_films), len(unique_films))

    # --- Concurrent Metadata Fetching ---
    unique_tmdb_ids = unique_films['tmdb_id'].dropna().unique()
    update_progress("tmdb_metadata", "Gathering film metadata (fast)...", 0, len(unique_tmdb_ids))
    fetch_tasks = [fetch_comprehensive_film_details(session, tmdb_id) for tmdb_id in unique_tmdb_ids]
    metadata_results = await asyncio.gather(*fetch_tasks)
    metadata_df = pd.DataFrame([m for m in metadata_results if m])
    update_progress("tmdb_metadata", "Metadata collection complete", len(unique_tmdb_ids), len(unique_tmdb_ids))
    
    # --- Final Data Merging and Analysis (Synchronous Pandas) ---
    films_enriched = pd.merge(unique_films, metadata_df, on='tmdb_id', how='left', suffixes=('_csv', '_tmdb'))
    
    # Consolidate title: prefer TMDb title, fallback to CSV title
    if 'title_tmdb' in films_enriched.columns:
        films_enriched['title'] = films_enriched['title_tmdb'].fillna(films_enriched['title_csv'])
    else:
        films_enriched['title'] = films_enriched['title_csv']
    
    # Clean up duplicated columns
    films_enriched.drop(columns=[col for col in ['title_csv', 'title_tmdb'] if col in films_enriched.columns], inplace=True)
    
    update_progress("analyzing", "Generating comprehensive statistics...", 0, 10)
    
    # The rest of the analysis is CPU-bound and remains synchronous
    stats = {}
    
    # === BASIC STATS ===
    stats['total_films'] = len(unique_films)
    stats['films_with_metadata'] = len(metadata_df)
    stats['metadata_coverage'] = round((len(metadata_df) / len(unique_films)) * 100, 1) if len(unique_films) > 0 else 0
    update_progress("analyzing", "Basic stats complete", 1, 10)
    
    # === RATING ANALYSIS (Restored from original for more detail) ===
    if 'rating' in films_df.columns and films_df['rating'].notna().any():
        ratings = films_df['rating'].dropna()
        stats['average_rating'] = round(ratings.mean(), 2)
        stats['median_rating'] = round(ratings.median(), 1)
        stats['rating_distribution'] = ratings.value_counts().sort_index().to_dict()
        stats['total_rated_films'] = len(ratings)
        stats['most_common_rating'] = ratings.mode().iloc[0] if not ratings.mode().empty else None
    update_progress("analyzing", "Rating analysis complete", 2, 10)
    
    # === RUNTIME ANALYSIS (Restored and fixed) ===
    if 'runtime' in films_enriched.columns and films_enriched['runtime'].notna().any():
        runtimes = films_enriched[films_enriched['runtime'] > 0]['runtime'].dropna()
        if not runtimes.empty:
            total_runtime = int(runtimes.sum())
            stats['total_runtime'] = total_runtime
            stats['hours_watched'] = round(total_runtime / 60, 1)
            stats['days_watched'] = round(total_runtime / (60 * 24), 1)
            stats['average_runtime'] = round(runtimes.mean(), 1)
            stats['median_runtime'] = round(runtimes.median(), 1)
            
            longest_film_data = films_enriched.loc[runtimes.idxmax()]
            shortest_film_data = films_enriched.loc[runtimes.idxmin()]
            
            stats['longest_film'] = {
                'title': longest_film_data['title'],
                'runtime': int(longest_film_data['runtime'])
            }
            stats['shortest_film'] = {
                'title': shortest_film_data['title'],
                'runtime': int(shortest_film_data['runtime'])
            }
    update_progress("analyzing", "Runtime analysis complete", 3, 10)
    
    # === DETAILED ANALYSIS (Restored from original) ===
    director_counts = Counter(films_enriched['director'].dropna())
    stats['top_directors'] = [{'name': name, 'count': count} for name, count in director_counts.most_common(20)]
    stats['total_directors'] = len(director_counts)
    if director_counts:
        name, count = director_counts.most_common(1)[0]
        stats['most_watched_director'] = {'name': name, 'count': count}
    else:
        stats['most_watched_director'] = None
    update_progress("analyzing", "Director analysis complete", 4, 10)

    genre_counts = Counter([g for genres in films_enriched['genres'].dropna() for g in genres])
    stats['top_genres'] = [{'name': name, 'count': count} for name, count in genre_counts.most_common(15)]
    if genre_counts:
        name, count = genre_counts.most_common(1)[0]
        stats['favorite_genre'] = {'name': name, 'count': count}
    else:
        stats['favorite_genre'] = None
    update_progress("analyzing", "Genre analysis complete", 5, 10)

    decade_counts = Counter(films_enriched['decade'].dropna())
    stats['decades'] = [{'decade': d, 'count': c} for d, c in sorted(decade_counts.items(), key=lambda x: x[0], reverse=True)]
    if decade_counts:
        name, count = decade_counts.most_common(1)[0]
        stats['favorite_decade'] = {'name': name, 'count': count}
    else:
        stats['favorite_decade'] = None
    update_progress("analyzing", "Decade analysis complete", 6, 10)

    country_counts = Counter([c for countries in films_enriched['countries'].dropna() for c in countries])
    stats['top_countries'] = [{'name': name, 'count': count} for name, count in country_counts.most_common(15)]
    stats['total_countries'] = len(country_counts)
    update_progress("analyzing", "Country analysis complete", 7, 10)

    language_counts = Counter(films_enriched['language'].dropna())
    stats['top_languages'] = [{'language': lang, 'count': count} for lang, count in language_counts.most_common(10)]
    update_progress("analyzing", "Language analysis complete", 8, 10)

    cast_counts = Counter([actor for cast_list in films_enriched['cast'].dropna() for actor in cast_list])
    stats['top_actors'] = [{'name': name, 'count': count} for name, count in cast_counts.most_common(20)]
    update_progress("analyzing", "Cast analysis complete", 9, 10)

    # === SPECIAL INSIGHTS (Restored) ===
    insights = []
    if stats.get('days_watched', 0) > 0:
        insights.append({
            'title': 'Time Invested',
            'description': f"You've spent {stats['days_watched']} days of your life watching movies!"
        })
    if stats.get('most_watched_director'):
        insights.append({
            'title': 'Director Obsession',
            'description': f"You're a big fan of {stats['most_watched_director']['name']} - you've watched {stats['most_watched_director']['count']} of their films!"
        })
    if stats.get('favorite_decade'):
        insights.append({
            'title': 'Time Traveler',
            'description': f"You love {stats['favorite_decade']['name']} cinema with {stats['favorite_decade']['count']} films from that era!"
        })
    if stats.get('average_rating', 0) > 4:
        insights.append({
            'title': 'Easy to Please',
            'description': f"You're generous with ratings - averaging {stats['average_rating']}★!"
        })
    elif stats.get('average_rating', 0) < 3:
        insights.append({
            'title': 'Tough Critic',
            'description': f"You're a tough critic with an average rating of {stats['average_rating']}★"
        })
    if stats.get('total_countries', 0) > 10:
        insights.append({
            'title': 'Global Cinema Explorer',
            'description': f"You've watched films from {stats['total_countries']} different countries!"
        })
    stats['insights'] = insights

    # === FINAL WRAP-UP ===
    stats['analysis_date'] = datetime.now().isoformat()
    update_progress("analyzing", "Analysis complete!", 10, 10)
    return stats

# --- API Endpoints ---
@app.get("/api/progress")
async def get_progress():
    """Get current analysis progress"""
    return current_progress

@app.post("/api/analyze")
async def analyze_comprehensive_data(file: UploadFile = File(...)):
    """Analyze Letterboxd data with high-speed, concurrent processing."""
    
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Please upload a ZIP file.")
    
    try:
        update_progress("starting", f"Starting analysis of {file.filename}", 0, 1)
        csv_files = extract_files(file)
        
        # Use the session from the application state
        stats = await process_comprehensive_letterboxd_data(app.state.aiohttp_session, csv_files)
        
        update_progress("complete", "Analysis complete! Returning stats.", 1, 1)
        return {"status": "success", "stats": stats}
        
    except Exception as e:
        error_msg = f"Analysis failed: {str(e)}"
        update_progress("error", error_msg, 0, 1)
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/")
async def root():
    return {"message": "🎬 Letterboxd Wrapped - High-Speed Backend"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)