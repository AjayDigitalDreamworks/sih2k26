"""
Weather Data Service — fetches real-time weather from IMD and Open-Meteo (fallback).
Provides rainfall, temperature, humidity, and weather warnings per NER district.
"""
import httpx
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
from app.services.config import APIConfig


class WeatherService:
    """Fetch real-time weather data for NER districts."""

    _cache: Dict[str, Any] = {}
    _cache_ttl = 900  # 15 minutes

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    @classmethod
    async def get_district_weather(cls, district_id: str) -> Dict[str, Any]:
        """Get current weather for a district — tries IMD first, falls back to Open-Meteo."""
        cache_key = f"weather:{district_id}"
        cached = cls._cache.get(cache_key)
        if cached and (datetime.utcnow() - cached.get("_fetched_at", datetime.min)).seconds < cls._cache_ttl:
            return cached

        district = APIConfig.NER_DISTRICTS.get(district_id)
        if not district:
            return cls._default_weather(district_id)

        # Try IMD API first
        if APIConfig.IMD_API_KEY:
            try:
                result = await cls._fetch_imd(district)
                if result:
                    result["_fetched_at"] = datetime.utcnow()
                    cls._cache[cache_key] = result
                    return result
            except Exception:
                pass

        # Fallback: Open-Meteo (free, no key needed)
        try:
            result = await cls._fetch_open_meteo(district)
            if result:
                result["_fetched_at"] = datetime.utcnow()
                cls._cache[cache_key] = result
                return result
        except Exception:
            pass

        return cls._default_weather(district_id)

    @classmethod
    async def get_all_districts_weather(cls) -> Dict[str, Dict[str, Any]]:
        """Get weather for every NER district (dict keyed by district id)."""
        districts = list(APIConfig.NER_DISTRICTS.keys())

        async def _one(did: str) -> Dict[str, Any]:
            # Small stagger to avoid hammering upstream APIs simultaneously
            return await cls.get_district_weather(did)

        # Concurrency-safe: fetch in bounded batches
        results: Dict[str, Dict[str, Any]] = {}
        for i in range(0, len(districts), 4):
            batch = districts[i:i + 4]
            batch_out = await asyncio.gather(*[_one(d) for d in batch])
            for did, weather in zip(batch, batch_out):
                results[did] = weather
        return results

    @classmethod
    async def get_district_warnings(cls, district_id: str) -> Dict[str, Any]:
        """Return active weather warnings for a district."""
        district = APIConfig.NER_DISTRICTS.get(district_id, {})
        weather = await cls.get_district_weather(district_id)
        warnings: List[Dict[str, str]] = []

        rainfall = weather.get("rainfall_24h_mm") or 0
        wind = weather.get("wind_kmh") or 0
        code = weather.get("weather_code")

        if rainfall >= 80:
            warnings.append({
                "type": "extreme_rainfall",
                "severity": "critical",
                "message": f"Very heavy rainfall ({rainfall:.0f} mm/24h). Route suspension recommended.",
            })
        elif rainfall >= 40:
            warnings.append({
                "type": "heavy_rainfall",
                "severity": "warning",
                "message": f"Heavy rainfall ({rainfall:.0f} mm/24h). Drive cautiously.",
            })
        if wind >= 60:
            warnings.append({
                "type": "high_wind",
                "severity": "warning",
                "message": f"Strong winds ({wind:.0f} km/h). High-sided vehicles advised to halt.",
            })
        if code is not None and (95 <= int(code) <= 99):
            warnings.append({
                "type": "thunderstorm",
                "severity": "warning",
                "message": "Thunderstorm in the area. Avoid open stretches.",
            })

        return {
            "district_id": district_id,
            "city": district.get("name", district_id),
            "source": weather.get("source", "unavailable"),
            "warnings": warnings,
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }

    @classmethod
    def _default_weather(cls, district_id: str) -> Dict[str, Any]:
        """No API reachable - return honest status."""
        district = APIConfig.NER_DISTRICTS.get(district_id, {})
        return {
            "source": "unavailable",
            "status": "DATA SOURCE NOT CONFIGURED",
            "city": district.get("name", "Unknown"),
            "lat": district.get("lat", 0),
            "lng": district.get("lng", 0),
            "temp_celsius": None,
            "humidity_percent": None,
            "rainfall_24h_mm": None,
            "wind_kmh": None,
            "weather_code": None,
            "note": "Live weather feed paused — historical data is being used",
        }

    # ------------------------------------------------------------------
    # IMD (requires API key)
    # ------------------------------------------------------------------
    @classmethod
    async def _fetch_imd(cls, district: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Fetch current weather from IMD station API."""
        station_id = district.get("imd_id", "")
        url = f"{APIConfig.IMD_BASE_URL}/stationdata/latest"
        params = {"station": station_id, "api_key": APIConfig.IMD_API_KEY}
        headers = {"Authorization": f"Bearer {APIConfig.IMD_API_KEY}"}

        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code != 200:
                return None
            data = resp.json()

        # IMD payloads vary by station; extract common numeric fields tolerantly.
        obs = data.get("stationdata") or data.get("data") or data
        if isinstance(obs, list):
            obs = obs[0] if obs else {}

        def num(*keys, default=None):
            for key in keys:
                val = obs.get(key)
                if val is None:
                    continue
                try:
                    fval = float(val)
                    return fval
                except (TypeError, ValueError):
                    continue
            return default

        temp = num("temperature_c", "temp", "tmax", "t")
        if temp is None:
            return None  # no usable observation

        return {
            "source": "imd",
            "status": "live",
            "city": district.get("name", "Unknown"),
            "lat": district.get("lat", 0),
            "lng": district.get("lng", 0),
            "temp_celsius": temp,
            "humidity_percent": num("humidity_percent", "humidity", "rh", default=None),
            "rainfall_24h_mm": num("rainfall_24h_mm", "rain_24h_mm", "rainfall_mm", "rain", default=0.0),
            "wind_kmh": num("wind_kmh", "wind_speed_kmh", "wind_speed", "wind", default=None),
            "weather_code": num("weather_code", "wx_code", default=None),
            "note": "Live IMD station observation",
        }

    # ------------------------------------------------------------------
    # Open-Meteo (free fallback, no key required)
    # ------------------------------------------------------------------
    @classmethod
    async def _fetch_open_meteo(cls, district: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Fetch current weather + 24h rainfall from Open-Meteo."""
        url = f"{APIConfig.OPEN_METEO_URL}/forecast"
        params = {
            "latitude": district["lat"],
            "longitude": district["lng"],
            "current": (
                "temperature_2m,relative_humidity_2m,apparent_temperature,"
                "precipitation,weather_code,wind_speed_10m"
            ),
            "hourly": "precipitation",
            "past_days": "1",
            "forecast_days": "1",
            "timezone": "auto",
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return None
            data = resp.json()

        current = data.get("current") or {}
        if "temperature_2m" not in current:
            return None

        # 24h rainfall = sum of the last 24 hourly precipitation samples
        hourly = data.get("hourly") or {}
        precip_series = hourly.get("precipitation") or []
        rainfall_24h = 0.0
        if precip_series:
            rainfall_24h = round(sum(float(v or 0) for v in precip_series[-24:]), 1)

        def fval(v, default=None):
            try:
                if v is None:
                    return default
                f = float(v)
                return f
            except (TypeError, ValueError):
                return default

        return {
            "source": "open-meteo",
            "status": "live",
            "city": district.get("name", "Unknown"),
            "lat": district.get("lat", 0),
            "lng": district.get("lng", 0),
            "temp_celsius": fval(current.get("temperature_2m")),
            "humidity_percent": fval(current.get("relative_humidity_2m")),
            "rainfall_24h_mm": rainfall_24h,
            "wind_kmh": fval(current.get("wind_speed_10m")),
            "weather_code": fval(current.get("weather_code")),
            "note": "Live Open-Meteo forecast (free fallback source)",
        }
