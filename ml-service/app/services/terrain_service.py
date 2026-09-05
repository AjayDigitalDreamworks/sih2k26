"""
Terrain Data Service — uses Bhuvan (ISRO) and SRTM for elevation and slope data.
Provides terrain slope, elevation profiles, and land cover data for NER districts.
"""
import httpx
from typing import Dict, Any, Optional
from datetime import datetime
from app.services.config import APIConfig


class TerrainService:
    """Fetch terrain and elevation data from Bhuvan (ISRO) and SRTM."""

    _cache: Dict[str, Any] = {}
    _cache_ttl = 86400  # 24 hours (terrain data rarely changes)

    @classmethod
    async def get_elevation(cls, lat: float, lng: float) -> Dict[str, Any]:
        """Get elevation at a point using Bhuvan/SRTM data."""
        cache_key = f"elev:{lat:.4f},{lng:.4f}"
        cached = cls._cache.get(cache_key)
        if cached:
            return cached

        # Try Bhuvan DEM API
        if APIConfig.BHUVAN_TOKEN:
            try:
                result = await cls._fetch_bhuvan_elevation(lat, lng)
                if result:
                    cls._cache[cache_key] = result
                    return result
            except Exception:
                pass

        # Fallback: Open-Meteo elevation (uses SRTM)
        try:
            result = await cls._fetch_open_meteo_elevation(lat, lng)
            if result:
                cls._cache[cache_key] = result
                return result
        except Exception:
            pass

        return {"elevation_m": 500, "source": "default", "note": "Default elevation"}

    @classmethod
    async def get_route_elevation_profile(cls, points: list) -> list:
        """Get elevation profile along a route (list of lat/lng points)."""
        if len(points) > 50:
            # Sample every Nth point to avoid API abuse
            step = len(points) // 50
            points = points[::step]

        profile = []
        for point in points:
            elev = await cls.get_elevation(point["lat"], point["lng"])
            profile.append({
                "lat": point["lat"],
                "lng": point["lng"],
                "elevation_m": elev.get("elevation_m", 0),
            })
        return profile

    @classmethod
    async def estimate_slope_risk(cls, lat: float, lng: float) -> Dict[str, Any]:
        """Estimate terrain slope risk for landslide assessment."""
        elev_data = await cls.get_elevation(lat, lng)
        elevation = elev_data.get("elevation_m", 0)

        # NER terrain slope estimation based on elevation and location
        # Higher elevation + steeper terrain = higher slope risk
        if elevation > 1500:
            slope_risk = 85
            terrain_type = "high_mountain"
        elif elevation > 800:
            slope_risk = 65
            terrain_type = "mountain"
        elif elevation > 300:
            slope_risk = 40
            terrain_type = "hills"
        elif elevation > 100:
            slope_risk = 20
            terrain_type = "foothills"
        else:
            slope_risk = 10
            terrain_type = "plain"

        return {
            "source": "terrain_estimate",
            "elevation_m": elevation,
            "estimated_slope_risk": slope_risk,
            "terrain_type": terrain_type,
            "elevation_source": elev_data.get("source", "unknown"),
        }

    @classmethod
    async def _fetch_bhuvan_elevation(cls, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """Fetch elevation from Bhuvan DEM API."""
        url = f"{APIConfig.BHUVAN_BASE_URL}/dem/elevation"
        params = {"lat": lat, "lng": lng, "token": APIConfig.BHUVAN_TOKEN}

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "elevation_m": data.get("elevation", 0),
                    "source": "bhuvan",
                }
        return None

    @classmethod
    async def _fetch_open_meteo_elevation(cls, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """Fetch elevation using Open-Meteo (uses SRTM DEM)."""
        # Open-Meteo doesn't have a direct elevation API, but we can use the
        # Google Elevation API (free tier) or Open Elevation
        url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lng}"

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    return {
                        "elevation_m": results[0].get("elevation", 0),
                        "source": "open_elevation",
                    }
        return None
