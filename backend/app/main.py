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


CORS_ORIGINS = [
    "http://localhost:3000",
    "https://movieswrapped.netlify.app",
    "https://wrapped-backend.onrender.com"
]

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
    required_files = [
        'watched.csv', 'diary.csv', 'ratings.csv', 'reviews.csv',
        'watchlist.csv', 'films.csv', 'comments.csv', 'profile.csv'
    ]
    for item in os.listdir(extract_dir):
        if any(required in item.lower() for required in required_files):
            csv_files[item.lower()] = os.path.join(extract_dir, item)
            
    update_progress("extracting", f"Found CSV files: {list(csv_files.keys())}", 1, 1)
    return csv_files

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

    # === REWATCH ANALYSIS ===
    if not diary_df.empty:
        # Method A: True Rewatches (films watched more than once)
        rewatch_counts = diary_df.groupby(['Name', 'Year']).size().reset_index(name='watch_count')
        true_rewatches = rewatch_counts[rewatch_counts['watch_count'] > 1].sort_values(by='watch_count', ascending=False)
        stats['top_true_rewatches'] = true_rewatches.head(10).rename(columns={'Name': 'name', 'watch_count': 'count'}).to_dict('records')
        
        # Method B: Most Logged Films (all films, sorted by total log count)
        most_logged = rewatch_counts.sort_values(by='watch_count', ascending=False)
        stats['most_logged_films'] = most_logged.head(10).rename(columns={'Name': 'name', 'watch_count': 'count'}).to_dict('records')
        
        # Keep the original for backward compatibility
        stats['top_rewatches'] = true_rewatches.rename(columns={'Name': 'name', 'watch_count': 'count'}).to_dict('records')

    # === DATE-BASED ANALYSIS ===
    if not diary_df.empty and 'Watched Date' in diary_df.columns:
        # Parse the 'Watched Date' column to datetime
        diary_df['parsed_date'] = pd.to_datetime(diary_df['Watched Date'], errors='coerce')
        valid_dates = diary_df.dropna(subset=['parsed_date'])
        
        if not valid_dates.empty:
            # Monthly Viewing Habits
            valid_dates['month'] = valid_dates['parsed_date'].dt.strftime('%B')
            monthly_counts = valid_dates['month'].value_counts()
            
            # Ensure proper month order
            month_order = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
            monthly_viewing_habits = []
            for month in month_order:
                count = monthly_counts.get(month, 0)
                monthly_viewing_habits.append({'month': month, 'count': int(count)})
            
            stats['monthly_viewing_habits'] = monthly_viewing_habits
            
            # Weekday/Weekend Analysis
            valid_dates['day_of_week'] = valid_dates['parsed_date'].dt.dayofweek
            weekday_count = len(valid_dates[valid_dates['day_of_week'] < 5])  # Monday=0, Friday=4
            weekend_count = len(valid_dates[valid_dates['day_of_week'] >= 5])  # Saturday=5, Sunday=6
            
            stats['day_of_week_pattern'] = {
                'weekday': weekday_count,
                'weekend': weekend_count
            }
     
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
            
            if avg_popularity > 50:
                cinema_type = "Popular Explorer"
                description = "You follow mainstream and popular films religiously!"
            elif avg_popularity > 20:
                cinema_type = "Balanced Cinephile"
                description = "You enjoy both popular and niche films equally!"
            else:
                cinema_type = "Independent Cinephile"
                description = "You love discovering obscure and independent films!"
                
            stats['sinefil_meter'] = {
                'type': cinema_type,
                'score': round(avg_popularity, 1),
                'description': description
            }
    
    # Binge-watching Detection
    if not diary_df.empty and 'parsed_date' in diary_df.columns:
        diary_sorted = diary_df.sort_values('parsed_date')
        binge_sessions = []
        current_session = []
        
        for i, row in diary_sorted.iterrows():
            if not current_session:
                current_session = [row]
            else:
                time_diff = (row['parsed_date'] - current_session[-1]['parsed_date']).total_seconds() / 3600
                if time_diff <= 48:  # 48 hours window
                    current_session.append(row)
                else:
                    if len(current_session) >= 2:
                        binge_sessions.append(len(current_session))
                    current_session = [row]
        
        # Check last session
        if len(current_session) >= 2:
            binge_sessions.append(len(current_session))
        
        if binge_sessions:
            stats['binge_analysis'] = {
                'total_sessions': len(binge_sessions),
                'longest_session': max(binge_sessions),
                'total_binge_films': sum(binge_sessions)
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