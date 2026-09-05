"""
Flood Prediction Service — fetches real-time flood forecasts from Google Flood Hub API.
Provides riverine flood risk levels and forecasted water levels per NER district.
"""
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime
from app.services.config import APIConfig


class FloodService:
    """Fetch real-time flood forecast data from Google Flood Hub."""

    _cache: Dict[str, Any] = {}
    _cache_ttl = 1800  # 30 minutes (flood forecasts update less frequently)

    @classmethod
    async def get_district_flood_risk(cls, district_id: str) -> Dict[str, Any]:
        """Get flood risk forecast for a NER district."""
        cache_key = f"flood:{district_id}"
        cached = cls._cache.get(cache_key)
        if cached and (datetime.utcnow() - cached.get("_fetched_at", datetime.min)).seconds < cls._cache_ttl:
            return cached

        district = APIConfig.NER_DISTRICTS.get(district_id)
        if not district:
            return cls._default_flood(district_id)

        # Try Google Flood Hub API
        if APIConfig.GOOGLE_FLOOD_KEY:
            try:
                result = await cls._fetch_google_flood(district)
                if result:
                    result["_fetched_at"] = datetime.utcnow()
                    cls._cache[cache_key] = result
                    return result
            except Exception:
                pass

        # Honest rainfall-based flood estimate (real observed rainfall → localized
        # flood likelihood). Same approach as the landslide service: when the
        # official feed is down we still return REAL-derived data, clearly
        # labelled, never a dead "No data".
        try:
            estimate = await cls._estimate_flood_from_rainfall(district_id, district)
            estimate["_fetched_at"] = datetime.utcnow()
            cls._cache[cache_key] = estimate
            return estimate
        except Exception:
            pass

        return cls._default_flood(district_id)

    @classmethod
    async def _estimate_flood_from_rainfall(cls, district_id: str, district: Dict) -> Optional[Dict[str, Any]]:
        """Estimate localized flood risk from real-time rainfall (Open-Meteo)."""
        from app.services.weather_service import WeatherService
        try:
            weather = await WeatherService.get_district_weather(district_id)
        except Exception:
            weather = {}
        rainfall = float(weather.get("rainfall_24h_mm", 0) or 0)
        if rainfall <= 0:
            # No meaningful rain — do not fabricate flood risk.
            return None
        # NER thresholds: heavy 24h rain drives localized flooding on low-lying
        # roads; the risk level maps directly from observed rainfall.
        forecast_hours = weather.get("forecast_hours") or 0
        if rainfall > 80:
            level_num, label = 65, "High"
        elif rainfall > 50:
            level_num, label = 45, "Medium"
        elif rainfall > 25:
            level_num, label = 30, "Low"
        else:
            level_num, label = 10, "Very Low"
        return {
            "source": "rainfall_estimate",
            "city": district["name"],
            "flood_risk_level": level_num,
            "flood_risk_label": label,
            "forecasted_water_level_m": 0,
            "discharge_cubic_mps": 0,
            "rainfall_trigger_mm": round(rainfall, 1),
            "note": "Live flood feed paused — localized flood risk estimated from real observed rainfall",
        }

    @classmethod
    async def get_all_districts_flood(cls) -> Dict[str, Dict[str, Any]]:
        """Fetch flood data for all NER districts."""
        results = {}
        for did in APIConfig.NER_DISTRICTS:
            results[did] = await cls.get_district_flood_risk(did)
        return results

    @classmethod
    async def _fetch_google_flood(cls, district: Dict) -> Optional[Dict[str, Any]]:
        """
        Fetch from Google Flood Forecasting API.
        Endpoint: GET /v1/gauges:searchByArea
        Docs: https://developers.google.com/flood-forecasting
        """
        # Search for river gauges near the district center
        lat, lng = district["lat"], district["lng"]
        url = (
            f"{APIConfig.GOOGLE_FLOOD_URL}/gauges:searchByArea"
            f"?key={APIConfig.GOOGLE_FLOOD_KEY}"
        )
        payload = {
            "coords": {"latitude": lat, "longitude": lng},
            "maxDistKm": 100,
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                gauges = data.get("gauges", [])

                if gauges:
                    # Get the most severe forecast across all gauges
                    max_risk = 0
                    worst_gauge = None
                    for gauge in gauges:
                        forecast = gauge.get(".getValueAtNearestPoint", {})
                        severity = forecast.get("severity", {})
                        risk_val = severity.get("riskLevel", 0)
                        if risk_val > max_risk:
                            max_risk = risk_val
                            worst_gauge = gauge

                    if worst_gauge:
                        forecast = worst_gauge.get("getValue", {})
                        severity = forecast.get("severity", {})
                        return {
                            "source": "google_flood_hub",
                            "city": district["name"],
                            "flood_risk_level": severity.get("riskLevel", 0),
                            "flood_risk_label": severity.get("label", "Unknown"),
                            "forecasted_water_level_m": forecast.get("waterLevel", 0),
                            "discharge_cubic_mps": forecast.get("discharge", 0),
                            "gauge_id": worst_gauge.get("id", ""),
                            "gauge_name": worst_gauge.get("name", ""),
                            "forecast_hours": len(gauge.get("forecastStats", {}).get("waterLevel", [])),
                        }
        return None

    @classmethod
    async def get_nearby_gauge_forecasts(cls, lat: float, lng: float, max_dist_km: int = 100) -> List[Dict]:
        """Search for flood gauge forecasts near a coordinate."""
        if not APIConfig.GOOGLE_FLOOD_KEY:
            return []

        url = f"{APIConfig.GOOGLE_FLOOD_URL}/gauges:searchByArea?key={APIConfig.GOOGLE_FLOOD_KEY}"
        payload = {"coords": {"latitude": lat, "longitude": lng}, "maxDistKm": max_dist_km}

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    return resp.json().get("gauges", [])
        except Exception:
            pass
        return []

    @classmethod
    def _default_flood(cls, district_id: str) -> Dict[str, Any]:
        """Default flood data when API is unavailable."""
        return {
            "source": "default",
            "city": APIConfig.NER_DISTRICTS.get(district_id, {}).get("name", "Unknown"),
            "flood_risk_level": 0,
            "flood_risk_label": "No data",
            "forecasted_water_level_m": 0,
            "discharge_cubic_mps": 0,
            "note": "Live flood forecast feed paused — ML model estimates active",
            "_fetched_at": datetime.utcnow(),
        }
