"""
Centralized configuration for all external API integrations.
API keys are loaded from environment variables. Never hardcode keys.

The .env files are loaded automatically so real keys placed in the repo-root
`.env` (or `ml-service/.env`) are picked up without manual exporting.
"""
import os
from pathlib import Path


def _load_dotenv_files() -> None:
    """Load KEY=VALUE pairs from nearby .env files into the process env.

    Process-level env vars already set (e.g. by Docker) always win.
    Looks in, in order: ml-service/.env, repo-root/.env, cwd/.env, cwd/../.env.
    """
    here = Path(__file__).resolve()
    candidates = [
        here.parent.parent.parent / ".env",          # ml-service/.env
        here.parent.parent.parent.parent / ".env",   # repo root .env
        Path.cwd() / ".env",
        Path.cwd().parent / ".env",
    ]
    seen = set()
    for candidate in candidates:
        try:
            p = candidate.resolve()
        except Exception:
            continue
        if p in seen or not p.is_file():
            continue
        seen.add(p)
        try:
            for raw in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
        except Exception:
            continue


_load_dotenv_files()


class APIConfig:
    # --- Core Backend (service-to-service, internal key) ---
    CORE_BACKEND_URL = os.getenv("CORE_BACKEND_URL", "http://localhost:5000")
    CORE_BACKEND_INTERNAL_KEY = os.getenv("CORE_BACKEND_INTERNAL_KEY", "")

    # --- IMD (India Meteorological Department) ---
    IMD_BASE_URL = os.getenv("IMD_API_URL", "https://api.imd.gov.in/api/v1")
    IMD_API_KEY = os.getenv("IMD_API_KEY", "")

    # --- NASA LHASA (Landslide Hazard Assessment) ---
    NASA_LHASA_URL = os.getenv("NASA_LHASA_URL", "https://maps.nccs.nasa.gov/download/landslides")
    NASA_EARTHDATA_USER = os.getenv("NASA_EARTHDATA_USER", "")
    NASA_EARTHDATA_PASS = os.getenv("NASA_EARTHDATA_PASS", "")

    # --- Google Flood Hub ---
    GOOGLE_FLOOD_URL = os.getenv("GOOGLE_FLOOD_API_URL", "https://floodforecasting.googleapis.com/v1")
    GOOGLE_FLOOD_KEY = os.getenv("GOOGLE_FLOOD_API_KEY", "")

    # --- TomTom Traffic ---
    TOMTOM_BASE_URL = os.getenv("TOMTOM_API_URL", "https://api.tomtom.com")
    TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY", "")

    # --- Mappls (MapMyIndia) ---
    MAPPLS_BASE_URL = os.getenv("MAPPLS_API_URL", "https://apis.mappls.com/advancedmaps/v1")
    MAPPLS_REST_URL = os.getenv("MAPPLS_REST_URL", "https://apis.mappls.com/api")
    MAPPLS_ACCESS_TOKEN = os.getenv("MAPPLS_ACCESS_TOKEN", "")

    # --- Bhuvan (ISRO NRSC) ---
    BHUVAN_BASE_URL = os.getenv("BHUVAN_API_URL", "https://bhuvan-app1.nrsc.gov.in/api")
    BHUVAN_TOKEN = os.getenv("BHUVAN_TOKEN", "")

    # --- ISRO VEDAS (SAC) ---
    ISRO_VEDAS_URL = os.getenv("ISRO_VEDAS_URL", "https://vedas.sac.gov.in")

    # --- Open-Meteo (free fallback weather API) ---
    OPEN_METEO_URL = "https://api.open-meteo.com/v1"

    # --- NER District Coordinates (for API lookups) ---
    NER_DISTRICTS = {
        "kamrup": {"name": "Guwahati", "lat": 26.1445, "lng": 91.7362, "imd_id": "42182"},
        "sonitpur": {"name": "Tezpur", "lat": 26.6528, "lng": 92.7926, "imd_id": "42301"},
        "cachar": {"name": "Silchar", "lat": 24.8170, "lng": 92.7985, "imd_id": "42295"},
        "dima_hasao": {"name": "Haflong", "lat": 25.1764, "lng": 93.0232, "imd_id": "42303"},
        "east_khasi": {"name": "Shillong", "lat": 25.5788, "lng": 91.8933, "imd_id": "42380"},
        "west_khasi": {"name": "Nongstoin", "lat": 25.5244, "lng": 91.2662, "imd_id": "42381"},
        "dimapur": {"name": "Dimapur", "lat": 25.9060, "lng": 93.7270, "imd_id": "42379"},
        "kohima": {"name": "Kohima", "lat": 25.6751, "lng": 94.1086, "imd_id": "42378"},
        "imphal_west": {"name": "Imphal", "lat": 24.8170, "lng": 93.9368, "imd_id": "42390"},
        "aizawl": {"name": "Aizawl", "lat": 23.7271, "lng": 92.7176, "imd_id": "42393"},
        "papum_pare": {"name": "Itanagar", "lat": 27.0844, "lng": 93.6053, "imd_id": "42305"},
        "west_tripura": {"name": "Agartala", "lat": 23.8315, "lng": 91.2868, "imd_id": "42395"},
        # Faridabad, Haryana hubs
        "ajay_digital_dreamworks": {"name": "Ajay Digital Dreamworks", "lat": 28.3820, "lng": 77.2800, "state": "Haryana", "imd_id": "42182"},
        "dabua_chowk": {"name": "Dabua Chowk", "lat": 28.3842, "lng": 77.2878, "state": "Haryana", "imd_id": "42182"},
        "dabua_colony": {"name": "Dabua Colony", "lat": 28.3838, "lng": 77.2817, "state": "Haryana", "imd_id": "42182"},
        "aravali_college": {"name": "Aravali College of Engineering & Management", "lat": 28.4006, "lng": 77.4125, "state": "Haryana", "imd_id": "42182"},
    }

    # --- Known NH Route Waypoints (for TomTom routing) ---
    NH_WAYPOINTS = {
        "NH-27": [(26.1445, 91.7362), (26.6528, 92.7926)],  # Guwahati-Tezpur
        "NH-6": [(26.1445, 91.7362), (25.5788, 91.8933)],   # Guwahati-Shillong
        "NH-306": [(24.8170, 92.7985), (23.7271, 92.7176)], # Silchar-Aizawl
        "NH-2": [(25.9060, 93.7270), (24.8170, 93.9368)],   # Dimapur-Imphal
        "NH-415": [(26.1445, 91.7362), (27.0844, 93.6053)], # Guwahati-Itanagar
    }
