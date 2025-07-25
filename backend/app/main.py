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
import requests
import time
import hashlib
from dotenv import load_dotenv
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

load_dotenv()

# --- CORS Configuration ---
# We'll read the allowed origins from an environment variable.
# This variable should be a comma-separated string of URLs.
# Example: "http://localhost:3000,https://your-vercel-app.vercel.app"
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(',')

# --- Configuration & Setup ---
app = FastAPI(title="Letterboxd Wrapped API - Comprehensive Edition")
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

session = requests.Session()
session.params = {'api_key': TMDB_API_KEY, 'language': 'en-US'}
CACHE_DIR = Path("tmdb_cache")
CACHE_DIR.mkdir(exist_ok=True)

print("🎬 LETTERBOXD WRAPPED - Comprehensive Backend Edition")
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

# --- Enhanced TMDB Client Logic ---
def tmdb_get(endpoint: str, params: dict = None, cache: bool = True):
    """GET from TMDb API with disk caching and comprehensive error handling"""
    params = params or {}
    params_str = json.dumps(params, sort_keys=True)
    cache_key_hash = hashlib.md5(params_str.encode()).hexdigest()
    cache_file = CACHE_DIR / f"{endpoint.replace('/', '_')}__{cache_key_hash}.json"

    if cache and cache_file.exists():
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass  # If cache is corrupted, fetch fresh data
    
    url = f"https://api.themoviedb.org/3/{endpoint}"
    try:
        response = session.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Save to cache
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        time.sleep(0.2)  # Rate limiting
        return data
    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None

def resolve_tmdb_id(title: str, year: Optional[int] = None) -> Optional[int]:
    """Find TMDb ID for a film with fuzzy matching"""
    query_params = {'query': title, 'include_adult': 'false'}
    if year and not pd.isna(year):
        query_params['year'] = int(year)

    try:
        data = tmdb_get('search/movie', query_params)
        results = data.get('results', []) if data else []
        
        if not results:
            # Try without year if no results
            if year:
                data = tmdb_get('search/movie', {'query': title, 'include_adult': 'false'})
                results = data.get('results', []) if data else []
        
        return results[0]['id'] if results else None
    except:
        return None

def fetch_comprehensive_film_details(tmdb_id: int) -> Dict[str, Any]:
    """Fetch comprehensive film details from TMDb"""
    if pd.isna(tmdb_id):
        return {}

    try:
        # Get basic details, credits, and keywords
        details = tmdb_get(f'movie/{int(tmdb_id)}')
        credits = tmdb_get(f'movie/{int(tmdb_id)}/credits')
        keywords = tmdb_get(f'movie/{int(tmdb_id)}/keywords')
        
        if not details:
            return {}

        # Extract directors (all of them)
        directors = [c['name'] for c in credits.get('crew', []) if c['job'] == 'Director'] if credits else []
        
        # Extract writers
        writers = [c['name'] for c in credits.get('crew', []) 
                  if c['job'] in ['Writer', 'Screenplay', 'Story']] if credits else []
        
        # Extract top cast
        cast = [c['name'] for c in credits.get('cast', [])[:10]] if credits else []
        
        # Extract genres
        genres = [g['name'] for g in details.get('genres', [])]
        
        # Extract production countries
        countries = [c['name'] for c in details.get('production_countries', [])]
        
        # Extract production companies
        companies = [c['name'] for c in details.get('production_companies', [])]
        
        # Extract keywords
        keyword_list = [k['name'] for k in keywords.get('keywords', [])] if keywords else []
        
        # Calculate decade
        release_date = details.get('release_date', '')
        decade = None
        if release_date:
            try:
                year = int(release_date[:4])
                decade = f"{(year // 10) * 10}s"
            except:
                pass

        return {
            'tmdb_id': tmdb_id,
            'title': details.get('title', ''),
            'original_title': details.get('original_title', ''),
            'release_date': release_date,
            'runtime': details.get('runtime'),
            'language': details.get('original_language'),
            'budget': details.get('budget', 0),
            'revenue': details.get('revenue', 0),
            'popularity': details.get('popularity', 0),
            'vote_average': details.get('vote_average', 0),
            'vote_count': details.get('vote_count', 0),
            'decade': decade,
            'tagline': details.get('tagline', ''),
            'overview': details.get('overview', ''),
            'director': directors[0] if directors else None,
            'directors': directors,
            'writers': writers,
            'cast': cast,
            'genres': genres,
            'countries': countries,
            'companies': companies,
            'keywords': keyword_list,
            'adult': details.get('adult', False),
            'status': details.get('status', ''),
            'poster_path': details.get('poster_path', ''),
            'backdrop_path': details.get('backdrop_path', '')
        }
    except Exception as e:
        print(f"Error fetching comprehensive details for ID {tmdb_id}: {e}")
        return {'tmdb_id': tmdb_id}

# --- Enhanced Data Processing Logic ---
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
        item_lower = item.lower()
        if any(required in item_lower for required in ['ratings.csv', 'diary.csv', 'watchlist.csv', 'reviews.csv', 'films.csv']):
            csv_files[item_lower] = os.path.join(extract_dir, item)
            
    update_progress("extracting", f"Found CSV files: {list(csv_files.keys())}", 1, 1)
    return csv_files

def process_comprehensive_letterboxd_data(csv_files: Dict[str, str]) -> Dict[str, Any]:
    """Process Letterboxd data with comprehensive analysis"""
    
    update_progress("loading", "Loading CSV data files...", 0, 4)
    
    # --- Load all CSV files ---
    ratings_df = pd.DataFrame()
    diary_df = pd.DataFrame()
    watchlist_df = pd.DataFrame()
    reviews_df = pd.DataFrame()
    
    try:
        if 'ratings.csv' in csv_files:
            ratings_df = pd.read_csv(csv_files['ratings.csv'])
            update_progress("loading", f"Loaded {len(ratings_df)} ratings", 1, 4)
    except Exception as e:
        print(f"   ⚠️ Could not load ratings.csv: {e}")

    try:
        if 'diary.csv' in csv_files:
            diary_df = pd.read_csv(csv_files['diary.csv'])
            update_progress("loading", f"Loaded {len(diary_df)} diary entries", 2, 4)
    except Exception as e:
        print(f"   ⚠️ Could not load diary.csv: {e}")

    try:
        if 'watchlist.csv' in csv_files:
            watchlist_df = pd.read_csv(csv_files['watchlist.csv'])
            update_progress("loading", f"Loaded {len(watchlist_df)} watchlist items", 3, 4)
    except Exception as e:
        print(f"   ⚠️ Could not load watchlist.csv: {e}")

    try:
        if 'reviews.csv' in csv_files:
            reviews_df = pd.read_csv(csv_files['reviews.csv'])
            update_progress("loading", f"Loaded {len(reviews_df)} reviews", 4, 4)
    except Exception as e:
        print(f"   ⚠️ Could not load reviews.csv: {e}")

    if ratings_df.empty and diary_df.empty:
        raise ValueError("❌ No usable data found. Need at least ratings.csv or diary.csv")

    # --- Create comprehensive film dataset ---
    update_progress("processing", "Building film dataset...", 0, 3)
    
    all_films = []

    # From ratings
    for _, row in ratings_df.iterrows():
        film_entry = {
            'title': row['Name'],
            'year': row['Year'],
            'rating': row['Rating'],
            'source': 'rated'
        }
        if 'Date' in row:
            film_entry['date_rated'] = pd.to_datetime(row['Date'], errors='coerce')
        all_films.append(film_entry)

    # From diary
    for _, row in diary_df.iterrows():
        film_entry = {
            'title': row['Name'],
            'year': row['Year'],
            'source': 'diary'
        }
        if 'Date' in row:
            film_entry['date_watched'] = pd.to_datetime(row['Date'], errors='coerce')
        if 'Rating' in row and pd.notna(row['Rating']):
            film_entry['rating'] = row['Rating']
        if 'Rewatch' in row:
            film_entry['rewatch'] = row['Rewatch'] == 'Yes'
        all_films.append(film_entry)

    films_df = pd.DataFrame(all_films)
    unique_films = films_df[['title', 'year']].drop_duplicates().reset_index(drop=True)
    update_progress("processing", f"Found {len(unique_films)} unique films", 1, 3)

    # --- Resolve TMDb IDs and fetch comprehensive metadata ---
    update_progress("tmdb_matching", "Matching films to TMDb database...", 0, len(unique_films))
    
    # Resolve TMDb IDs with progress
    tmdb_ids = []
    for i, row in unique_films.iterrows():
        if i % 25 == 0:
            update_progress("tmdb_matching", f"Matching films to TMDb database... ({i}/{len(unique_films)})", i, len(unique_films))
        tmdb_ids.append(resolve_tmdb_id(row['title'], row['year']))

    unique_films['tmdb_id'] = tmdb_ids
    match_rate = unique_films['tmdb_id'].notna().mean() * 100
    update_progress("tmdb_matching", f"Matched {match_rate:.1f}% of films to TMDb", len(unique_films), len(unique_films))

    # Fetch comprehensive metadata
    metadata_list = []
    unique_tmdb_ids = unique_films['tmdb_id'].dropna().unique()
    
    update_progress("tmdb_metadata", "Gathering film metadata...", 0, len(unique_tmdb_ids))
    
    for i, tmdb_id in enumerate(unique_tmdb_ids):
        if i % 25 == 0:
            update_progress("tmdb_metadata", f"Gathering metadata... ({i}/{len(unique_tmdb_ids)})", i, len(unique_tmdb_ids))
        metadata_list.append(fetch_comprehensive_film_details(tmdb_id))

    metadata_df = pd.DataFrame(metadata_list)
    
    # Merge everything together
    films_enriched = unique_films.merge(metadata_df, on='tmdb_id', how='left')
    
    update_progress("tmdb_metadata", "Metadata collection complete", len(unique_tmdb_ids), len(unique_tmdb_ids))
    
    # --- Generate Comprehensive Statistics ---
    update_progress("analyzing", "Generating comprehensive statistics...", 0, 10)
    
    stats = {}
    
    # === BASIC STATS ===
    stats['total_films'] = len(unique_films)
    stats['films_with_metadata'] = len(metadata_df)
    stats['metadata_coverage'] = round((len(metadata_df) / len(unique_films)) * 100, 1) if len(unique_films) > 0 else 0
    update_progress("analyzing", "Basic stats complete", 1, 10)
    
    # === RATING ANALYSIS ===
    if 'rating' in films_df.columns and films_df['rating'].notna().any():
        ratings = films_df['rating'].dropna()
        stats['average_rating'] = round(ratings.mean(), 2)
        stats['median_rating'] = round(ratings.median(), 1)
        stats['rating_distribution'] = ratings.value_counts().sort_index().to_dict()
        stats['total_rated_films'] = len(ratings)
        stats['most_common_rating'] = ratings.mode().iloc[0] if not ratings.mode().empty else None
    update_progress("analyzing", "Rating analysis complete", 2, 10)
    
    # === RUNTIME ANALYSIS ===
    if 'runtime' in films_enriched.columns and films_enriched['runtime'].notna().any():
        runtimes = films_enriched['runtime'].dropna()
        total_runtime = int(runtimes.sum())
        stats['total_runtime'] = total_runtime
        stats['hours_watched'] = round(total_runtime / 60, 1)
        stats['days_watched'] = round(total_runtime / (60 * 24), 1)
        stats['average_runtime'] = round(runtimes.mean(), 1)
        stats['median_runtime'] = round(runtimes.median(), 1)
        
        # Find longest and shortest films (with error handling)
        if not runtimes.empty:
            longest_idx = films_enriched['runtime'].idxmax()
            shortest_idx = films_enriched['runtime'].idxmin()
            
            # Safe title extraction with fallback
            longest_title = films_enriched.loc[longest_idx, 'title'] if 'title' in films_enriched.columns and pd.notna(films_enriched.loc[longest_idx, 'title']) else films_enriched.loc[longest_idx, 'title_x'] if 'title_x' in films_enriched.columns else 'Unknown'
            shortest_title = films_enriched.loc[shortest_idx, 'title'] if 'title' in films_enriched.columns and pd.notna(films_enriched.loc[shortest_idx, 'title']) else films_enriched.loc[shortest_idx, 'title_x'] if 'title_x' in films_enriched.columns else 'Unknown'
            
            stats['longest_film'] = {
                'title': longest_title,
                'runtime': int(films_enriched.loc[longest_idx, 'runtime'])
            }
            stats['shortest_film'] = {
                'title': shortest_title,
                'runtime': int(films_enriched.loc[shortest_idx, 'runtime'])
            }
    update_progress("analyzing", "Runtime analysis complete", 3, 10)
    
    # === DIRECTOR ANALYSIS ===
    director_counts = Counter()
    for _, row in films_enriched.iterrows():
        if pd.notna(row['director']):
            director_counts[row['director']] += 1
    
    stats['top_directors'] = [
        {'name': director, 'count': count} 
        for director, count in director_counts.most_common(20)
    ]
    stats['total_directors'] = len(director_counts)
    stats['most_watched_director'] = director_counts.most_common(1)[0] if director_counts else None
    update_progress("analyzing", "Director analysis complete", 4, 10)

    # === GENRE ANALYSIS ===
    genre_counts = Counter()
    for _, row in films_enriched.iterrows():
        if isinstance(row['genres'], list):
            for genre in row['genres']:
                genre_counts[genre] += 1

    stats['top_genres'] = [
        {'name': genre, 'count': count} 
        for genre, count in genre_counts.most_common(15)
    ]
    stats['total_genres'] = len(genre_counts)
    stats['favorite_genre'] = genre_counts.most_common(1)[0] if genre_counts else None
    update_progress("analyzing", "Genre analysis complete", 5, 10)

    # === DECADE ANALYSIS ===
    decade_counts = Counter()
    for _, row in films_enriched.iterrows():
        if pd.notna(row['decade']):
            decade_counts[row['decade']] += 1

    stats['decades'] = [
        {'decade': decade, 'count': count} 
        for decade, count in sorted(decade_counts.items(), key=lambda x: x[0], reverse=True)
    ]
    stats['favorite_decade'] = decade_counts.most_common(1)[0] if decade_counts else None
    update_progress("analyzing", "Decade analysis complete", 6, 10)

    # === COUNTRY ANALYSIS ===
    country_counts = Counter()
    for _, row in films_enriched.iterrows():
        if isinstance(row['countries'], list):
            for country in row['countries']:
                country_counts[country] += 1

    stats['top_countries'] = [
        {'name': country, 'count': count} 
        for country, count in country_counts.most_common(15)
    ]
    stats['total_countries'] = len(country_counts)
    update_progress("analyzing", "Country analysis complete", 7, 10)

    # === LANGUAGE ANALYSIS ===
    language_counts = Counter()
    for _, row in films_enriched.iterrows():
        if pd.notna(row['language']):
            language_counts[row['language']] += 1

    stats['top_languages'] = [
        {'language': lang, 'count': count} 
        for lang, count in language_counts.most_common(10)
    ]
    update_progress("analyzing", "Language analysis complete", 8, 10)

    # === CAST ANALYSIS ===
    cast_counts = Counter()
    for _, row in films_enriched.iterrows():
        if isinstance(row['cast'], list):
            for actor in row['cast']:
                cast_counts[actor] += 1

    stats['top_actors'] = [
        {'name': actor, 'count': count} 
        for actor, count in cast_counts.most_common(20)
    ]
    update_progress("analyzing", "Cast analysis complete", 9, 10)

    # === SPECIAL INSIGHTS ===
    insights = []
    
    if stats.get('days_watched', 0) > 0:
        insights.append({
            'title': 'Time Invested',
            'description': f"You've spent {stats['days_watched']} days of your life watching movies!"
        })
    
    if stats.get('favorite_director'):
        director_name, count = stats['favorite_director']
        insights.append({
            'title': 'Director Obsession',
            'description': f"You're a big fan of {director_name} - you've watched {count} of their films!"
        })
    
    if stats.get('favorite_decade'):
        decade, count = stats['favorite_decade']
        insights.append({
            'title': 'Time Traveler',
            'description': f"You love {decade} cinema with {count} films from that era!"
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
    
    if len(stats.get('top_countries', [])) > 10:
        insights.append({
            'title': 'Global Cinema Explorer',
            'description': f"You've watched films from {stats['total_countries']} different countries!"
        })

    stats['insights'] = insights

    # === RECENT ACTIVITY (Last 12 months) ===
    current_date = datetime.now()
    year_ago = current_date - timedelta(days=365)
    
    recent_stats = {}
    if 'date_watched' in films_df.columns:
        recent_films = films_df[films_df['date_watched'] >= year_ago]
        recent_stats['films_watched_last_year'] = len(recent_films)
    
    if 'date_rated' in films_df.columns:
        recent_ratings = films_df[films_df['date_rated'] >= year_ago]
        recent_stats['films_rated_last_year'] = len(recent_ratings)
    
    stats['recent_activity'] = recent_stats

    # === ADDITIONAL METADATA ===
    stats['analysis_date'] = datetime.now().isoformat()
    stats['total_unique_films'] = len(unique_films)
    stats['has_diary_data'] = not diary_df.empty
    stats['has_ratings_data'] = not ratings_df.empty
    stats['has_watchlist_data'] = not watchlist_df.empty
    stats['has_reviews_data'] = not reviews_df.empty
    
    update_progress("analyzing", "Analysis complete!", 10, 10)
    
    print(f"✅ Comprehensive analysis complete!")
    print(f"   📊 {stats['total_films']} total films analyzed")
    print(f"   🎭 {stats['total_directors']} directors discovered")
    print(f"   🎨 {stats['total_genres']} genres explored")
    print(f"   🌍 {stats['total_countries']} countries represented")
    
    return stats

# --- API Endpoints ---
@app.get("/api/progress")
async def get_progress():
    """Get current analysis progress"""
    return current_progress

@app.post("/api/analyze")
async def analyze_comprehensive_data(file: UploadFile = File(...)):
    """Analyze Letterboxd data with comprehensive insights"""
    
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Please upload a ZIP file containing your Letterboxd data.")
    
    try:
        update_progress("starting", f"Starting comprehensive analysis of {file.filename}", 0, 1)
        
        # Extract CSV files
        csv_files = extract_files(file)
        if not csv_files:
            raise HTTPException(
                status_code=400, 
                detail="No valid Letterboxd CSV files found in the ZIP. Please ensure you have ratings.csv or diary.csv."
            )
        
        # Process with comprehensive analysis
        stats = process_comprehensive_letterboxd_data(csv_files)
        
        update_progress("complete", "Analysis complete! Returning comprehensive stats.", 1, 1)
        
        return {
            "status": "success",
            "message": "Comprehensive Letterboxd analysis complete!",
            "stats": stats
        }
        
    except Exception as e:
        error_msg = f"Analysis failed: {str(e)}"
        update_progress("error", error_msg, 0, 1)
        print(f"❌ Error during analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/")
async def root():
    return {
        "message": "🎬 Letterboxd Wrapped - Comprehensive Backend",
        "version": "2.0.0",
        "features": [
            "Comprehensive TMDb metadata integration",
            "Real-time progress tracking",
            "Decade analysis",
            "Country and language analysis", 
            "Cast and crew insights",
            "Special insights generation",
            "Lifetime statistics (not just yearly)",
            "Enhanced error handling and caching"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)