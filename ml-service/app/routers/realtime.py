"""
Real-Time Data Endpoints — provides live data from all integrated APIs.
These are the primary endpoints for the frontend to consume real-time intelligence.
"""
from fastapi import APIRouter, Query
from typing import Optional
from app.services.data_aggregator import DataAggregator
from app.services.weather_service import WeatherService
from app.services.flood_service import FloodService
from app.services.landslide_service import LandslideService
from app.services.traffic_service import TrafficService
from app.services.routing_service import RoutingService
from app.services.terrain_service import TerrainService
from app.services.config import APIConfig

router = APIRouter(prefix="/realtime", tags=["Real-Time Data"])


# --- Weather Endpoints ---

@router.get("/weather/all")
async def get_all_weather():
    """Get weather for all 12 NER districts."""
    return await WeatherService.get_all_districts_weather()


@router.get("/weather/{district_id}")
async def get_district_weather(district_id: str):
    """Get real-time weather for a specific NER district."""
    return await WeatherService.get_district_weather(district_id)


@router.get("/weather/warnings/{district_id}")
async def get_weather_warnings(district_id: str):
    """Get weather warnings for a district from IMD."""
    return await WeatherService.get_district_warnings(district_id)


# --- Flood Endpoints ---

@router.get("/flood/all")
async def get_all_flood():
    """Get flood data for all NER districts."""
    return await FloodService.get_all_districts_flood()


@router.get("/flood/{district_id}")
async def get_flood_risk(district_id: str):
    """Get flood forecast for a specific district."""
    return await FloodService.get_district_flood_risk(district_id)


# --- Landslide Endpoints ---

@router.get("/landslide/{district_id}")
async def get_landslide_risk(district_id: str):
    """Get landslide hazard assessment for a district."""
    return await LandslideService.get_district_landslide_risk(district_id)


# --- Traffic Endpoints ---

@router.get("/traffic/route")
async def get_route_traffic(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
):
    """Get real-time traffic conditions between two points."""
    return await TrafficService.get_route_traffic(origin_lat, origin_lng, dest_lat, dest_lng)


@router.get("/traffic/incidents")
async def get_traffic_incidents(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(50000),
):
    """Get traffic incidents near a point."""
    return await TrafficService.get_traffic_incidents(lat, lng, radius)


@router.get("/traffic/flow")
async def get_road_flow(lat: float = Query(...), lng: float = Query(...)):
    """Get traffic flow (speed/congestion) for a road segment."""
    return await TrafficService.get_road_flow(lat, lng)


# --- Routing Endpoints ---

@router.get("/route")
async def get_optimized_route(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
):
    """Get optimized route using real road network data."""
    return await RoutingService.get_optimized_route(
        {"lat": origin_lat, "lng": origin_lng},
        {"lat": dest_lat, "lng": dest_lng},
    )


@router.get("/geocode")
async def geocode_address(address: str = Query(...)):
    """Geocode an address to coordinates."""
    result = await RoutingService.geocode(address)
    return result or {"error": "Geocoding failed"}


@router.get("/reverse-geocode")
async def reverse_geocode(lat: float = Query(...), lng: float = Query(...)):
    """Reverse geocode coordinates to an address."""
    result = await RoutingService.reverse_geocode(lat, lng)
    return result or {"error": "Reverse geocoding failed"}


# --- Terrain Endpoints ---

@router.get("/terrain/elevation")
async def get_elevation(lat: float = Query(...), lng: float = Query(...)):
    """Get elevation at a point."""
    return await TerrainService.get_elevation(lat, lng)


@router.get("/terrain/slope/{district_id}")
async def get_slope_risk(district_id: str):
    """Get terrain slope risk estimate for a district."""
    district = APIConfig.NER_DISTRICTS.get(district_id, {})
    return await TerrainService.estimate_slope_risk(
        district.get("lat", 26.0), district.get("lng", 92.0)
    )


# --- Full Context Endpoints ---

@router.get("/context/district/{district_id}")
async def get_full_district_context(district_id: str):
    """Get complete real-time context for a district (all data sources combined)."""
    return await DataAggregator.get_full_district_context(district_id)


@router.get("/context/route")
async def get_full_route_context(
    origin: str = Query("kamrup"),
    dest: str = Query("sonitpur"),
):
    """Get complete real-time context for a route between two districts."""
    return await DataAggregator.get_route_context(origin, dest)


@router.get("/summary")
async def get_all_districts_summary():
    """Get summary of all NER districts with key real-time metrics."""
    return await DataAggregator.get_all_districts_summary()


# --- Available Districts ---

@router.get("/districts")
async def list_districts():
    """List all NER districts with their coordinates and IMD station IDs."""
    return APIConfig.NER_DISTRICTS
