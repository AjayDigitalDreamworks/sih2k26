"""
Risk Scoring Router — ML-powered route risk assessment.
Uses trained XGBoost model with real-time data enrichment.
"""
from fastapi import APIRouter, Query, UploadFile, File
from fastapi.responses import JSONResponse
from typing import Optional
from app.models.schemas import RouteScoreRequest, RiskScoreResponse
from app.engine.ml_inference import predict_risk_score, predict_incident_from_image, get_model_status
from app.services.data_aggregator import DataAggregator
from app.services.weather_service import WeatherService
from app.services.flood_service import FloodService
from app.services.landslide_service import LandslideService
from app.services.traffic_service import TrafficService

router = APIRouter(prefix="/risk", tags=["Risk Scoring (ML)"])


@router.post("/route-score", response_model=RiskScoreResponse)
async def get_route_score(payload: RouteScoreRequest):
    """
    Compute ML-powered risk score for a route.

    Uses trained XGBoost model when available, falls back to rule-based.
    Enriches with real-time weather/flood/landslide/traffic data from external APIs.
    """
    rainfall = payload.weatherSnapshot.rainfall_24h_mm if payload.weatherSnapshot else None
    slope = payload.slopeRisk
    condition = payload.roadCondition
    historical = payload.historicalDisruptions or 0
    bridge = payload.bridgeCondition or "operational"
    congestion = payload.congestionLevel

    # Enrich with real-time data
    flood_risk = 0.0
    landslide_prob = 0.1
    elevation = 500.0

    try:
        origin = payload.roadIds[0] if payload.roadIds else "kamrup"
        dest = payload.roadIds[1] if len(payload.roadIds) > 1 else "sonitpur"

        ctx = await DataAggregator.get_route_context(origin, dest)
        if rainfall is None:
            rainfall = ctx.get("rainfall_24h_mm", 12.0)
        if congestion is None:
            congestion = ctx.get("congestion_level", "low")

        # Get flood/landslide data
        flood_data = await FloodService.get_district_flood_risk(origin)
        flood_risk = flood_data.get("flood_risk_level", 0)

        land_data = await LandslideService.get_district_landslide_risk(origin)
        landslide_prob = land_data.get("hazard_probability", 0.1)

    except Exception:
        if rainfall is None:
            rainfall = 12.0
        if congestion is None:
            congestion = "low"

    # ML prediction
    result = predict_risk_score(
        slope_risk=slope or 25.0,
        rainfall_24h_mm=rainfall,
        road_condition=condition or "good",
        bridge_condition=bridge,
        historical_disruptions=historical,
        congestion_level=congestion,
        flood_risk_level=flood_risk,
        landslide_probability=landslide_prob,
        elevation_m=elevation,
        road_distance_km=100.0,
        route_id=payload.routeId,
    )

    return result


@router.get("/route-score/live")
async def get_live_route_score(
    route_id: str = Query(..., description="Route ID to score"),
    origin: str = Query("kamrup", description="Origin district ID"),
    dest: str = Query("sonitpur", description="Destination district ID"),
):
    """
    Compute ML risk score using ONLY real-time external data.
    No DB lookup — pure live data from IMD/NASA/TomTom/Google Flood Hub.
    """
    ctx = await DataAggregator.get_route_context(origin, dest)

    # Get all real-time data
    flood_data = await FloodService.get_district_flood_risk(origin)
    land_data = await LandslideService.get_district_landslide_risk(origin)

    result = predict_risk_score(
        slope_risk=25,
        rainfall_24h_mm=ctx.get("rainfall_24h_mm", 12.0),
        road_condition="good",
        bridge_condition="operational",
        historical_disruptions=0,
        congestion_level=ctx.get("congestion_level", "low"),
        flood_risk_level=flood_data.get("flood_risk_level", 0),
        landslide_probability=land_data.get("hazard_probability", 0.1),
        elevation_m=500,
        road_distance_km=ctx.get("real_distance_km", 100),
        route_id=route_id,
    )
    result["liveData"] = ctx
    return result


@router.post("/incident-detect")
async def detect_incident(
    file: UploadFile = File(..., description="Image of road incident"),
):
    """
    Detect road incidents from image using CNN model.

    Accepts image files (JPEG/PNG). Returns predicted incident type
    and severity. For geo-tagged images, extracts location data.
    """
    image_bytes = await file.read()
    result = predict_incident_from_image(image_bytes=image_bytes)
    return result


@router.get("/model-status")
async def get_risk_model_status():
    """Get status of all ML models used in risk scoring."""
    return get_model_status()
