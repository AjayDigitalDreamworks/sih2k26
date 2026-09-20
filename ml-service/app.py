"""
Raahi ML & Road Risk Engine — Standalone FastAPI Application Entry Point
========================================================================
Entry point for local execution and cloud platforms (Render, Railway, Docker).

Usage:
  python app.py
or
  uvicorn app:app --host 0.0.0.0 --port 8000
"""

import os
import sys

# Configure UTF-8 encoding on Windows to prevent UnicodeEncodeError with cp1252
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Ensure current directory is on python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Import the FastAPI application
from app.main import app

if __name__ == "__main__":
    import uvicorn
    # Dynamic port detection for cloud deployment platforms (Render, Railway, Heroku, etc.)
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"\n[START] Starting Raahi ML Engine on {host}:{port}...")
    uvicorn.run("app:app", host=host, port=port, reload=False)

