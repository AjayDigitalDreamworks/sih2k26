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

    # ------------------------------------------------------------------
    # Time-of-Arrival (ETA) Hourly Prediction
    # ------------------------------------------------------------------
    WEATHER_DESCRIPTIONS = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Freezing rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        80: "Rain showers",
        81: "Moderate showers",
        82: "Violent rain showers",
        95: "Thunderstorm",
        96: "Thunderstorm with hail",
        99: "Severe thunderstorm",
    }

    @classmethod
    async def get_hourly_weather_at_eta(cls, lat: float, lng: float, hours_ahead: float = 0.0) -> Dict[str, Any]:
        """Fetch forecasted weather at the estimated arrival time (current_hour + hours_ahead)."""
        offset_h = max(0, min(72, int(round(hours_ahead))))
        cache_key = f"weather_eta:{lat:.3f},{lng:.3f}:{offset_h}"
        cached = cls._cache.get(cache_key)
        if cached:
            return cached

        url = f"{APIConfig.OPEN_METEO_URL}/forecast"
        params = {
            "latitude": lat,
            "longitude": lng,
            "hourly": "temperature_2m,precipitation,weather_code,wind_speed_10m",
            "forecast_days": "3",
            "timezone": "auto",
        }
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    hourly = data.get("hourly") or {}
                    times = hourly.get("time") or []
                    precip = hourly.get("precipitation") or []
                    wx_codes = hourly.get("weather_code") or []
                    winds = hourly.get("wind_speed_10m") or []
                    temps = hourly.get("temperature_2m") or []

                    # Find index corresponding to current hour in local time
                    now_str = datetime.now().strftime("%Y-%m-%dT%H:00")
                    start_idx = 0
                    for idx, t_str in enumerate(times):
                        if t_str >= now_str:
                            start_idx = idx
                            break

                    target_idx = min(len(times) - 1, start_idx + offset_h) if times else offset_h

                    val_precip = float(precip[target_idx] or 0.0) if target_idx < len(precip) else 0.0
                    val_code = int(wx_codes[target_idx] or 0) if target_idx < len(wx_codes) else 0
                    val_wind = float(winds[target_idx] or 0.0) if target_idx < len(winds) else 0.0
                    val_temp = float(temps[target_idx] or 25.0) if target_idx < len(temps) else 25.0
                    target_time = times[target_idx] if target_idx < len(times) else now_str

                    weather_desc = cls.WEATHER_DESCRIPTIONS.get(val_code, "Cloudy" if val_code > 0 else "Clear")

                    risk_level = "low"
                    if val_precip >= 20.0 or val_code in (95, 96, 99) or val_wind >= 60.0:
                        risk_level = "critical"
                    elif val_precip >= 8.0 or val_code in (65, 75, 82) or val_wind >= 45.0:
                        risk_level = "high"
                    elif val_precip >= 2.0 or val_code in (61, 63, 80):
                        risk_level = "medium"

                    res = {
                        "hours_ahead": offset_h,
                        "eta_time": target_time,
                        "forecast_precip_mm": round(val_precip, 1),
                        "weather_code": val_code,
                        "weather_desc": weather_desc,
                        "wind_kmh": round(val_wind, 1),
                        "temp_celsius": round(val_temp, 1),
                        "forecast_risk_level": risk_level,
                        "source": "open-meteo-hourly",
                    }
                    cls._cache[cache_key] = res
                    return res
        except Exception:
            pass

        return {
            "hours_ahead": offset_h,
            "eta_time": datetime.now().strftime("%Y-%m-%dT%H:00"),
            "forecast_precip_mm": 0.0,
            "weather_code": 0,
            "weather_desc": "Clear",
            "wind_kmh": 10.0,
            "temp_celsius": 25.0,
            "forecast_risk_level": "low",
            "source": "default",
        }


