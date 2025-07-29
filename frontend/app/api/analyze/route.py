# frontend/app/api/analyze/route.py
import os
import json
import zipfile
import pandas as pd
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs
import warnings
from io import BytesIO
import cgi
from collections import Counter
from datetime import datetime

warnings.filterwarnings('ignore')

# --- Data Processing Logic ---
def process_letterboxd_data(csv_files):
    # This is a simplified, synchronous version of your core pandas logic.
    # The TMDB fetching part is removed as it's now handled by the frontend/another API route.
    
    ratings_df = pd.read_csv(BytesIO(csv_files.get('ratings.csv', b''))) if 'ratings.csv' in csv_files else pd.DataFrame()
    diary_df = pd.read_csv(BytesIO(csv_files.get('diary.csv', b''))) if 'diary.csv' in csv_files else pd.DataFrame()
    
    if ratings_df.empty and diary_df.empty:
        raise ValueError("No usable data found. Need at least ratings.csv or diary.csv")

    all_films = []
    if not ratings_df.empty:
        df = ratings_df.rename(columns={'Name': 'title', 'Year': 'year', 'Rating': 'rating'})
        all_films.extend(df.to_dict('records'))
    if not diary_df.empty:
        df = diary_df.rename(columns={'Name': 'title', 'Year': 'year', 'Rating': 'rating'})
        if not all_films:
            all_films.extend(df.to_dict('records'))
        else:
            temp_df = pd.DataFrame(all_films)
            merged_df = df.merge(temp_df[['title', 'year']], on=['title', 'year'], how='left', indicator=True)
            all_films.extend(merged_df[merged_df['_merge'] == 'left_only'].to_dict('records'))

    films_df = pd.DataFrame(all_films)
    unique_films = films_df[['title', 'year']].drop_duplicates().reset_index(drop=True)
    
    # --- Start Analysis ---
    stats = {}
    stats['total_films'] = len(unique_films)
    
    # Rating Analysis
    if 'rating' in films_df.columns and films_df['rating'].notna().any():
        ratings = films_df['rating'].dropna()
        stats['average_rating'] = round(ratings.mean(), 2)
        stats['most_common_rating'] = ratings.mode().iloc[0] if not ratings.mode().empty else None
    
    # For this migration, we'll keep the analysis focused on what's available in the CSVs.
    # We are omitting runtime, director, genre, decade, country, language, and actor analysis
    # because they depend on the TMDB data that was previously fetched by the backend.
    # This data is now fetched on the client side or via a separate proxy.
    
    # We will create placeholder fields for the data that is now missing.
    stats['days_watched'] = 0
    stats['favorite_genre'] = {'name': 'N/A', 'count': 0}
    stats['most_watched_director'] = {'name': 'N/A', 'count': 0}
    stats['top_directors'] = []
    stats['total_directors'] = 0
    stats['decades'] = []
    stats['favorite_decade'] = {'name': 'N/A', 'count': 0}
    stats['top_countries'] = []
    stats['total_countries'] = 0
    stats['average_runtime'] = 0
    stats['top_actors'] = []
    stats['top_languages'] = []
    stats['insights'] = []
    stats['analysis_date'] = datetime.now().isoformat()
    stats['metadata_coverage'] = 0 # Placeholder

    return stats

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse the multipart/form-data
            ctype, pdict = cgi.parse_header(self.headers.get('content-type'))
            pdict['boundary'] = bytes(pdict['boundary'], "utf-8")
            
            if ctype == 'multipart/form-data':
                fields = cgi.parse_multipart(self.rfile, pdict)
                uploaded_file = fields.get('file')[0]
                
                if not self.path.endswith('.zip'):
                     # This check is a bit naive since it's on the path, not filename.
                     # A better check would be on the uploaded file's name if available.
                     # For now, we assume the client sends the correct file type.
                     pass

                # Extract ZIP in-memory
                csv_files = {}
                with zipfile.ZipFile(BytesIO(uploaded_file), 'r') as zip_ref:
                    for item in zip_ref.namelist():
                        if any(required in item.lower() for required in ['ratings.csv', 'diary.csv', 'watchlist.csv', 'reviews.csv']):
                            csv_files[os.path.basename(item).lower()] = zip_ref.read(item)
                
                # Process data
                stats = process_letterboxd_data(csv_files)
                
                # Send response
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response_data = json.dumps({"status": "success", "stats": stats})
                self.wfile.write(response_data.encode('utf-8'))
                
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Please upload a file in multipart/form-data format."}')

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = json.dumps({"status": "error", "message": str(e)})
            self.wfile.write(error_response.encode('utf-8'))
        
        return 