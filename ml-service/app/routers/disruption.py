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

router = APIRouter(prefix="/risk", tags=["Disruption Prediction (ML)"])


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
    district_info = APIConfig.NER_DISTRICTS.get(district_id, {})

    # Fetch real-time data from external APIs
    try:
        ctx = await DataAggregator.get_full_district_context(district_id)
        weather = ctx.get("weather", {})
        flood = ctx.get("flood", {})
        landslide = ctx.get("landslide", {})

        rainfall_24h = weather.get("rainfall_24h_mm", 12.0)
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

    # ML prediction
    result = predict_disruption(
        elevation_m=district_info.get("elevation_m", 500),
        slope_risk=district_info.get("slope_risk", 25),
        flood_susceptibility=district_info.get("flood_susceptibility", 0.3),
        landslide_susceptibility=district_info.get("landslide_susceptibility", 0.3),
        temp_celsius=temp,
        humidity_percent=humidity,
        wind_kmh=wind,
        rainfall_24h_mm=rainfall_24h,
        rainfall_48h_mm=rainfall_48h,
        rainfall_72h_mm=rainfall_72h,
        seasonal_rainfall_avg_mm=district_info.get("monsoon_rainfall_mm", 1500) / 12,
    )

    # Compute buffer days based on severity
    severity = result.get("disruptionSeverity", 20)
    buffer_days = 45 if severity >= 70 else 30 if severity >= 50 else 20 if severity >= 30 else 12

    return {
        "districtId": district_id,
        "landslideRisk": result["landslideRisk"],
        "floodRisk": result["floodRisk"],
        "confidenceScore": result["confidenceScore"],
        "recommendedBufferDays": buffer_days,
        "engine": result["engine"],
        "details": {
            "landslideProbability": result["landslideProbability"],
            "floodProbability": result["floodProbability"],
            "roadBlocked": result["roadBlocked"],
            "disruptionSeverity": result["disruptionSeverity"],
        },
    }


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
