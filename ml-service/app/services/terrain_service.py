"""
Terrain Data Service — uses Open-Meteo (SRTM DEM), Bhuvan (ISRO), and Open-Elevation.
Provides terrain slope, elevation profiles, and incline metrics for NER road networks.
"""
import math
import httpx
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from app.services.config import APIConfig


def _haversine_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great circle distance in km between two lat/lng points."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
    return 2.0 * r * math.asin(math.sqrt(max(0.0, min(1.0, a))))


class TerrainService:
    """Fetch terrain and elevation data from Open-Meteo (SRTM DEM), Bhuvan (ISRO), and Open-Elevation."""

    _cache: Dict[str, Any] = {}
    _cache_ttl = 86400  # 24 hours (terrain elevation data is static)

    @classmethod
    async def get_elevation(cls, lat: float, lng: float) -> Dict[str, Any]:
        """Get elevation at a point using Open-Meteo SRTM DEM or Bhuvan."""
        cache_key = f"elev:{lat:.4f},{lng:.4f}"
        cached = cls._cache.get(cache_key)
        if cached:
            return cached

        # 1. Open-Meteo elevation (SRTM 90m DEM, fast and keyless)
        try:
            result = await cls._fetch_open_meteo_elevation(lat, lng)
            if result:
                cls._cache[cache_key] = result
                return result
        except Exception:
            pass

        # 2. Try Bhuvan DEM API if token configured
        if APIConfig.BHUVAN_TOKEN:
            try:
                result = await cls._fetch_bhuvan_elevation(lat, lng)
                if result:
                    cls._cache[cache_key] = result
                    return result
            except Exception:
                pass

        # 3. Fallback: Open Elevation API
        try:
            result = await cls._fetch_open_elevation(lat, lng)
            if result:
                cls._cache[cache_key] = result
                return result
        except Exception:
            pass

        return {"elevation_m": 500.0, "source": "default", "note": "Default elevation"}

    @classmethod
    async def get_route_elevation_profile(cls, points: list) -> Dict[str, Any]:
        """Get elevation profile and mountain climb metrics along a route.
        Returns: { profile: [...], climb_gain_m: float, max_elevation_m: float, max_gradient_pct: float, avg_gradient_pct: float }
        """
        if not points:
            return {
                "profile": [],
                "climb_gain_m": 0.0,
                "max_elevation_m": 0.0,
                "max_gradient_pct": 0.0,
                "avg_gradient_pct": 0.0,
            }

        # Subsample to at most 40 points to stay snappy
        sampled = points
        if len(points) > 40:
            step = max(1, len(points) // 40)
            sampled = points[::step]
            if points[-1] not in sampled:
                sampled.append(points[-1])

        coords: List[Tuple[float, float]] = []
        for pt in sampled:
            lat = pt[0] if isinstance(pt, (list, tuple)) else pt.get("lat")
            lng = pt[1] if isinstance(pt, (list, tuple)) else pt.get("lng")
            if lat is not None and lng is not None:
                coords.append((float(lat), float(lng)))

        if not coords:
            return {
                "profile": [],
                "climb_gain_m": 0.0,
                "max_elevation_m": 0.0,
                "max_gradient_pct": 0.0,
                "avg_gradient_pct": 0.0,
            }

        elevations = await cls._fetch_batch_elevations(coords)

        profile = []
        climb_gain = 0.0
        max_elev = 0.0
        max_gradient = 0.0
        positive_gradients: List[float] = []
        cum_dist_km = 0.0

        for i, (lat, lng) in enumerate(coords):
            cur_elev = elevations[i] if i < len(elevations) else 500.0
            max_elev = max(max_elev, cur_elev)

            gradient_pct = 0.0
            if i > 0:
                prev_lat, prev_lng = coords[i - 1]
                prev_elev = elevations[i - 1] if (i - 1) < len(elevations) else 500.0
                step_dist_km = _haversine_distance_km(prev_lat, prev_lng, lat, lng)
                cum_dist_km += step_dist_km

                delta_elev_m = cur_elev - prev_elev
                if delta_elev_m > 0:
                    climb_gain += delta_elev_m

                if step_dist_km > 0.05:  # At least 50m to avoid GPS jitter division spikes
                    gradient_pct = (delta_elev_m / (step_dist_km * 1000.0)) * 100.0
                    if gradient_pct > 0:
                        positive_gradients.append(gradient_pct)
                    max_gradient = max(max_gradient, abs(gradient_pct))

            profile.append({
                "lat": round(lat, 5),
                "lng": round(lng, 5),
                "elevation_m": round(cur_elev, 1),
                "distance_km": round(cum_dist_km, 2),
                "gradient_pct": round(gradient_pct, 1),
            })

        avg_gradient = (sum(positive_gradients) / len(positive_gradients)) if positive_gradients else 0.0

        return {
            "profile": profile,
            "climb_gain_m": round(climb_gain, 1),
            "max_elevation_m": round(max_elev, 1),
            "max_gradient_pct": round(min(30.0, max_gradient), 1),
            "avg_gradient_pct": round(min(20.0, avg_gradient), 1),
        }

    @classmethod
    async def estimate_slope_risk(cls, lat: float, lng: float) -> Dict[str, Any]:
        """Estimate terrain slope risk for landslide assessment."""
        elev_data = await cls.get_elevation(lat, lng)
        elevation = elev_data.get("elevation_m", 0.0)

        # NER terrain slope estimation based on elevation and location
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
    async def _fetch_batch_elevations(cls, coords: List[Tuple[float, float]]) -> List[float]:
        """Batch fetch elevations using Open-Meteo SRTM DEM."""
        if not coords:
            return []

        # Check if all are cached
        missing_indices = []
        results: List[Optional[float]] = [None] * len(coords)
        for i, (lat, lng) in enumerate(coords):
            cache_key = f"elev:{lat:.4f},{lng:.4f}"
            if cache_key in cls._cache:
                results[i] = cls._cache[cache_key].get("elevation_m", 500.0)
            else:
                missing_indices.append(i)

        if not missing_indices:
            return [r if r is not None else 500.0 for r in results]

        # Fetch missing via Open-Meteo batch
        try:
            lats_str = ",".join(f"{coords[i][0]:.4f}" for i in missing_indices)
            lngs_str = ",".join(f"{coords[i][1]:.4f}" for i in missing_indices)
            url = f"https://api.open-meteo.com/v1/elevation?latitude={lats_str}&longitude={lngs_str}"

            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    elev_list = data.get("elevation") or []
                    for idx, elev_val in zip(missing_indices, elev_list):
                        val = float(elev_val or 500.0)
                        results[idx] = val
                        cls._cache[f"elev:{coords[idx][0]:.4f},{coords[idx][1]:.4f}"] = {
                            "elevation_m": val,
                            "source": "open_meteo",
                        }
        except Exception:
            pass

        # Fill any remaining missing with default
        return [r if r is not None else 500.0 for r in results]

    @classmethod
    async def _fetch_open_meteo_elevation(cls, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """Fetch elevation for a single point using Open-Meteo."""
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lat:.4f}&longitude={lng:.4f}"
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                elev_list = data.get("elevation") or []
                if elev_list:
                    return {
                        "elevation_m": float(elev_list[0]),
                        "source": "open_meteo",
                    }
        return None

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
                    "elevation_m": float(data.get("elevation", 0)),
                    "source": "bhuvan",
                }
        return None

    @classmethod
    async def _fetch_open_elevation(cls, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """Fetch elevation using Open-Elevation fallback."""
        url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lng}"
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    return {
                        "elevation_m": float(results[0].get("elevation", 0)),
                        "source": "open_elevation",
                    }
        return None
