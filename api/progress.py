from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import os
import tempfile
from pathlib import Path

PROGRESS_DIR = Path(tempfile.gettempdir()) / "progress"

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query_components = parse_qs(urlparse(self.path).query)
        session_id = query_components.get('session', [None])[0]

        if not session_id:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Session ID is required"}).encode('utf-8'))
            return

        progress_file = PROGRESS_DIR / f"{session_id}.json"

        if not progress_file.exists():
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"stage": "idle", "message": "No analysis in progress for this session."}).encode('utf-8'))
            return

        try:
            with open(progress_file, 'r', encoding='utf-8') as f:
                progress_data = json.load(f)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(progress_data).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Failed to read progress: {str(e)}"}).encode('utf-8')) 