import os
import json
import zipfile
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, unquote_plus
import cgi
from collections import Counter
from datetime import datetime
import asyncio
import aiohttp
import aiofiles
import hashlib
from dotenv import load_dotenv
from pathlib import Path
import warnings
import tempfile

warnings.filterwarnings('ignore')
load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
CACHE_DIR = Path(tempfile.gettempdir()) / "tmdb_cache"
CACHE_DIR.mkdir(exist_ok=True)
PROGRESS_DIR = Path(tempfile.gettempdir()) / "progress"
PROGRESS_DIR.mkdir(exist_ok=True)

# --- Progress Tracking ---
def get_progress_file(session_id: str):
    return PROGRESS_DIR / f"{session_id}.json"

def update_progress(session_id: str, stage: str, message: str, progress: int = 0, total: int = 0):
    progress_data = {
        "stage": stage,
        "message": message,
        "progress": progress,
        "total": total,
        "timestamp": datetime.now().isoformat()
    }
    with open(get_progress_file(session_id), 'w', encoding='utf-8') as f:
        json.dump(progress_data, f)
    print(f"📊 {stage}: {message} ({progress}/{total})")


# --- TMDb Client Logic ---
async def tmdb_get(session: aiohttp.ClientSession, endpoint: str, params: dict = None, cache: bool = True):
    params = params or {}
    params['api_key'] = TMDB_API_KEY
    
    params_str = json.dumps(params, sort_keys=True)
    cache_key_hash = hashlib.md5(f"{endpoint}{params_str}".encode()).hexdigest()
    cache_file = CACHE_DIR / f"{cache_key_hash}.json"

    if cache and cache_file.exists():
        try:
            async with aiofiles.open(cache_file, 'r', encoding='utf-8') as f:
                return json.loads(await f.read())
        except Exception:
            pass
    
    url = f"https://api.themoviedb.org/3/{endpoint}"
    try:
        async with session.get(url, params=params) as response:
            response.raise_for_status()
            data = await response.json()
            async with aiofiles.open(cache_file, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(data, ensure_ascii=False, indent=2))
            await asyncio.sleep(0.05)
            return data
    except aiohttp.ClientError as e:
        print(f"Error fetching {url}: {e}")
        return None

async def resolve_tmdb_id(session: aiohttp.ClientSession, title: str, year: Optional[int] = None) -> Optional[int]:
    query_params = {'query': title, 'include_adult': 'false'}
    if year and not pd.isna(year):
        query_params['year'] = int(year)

    try:
        data = await tmdb_get(session, 'search/movie', query_params)
        results = data.get('results', []) if data else []
        if not results and year:
            data = await tmdb_get(session, 'search/movie', {'query': title, 'include_adult': 'false'})
            results = data.get('results', []) if data else []
        return results[0]['id'] if results else None
    except Exception:
        return None

async def fetch_comprehensive_film_details(session: aiohttp.ClientSession, tmdb_id: int) -> Dict[str, Any]:
    if pd.isna(tmdb_id):
        return {}
    try:
        tasks = {
            "details": tmdb_get(session, f'movie/{int(tmdb_id)}'),
            "credits": tmdb_get(session, f'movie/{int(tmdb_id)}/credits'),
            "keywords": tmdb_get(session, f'movie/{int(tmdb_id)}/keywords')
        }
        results = await asyncio.gather(*tasks.values())
        details, credits, keywords = results
        
        if not details: return {}

        directors = [c['name'] for c in credits.get('crew', []) if c['job'] == 'Director'] if credits else []
        writers = [c['name'] for c in credits.get('crew', []) if c['job'] in ['Writer', 'Screenplay', 'Story']] if credits else []
        cast = [c['name'] for c in credits.get('cast', [])[:10]] if credits else []
        genres = [g['name'] for g in details.get('genres', [])]
        countries = [c['name'] for c in details.get('production_countries', [])]
        companies = [c['name'] for c in details.get('production_companies', [])]
        keyword_list = [k['name'] for k in keywords.get('keywords', [])] if keywords else []
        
        release_date = details.get('release_date', '')
        decade = f"{(int(release_date[:4]) // 10) * 10}s" if release_date else None

        return {
            'tmdb_id': tmdb_id, 'title': details.get('title', ''), 'release_date': release_date,
            'runtime': details.get('runtime'), 'language': details.get('original_language'),
            'vote_average': details.get('vote_average', 0), 'decade': decade,
            'director': directors[0] if directors else None, 'directors': directors, 'cast': cast,
            'genres': genres, 'countries': countries, 'poster_path': details.get('poster_path', ''),
        }
    except Exception as e:
        print(f"Error fetching comprehensive details for ID {tmdb_id}: {e}")
        return {'tmdb_id': tmdb_id}

# --- Data Processing Logic ---
def extract_files_from_bytes(file_bytes: bytes) -> Dict[str, str]:
    import io
    extract_dir = Path(tempfile.gettempdir()) / "letterboxd_extract"
    extract_dir.mkdir(exist_ok=True, parents=True)
    
    with zipfile.ZipFile(io.BytesIO(file_bytes), 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
        
    csv_files = {}
    for item in os.listdir(extract_dir):
        if any(required in item.lower() for required in ['ratings.csv', 'diary.csv', 'watchlist.csv', 'reviews.csv']):
            csv_files[item.lower()] = os.path.join(extract_dir, item)
    return csv_files

async def process_comprehensive_letterboxd_data(session_id: str, session: aiohttp.ClientSession, csv_files: Dict[str, str]) -> Dict[str, Any]:
    update_progress(session_id, "loading", "Loading CSV data files...", 0, 4)
    ratings_df = pd.read_csv(csv_files['ratings.csv']) if 'ratings.csv' in csv_files else pd.DataFrame()
    diary_df = pd.read_csv(csv_files['diary.csv']) if 'diary.csv' in csv_files else pd.DataFrame()

    if ratings_df.empty and diary_df.empty:
        raise ValueError("No usable data found. Need at least ratings.csv or diary.csv")

    films_df = ratings_df.rename(columns={'Name': 'title', 'Year': 'year', 'Rating': 'rating'})
    unique_films = films_df[['title', 'year']].drop_duplicates().reset_index(drop=True)
    update_progress(session_id, "processing", f"Found {len(unique_films)} unique films", 1, 4)

    update_progress(session_id, "tmdb_matching", "Matching films to TMDb...", 0, len(unique_films))
    resolve_tasks = [resolve_tmdb_id(session, row['title'], row['year']) for _, row in unique_films.iterrows()]
    tmdb_ids = await asyncio.gather(*resolve_tasks)
    unique_films['tmdb_id'] = tmdb_ids
    match_rate = unique_films['tmdb_id'].notna().mean() * 100
    update_progress(session_id, "tmdb_matching", f"Matched {match_rate:.1f}% of films", len(unique_films), len(unique_films))

    unique_tmdb_ids = unique_films['tmdb_id'].dropna().unique()
    update_progress(session_id, "tmdb_metadata", "Gathering film metadata...", 0, len(unique_tmdb_ids))
    fetch_tasks = [fetch_comprehensive_film_details(session, tmdb_id) for tmdb_id in unique_tmdb_ids]
    metadata_results = await asyncio.gather(*fetch_tasks)
    metadata_df = pd.DataFrame([m for m in metadata_results if m])
    update_progress(session_id, "tmdb_metadata", "Metadata collection complete", len(unique_tmdb_ids), len(unique_tmdb_ids))
    
    films_enriched = pd.merge(unique_films, metadata_df, on='tmdb_id', how='left')
    update_progress(session_id, "analyzing", "Generating statistics...", 3, 4)

    stats = {}
    if 'rating' in films_df.columns:
        stats['average_rating'] = round(films_df['rating'].mean(), 2)
        stats['rating_distribution'] = films_df['rating'].value_counts().sort_index().to_dict()
    if 'runtime' in films_enriched.columns:
        runtimes = films_enriched[films_enriched['runtime'] > 0]['runtime']
        stats['hours_watched'] = round(runtimes.sum() / 60, 1)
        stats['longest_film'] = films_enriched.loc[runtimes.idxmax()][['title', 'runtime']].to_dict() if not runtimes.empty else None
        stats['shortest_film'] = films_enriched.loc[runtimes.idxmin()][['title', 'runtime']].to_dict() if not runtimes.empty else None
    
    stats['top_directors'] = films_enriched['director'].dropna().value_counts().nlargest(10).to_dict()
    stats['top_genres'] = Counter([g for genres in films_enriched['genres'].dropna() for g in genres]).most_common(10)
    stats['top_countries'] = Counter([c for countries in films_enriched['countries'].dropna() for c in countries]).most_common(10)
    stats['decade_distribution'] = films_enriched['decade'].dropna().value_counts().sort_index().to_dict()
    
    update_progress(session_id, "complete", "Analysis complete!", 4, 4)
    return stats

class handler(BaseHTTPRequestHandler):
    async def do_POST(self):
        session_id = None # Initialize session_id
        try:
            content_type, pdict = cgi.parse_header(self.headers['content-type'])
            
            if 'boundary' in pdict:
                pdict['boundary'] = pdict['boundary'].encode('utf-8')
            
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['content-type']},)
            
            file_item = form['file']
            file_bytes = file_item.file.read()
            
            session_id = hashlib.md5(file_bytes).hexdigest()
            update_progress(session_id, "starting", f"Starting analysis for session {session_id}", 0, 1)

            csv_files = extract_files_from_bytes(file_bytes)
            
            async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit_per_host=20)) as session:
                stats = await process_comprehensive_letterboxd_data(session_id, session, csv_files)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"status": "success", "session_id": session_id, "stats": stats}
            self.wfile.write(json.dumps(response, default=lambda o: o.__dict__, indent=2).encode('utf-8'))
        
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_msg = f"Analysis failed: {str(e)}"
            if session_id:
                update_progress(session_id, "error", error_msg)
            self.wfile.write(json.dumps({"status": "error", "message": error_msg}).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

# Vercel entrypoint is the handler class 