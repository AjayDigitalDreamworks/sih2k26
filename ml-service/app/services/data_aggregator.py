"""
Data Aggregator — combines all real-time data sources into a unified context
for the ML risk engine, route optimizer, and disruption predictor.
This is the single entry point for fetching all external data.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.services.weather_service import WeatherService
from app.services.flood_service import FloodService
from app.services.landslide_service import LandslideService
from app.services.traffic_service import TrafficService
from app.services.routing_service import RoutingService
from app.services.terrain_service import TerrainService
from app.services.config import APIConfig


class DataAggregator:
    """
    Unified data layer that fetches from all real-time sources
    and provides a single context object for ML engines.
    """

    @classmethod
    async def get_full_district_context(cls, district_id: str) -> Dict[str, Any]:
        """
        Get complete real-time context for a district.
        Combines: weather + flood + landslide + terrain data.
        """
        district = APIConfig.NER_DISTRICTS.get(district_id, {})

        # Fetch all data sources in parallel
        weather_task = WeatherService.get_district_weather(district_id)
        flood_task = FloodService.get_district_flood_risk(district_id)
        landslide_task = LandslideService.get_district_landslide_risk(district_id)
        terrain_task = TerrainService.estimate_slope_risk(
            district.get("lat", 26.0), district.get("lng", 92.0)
        )

        weather, flood, landslide, terrain = (
            await weather_task,
            await flood_task,
            await landslide_task,
            await terrain_task,
        )

        return {
            "district_id": district_id,
            "district_name": district.get("name", "Unknown"),
            "coordinates": {"lat": district.get("lat", 0), "lng": district.get("lng", 0)},
            "weather": weather,
            "flood": flood,
            "landslide": landslide,
            "terrain": terrain,
            "aggregated_risk": cls._compute_aggregated_risk(weather, flood, landslide, terrain),
            "fetched_at": datetime.utcnow().isoformat(),
        }

    @classmethod
    async def get_route_context(cls, origin_district_id: str, dest_district_id: str) -> Dict[str, Any]:
        """
        Get complete real-time context for a route between two districts.
        Combines: weather + traffic + terrain + routing data.
        """
        origin = APIConfig.NER_DISTRICTS.get(origin_district_id, {})
        dest = APIConfig.NER_DISTRICTS.get(dest_district_id, {})

        # Fetch all data sources in parallel
        origin_weather_task = WeatherService.get_district_weather(origin_district_id)
        dest_weather_task = WeatherService.get_district_weather(dest_district_id)
        traffic_task = TrafficService.get_route_traffic(
            origin.get("lat", 26.0), origin.get("lng", 92.0),
            dest.get("lat", 25.0), dest.get("lng", 91.0),
        )
        routing_task = RoutingService.get_optimized_route(
            {"lat": origin.get("lat", 26.0), "lng": origin.get("lng", 92.0)},
            {"lat": dest.get("lat", 25.0), "lng": dest.get("lng", 91.0)},
        )

        origin_weather, dest_weather, traffic, routing = (
            await origin_weather_task,
            await dest_weather_task,
            await traffic_task,
            await routing_task,
        )

        # Use the worst weather along the route
        max_rainfall = max(
            origin_weather.get("rainfall_24h_mm", 0),
            dest_weather.get("rainfall_24h_mm", 0),
        )
        max_temp = max(
            origin_weather.get("temp_celsius", 24),
            dest_weather.get("temp_celsius", 24),
        )

        return {
            "origin_district": origin_district_id,
            "dest_district": dest_district_id,
            "origin_weather": origin_weather,
            "dest_weather": dest_weather,
            "rainfall_24h_mm": max_rainfall,
            "temperature_celsius": max_temp,
            "traffic": traffic,
            "routing": routing,
            "congestion_level": traffic.get("congestion_level", "low"),
            "real_distance_km": routing.get("distance_km", 0),
            "real_duration_seconds": routing.get("duration_seconds", 0),
            "fetched_at": datetime.utcnow().isoformat(),
        }

    @classmethod
    async def get_all_districts_summary(cls) -> List[Dict[str, Any]]:
        """Get a summary of all NER districts with key real-time metrics.

        Each row carries the RAW numbers (rainfall mm, flood risk level, landslide
        probability) plus a REAL composite risk score (0-100) and level computed
        from those numbers — so dashboards show a genuine risk distribution
        instead of guessing from label strings. Missing feeds are marked
        unavailable, never treated as "safe".
        """
        summaries = []
        for district_id, district_info in APIConfig.NER_DISTRICTS.items():
            try:
                weather = await WeatherService.get_district_weather(district_id)
                flood = await FloodService.get_district_flood_risk(district_id)
                landslide = await LandslideService.get_district_landslide_risk(district_id)
                terrain = await TerrainService.estimate_slope_risk(
                    float(district_info["lat"]), float(district_info["lng"])
                )

                rainfall = float(weather.get("rainfall_24h_mm", 0) or 0)
                flood_level = float(flood.get("flood_risk_level", 0) or 0)
                landslide_prob = float(landslide.get("hazard_probability", 0) or 0)
                slope_risk = float(terrain.get("estimated_slope_risk", 25) or 0)

                # Real composite from REAL signals, weighted the same way the ML
                # disruption pipeline scores corridors:
                #   30% rainfall | 25% flood | 25% landslide | 20% terrain slope
                # Rainfall normalised to 0-100 against the 80mm/24h NER alert
                # threshold; landslide probability and slope risk are already 0-100.
                rainfall_score = min(100.0, (rainfall / 80.0) * 100.0)
                landslide_score = min(100.0, landslide_prob * 100.0)
                composite = round(
                    rainfall_score * 0.30 +
                    flood_level * 0.25 +
                    landslide_score * 0.25 +
                    slope_risk * 0.20,
                    1
                )
                level = (
                    "critical" if composite > 80 else
                    "high" if composite > 60 else
                    "medium" if composite > 30 else
                    "low"
                )

                flood_source = flood.get("source", "unknown")
                landslide_source = landslide.get("source", "unknown")
                # A feed that fell back to defaults is "unavailable", which must
                # never be shown as a safe / zero-risk reading.
                flood_unavailable = flood_source in ("default", "unavailable") or \
                    str(flood.get("flood_risk_label", "")).lower() in ("no data", "unknown")
                landslide_unavailable = landslide_source in ("default", "unavailable") or \
                    str(landslide.get("hazard_level", "")).lower() in ("unknown",)

                summaries.append({
                    "district_id": district_id,
                    "name": district_info["name"],
                    "state": district_info.get("state", ""),
                    "coordinates": {"lat": district_info["lat"], "lng": district_info["lng"]},
                    "weather_source": weather.get("source", "unknown"),
                    "rainfall_mm": rainfall,
                    "temperature_c": weather.get("temp_celsius", 0),
                    "flood_risk": flood.get("flood_risk_label", "Unknown"),
                    "flood_risk_level": round(flood_level, 1),
                    "flood_source": flood_source,
                    "flood_unavailable": flood_unavailable,
                    "landslide_risk": landslide.get("hazard_level", "Unknown"),
                    "landslide_probability": round(landslide_prob, 2),
                    "landslide_source": landslide_source,
                    "landslide_unavailable": landslide_unavailable,
                    "slope_risk": round(slope_risk, 1),
                    "terrain_source": terrain.get("source", "unknown"),
                    "risk_score": composite,
                    "risk_level": level,
                    "connectivity": cls._assess_connectivity(weather, flood, landslide),
                })
            except Exception as e:
                summaries.append({
                    "district_id": district_id,
                    "name": district_info["name"],
                    "error": str(e),
                })
        return summaries

    @classmethod
    def _compute_aggregated_risk(cls, weather: Dict, flood: Dict, landslide: Dict, terrain: Dict) -> Dict[str, Any]:
        """Compute a single aggregated risk score from all data sources."""
        rainfall = weather.get("rainfall_24h_mm", 0)
        flood_risk = flood.get("flood_risk_level", 0)
        landslide_prob = landslide.get("hazard_probability", 0)
        slope_risk = terrain.get("estimated_slope_risk", 25)

        # Weighted aggregation
        # 30% rainfall, 25% flood, 25% landslide, 20% terrain
        rainfall_score = min(100, (rainfall / 80) * 100)
        composite = (
            rainfall_score * 0.30 +
            flood_risk * 0.25 +
            (landslide_prob * 100) * 0.25 +
            slope_risk * 0.20
        )

        level = "critical" if composite > 80 else "high" if composite > 60 else "medium" if composite > 30 else "low"

        return {
            "composite_score": round(composite, 1),
            "risk_level": level,
            "contributing_factors": {
                "rainfall": {"score": round(rainfall_score, 1), "weight": 0.30},
                "flood": {"score": flood_risk, "weight": 0.25},
                "landslide": {"score": round(landslide_prob * 100, 1), "weight": 0.25},
                "terrain": {"score": slope_risk, "weight": 0.20},
            },
            "data_sources": [
                weather.get("source", "unknown"),
                flood.get("source", "unknown"),
                landslide.get("source", "unknown"),
                terrain.get("source", "unknown"),
            ],
        }

    @classmethod
    def _assess_connectivity(cls, weather: Dict, flood: Dict, landslide: Dict) -> str:
        """Assess district connectivity based on real-time hazards."""
        rainfall = weather.get("rainfall_24h_mm", 0)
        flood_level = flood.get("flood_risk_level", 0)
        landslide_prob = landslide.get("hazard_probability", 0)

        if flood_level > 60 or landslide_prob > 0.7 or rainfall > 80:
            return "blocked"
        elif flood_level > 30 or landslide_prob > 0.4 or rainfall > 40:
            return "partial"
        return "accessible"
