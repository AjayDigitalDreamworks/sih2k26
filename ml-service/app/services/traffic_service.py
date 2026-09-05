"""
Traffic Data Service — fetches real-time traffic flow and incidents from TomTom API.
Provides congestion levels, travel times, and incident reports for NER highways.
TomTom free tier: 2,500 requests/day.
"""
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime
from app.services.config import APIConfig


class TrafficService:
    """Fetch real-time traffic data from TomTom for NER highways."""

    _cache: Dict[str, Any] = {}
    _cache_ttl = 300  # 5 minutes (traffic updates every minute)

    @classmethod
    async def get_route_traffic(cls, origin_lat: float, origin_lng: float,
                                 dest_lat: float, dest_lng: float) -> Dict[str, Any]:
        """Get real-time traffic conditions for a route between two points."""
        cache_key = f"traffic:{origin_lat},{origin_lng}:{dest_lat},{dest_lng}"
        cached = cls._cache.get(cache_key)
        if cached and (datetime.utcnow() - cached.get("_fetched_at", datetime.min)).seconds < cls._cache_ttl:
            return cached

        if not APIConfig.TOMTOM_API_KEY:
            return cls._default_traffic()

        try:
            result = await cls._fetch_tomtom_route(origin_lat, origin_lng, dest_lat, dest_lng)
            if result:
                result["_fetched_at"] = datetime.utcnow()
                cls._cache[cache_key] = result
                return result
        except Exception:
            pass

        return cls._default_traffic()

    @classmethod
    async def get_traffic_incidents(cls, lat: float, lng: float, radius_m: int = 50000) -> List[Dict]:
        """Get traffic incidents near a point from TomTom."""
        if not APIConfig.TOMTOM_API_KEY:
            return []

        url = (
            f"{APIConfig.TOMTOM_BASE_URL}/traffic/services/5/incidentDetails"
            f"?key={APIConfig.TOMTOM_API_KEY}"
            f"&bbox={lng - 0.5},{lat - 0.5},{lng + 0.5},{lat + 0.5}"
            "&fields={type,geometry,properties}"
        )

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    incidents = []
                    for inc in data.get("incidents", []):
                        props = inc.get("properties", {})
                        incidents.append({
                            "type": props.get("iconCategory", "unknown"),
                            "description": props.get("description", ""),
                            "severity": props.get("magnitudeOfDelay", 0),
                            "road_name": props.get("similarTraffic", ""),
                            "start_location": props.get("startPoint", {}),
                            "end_location": props.get("endPoint", {}),
                            "delay_seconds": props.get("delay", {}).get("value", 0),
                        })
                    return incidents
        except Exception:
            pass
        return []

    @classmethod
    async def get_road_flow(cls, lat: float, lng: float) -> Dict[str, Any]:
        """Get traffic flow (speed) for road segments near a point."""
        if not APIConfig.TOMTOM_API_KEY:
            return {"source": "unavailable", "status": "feed_unavailable", "congestion_level": "unknown", "note": "Live traffic feed paused — using real-time risk estimate instead", "status": "feed_unavailable"}

        # TomTom Flow Segment Data
        url = (
            f"{APIConfig.TOMTOM_BASE_URL}/traffic/services/4/flowSegmentData"
            f"/absolute/10/json"
            f"?key={APIConfig.TOMTOM_API_KEY}"
            f"&point={lat},{lng}"
        )

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    flow = data.get("flowSegmentData", {})
                    current_speed = flow.get("currentSpeed", 0)
                    free_flow_speed = flow.get("freeFlowSpeed", 0)

                    if free_flow_speed > 0:
                        ratio = current_speed / free_flow_speed
                        congestion = "low" if ratio > 0.8 else "moderate" if ratio > 0.5 else "high" if ratio > 0.3 else "blocked"
                    else:
                        congestion = "unknown"

                    return {
                        "source": "tomtom",
                        "current_speed_kmh": current_speed,
                        "free_flow_speed_kmh": free_flow_speed,
                        "congestion_level": congestion,
                        "travel_time_seconds": flow.get("currentTravelTime", 0),
                        "confidence": flow.get("confidence", 0),
                        "road_name": flow.get("roadName", ""),
                    }
        except Exception:
            pass

        return {"source": "unavailable", "status": "feed_unavailable", "congestion_level": "unknown", "note": "Live traffic feed paused — using real-time risk estimate instead"}

    @classmethod
    async def _fetch_tomtom_route(cls, o_lat: float, o_lng: float,
                                   d_lat: float, d_lng: float) -> Optional[Dict[str, Any]]:
        """
        Fetch route with real-time traffic from TomTom Routing API.
        Endpoint: /routing/1/calculateRoute/{routeJson}/json
        """
        # TomTom calculateRoute expects coordinates as {lat},{lon}:{lat},{lon}
        route_json = f"{o_lat},{o_lng}:{d_lat},{d_lng}"
        url = (
            f"{APIConfig.TOMTOM_BASE_URL}/routing/1/calculateRoute"
            f"/{route_json}/json"
            f"?key={APIConfig.TOMTOM_API_KEY}"
            f"&traffic=true"
            f"&travelMode=car"
            f"&language=en-GB"
        )

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                routes = data.get("routes", [])
                if routes:
                    route = routes[0]
                    summary = route.get("summary", {})
                    legs = route.get("legs", [])

                    return {
                        "source": "tomtom",
                        "distance_km": round(summary.get("lengthInMeters", 0) / 1000, 1),
                        "travel_time_seconds": summary.get("travelTimeInSeconds", 0),
                        "departure_time": summary.get("departureTime", ""),
                        "arrival_time": summary.get("arrivalTime", ""),
                        "traffic_delay_seconds": summary.get("trafficDelayInSeconds", 0),
                        "traffic_length_km": round(summary.get("trafficLengthInMeters", 0) / 1000, 1),
                        "congestion_level": cls._classify_congestion(
                            summary.get("trafficDelayInSeconds", 0),
                            summary.get("travelTimeInSeconds", 1)
                        ),
                        "waypoints": len(legs[0].get("points", [])) if legs else 0,
                    }
        return None

    @classmethod
    def _classify_congestion(cls, delay_seconds: int, total_seconds: int) -> str:
        if total_seconds == 0:
            return "unknown"
        ratio = delay_seconds / total_seconds
        if ratio > 0.5:
            return "blocked"
        elif ratio > 0.3:
            return "high"
        elif ratio > 0.15:
            return "moderate"
        return "low"

    @classmethod
    def _default_traffic(cls) -> Dict[str, Any]:
        return {
            "source": "unavailable",
            "distance_km": 0,
            "travel_time_seconds": 0,
            "traffic_delay_seconds": 0,
            "congestion_level": "unknown",
            "note": "Live traffic feed paused — using real-time risk estimate instead",
            "_fetched_at": datetime.utcnow(),
        }
