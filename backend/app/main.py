# backend/app/main.py
import os
import json
import zipfile
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
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
import uuid
from io import BytesIO

warnings.filterwarnings('ignore')

load_dotenv()


CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://movieswrapped.netlify.app",
    "https://letterboxd-wrapped.netlify.app",
    "https://wrapped-backend.onrender.com"
]

# Add all Netlify domains dynamically
if os.getenv("ALLOW_ALL_NETLIFY", "true").lower() == "true":
    CORS_ORIGINS.append("https://*.netlify.app")

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

# --- Simple Rate Limiter (memory) ---
RATE_LIMIT_WINDOW_SECONDS = 600  # 10 minutes
RATE_LIMIT_MAX_REQUESTS = 3
rate_limiter: dict[str, list[float]] = {}

def _rl_prune(now: float, events: list[float]) -> list[float]:
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS
    return [t for t in events if t >= cutoff]

def check_rate_limit(client_key: str) -> bool:
    now = time.time()
    events = rate_limiter.get(client_key, [])
    events = _rl_prune(now, events)
    allowed = len(events) < RATE_LIMIT_MAX_REQUESTS
    if allowed:
        events.append(now)
        rate_limiter[client_key] = events
    return allowed

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
        
        # Enhanced: Store both name lists (for backward compatibility) AND full objects
        countries = [c['name'] for c in details.get('production_countries', [])]
        production_countries = details.get('production_countries', [])  # Full objects with iso_3166_1, name
        
        companies = [c['name'] for c in details.get('production_companies', [])]
        
        # Enhanced: Store both name lists (for backward compatibility) AND full objects  
        keyword_list = [k['name'] for k in keywords.get('keywords', [])] if keywords else []
        keywords_full = keywords.get('keywords', []) if keywords else []  # Full objects with id, name
        
        release_date = details.get('release_date', '')
        decade = None
        if release_date:
            try:
                year = int(release_date[:4])
                decade = f"{(year // 10) * 10}s"
            except ValueError:
                pass

        return {
            'tmdb_id': tmdb_id, 
            'title': details.get('title', ''), 
            'original_title': details.get('original_title', ''),
            'release_date': release_date, 
            'runtime': details.get('runtime'), 
            'language': details.get('original_language'),
            
            # Enhanced: Ensure these critical fields are always present with defaults
            'budget': details.get('budget', 0), 
            'revenue': details.get('revenue', 0), 
            'popularity': details.get('popularity', 0.0),
            
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
            
            # Enhanced: Both backward-compatible and full object versions
            'countries': countries,  # Backward compatibility - list of country names
            'production_countries': production_countries,  # Full objects for advanced analysis
            
            'companies': companies, 
            
            # Enhanced: Both backward-compatible and full object versions
            'keywords': keyword_list,  # Backward compatibility - list of keyword names
            'keywords_full': keywords_full,  # Full objects for advanced analysis
            
            'adult': details.get('adult', False), 
            'status': details.get('status', ''),
            'poster_path': details.get('poster_path', ''), 
            'backdrop_path': details.get('backdrop_path', '')
        }
    except Exception as e:
        print(f"Error fetching comprehensive details for ID {tmdb_id}: {e}")
        return {'tmdb_id': tmdb_id}


# This function is no longer needed as its logic is integrated into the endpoint.
# def extract_files(upload_file: UploadFile) -> Dict[str, str]:
#     ...

async def process_comprehensive_letterboxd_data(session: aiohttp.ClientSession, csv_files: Dict[str, str]) -> Dict[str, Any]:
    """Process Letterboxd data with high-speed, concurrent analysis."""
    
    update_progress("loading", "Loading CSV data files...", 0, 4)
    
    # --- Load all CSV files ---
    watched_df = pd.read_csv(csv_files['watched.csv']) if 'watched.csv' in csv_files else pd.DataFrame()
    ratings_df = pd.read_csv(csv_files['ratings.csv']) if 'ratings.csv' in csv_files else pd.DataFrame()
    diary_df = pd.read_csv(csv_files['diary.csv']) if 'diary.csv' in csv_files else pd.DataFrame()
    
    if watched_df.empty:
        raise ValueError("❌ watched.csv is required for analysis.")

    # --- Film Dataset Creation (Synchronous Pandas) ---
    # Use watched.csv as the single source of truth
    films_df = watched_df.rename(columns={'Name': 'title', 'Year': 'year'})
    
    # Merge ratings into the main dataframe
    if not ratings_df.empty:
        ratings_df_renamed = ratings_df[['Name', 'Year', 'Rating']].rename(columns={'Name': 'title', 'Year': 'year', 'Rating': 'rating'})
        films_df = pd.merge(films_df, ratings_df_renamed, on=['title', 'year'], how='left')

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
    
    # === ENRICHED FILM DATA FOR STORYTELLING ===
    # Make enriched film-level data available for future personality/storytelling features
    stats['enriched_films_summary'] = {
        'total_enriched': len(films_enriched[films_enriched['tmdb_id'].notna()]),
        'budget_data_available': len(films_enriched[films_enriched['budget'] > 0]),
        'revenue_data_available': len(films_enriched[films_enriched['revenue'] > 0]),
        'popularity_data_available': len(films_enriched[films_enriched['popularity'] > 0]),
        'keywords_data_available': len(films_enriched[films_enriched['keywords_full'].apply(lambda x: isinstance(x, list) and len(x) > 0)]),
        'countries_data_available': len(films_enriched[films_enriched['production_countries'].apply(lambda x: isinstance(x, list) and len(x) > 0)])
    }
    
    # Data Quality & Coverage Report for Storytelling Features
    total_films = len(films_enriched)
    stats['data_quality_report'] = {
        'total_films_analyzed': total_films,
        'tmdb_match_rate': round((len(films_enriched[films_enriched['tmdb_id'].notna()]) / total_films) * 100, 1) if total_films > 0 else 0,
        'budget_coverage': round((len(films_enriched[films_enriched['budget'] > 0]) / total_films) * 100, 1) if total_films > 0 else 0,
        'revenue_coverage': round((len(films_enriched[films_enriched['revenue'] > 0]) / total_films) * 100, 1) if total_films > 0 else 0,
        'popularity_coverage': round((len(films_enriched[films_enriched['popularity'] > 0]) / total_films) * 100, 1) if total_films > 0 else 0,
        'keywords_coverage': round((len(films_enriched[films_enriched['keywords_full'].apply(lambda x: isinstance(x, list) and len(x) > 0)]) / total_films) * 100, 1) if total_films > 0 else 0,
        'countries_coverage': round((len(films_enriched[films_enriched['production_countries'].apply(lambda x: isinstance(x, list) and len(x) > 0)]) / total_films) * 100, 1) if total_films > 0 else 0,
        'storytelling_readiness': 'excellent' if total_films > 0 and (len(films_enriched[films_enriched['tmdb_id'].notna()]) / total_films) > 0.8 else 'good' if total_films > 0 and (len(films_enriched[films_enriched['tmdb_id'].notna()]) / total_films) > 0.6 else 'limited'
    }
    
    # Store aggregated data that will enable rich storytelling features
    if not films_enriched.empty:
        # Budget & Revenue Analysis for "Expensive Taste" or "Indie Lover" personas
        valid_budgets = films_enriched[films_enriched['budget'] > 0]['budget']
        valid_revenues = films_enriched[films_enriched['revenue'] > 0]['revenue']
        
        if not valid_budgets.empty:
            stats['budget_analytics'] = {
                'average_budget': float(valid_budgets.mean()),
                'median_budget': float(valid_budgets.median()),
                'total_budget_watched': float(valid_budgets.sum()),
                'highest_budget': float(valid_budgets.max()),
                'budget_range_preference': 'high' if valid_budgets.median() > 50000000 else 'medium' if valid_budgets.median() > 10000000 else 'low'
            }
        
        if not valid_revenues.empty:
            stats['revenue_analytics'] = {
                'average_revenue': float(valid_revenues.mean()),
                'median_revenue': float(valid_revenues.median()),
                'total_revenue_watched': float(valid_revenues.sum()),
                'highest_revenue': float(valid_revenues.max())
            }
        
        # Popularity Score Analysis for "Mainstream vs Niche" persona
        valid_popularity = films_enriched[films_enriched['popularity'] > 0]['popularity']
        if not valid_popularity.empty:
            stats['popularity_analytics'] = {
                'average_popularity': float(valid_popularity.mean()),
                'median_popularity': float(valid_popularity.median()),
                'popularity_variance': float(valid_popularity.std()) if len(valid_popularity) > 1 else 0,
                'mainstream_percentage': float((valid_popularity > 20).mean() * 100),
                'niche_percentage': float((valid_popularity < 5).mean() * 100)
            }
        
        # Keywords Analysis for "Thematic Interests" storytelling
        all_keywords = []
        for keywords_list in films_enriched['keywords_full'].dropna():
            if isinstance(keywords_list, list):
                all_keywords.extend([kw.get('name', '') for kw in keywords_list if isinstance(kw, dict)])
        
        if all_keywords:
            from collections import Counter
            keyword_counts = Counter(all_keywords)
            stats['keywords_analytics'] = {
                'total_unique_keywords': len(keyword_counts),
                'top_keywords': [{'keyword': k, 'count': v} for k, v in keyword_counts.most_common(20)],
                'keyword_diversity': len(keyword_counts) / len(all_keywords) if all_keywords else 0
            }
        
        # Production Countries Analysis for "World Cinema Explorer" storytelling
        all_countries = []
        for countries_list in films_enriched['production_countries'].dropna():
            if isinstance(countries_list, list):
                all_countries.extend([country.get('name', '') for country in countries_list if isinstance(country, dict)])
        
        if all_countries:
            from collections import Counter
            country_counts = Counter(all_countries)
            stats['countries_analytics'] = {
                'total_countries_explored': len(country_counts),
                'top_countries_detailed': [
                    {
                        'country': country, 
                        'count': count,
                        'percentage': (count / len(all_countries)) * 100
                    } for country, count in country_counts.most_common(10)
                ],
                'geographic_diversity': len(country_counts) / len(all_countries) if all_countries else 0,
                'international_percentage': float((1 - country_counts.get('United States', 0) / len(all_countries)) * 100) if all_countries else 0
            }
    
    # === BASIC STATS ===
    stats['total_films'] = len(films_df)
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

    # Date analysis
    if not diary_df.empty:
        # Find date column
        date_column = None
        possible_date_columns = ['Watched Date', 'Date', 'Watch Date', 'Watched', 'Date Watched', 'WatchedDate']
        
        for col in possible_date_columns:
            if col in diary_df.columns:
                date_column = col
                break
        
        if date_column:
            # Parse dates
            diary_df['parsed_date'] = pd.to_datetime(diary_df[date_column], errors='coerce')
            valid_dates = diary_df.dropna(subset=['parsed_date'])
        else:
            date_column = None
            valid_dates = pd.DataFrame()
    else:
        date_column = None
        valid_dates = pd.DataFrame()
    
    # Get dates from diary.csv or fallback to watched.csv
    date_data = None
    date_source = "diary"
    
    if date_column and not valid_dates.empty:
        # Use diary.csv if enough data
        if len(valid_dates) >= 5:
            date_data = valid_dates
        else:
            date_data = None
    
    # Fallback to watched.csv
    if date_data is None and not watched_df.empty:
        # Find date column in watched.csv
        watched_date_column = None
        for col in ['Date', 'Watched Date', 'Watch Date']:
            if col in watched_df.columns:
                watched_date_column = col
                break
        
        if watched_date_column:
            watched_df['parsed_date'] = pd.to_datetime(watched_df[watched_date_column], errors='coerce')
            watched_valid_dates = watched_df.dropna(subset=['parsed_date'])
            
            if not watched_valid_dates.empty:
                date_data = watched_valid_dates
                date_source = "watched"
    
    if date_data is not None:
        # Monthly habits
        date_data['year_month'] = date_data['parsed_date'].dt.strftime('%Y-%m')
        monthly_counts = date_data['year_month'].value_counts().sort_index()
        
        monthly_viewing_habits = []
        for year_month, count in monthly_counts.items():
            monthly_viewing_habits.append({'month': year_month, 'count': int(count)})
        
        stats['monthly_viewing_habits'] = monthly_viewing_habits
        
        # Weekday/weekend analysis
        date_data['day_of_week'] = date_data['parsed_date'].dt.dayofweek
        weekday_count = len(date_data[date_data['day_of_week'] < 5])  # Mon=0, Fri=4
        weekend_count = len(date_data[date_data['day_of_week'] >= 5])  # Sat=5, Sun=6
        
        stats['day_of_week_pattern'] = {
            'weekday': weekday_count,
            'weekend': weekend_count
        }
        
        # Timeline analysis
        earliest_date = date_data['parsed_date'].min()
        latest_date = date_data['parsed_date'].max()
        total_days = (latest_date - earliest_date).days
        
        # Handle single-day entries or very short periods
        if total_days == 0:
            # If same day, use 1 day as the range
            total_days = 1
        elif total_days < 30:
            # For very short periods, add some buffer
            total_days = max(total_days, 7)  # Minimum 1 week
        
        # Create period description
        if total_days == 1:
            period_description = f"Analyzing your cinematic moment on {earliest_date.strftime('%B %d, %Y')}"
        elif total_days <= 365:
            period_description = f"Analyzing your last {total_days} days of cinematic history"
        elif total_days <= 730:
            period_description = f"Exploring {total_days} days of your film journey"
        else:
            years = total_days // 365
            period_description = f"Journeying through {years} years of your cinematic legacy"
        
        stats['data_timeline'] = {
            'earliest_date': earliest_date.isoformat(),
            'latest_date': latest_date.isoformat(),
            'total_days': total_days,
            'period_description': period_description
        }
    else:
        pass
     
    # === ADVANCED ANALYTICS & CINEMATIC DNA ===
    
    # === CINEMATIC PERSONA ===
    top_genre = stats['top_genres'][0]['name'] if stats.get('top_genres') else 'Film'
    top_decade = stats['favorite_decade']['name'] if stats.get('favorite_decade') else '2020s'
    top_country = stats['top_countries'][0]['name'] if stats.get('top_countries') else 'USA'
    
    # Handle Unknown values with fallbacks
    if top_genre == 'Unknown' or not top_genre:
        top_genre = 'Genre-Defying'
    if top_decade == 'Unknown' or not top_decade:
        top_decade = 'Timeless'
    if top_country == 'Unknown' or not top_country:
        top_country = 'International'
    
    # Create persona based on viewing patterns
    persona_map = {
        ('Action', '2020s', 'USA'): ("Blockbuster Addict", "You live for explosions, CGI, and popcorn entertainment."),
        ('Drama', '1970s', 'USA'): ("Classic Hollywood Connoisseur", "You appreciate the golden age when movies had substance."),
        ('Horror', '1980s', 'USA'): ("Retro Horror Fiend", "You know true terror peaked in the 80s."),
        ('Comedy', '2000s', 'USA'): ("Millennial Comedy Scholar", "You quote movies more than you quote real people."),
        ('Sci-Fi', '1980s', 'USA'): ("Cyberpunk Prophet", "You saw the future coming before everyone else."),
        ('Crime', '1990s', 'USA'): ("Tarantino Disciple", "You believe violence can be art when done right."),
        ('Romance', '1950s', 'USA'): ("Old Hollywood Romantic", "You think love stories peaked before color TV."),
        ('Thriller', '2010s', 'USA'): ("Modern Suspense Seeker", "You need your movies to keep you guessing."),
        ('Animation', '2000s', 'Japan'): ("Anime Connoisseur", "You know Miyazaki is basically cinema Jesus."),
        ('Documentary', '2010s', 'USA'): ("Reality Obsessive", "Fiction is for people who can't handle the truth."),
    }
    
    # Find closest match or create generic one
    persona_key = (top_genre, top_decade, top_country)
    if persona_key in persona_map:
        persona, description = persona_map[persona_key]
    else:
        # Create dynamic persona
        if 'Horror' in top_genre:
            persona = "Horror Devotee"
            description = "You watch scary movies like other people watch comfort food shows."
        elif 'Comedy' in top_genre:
            persona = "Laugh Track Survivor"
            description = "You've seen every joke coming since 1995, but you still show up."
        elif 'Drama' in top_genre:
            persona = "Emotional Masochist"
            description = "You pay money to feel feelings. That's commitment."
        elif 'Action' in top_genre:
            persona = "Adrenaline Junkie"
            description = "Physics are optional, explosions are mandatory."
        elif 'Sci-Fi' in top_genre:
            persona = "Future Pessimist"
            description = "You watch dystopian futures and think 'sounds about right.'"
        else:
            persona = f"{top_genre} Enthusiast"
            description = f"You've made {top_genre} your personality, and honestly? Respect."

    stats['cinematic_persona'] = {
        'persona': persona,
        'description': description
    }
    
    # Director Deep Analysis
    if stats.get('most_watched_director') and not films_enriched.empty:
        director_name = stats['most_watched_director']['name']
        director_films = films_enriched[films_enriched['director'] == director_name]
        
        if not director_films.empty and 'rating' in films_df.columns:
            # Merge with ratings
            director_with_ratings = pd.merge(director_films, films_df[['title', 'year', 'rating']], 
                                           on=['title', 'year'], how='left')
            director_ratings = director_with_ratings['rating'].dropna()
            
            if not director_ratings.empty:
                avg_rating = round(director_ratings.mean(), 2)
                stats['director_deep_analysis'] = {
                    'director_name': director_name,
                    'average_rating_given': avg_rating,
                    'total_films': len(director_films),
                    'relationship': 'critical' if avg_rating < 3.5 else 'generous' if avg_rating > 4.0 else 'balanced'
                }
    
    # Actor/Actress Analysis ("My Star")
    if not films_enriched.empty and 'cast' in films_enriched.columns:
        all_actors = []
        for cast_list in films_enriched['cast'].dropna():
            if isinstance(cast_list, list) and len(cast_list) > 0:
                all_actors.append(cast_list[0])  # Lead actor/actress
        
        if all_actors:
            actor_counts = Counter(all_actors)
            top_actor = actor_counts.most_common(1)[0]
            stats['my_star'] = {
                'name': top_actor[0],
                'count': top_actor[1]
            }
    
    # Popularity Scale (Cinema Enthusiast Meter)
    if not films_enriched.empty and 'popularity' in films_enriched.columns:
        popularity_scores = films_enriched['popularity'].dropna()
        if not popularity_scores.empty:
            avg_popularity = popularity_scores.mean()
            
            # Invert the score so higher numbers = more independent cinephile
            cinephile_score = 100 - min(avg_popularity, 100)
            
            # Use the inverted score for categories (higher = more cinephile)
            if cinephile_score >= 80:
                cinema_type = "Independent Cinephile"
                description = "You love discovering obscure and independent films!"
            elif cinephile_score >= 50:
                cinema_type = "Balanced Cinephile"
                description = "You enjoy both popular and niche films equally!"
            else:
                cinema_type = "Popular Explorer"
                description = "You follow mainstream and popular films religiously!"
            
            stats['sinefil_meter'] = {
                'type': cinema_type,
                'score': round(cinephile_score, 1),
                'description': description
            }
    
    # Fun Statistics
    fun_stats = {}
    
    # Highest budget, revenue films
    if not films_enriched.empty:
        if 'budget' in films_enriched.columns:
            max_budget_film = films_enriched.loc[films_enriched['budget'].idxmax()]
            if pd.notna(max_budget_film['budget']) and max_budget_film['budget'] > 0:
                fun_stats['highest_budget_film'] = {
                    'title': max_budget_film['title'],
                    'budget': int(max_budget_film['budget'])
                }
        
        if 'revenue' in films_enriched.columns:
            max_revenue_film = films_enriched.loc[films_enriched['revenue'].idxmax()]
            if pd.notna(max_revenue_film['revenue']) and max_revenue_film['revenue'] > 0:
                fun_stats['highest_grossing_film'] = {
                    'title': max_revenue_film['title'],
                    'revenue': int(max_revenue_film['revenue'])
                }
        
        # Lowest rated film (guilty pleasure)
        if 'vote_average' in films_enriched.columns and 'rating' in films_df.columns:
            enriched_with_ratings = pd.merge(films_enriched, films_df[['title', 'year', 'rating']], 
                                           on=['title', 'year'], how='left')
            
            # Find films with low TMDb rating but high personal rating
            guilty_candidates = enriched_with_ratings[
                (enriched_with_ratings['vote_average'] < 6.0) & 
                (enriched_with_ratings['rating'] >= 4.0)
            ]
            
            if not guilty_candidates.empty:
                guilty_pleasure = guilty_candidates.loc[guilty_candidates['vote_average'].idxmin()]
                fun_stats['guilty_pleasure'] = {
                    'title': guilty_pleasure['title'],
                    'tmdb_rating': round(guilty_pleasure['vote_average'], 1),
                    'your_rating': guilty_pleasure['rating']
                }
    
    # Genre combinations
    if not films_enriched.empty and 'genres' in films_enriched.columns:
        genre_combinations = []
        for genres in films_enriched['genres'].dropna():
            if isinstance(genres, list) and len(genres) >= 2:
                # Create combination of first two genres
                combo = f"{genres[0]}-{genres[1]}"
                genre_combinations.append(combo)
        
        if genre_combinations:
            combo_counts = Counter(genre_combinations)
            top_combo = combo_counts.most_common(1)[0]
            fun_stats['favorite_genre_combo'] = {
                'combination': top_combo[0],
                'count': top_combo[1]
            }
    
    # Cinematic World Tour (Top 5 countries with flags)
    if stats.get('top_countries'):
        world_tour = []
        country_flags = {
            'United States': '🇺🇸', 'France': '🇫🇷', 'United Kingdom': '🇬🇧',
            'Japan': '🇯🇵', 'Italy': '🇮🇹', 'Germany': '🇩🇪', 'South Korea': '🇰🇷',
            'Spain': '🇪🇸', 'Canada': '🇨🇦', 'India': '🇮🇳', 'China': '🇨🇳',
            'Australia': '🇦🇺', 'Russia': '🇷🇺', 'Brazil': '🇧🇷', 'Mexico': '🇲🇽'
        }
        
        for country in stats['top_countries'][:5]:
            flag = country_flags.get(country['name'], '🎬')
            world_tour.append({
                'country': country['name'],
                'flag': flag,
                'count': country['count']
            })
        
        fun_stats['world_tour'] = world_tour
    
    # Film age analysis
    if not films_enriched.empty and 'release_date' in films_enriched.columns:
        current_year = datetime.now().year
        film_ages = []
        
        for release_date in films_enriched['release_date'].dropna():
            if release_date:
                try:
                    year = int(release_date[:4])
                    age = current_year - year
                    film_ages.append(age)
                except:
                    continue
        
        if film_ages and len(film_ages) > 0:
            avg_age = round(sum(film_ages) / len(film_ages), 1)
            recent_films = len([age for age in film_ages if age <= 5])
            recent_percentage = round((recent_films / len(film_ages)) * 100, 1) if len(film_ages) > 0 else 0
            
            fun_stats['film_age_analysis'] = {
                'average_age': avg_age,
                'recent_percentage': recent_percentage,
                'type': 'innovation hunter' if recent_percentage > 60 else 'classic lover' if avg_age > 20 else 'balanced'
            }
    
    stats['fun_statistics'] = fun_stats
    
    # === STORY-DRIVEN ANALYTICS ===
    
    # Bölüm 1: Giriş - Senin Bir Yılın
    story_analytics = {}
    
    # Sinemada Geçen Zamanın (daha çarpıcı ifade)
    if stats.get('days_watched') and stats.get('days_watched', 0) > 0:
        days = stats['days_watched']
        if days >= 30:
            time_story = f"You spent {days:.0f} days watching movies this year. That's basically {days/30:.1f} months of your life. No regrets?"
        elif days >= 7:
            weeks = days / 7
            time_story = f"You clocked {days:.1f} days of screen time. That's {weeks:.1f} weeks of pure cinema dedication."
        else:
            time_story = f"You spent {days:.1f} days watching movies. Quality over quantity, we respect that."
        
        story_analytics['time_spent_story'] = time_story
    
    # En Aktif Günün
    if not diary_df.empty and 'parsed_date' in diary_df.columns:
        daily_counts = diary_df.groupby(diary_df['parsed_date'].dt.date).size()
        if not daily_counts.empty and len(daily_counts) > 0:
            most_active_date = daily_counts.idxmax()
            max_films = daily_counts.max()
            
            # Date formatting for Turkish
            months_tr = {
                1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
                7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
            }
            
            date_str = f"{months_tr[most_active_date.month]} {most_active_date.day}"
            
            if max_films >= 4:
                activity_story = f"Remember {date_str}? You watched {max_films} movies in one day. That's either dedication or avoidance behavior."
            elif max_films == 3:
                activity_story = f"On {date_str}, you managed {max_films} films. Solid marathon vibes."
            else:
                activity_story = f"Your most active day was {date_str} with {max_films} films. Respectable commitment."
            
            story_analytics['most_active_day'] = {
                'date': date_str,
                'films': int(max_films),
                'story': activity_story
            }
    
    # Bölüm 2: Zevklerinin Anatomisi
    
    # Rating Kişiliğin
    if 'rating' in films_df.columns:
        ratings = films_df['rating'].dropna()
        if not ratings.empty and len(ratings) > 0:
            avg_rating = ratings.mean()
            rating_std = ratings.std() if len(ratings) > 1 else 0
            high_ratings = len(ratings[ratings >= 4.5])
            low_ratings = len(ratings[ratings <= 2.5])
            total_ratings = len(ratings)
            
            # Rating personality determination
            if avg_rating >= 4.2:
                rating_personality = "Easy to Please"
                rating_description = "You hand out 4-5 stars like candy. Either you have great taste or low standards."
            elif avg_rating <= 3.2:
                rating_personality = "Tough Critic"
                rating_description = "Your ratings hover around 3 stars. You're basically the Gordon Ramsay of cinema."
            elif rating_std > 1.2:
                rating_personality = "Mood Swinger"
                rating_description = "Your ratings are all over the place. A film either destroys you or bores you to death."
            else:
                rating_personality = "Balanced Judge"
                rating_description = "Your ratings are perfectly balanced. You give every film exactly what it deserves."
            
            story_analytics['rating_personality'] = {
                'type': rating_personality,
                'description': rating_description,
                'average': round(avg_rating, 1)
            }

    # Data-driven rating persona
    stats['rating_personality'] = None
    if 'rating' in films_df.columns:
        ratings = films_df['rating'].dropna()
        if not ratings.empty:
            avg_rating = ratings.mean()
            std_dev = ratings.std()

            if avg_rating > 4.0:
                stats['rating_personality'] = 'The Generous Critic'
            elif avg_rating < 3.0:
                stats['rating_personality'] = 'The Picky Gourmet'
            elif std_dev > 1.2: # Assuming a high standard deviation threshold
                stats['rating_personality'] = 'The All-or-Nothing Judge'
            else:
                stats['rating_personality'] = 'The Balanced Reviewer'
    
    # İmza İkilin: Yönetmen & Aktör Kombosu
    if not films_enriched.empty and 'director' in films_enriched.columns and 'cast' in films_enriched.columns:
        director_actor_combos = []
        
        for _, film in films_enriched.iterrows():
            if pd.notna(film['director']) and isinstance(film.get('cast'), list) and len(film['cast']) > 0:
                director = film['director']
                
                # Find first actor who is NOT the director
                main_actor = None
                for actor in film['cast']:
                    if actor != director:  # Avoid director-actor being the same person
                        main_actor = actor
                        break
                
                # If we found a valid actor-director pair
                if main_actor:
                    combo = f"{director}#{main_actor}"
                    director_actor_combos.append({
                        'combo': combo,
                        'director': director,
                        'actor': main_actor,
                        'film': film['title']
                    })
        
        if director_actor_combos and len(director_actor_combos) > 0:
            combo_counts = Counter([combo['combo'] for combo in director_actor_combos])
            if combo_counts and len(combo_counts) > 0:
                top_combo = combo_counts.most_common(1)[0]
                combo_info = next((combo for combo in director_actor_combos if combo['combo'] == top_combo[0]), None)
                
                if combo_info:  # Güvenlik kontrolü
                    if top_combo[1] >= 3:
                        combo_story = f"You've got a serious thing for {combo_info['director']} directing {combo_info['actor']}. {top_combo[1]} films together? That's not coincidence, that's obsession."
                    elif top_combo[1] == 2:
                        combo_story = f"{combo_info['director']} + {combo_info['actor']} = your comfort zone. {top_combo[1]} films prove it."
                    else:
                        combo_story = f"Your go-to combo: {combo_info['director']} directing {combo_info['actor']}."
                    
                    story_analytics['signature_duo'] = {
                        'director': combo_info['director'],
                        'actor': combo_info['actor'],
                        'count': top_combo[1],
                        'story': combo_story
                    }
    
    # Bölüm 3: Alışkanlıkların - Sinema Ritüellerin
    
    # İzleme Mevsimin
    if stats.get('monthly_viewing_habits'):
        monthly_data = stats['monthly_viewing_habits']
        
        # Season mapping
        seasons = {
            'Winter': ['December', 'January', 'February'],
            'Spring': ['March', 'April', 'May'],
            'Summer': ['June', 'July', 'August'],
            'Fall': ['September', 'October', 'November']
        }
        
        season_counts = {}
        for season, months in seasons.items():
            season_counts[season] = sum(month['count'] for month in monthly_data if month['month'] in months)
        
        if season_counts and sum(season_counts.values()) > 0:
            top_season = max(season_counts, key=season_counts.get)
            total_seasons = sum(season_counts.values())
            season_percentage = round((season_counts[top_season] / total_seasons) * 100) if total_seasons > 0 else 0
            
            season_stories = {
                'Winter': f"Winter is your movie season. You watched {season_percentage}% of your films during the cold months. Peak cozy behavior.",
                'Summer': f"Summer is when you really commit to cinema. {season_percentage}% of your films happened in the sunny months. Air conditioning is underrated.",
                'Spring': f"Spring awakens your cinematic spirit. {season_percentage}% of your films bloomed with the flowers. Very poetic of you.",
                'Fall': f"Fall is your movie season. {season_percentage}% of your films dropped with the leaves. Maximum atmospheric vibes."
            }
            
            story_analytics['viewing_season'] = {
                'season': top_season,
                'percentage': season_percentage,
                'story': season_stories.get(top_season, f"{top_season} is your movie season!")
            }
    
    # Bölüm 4: Keşif - Gittiğin Yeni Dünyalar
    
    # Sinematik Pasaportun
    if stats.get('top_countries') and stats.get('total_countries') and stats.get('total_countries', 0) > 0:
        total_countries = stats['total_countries']
        
        if total_countries >= 15:
            passport_story = f"You've collected {total_countries} countries in your cinematic passport this year. Basically a cultural anthropologist."
        elif total_countries >= 8:
            passport_story = f"You added {total_countries} new countries to your cinematic journey this year. Solid exploration game."
        else:
            passport_story = f"You discovered {total_countries} different countries through cinema this year. Quality over quantity."
        
        # Director discovery count
        total_directors = stats.get('total_directors', 0)
        if total_directors >= 50:
            director_story = f"You explored {total_directors} directors this year. You're basically a walking IMDb."
        elif total_directors >= 20:
            director_story = f"You discovered {total_directors} new directors, expanding your cinematic horizons like a proper film scholar."
        else:
            director_story = f"You explored {total_directors} different directors this year. Building that auteur knowledge base."
        
        story_analytics['cinematic_passport'] = {
            'countries': total_countries,
            'directors': total_directors,
            'country_story': passport_story,
            'director_story': director_story
        }
    
    # Bölüm 5: Büyük Final - Senin 2025 Sinema Kimliğin
    
    # Cinema Archetype belirleme
    avg_popularity = 0
    if not films_enriched.empty and 'popularity' in films_enriched.columns:
        popularity_scores = films_enriched['popularity'].dropna()
        if not popularity_scores.empty:
            avg_popularity = popularity_scores.mean()
    
    # Film age analysis for classic vs modern
    avg_film_age = 20  # Default
    if stats.get('fun_statistics', {}).get('film_age_analysis'):
        avg_film_age = stats['fun_statistics']['film_age_analysis']['average_age']
    
    # Archetype determination
    is_mainstream = avg_popularity > 30
    is_modern = avg_film_age < 15
    
    if is_mainstream and is_modern:
        archetype = "Pop Culture Professor"
        archetype_description = "You follow current and popular films religiously. You're basically the pulse of contemporary cinema."
    elif not is_mainstream and not is_modern:
        archetype = "Archive Treasure Hunter"
        archetype_description = "You dig up old and obscure films like a true cinephile. You're the keeper of forgotten classics."
    elif not is_mainstream and is_modern:
        archetype = "Indie Oracle"
        archetype_description = "You discover new independent and festival films before everyone else. You're a cinema prophet."
    elif is_mainstream and not is_modern:
        archetype = "Time Traveler"
        archetype_description = "You watch films from every era with perfect balance. You're the master of cinema history."
    else:
        archetype = "Balanced Cinema Enthusiast"
        archetype_description = "Old and new, mainstream and niche... You've achieved perfect cinematic harmony."
    
    story_analytics['cinema_archetype'] = {
        'type': archetype,
        'description': archetype_description,
        'popularity_score': round(avg_popularity, 1),
        'film_age': round(avg_film_age, 1)
    }
    
    stats['story_analytics'] = story_analytics
    
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
    stats['decades'] = [{'decade': d, 'count': c} for d, c in sorted(decade_counts.items(), key=lambda x: int(x[0].replace('s', '')) if x[0] and x[0] != 'Unknown' else 0)]
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
    
    # Create top_actors with profile paths for the top 3 actors
    top_actors_with_profiles = []
    for i, (name, count) in enumerate(cast_counts.most_common(3)):
        profile_path = None
        try:
            # Search for the actor to get their profile image
            person_search_data = await tmdb_get(session, 'search/person', {'query': name})
            if person_search_data and person_search_data.get('results'):
                top_person_details = person_search_data['results'][0]
                profile_path = top_person_details.get('profile_path')
        except Exception as e:
            pass
        
        top_actors_with_profiles.append({
            'name': name,
            'count': count,
            'profile_path': profile_path
        })
    
    # Add remaining actors without profile paths
    remaining_actors = [{'name': name, 'count': count} for name, count in cast_counts.most_common(20)[3:]]
    stats['top_actors'] = top_actors_with_profiles + remaining_actors
    
    update_progress("analyzing", "Cast analysis complete", 9, 10)

    # === Movie Crush Feature ===
    stats['movie_crush'] = None
    if top_actors_with_profiles:
        top_actor = top_actors_with_profiles[0]
        stats['movie_crush'] = {
            'name': top_actor['name'],
            'profile_path': top_actor['profile_path'],
            'count': top_actor['count']
        }

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
    
    # "Secret Obsession" (Keyword Analysis)
    stats['secret_obsession'] = None
    if 'keywords_analytics' in stats and 'top_keywords' in stats['keywords_analytics']:
        genre_names = {genre['name'].lower() for genre in stats.get('top_genres', [])}
        for keyword in stats['keywords_analytics']['top_keywords']:
            if keyword['keyword'].lower() not in genre_names:
                stats['secret_obsession'] = keyword['keyword']
                break

    # "Runtime Persona" (Marathoner/Sprinter)
    stats['runtime_persona'] = "The Balanced Viewer"
    if 'average_runtime' in stats:
        if stats['average_runtime'] > 130:
            stats['runtime_persona'] = "The Marathoner"
        elif stats['average_runtime'] < 100:
            stats['runtime_persona'] = "The Sprinter"

    # "Cinematic Passport" (Furthest Destination)
    stats['furthest_destination'] = None
    if 'top_countries' in stats:
        for country in stats['top_countries']:
            if country['name'] not in ['USA', 'UK']:
                stats['furthest_destination'] = country['name']
                break

    update_progress("analyzing", "Analysis complete!", 10, 10)
    return stats

# --- API Endpoints ---
@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "🎬 Letterboxd Wrapped - High-Speed Backend"}

@app.get("/api/progress")
async def get_progress():
    """Get current analysis progress"""
    return current_progress

@app.post("/api/analyze")
async def analyze_comprehensive_data_endpoint(files: List[UploadFile] = File(...)):
    """
    Analyze Letterboxd data from either a single ZIP file or multiple CSV files.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    # Create a unique temporary folder for this request
    request_dir = upload_dir / str(uuid.uuid4())
    request_dir.mkdir(exist_ok=True)
    
    csv_files = {}

    try:
        # Scenario 1: Single ZIP file (any name)
        if len(files) == 1 and files[0].filename and files[0].filename.lower().endswith(('.zip', '.utc')):
            upload_file = files[0]
            update_progress("extracting", f"Extracting {upload_file.filename}...", 0, 1)
            
            with zipfile.ZipFile(upload_file.file, 'r') as zip_ref:
                zip_ref.extractall(request_dir)
            
            update_progress("extracting", "Extraction complete.", 1, 1)

        # Scenario 2: Multiple CSV files
        elif all(f.filename and f.filename.lower().endswith('.csv') for f in files):
            update_progress("processing", f"Processing {len(files)} CSV files...", 0, len(files))
            for i, upload_file in enumerate(files):
                safe_filename = Path(upload_file.filename).name
                file_path = request_dir / safe_filename
                with open(file_path, "wb") as buffer:
                    buffer.write(upload_file.file.read())
                update_progress("processing", f"Saved {safe_filename}", i + 1, len(files))
        else:
            raise HTTPException(status_code=400, detail="Invalid input. Please upload a single ZIP file or multiple CSV files.")

        # Discover CSV files in the directory (enhanced for Mac exports)
        required_files = [
            'diary.csv', 'ratings.csv', 'watched.csv', 'reviews.csv',
            'watchlist.csv', 'films.csv', 'comments.csv', 'profile.csv'
        ]
        
        # Recursively search for CSV files (handles nested folders from Mac exports)
        def find_csv_files(directory):
            csv_found = {}
            for root, dirs, files in os.walk(directory):
                for file in files:
                    if file.lower().endswith('.csv'):
                        file_lower = file.lower()
                        for req_file in required_files:
                            if req_file.split('.')[0] in file_lower:
                                csv_found[req_file] = os.path.join(root, file)
                                break
            return csv_found
        
        csv_files = find_csv_files(request_dir)
        
        # If no CSV files found in subdirectories, check root directory
        if not csv_files:
            for item in os.listdir(request_dir):
                if os.path.isfile(os.path.join(request_dir, item)):
                    item_lower = item.lower()
                    for req_file in required_files:
                        if req_file.split('.')[0] in item_lower:
                             csv_files[req_file] = os.path.join(request_dir, item)
                             break
        
        if not csv_files:
            raise HTTPException(status_code=400, detail="No valid Letterboxd CSV files found in the upload.")

        stats = await process_comprehensive_letterboxd_data(app.state.aiohttp_session, csv_files)
        
        update_progress("complete", "Analysis complete! Returning stats.", 1, 1)
        return {"status": "success", "stats": stats}

    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid ZIP archive.")
    except Exception as e:
        error_msg = f"Analysis failed: {str(e)}"
        update_progress("error", error_msg, 0, 1)
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/api/tmdb/person/search")
async def search_tmdb_person(name: str, role: str = None):
    """
    Search for a person on TMDB and return their profile image.
    This endpoint proxies TMDB API calls to keep the API key secure on the backend.
    """
    if not name:
        raise HTTPException(status_code=400, detail="Name parameter is required")
    
    try:
        # Use the existing tmdb_get function
        params = {'query': name, 'include_adult': 'false'}
        person_data = await tmdb_get(app.state.aiohttp_session, 'search/person', params)
        
        if person_data and person_data.get('results'):
            # Get the first result (most relevant)
            person = person_data['results'][0]
            
            # Search for person
            
            # If role is specified, try to find a better match
            if role and len(person_data['results']) > 1:
                # First, try to find exact role match
                for result in person_data['results']:
                    if role.lower() == 'director' and result.get('known_for_department') == 'Directing':
                        person = result
                        break
                    elif role.lower() == 'actor' and result.get('known_for_department') == 'Acting':
                        person = result
                        break
                
                # If no exact match found, try to find someone who has the role in their known_for
                if person == person_data['results'][0]:  # Still using first result
                    for result in person_data['results']:
                        known_for = result.get('known_for', [])
                        if role.lower() == 'director':
                            # Check if they have directing credits in known_for
                            for work in known_for:
                                if work.get('job') == 'Director' or work.get('department') == 'Directing':
                                    person = result
                                    break
                        elif role.lower() == 'actor':
                            # Check if they have acting credits in known_for
                            for work in known_for:
                                if work.get('job') == 'Actor' or work.get('department') == 'Acting':
                                    person = result
                                    break
                        if person != person_data['results'][0]:  # Found a better match
                            break
            
            # Person selected
            
            profile_path = person.get('profile_path')
            if profile_path:
                return {
                    "found": True,
                    "person_id": person.get('id'),
                    "profile_path": profile_path,
                    "name": person.get('name'),
                    "known_for_department": person.get('known_for_department'),
                    "url": f"https://image.tmdb.org/t/p/w300{profile_path}"
                }
            else:
                return {
                    "found": False,
                    "person_id": person.get('id'),
                    "name": person.get('name'),
                    "message": "No profile image available"
                }
        else:
            return {"found": False, "message": "No person found"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TMDB API error: {str(e)}")

@app.post("/api/parse-username")
async def parse_username(request: Request):
    """
    Parse Letterboxd username from filename.
    """
    try:
        body = await request.json()
        filename = body.get('filename')
        
        if not filename or not isinstance(filename, str):
            return {"username": None}
        
        # Use regex to extract username from filename
        import re
        regex = r'^letterboxd-([^-\s]+)-'
        match = re.match(regex, filename, re.IGNORECASE)
        
        if match and match.group(1):
            username = match.group(1).strip()
            return {"username": username}
        else:
            return {"username": None}
            
    except Exception as e:
        return {"username": None}

@app.get("/tmdb-proxy/{path:path}")
async def tmdb_proxy(path: str):
    """
    Proxy TMDB images to avoid CORS issues.
    """
    try:
        tmdb_url = f"https://image.tmdb.org/{path}"
        async with app.state.aiohttp_session.get(tmdb_url) as response:
            if response.status != 200:
                raise HTTPException(status_code=404, detail="Image not found")
            
            image_data = await response.read()
            content_type = response.headers.get('Content-Type', 'image/jpeg')
            
            return Response(
                content=image_data,
                media_type=content_type,
                headers={
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Range, Accept',
                    'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
                    'Cache-Control': 'public, max-age=31536000, immutable'
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to proxy image: {str(e)}")

@app.options("/tmdb-proxy/{path:path}")
async def tmdb_proxy_options(path: str):
    """Handle OPTIONS requests for CORS preflight."""
    return Response(
        status_code=204,
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Range, Accept',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Range'
        }
    )

@app.get("/")
async def root():
    return {"message": "🎬 Letterboxd Wrapped - High-Speed Backend"}

# --- Feedback & Report Endpoints (Prompt 3) ---
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

def _client_key(request: Request) -> str:
    xfwd = request.headers.get('x-forwarded-for')
    if xfwd:
        return xfwd.split(',')[0].strip()
    return request.client.host if request.client else 'unknown'

@app.post("/api/feedback")
async def submit_feedback(
    request: Request,
    sessionId: str = Form(...),
    kind: str = Form("general"),
    message: str = Form(""),
    include_names: bool = Form(False),
    attachment: UploadFile | None = File(None),
):
    client_key = _client_key(request)
    if not check_rate_limit(client_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

    # Read optional attachment with size guard
    attachment_bytes: bytes | None = None
    if attachment is not None:
        chunked = await attachment.read()
        if len(chunked) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Attachment too large (max 5 MB)")
        attachment_bytes = chunked

    # Persist a minimal record to disk for diagnostics
    reports_dir = Path("uploads") / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    issue_id = str(uuid.uuid4())[:8]

    payload = {
        "issue_id": issue_id,
        "sessionId": sessionId,
        "kind": kind,
        "message": message[:4000],
        "include_names": include_names,
        "received_at": datetime.utcnow().isoformat(),
        "client": client_key,
    }
    meta_path = reports_dir / f"feedback-{issue_id}.json"
    meta_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if attachment_bytes is not None:
        (reports_dir / f"feedback-{issue_id}.bin").write_bytes(attachment_bytes)

    return {"ok": True, "issue_id": issue_id}


@app.post("/api/report")
async def submit_report(
    request: Request,
    sessionId: str = Form(...),
    include_names: bool = Form(False),
    bundle: UploadFile = File(...),
):
    client_key = _client_key(request)
    if not check_rate_limit(client_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

    data = await bundle.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Bundle too large (max 5 MB)")

    reports_dir = Path("uploads") / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    issue_id = str(uuid.uuid4())[:8]

    payload = {
        "issue_id": issue_id,
        "sessionId": sessionId,
        "include_names": include_names,
        "received_at": datetime.utcnow().isoformat(),
        "client": client_key,
    }
    (reports_dir / f"report-{issue_id}.meta.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (reports_dir / f"report-{issue_id}.bin").write_bytes(data)

    return {"ok": True, "issue_id": issue_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)