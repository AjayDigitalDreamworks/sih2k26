"""
Landslide Hazard Service — fetches real-time landslide risk from NASA LHASA data.
LHASA provides daily global landslide hazard predictions based on rainfall + terrain.
Data source: https://maps.nccs.nasa.gov/download/landslides
"""
import httpx
from typing import Dict, Any, Optional
from datetime import datetime
from app.services.config import APIConfig


class LandslideService:
    """Fetch real-time landslide hazard data from NASA LHASA."""

    _cache: Dict[str, Any] = {}
    _cache_ttl = 3600  # 1 hour (LHASA updates ~4x/day)

    @classmethod
    async def get_district_landslide_risk(cls, district_id: str) -> Dict[str, Any]:
        """Get landslide hazard assessment for a NER district."""
        cache_key = f"landslide:{district_id}"
        cached = cls._cache.get(cache_key)
        if cached and (datetime.utcnow() - cached.get("_fetched_at", datetime.min)).seconds < cls._cache_ttl:
            return cached

        district = APIConfig.NER_DISTRICTS.get(district_id)
        if not district:
            return cls._default_risk(district_id)

        # Try NASA LHASA data download
        if APIConfig.NASA_EARTHDATA_USER:
            try:
                result = await cls._fetch_lhasa_data(district)
                if result:
                    result["_fetched_at"] = datetime.utcnow()
                    cls._cache[cache_key] = result
                    return result
            except Exception:
                pass

        # Fallback: Use Open-Meteo rainfall to estimate landslide risk
        # (rainfall is the primary trigger for LHASA model)
        try:
            result = await cls._estimate_from_rainfall(district)
            if result:
                result["_fetched_at"] = datetime.utcnow()
                cls._cache[cache_key] = result
                return result
        except Exception:
            pass

        return cls._default_risk(district_id)

    @classmethod
    async def _fetch_lhasa_data(cls, district: Dict) -> Optional[Dict[str, Any]]:
        """
        Fetch LHASA landslide hazard data.
        LHASA data is published as GeoTIFF/CSV at maps.nccs.nasa.gov.
        For real-time, we check the latest hazard tile for our coordinates.
        """
        lat, lng = district["lat"], district["lng"]

        # LHASA API endpoint for point query
        # The data is at ~1km resolution, we query the nearest grid cell
        url = f"{APIConfig.NASA_LHASA_URL}/hazard/query"
        params = {"lat": lat, "lon": lng, "format": "json"}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "source": "nasa_lhasa",
                    "city": district["name"],
                    "hazard_probability": data.get("probability", 0),
                    "hazard_level": data.get("level", "Unknown"),
                    "rainfall_trigger_mm": data.get("threshold_mm", 0),
                    "susceptibility_score": data.get("susceptibility", 0),
                    "model_version": data.get("model_version", "2.1"),
                    "data_date": data.get("date", ""),
                }
        return None

    @classmethod
    async def _estimate_from_rainfall(cls, district: Dict) -> Optional[Dict[str, Any]]:
        """
        Estimate landslide risk from real-time rainfall data.
        Based on LHASA v2 methodology: rainfall intensity vs historical threshold.
        NER regions have high susceptibility due to steep terrain.
        """
        # Get current rainfall from Open-Meteo
        lat, lng = district["lat"], district["lng"]
        url = (
            f"{APIConfig.OPEN_METEO_URL}/forecast"
            f"?latitude={lat}&longitude={lng}"
            f"&current=rain"
            f"&daily=rain_sum"
            f"&timezone=Asia/Kolkata"
            f"&forecast_days=1"
        )

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                current_rain = data.get("current", {}).get("rain", 0)
                daily_rain = data.get("daily", {}).get("rain_sum", [0])[0] if data.get("daily") else 0

                # NER-specific thresholds (mm/day):
                # >25mm = moderate risk, >50mm = high, >80mm = very high
                total_rain = max(current_rain, daily_rain)

                if total_rain > 80:
                    probability = 0.85
                    level = "Very High"
                elif total_rain > 50:
                    probability = 0.65
                    level = "High"
                elif total_rain > 25:
                    probability = 0.40
                    level = "Moderate"
                elif total_rain > 10:
                    probability = 0.20
                    level = "Low"
                else:
                    probability = 0.05
                    level = "Very Low"

                return {
                    "source": "rainfall_estimate",
                    "city": district["name"],
                    "hazard_probability": round(probability, 2),
                    "hazard_level": level,
                    "rainfall_trigger_mm": total_rain,
                    "current_rainfall_mm": current_rain,
                    "daily_rainfall_mm": daily_rain,
                    "methodology": "LHASA-inspired rainfall threshold model",
                    "note": "Estimated from real-time rainfall — connect NASA LHASA for official data",
                }
        return None

    @classmethod
    def _default_risk(cls, district_id: str) -> Dict[str, Any]:
        return {
            "source": "default",
            "city": APIConfig.NER_DISTRICTS.get(district_id, {}).get("name", "Unknown"),
            "hazard_probability": 0.1,
            "hazard_level": "Unknown",
            "note": "Default values — connect NASA LHASA for live landslide data",
            "_fetched_at": datetime.utcnow(),
        }
