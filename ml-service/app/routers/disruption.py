"""
Disruption Prediction Router — ML-powered flood/landslide/traffic forecasting.
Uses trained XGBoost models with real-time data from NASA LHASA, Google Flood Hub, IMD.
"""
from fastapi import APIRouter, Query
from app.models.schemas import DisruptionPredictRequest, DisruptionPredictResponse
from app.engine.ml_inference import predict_disruption, get_model_status
from app.services.data_aggregator import DataAggregator
from app.services.weather_service import WeatherService
from app.services.flood_service import FloodService
from app.services.landslide_service import LandslideService
from app.services.config import APIConfig

import time
from typing import Tuple

router = APIRouter(prefix="/risk", tags=["Disruption Prediction (ML)"])

_DISRUPTION_CACHE: dict = {}
TTL_DISRUPTION = 60.0  # 60 seconds fast cache


@router.post("/disruption-predict", response_model=DisruptionPredictResponse)
async def predict_disruption_endpoint(payload: DisruptionPredictRequest):
    """
    ML-powered disruption prediction for a district.

    Uses trained XGBoost models to predict:
    - Landslide probability
    - Flood probability
    - Road blockage risk
    - Overall disruption severity

    Enriched with real-time data from NASA LHASA + Google Flood Hub + IMD weather.
    """
    district_id = payload.districtId
    now = time.time()
    cache_key = f"{district_id}:{payload.includeRealTime}:{payload.connectivityScore}:{payload.recentIncidents}"
    cached = _DISRUPTION_CACHE.get(cache_key)
    if cached and (now - cached[0]) < TTL_DISRUPTION:
        return cached[1]

    district_info = APIConfig.NER_DISTRICTS.get(district_id, {})

    # Fetch real-time data from external APIs
    imd_warning_meta = None
    imd_rainfall_meta = None
    try:
        ctx = await DataAggregator.get_full_district_context(district_id)
        weather = ctx.get("weather", {})
        flood = ctx.get("flood", {})
        landslide = ctx.get("landslide", {})

        rainfall_24h = weather.get("rainfall_24h_mm", 12.0)
        
        # Check official IMD district rainfall departure (LE/E indicates high soil saturation)
        try:
            ner_rainfall = await WeatherService.get_district_rainfall("ner")
            clean_id = district_id.lower().replace("_", " ")
            matching_r = next((r for r in ner_rainfall if clean_id in r.get("district", "").lower() or r.get("district", "").lower() in clean_id), None)
            if matching_r:
                imd_rainfall_meta = matching_r.get("daily")
                actual_val = matching_r.get("daily", {}).get("actualMm")
                if actual_val and actual_val > 0:
                    rainfall_24h = max(rainfall_24h, actual_val)
        except Exception:
            pass

        # Check official IMD 5-day warning matrix
        try:
            ner_warnings = await WeatherService.get_district_warnings("ner")
            clean_id = district_id.lower().replace("_", " ")
            matching_w = next((w for w in ner_warnings if clean_id in w.get("district", "").lower() or w.get("district", "").lower() in clean_id), None)
            if matching_w:
                imd_warning_meta = matching_w
        except Exception:
            pass

        rainfall_48h = rainfall_24h * 1.5
        rainfall_72h = rainfall_48h * 1.2
        temp = weather.get("temp_celsius", 25)
        humidity = weather.get("humidity_percent", 75)
        wind = weather.get("wind_kmh", 10)
        flood_risk = flood.get("flood_risk_level", 0)
        landslide_prob = landslide.get("hazard_probability", 0.1)
    except Exception:
        # Fallback to payload data
        rainfall_24h = payload.weatherSnapshot.rainfall_24h_mm if payload.weatherSnapshot else 12.0
        rainfall_48h = rainfall_24h * 1.5
        rainfall_72h = rainfall_48h * 1.2
        temp = payload.weatherSnapshot.temp_celsius if payload.weatherSnapshot else 25
        humidity = payload.weatherSnapshot.humidity_percent if payload.weatherSnapshot else 75
        wind = payload.weatherSnapshot.wind_kmh if payload.weatherSnapshot else 10
        flood_risk = 0
        landslide_prob = 0.1

    # Adjust susceptibilities if IMD reports Large Excess or Red/Orange warning
    is_excess_rain = imd_rainfall_meta and imd_rainfall_meta.get("category") in ("LE", "E")
    has_severe_warning = imd_warning_meta and imd_warning_meta.get("day1", {}).get("color") in ("red", "orange")

    base_flood_susc = district_info.get("flood_susceptibility", 0.3)
    base_land_susc = district_info.get("landslide_susceptibility", 0.3)
    if is_excess_rain:
        base_flood_susc = min(1.0, base_flood_susc + 0.2)
        base_land_susc = min(1.0, base_land_susc + 0.15)
    if has_severe_warning:
        base_flood_susc = min(1.0, base_flood_susc + 0.15)
        base_land_susc = min(1.0, base_land_susc + 0.2)

    # ML prediction
    result = predict_disruption(
        elevation_m=district_info.get("elevation_m", 500),
        slope_risk=district_info.get("slope_risk", 25),
        flood_susceptibility=base_flood_susc,
        landslide_susceptibility=base_land_susc,
        temp_celsius=temp,
        humidity_percent=humidity,
        wind_kmh=wind,
        rainfall_24h_mm=rainfall_24h,
        rainfall_48h_mm=rainfall_48h,
        rainfall_72h_mm=rainfall_72h,
        seasonal_rainfall_avg_mm=district_info.get("monsoon_rainfall_mm", 1500) / 12,
    )

    # Compute buffer days based on severity & IMD warning status
    severity = result.get("disruptionSeverity", 20)
    if has_severe_warning:
        severity = min(100, severity + 20)
    buffer_days = 45 if severity >= 70 else 30 if severity >= 50 else 20 if severity >= 30 else 12

    resp_payload = {
        "districtId": district_id,
        "landslideRisk": result["landslideRisk"],
        "floodRisk": result["floodRisk"],
        "confidenceScore": result["confidenceScore"],
        "recommendedBufferDays": buffer_days,
        "engine": result["engine"],
        "imdIntelligence": {
            "warning": imd_warning_meta,
            "rainfallAnomaly": imd_rainfall_meta,
            "hasSevereWarning": has_severe_warning,
            "isExcessRainfall": is_excess_rain,
        },
        "details": {
            "landslideProbability": result["landslideProbability"],
            "floodProbability": result["floodProbability"],
            "roadBlocked": result["roadBlocked"],
            "disruptionSeverity": result["disruptionSeverity"],
        },
    }
    _DISRUPTION_CACHE[cache_key] = (now, resp_payload)
    return resp_payload


@router.get("/disruption-predict/live")
async def predict_disruption_live(district_id: str = Query(..., description="District ID")):
    """
    ML disruption prediction using ONLY real-time external API data.
    Pure live data from NASA LHASA + Google Flood Hub + IMD.
    """
    district_info = APIConfig.NER_DISTRICTS.get(district_id, {})
    ctx = await DataAggregator.get_full_district_context(district_id)

    weather = ctx.get("weather", {})
    flood = ctx.get("flood", {})
    landslide = ctx.get("landslide", {})
    terrain = ctx.get("terrain", {})

    # ML prediction with real-time data
    result = predict_disruption(
        elevation_m=terrain.get("elevation_m", district_info.get("elevation_m", 500)),
        slope_risk=terrain.get("estimated_slope_risk", district_info.get("slope_risk", 25)),
        flood_susceptibility=district_info.get("flood_susceptibility", 0.3),
        landslide_susceptibility=district_info.get("landslide_susceptibility", 0.3),
        temp_celsius=weather.get("temp_celsius", 25),
        humidity_percent=weather.get("humidity_percent", 75),
        wind_kmh=weather.get("wind_kmh", 10),
        rainfall_24h_mm=weather.get("rainfall_24h_mm", 12),
        rainfall_48h_mm=weather.get("rainfall_24h_mm", 12) * 1.5,
        rainfall_72h_mm=weather.get("rainfall_24h_mm", 12) * 1.8,
        seasonal_rainfall_avg_mm=district_info.get("monsoon_rainfall_mm", 1500) / 12,
    )

    return {
        "districtId": district_id,
        "districtName": district_info.get("name", district_id),
        **result,
        "liveData": ctx,
        "computedAt": result.get("computedAt"),
    }


@router.get("/disruption-predict/all")
async def predict_all_disruptions():
    """
    Run ML disruption predictions for ALL NER districts.
    Returns predictions for all 12 districts.
    """
    results = {}
    for district_id, district_info in APIConfig.NER_DISTRICTS.items():
        try:
            ctx = await DataAggregator.get_full_district_context(district_id)
            weather = ctx.get("weather", {})
            terrain = ctx.get("terrain", {})

            result = predict_disruption(
                elevation_m=terrain.get("elevation_m", district_info.get("elevation_m", 500)),
                slope_risk=terrain.get("estimated_slope_risk", district_info.get("slope_risk", 25)),
                flood_susceptibility=district_info.get("flood_susceptibility", 0.3),
                landslide_susceptibility=district_info.get("landslide_susceptibility", 0.3),
                temp_celsius=weather.get("temp_celsius", 25),
                humidity_percent=weather.get("humidity_percent", 75),
                wind_kmh=weather.get("wind_kmh", 10),
                rainfall_24h_mm=weather.get("rainfall_24h_mm", 0),
                rainfall_48h_mm=weather.get("rainfall_24h_mm", 0) * 1.5,
                rainfall_72h_mm=weather.get("rainfall_24h_mm", 0) * 1.8,
                seasonal_rainfall_avg_mm=district_info.get("monsoon_rainfall_mm", 1500) / 12,
            )

            results[district_id] = {
                "name": district_info.get("name", district_id),
                **result,
            }
        except Exception as e:
            results[district_id] = {"error": str(e)}

    return {
        "totalDistricts": len(results),
        "predictions": results,
    }
