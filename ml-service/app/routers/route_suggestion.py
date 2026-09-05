"""
Route Suggestion Router — ML-powered route optimization.
Uses trained XGBoost models for delay prediction, safety scoring, and route ranking.
"""
from fastapi import APIRouter, Query
from typing import Optional
from app.models.schemas import RouteSuggestRequest, RouteSuggestResponse, RouteOption
from app.engine.ml_inference import predict_route_optimization, get_model_status
from app.engine.route_optimizer import optimize_route, NER_DISTANCES, SEGMENT_RISK
from app.services.data_aggregator import DataAggregator
from app.services.weather_service import WeatherService
from app.services.flood_service import FloodService
from app.services.landslide_service import LandslideService
from app.services.traffic_service import TrafficService
from app.services.config import APIConfig
import numpy as np

router = APIRouter(prefix="/route", tags=["Route Optimization (ML)"])


@router.post("/suggest", response_model=RouteSuggestResponse)
async def suggest_route(payload: RouteSuggestRequest):
    """
    ML-powered route suggestion between two NER districts.

    Uses trained models to:
    1. Score primary and alternate routes for risk
    2. Estimate delays based on real-time conditions
    3. Rank routes by safety and efficiency
    4. Suggest optimal route based on commodity type and priority
    """
    origin = payload.originDistrictId.lower().strip()
    dest = payload.destDistrictId.lower().strip()
    commodity = payload.commodityType or "general"
    weight_kg = payload.weightKg or 1000.0

    # Get base route data from rule-based optimizer
    base_result = optimize_route(
        origin=origin,
        destination=dest,
        commodity=commodity,
        weight_kg=weight_kg,
        historical_disruptions=payload.historicalDisruptions or 0,
        rainfall_mm=payload.rainfallMm or 12.0,
    )

    # Enrich with real-time data
    try:
        origin_info = APIConfig.NER_DISTRICTS.get(origin, {})
        dest_info = APIConfig.NER_DISTRICTS.get(dest, {})

        weather = await WeatherService.get_district_weather(origin)
        rainfall = weather.get("rainfall_24h_mm", payload.rainfallMm or 12.0)
        temp = weather.get("temp_celsius", 25)

        flood = await FloodService.get_district_flood_risk(origin)
        flood_risk = flood.get("flood_risk_level", 0)

        landslide = await LandslideService.get_district_landslide_risk(origin)
        landslide_prob = landslide.get("hazard_probability", 0.1)

        traffic = await TrafficService.get_route_traffic(
            origin_info.get("lat", 26), origin_info.get("lng", 92),
            dest_info.get("lat", 25), dest_info.get("lng", 91)
        )
        congestion = traffic.get("congestion_level", "low")
    except Exception:
        rainfall = payload.rainfallMm or 12.0
        temp = 25
        flood_risk = 0
        landslide_prob = 0.1
        congestion = "low"

    # ML-enhanced scoring for each route option
    commodity_priority = {"medicine": 5, "food": 4, "fuel": 3, "agri": 2, "construction": 1, "general": 1}
    priority = commodity_priority.get(commodity, 1)

    # Primary route
    primary = base_result["primaryRoute"]
    ml_primary = predict_route_optimization(
        distance_km=primary["distanceKm"],
        road_condition="good",
        bridge_condition="operational",
        avg_slope_risk=origin_info.get("slope_risk", 25),
        avg_elevation_m=(origin_info.get("elevation_m", 500) + dest_info.get("elevation_m", 500)) / 2,
        rainfall_24h_mm=rainfall,
        temp_celsius=temp,
        congestion_level=congestion,
        flood_risk_level=flood_risk,
        landslide_probability=landslide_prob,
        commodity_type=commodity,
        weight_kg=weight_kg,
        priority=priority,
    )

    primary_option = RouteOption(
        name=primary["name"],
        distanceKm=primary["distanceKm"],
        estimatedHours=ml_primary["estimatedHours"],
        fuelCostEstimate=ml_primary["fuelCostEstimate"],
        riskScore=ml_primary["safetyScore"],
        riskLevel=_score_to_level(ml_primary["safetyScore"]),
        efficiencyGain=f"ML-optimized | Delay: {ml_primary['delayMinutes']:.0f}min | Engine: {ml_primary['engine']}",
    )

    # Alternate routes
    alternate_options = []
    for alt in base_result.get("alternateRoutes", []):
        ml_alt = predict_route_optimization(
            distance_km=alt["distanceKm"],
            road_condition="good" if alt["riskScore"] < 30 else "damaged",
            bridge_condition="operational",
            avg_slope_risk=origin_info.get("slope_risk", 25) * 0.8,
            avg_elevation_m=(origin_info.get("elevation_m", 500) + dest_info.get("elevation_m", 500)) / 2,
            rainfall_24h_mm=rainfall * 0.9,  # Alternate may have less rain exposure
            temp_celsius=temp,
            congestion_level="low" if alt["riskScore"] < 30 else congestion,
            flood_risk_level=flood_risk * 0.7,
            landslide_probability=landslide_prob * 0.6,
            commodity_type=commodity,
            weight_kg=weight_kg,
            priority=priority,
        )

        alternate_options.append(RouteOption(
            name=alt["name"],
            distanceKm=alt["distanceKm"],
            estimatedHours=ml_alt["estimatedHours"],
            fuelCostEstimate=ml_alt["fuelCostEstimate"],
            riskScore=ml_alt["safetyScore"],
            riskLevel=_score_to_level(ml_alt["safetyScore"]),
            efficiencyGain=f"ML-optimized | Delay: {ml_alt['delayMinutes']:.0f}min | Engine: {ml_alt['engine']}",
        ))

    return RouteSuggestResponse(
        primaryRoute=primary_option,
        alternateRoutes=alternate_options,
    )


@router.get("/optimize/live")
async def optimize_route_live(
    origin: str = Query("kamrup", description="Origin district ID"),
    dest: str = Query("sonitpur", description="Destination district ID"),
    commodity: str = Query("general", description="Commodity type"),
    weight_kg: float = Query(1000.0, description="Weight in kg"),
):
    """
    ML route optimization using ONLY real-time data.
    No DB lookup — pure live data from all external APIs.
    """
    origin_info = APIConfig.NER_DISTRICTS.get(origin, {})
    dest_info = APIConfig.NER_DISTRICTS.get(dest, {})

    # Fetch all real-time data
    weather = await WeatherService.get_district_weather(origin)
    flood = await FloodService.get_district_flood_risk(origin)
    landslide = await LandslideService.get_district_landslide_risk(origin)
    traffic = await TrafficService.get_route_traffic(
        origin_info.get("lat", 26), origin_info.get("lng", 92),
        dest_info.get("lat", 25), dest_info.get("lng", 91)
    )

    # Base distances
    base_distance = NER_DISTANCES.get(origin, {}).get(dest, 200.0)

    commodity_priority = {"medicine": 5, "food": 4, "fuel": 3, "agri": 2, "construction": 1, "general": 1}

    # ML optimization
    result = predict_route_optimization(
        distance_km=base_distance,
        road_condition="good",
        bridge_condition="operational",
        avg_slope_risk=origin_info.get("slope_risk", 25),
        avg_elevation_m=(origin_info.get("elevation_m", 500) + dest_info.get("elevation_m", 500)) / 2,
        rainfall_24h_mm=weather.get("rainfall_24h_mm", 0),
        temp_celsius=weather.get("temp_celsius", 25),
        congestion_level=traffic.get("congestion_level", "low"),
        flood_risk_level=flood.get("flood_risk_level", 0),
        landslide_probability=landslide.get("hazard_probability", 0.1),
        commodity_type=commodity,
        weight_kg=weight_kg,
        priority=commodity_priority.get(commodity, 1),
    )

    return {
        "origin": origin,
        "destination": dest,
        "distance_km": base_distance,
        **result,
        "realTimeData": {
            "weather": weather,
            "flood": flood,
            "landslide": landslide,
            "traffic": traffic,
        },
    }


def _score_to_level(score: int) -> str:
    """Convert numeric score to risk level string."""
    if score > 80: return "critical"
    elif score > 60: return "high"
    elif score > 30: return "medium"
    else: return "low"
