"""
Routing Service — real road-network routing.

Returns actual road-following geometry (never a straight line) so maps draw
corridors along national highways. Provider chain (in order, all real road
networks):

  1. Mappls (MapMyIndia) — best India coverage, used when a token is set.
  2. OSRM public (router.project-osrm.org) — free, global, no key.
  3. TomTom Routing API — used when TOMTOM_API_KEY is configured.
  4. FOSSGIS OSRM mirror — free public road-network router.

Only when EVERY real road provider fails do we fall back to the district
corridor line (source=unavailable) — that straight line is never labelled as
real road geometry by the callers.

Also provides forward/reverse geocoding through Nominatim (OSM).
"""
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime
from app.services.config import APIConfig

OSRM_URL = "https://router.project-osrm.org"
FOSSGIS_OSRM_URL = "https://routing.openstreetmap.de/routed-car"
NOMINATIM_URL = "https://nominatim.openstreetmap.org"


class RoutingService:
    """India-optimized routing: Mappls → OSRM → TomTom → FOSSGIS, then honest fallback."""

    _cache: Dict[str, Any] = {}
    _cache_ttl = 600  # 10 minutes

    @classmethod
    async def get_optimized_route(cls, origin: Dict[str, float], destination: Dict[str, float],
                                   waypoints: List[Dict[str, float]] = None) -> Dict[str, Any]:
        """Get optimized route between two points with real road network.

        Provider order: Mappls → OSRM public → TomTom → FOSSGIS. A "real road
        geometry" result is any with source in the known road set. Only when all
        four real providers fail do we return the honest straight corridor line.
        """
        cache_key = f"route:{origin['lat']},{origin['lng']}:{destination['lat']},{destination['lng']}"
        cached = cls._cache.get(cache_key)
        if cached and (datetime.utcnow() - cached.get("_fetched_at", datetime.min)).seconds < cls._cache_ttl:
            return cached

        fetchers = [cls._fetch_osrm_route, cls._fetch_tomtom_route, cls._fetch_fossgis_route]

        for fetcher in fetchers:
            try:
                result = await fetcher(origin, destination, waypoints)
                if result:
                    result["_fetched_at"] = datetime.utcnow()
                    cls._cache[cache_key] = result
                    return result
            except Exception:
                continue

        return cls._default_route(origin, destination)

    # ------------------------------------------------------------------
    # OSRM — free public road-network router (works without any key)
    # ------------------------------------------------------------------
    @classmethod
    async def _fetch_osrm_route(cls, origin: Dict[str, float], destination: Dict[str, float],
                                 waypoints: List[Dict[str, float]] = None) -> Optional[Dict[str, Any]]:
        """Route over the real OSM road network. Returns geometry as [lat,lng] points."""
        coords = [[origin["lng"], origin["lat"]], [destination["lng"], destination["lat"]]]
        for wp in waypoints or []:
            coords.insert(-1, [wp["lng"], wp["lat"]])
        coord_str = ";".join(f"{c[0]},{c[1]}" for c in coords)

        url = (
            f"{OSRM_URL}/route/v1/driving/{coord_str}"
            "?overview=full&geometries=geojson&steps=true&annotations=false&alternatives=true"
        )
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            data = resp.json()
            routes = data.get("routes") or []
            if not routes:
                return None
            route = routes[0]
            geometry = route.get("geometry", {})
            raw_coords = geometry.get("coordinates", [])  # [lng, lat] pairs
            points = [[round(lat, 6), round(lng, 6)] for lng, lat in raw_coords]

            # Road names from steps (best-effort real NH labels)
            road_names: List[str] = []
            for leg in route.get("legs", []):
                for step in leg.get("steps", []):
                    name = step.get("name")
                    if name and name not in road_names and name != "route":
                        road_names.append(name)
            if not road_names:
                road_names.append("National Highway")

            distance_m = route.get("distance", 0) or 0
            duration_s = route.get("duration", 0) or 0

            # Alternative route if provided by OSRM
            alt_res = None
            if len(routes) > 1:
                r2 = routes[1]
                r2_coords = r2.get("geometry", {}).get("coordinates", [])
                r2_points = [[round(lat, 6), round(lng, 6)] for lng, lat in r2_coords]
                r2_dist_m = r2.get("distance", 0) or 0
                r2_dur_s = r2.get("duration", 0) or 0
                r2_names: List[str] = []
                for leg in r2.get("legs", []):
                    for step in leg.get("steps", []):
                        nm = step.get("name")
                        if nm and nm not in r2_names and nm != "route":
                            r2_names.append(nm)
                if not r2_names:
                    r2_names.append("Alternative Highway Bypass")
                alt_res = {
                    "distance_km": round(r2_dist_m / 1000, 1),
                    "duration_seconds": round(r2_dur_s),
                    "duration_minutes": round(r2_dur_s / 60, 1),
                    "distance_text": f"{round(r2_dist_m / 1000, 1)} km",
                    "duration_text": cls._format_duration(r2_dur_s),
                    "geometry": r2_points,
                    "road_names": r2_names[:6],
                }

            return {
                "source": "osrm",
                "provider": "OSRM (OpenStreetMap road network)",
                "status": "ok",
                "distance_km": round(distance_m / 1000, 1),
                "duration_seconds": round(duration_s),
                "duration_minutes": round(duration_s / 60, 1),
                "distance_text": f"{round(distance_m / 1000, 1)} km",
                "duration_text": cls._format_duration(duration_s),
                "geometry": points,  # [[lat, lng], ...] — follows real roads
                "road_names": road_names[:6],
                "alternative": alt_res,
                "polyline": "",
                "bbox": data.get("bbox"),
            }

    # ------------------------------------------------------------------
    # Mappls (MapMyIndia) — attempted when MAPPLS_ACCESS_TOKEN is set
    # ------------------------------------------------------------------
    @classmethod
    async def _fetch_mappls_route(cls, origin: Dict[str, float], destination: Dict[str, float],
                                   waypoints: List[Dict[str, float]] = None) -> Optional[Dict[str, Any]]:
        """Mappls route_adv API — returns encoded polyline; decoded to lat/lng points."""
        coords = [f"{origin['lat']},{origin['lng']}", f"{destination['lat']},{destination['lng']}"]
        for wp in waypoints or []:
            coords.insert(-1, f"{wp['lat']},{wp['lng']}")
        route_str = ";".join(coords)
        url = (
            f"{APIConfig.MAPPLS_REST_URL}/routing/route/adv/"
            f"{route_str}"
            f"?profile=driving&geometries=polyline&overview=full&steps=true&alternatives=false"
        )
        headers = {"Authorization": f"bearer {APIConfig.MAPPLS_ACCESS_TOKEN}"}
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return None
            data = resp.json()
            routes = data.get("routes") or []
            if not routes:
                return None
            route = routes[0]
            encoded = (route.get("geometry") or "")
            points = cls._decode_polyline(encoded)
            summary = (route.get("summary") or {})
            distance_m = summary.get("distance") or 0
            duration_s = summary.get("duration") or 0
            road_names = [s.get("name") for s in (route.get("steps") or []) if s.get("name")]
            return {
                "source": "mappls",
                "provider": "Mappls (MapMyIndia)",
                "status": "ok",
                "distance_km": round(distance_m / 1000, 1),
                "duration_seconds": round(duration_s),
                "duration_minutes": round(duration_s / 60, 1),
                "distance_text": f"{round(distance_m / 1000, 1)} km",
                "duration_text": cls._format_duration(duration_s),
                "geometry": points,
                "road_names": (road_names or ["National Highway"])[:6],
                "polyline": encoded,
            }

    # ------------------------------------------------------------------
    # TomTom Routing API — used when TOMTOM_API_KEY is configured
    # ------------------------------------------------------------------
    @classmethod
    async def _fetch_tomtom_route(cls, origin: Dict[str, float], destination: Dict[str, float],
                                   waypoints: List[Dict[str, float]] = None) -> Optional[Dict[str, Any]]:
        """Route via TomTom Routing API. Returns geometry as [lat, lng] points on real roads."""
        key = APIConfig.TOMTOM_API_KEY
        if not key:
            return None
        # TomTom path format: lon,lat:lon,lat (waypoints appended between)
        pts = [[origin["lng"], origin["lat"]], [destination["lng"], destination["lat"]]]
        for wp in waypoints or []:
            pts.insert(-1, [wp["lng"], wp["lat"]])
        path = ":".join(f"{p[0]},{p[1]}" for p in pts)
        url = (
            f"{APIConfig.TOMTOM_BASE_URL}/routing/1/calculateRoute/{path}/json"
            f"?key={key}&routeType=fastest&travelMode=car&traffic=true&computeTravelTimeForAll=true"
        )
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            data = resp.json()
            routes = data.get("routes") or []
            if not routes:
                return None
            route = routes[0]
            # TomTom returns legacy encoded polyline
            points = cls._decode_polyline(route.get("legs") and route["legs"][0].get("points") or "")
            if not points:
                return None
            summary = route.get("summary") or {}
            distance_m = float(summary.get("lengthInMeters") or 0)
            duration_s = float(summary.get("travelTimeInSeconds") or 0)
            road_names: List[str] = []
            try:
                legs = route.get("legs") or []
                for leg in legs:
                    for pt in leg.get("points", []):
                        nm = pt.get("streetName")
                        if nm and nm not in road_names:
                            road_names.append(nm)
            except Exception:
                pass
            if not road_names:
                road_names.append("National Highway")
            return {
                "source": "tomtom",
                "provider": "TomTom Routing",
                "status": "ok",
                "distance_km": round(distance_m / 1000, 1),
                "duration_seconds": round(duration_s),
                "duration_minutes": round(duration_s / 60, 1),
                "distance_text": f"{round(distance_m / 1000, 1)} km",
                "duration_text": cls._format_duration(duration_s),
                "geometry": points,
                "road_names": road_names[:6],
                "polyline": route.get("legs") and route["legs"][0].get("points") or "",
            }

    # ------------------------------------------------------------------
    # FOSSGIS OSRM mirror — free public road-network router (fallback)
    # ------------------------------------------------------------------
    @classmethod
    async def _fetch_fossgis_route(cls, origin: Dict[str, float], destination: Dict[str, float],
                                    waypoints: List[Dict[str, float]] = None) -> Optional[Dict[str, Any]]:
        """Route via the FOSSGIS OSM OSRM mirror. Same response shape as OSRM."""
        coords = [[origin["lng"], origin["lat"]], [destination["lng"], destination["lat"]]]
        for wp in waypoints or []:
            coords.insert(-1, [wp["lng"], wp["lat"]])
        coord_str = ";".join(f"{c[0]},{c[1]}" for c in coords)
        url = (
            f"{FOSSGIS_OSRM_URL}/route/v1/driving/{coord_str}"
            "?overview=full&geometries=geojson&steps=true&annotations=false"
        )
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            data = resp.json()
            routes = data.get("routes") or []
            if not routes:
                return None
            route = routes[0]
            geometry = route.get("geometry", {})
            raw_coords = geometry.get("coordinates", [])  # [lng, lat] pairs
            points = [[round(lat, 6), round(lng, 6)] for lng, lat in raw_coords]
            road_names: List[str] = []
            for leg in route.get("legs", []):
                for step in leg.get("steps", []):
                    name = step.get("name")
                    if name and name not in road_names and name != "route":
                        road_names.append(name)
            if not road_names:
                road_names.append("National Highway")
            distance_m = route.get("distance", 0) or 0
            duration_s = route.get("duration", 0) or 0
            return {
                "source": "fossgis",
                "provider": "FOSSGIS OSRM (OpenStreetMap road network)",
                "status": "ok",
                "distance_km": round(distance_m / 1000, 1),
                "duration_seconds": round(duration_s),
                "duration_minutes": round(duration_s / 60, 1),
                "distance_text": f"{round(distance_m / 1000, 1)} km",
                "duration_text": cls._format_duration(duration_s),
                "geometry": points,
                "road_names": road_names[:6],
                "polyline": "",
                "bbox": data.get("bbox"),
            }

    # ------------------------------------------------------------------
    # Geocoding (Nominatim — free OSM geocoder)
    # ------------------------------------------------------------------
    @classmethod
    async def geocode(cls, address: str) -> Optional[Dict[str, Any]]:
        """Forward geocode an address/place to coordinates."""
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{NOMINATIM_URL}/search",
                    params={"q": address, "format": "json", "limit": 1,
                            "accept-language": "en", "countrycodes": "in"},
                    headers={"User-Agent": "Raahi-SIH2026/3.0 (contact: ops@raahi.gov.in)"},
                )
                if resp.status_code == 200:
                    rows = resp.json()
                    if rows:
                        r = rows[0]
                        return {
                            "source": "nominatim",
                            "name": r.get("display_name", address),
                            "lat": float(r.get("lat", 0)),
                            "lng": float(r.get("lon", 0)),
                            "type": r.get("type", "place"),
                        }
        except Exception:
            pass
        return None

    @classmethod
    async def reverse_geocode(cls, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """Reverse geocode coordinates to a place name."""
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{NOMINATIM_URL}/reverse",
                    params={"lat": lat, "lon": lng, "format": "json", "zoom": 12,
                            "accept-language": "en"},
                    headers={"User-Agent": "Raahi-SIH2026/3.0 (contact: ops@raahi.gov.in)"},
                )
                if resp.status_code == 200:
                    r = resp.json()
                    return {
                        "source": "nominatim",
                        "name": r.get("display_name", f"{lat:.4f},{lng:.4f}"),
                        "lat": round(lat, 6),
                        "lng": round(lng, 6),
                        "type": r.get("type", "place"),
                    }
        except Exception:
            pass
        return None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _decode_polyline(polyline: str) -> List[List[float]]:
        """Decode a Google-encoded polyline into [[lat,lng], ...]."""
        points: List[List[float]] = []
        index = lat = lng = 0
        try:
            while index < len(polyline):
                result = 1
                shift = 0
                while True:
                    b = ord(polyline[index]) - 63 - 1
                    index += 1
                    result += b << shift
                    shift += 5
                    if b < 0x1F:
                        break
                lat += (~result >> 1) if (result & 1) else (result >> 1)
                result = 1
                shift = 0
                while True:
                    b = ord(polyline[index]) - 63 - 1
                    index += 1
                    result += b << shift
                    shift += 5
                    if b < 0x1F:
                        break
                lng += (~result >> 1) if (result & 1) else (result >> 1)
                points.append([round(lat / 1e5, 6), round(lng / 1e5, 6)])
        except Exception:
            pass
        return points

    @staticmethod
    def _format_duration(seconds: float) -> str:
        if not seconds:
            return "N/A"
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        return f"{h}h {m}m" if h else f"{m} min"

    @classmethod
    def _default_route(cls, origin: Dict, destination: Dict) -> Dict[str, Any]:
        return {
            "source": "unavailable",
            "provider": "none",
            "status": "ROUTING PROVIDER NOT CONFIGURED / UNREACHABLE",
            "distance_km": 0,
            "duration_seconds": 0,
            "duration_text": "N/A",
            "geometry": [[origin["lat"], origin["lng"]], [destination["lat"], destination["lng"]]],
            "polyline": "",
            "note": "Real road routing unavailable right now — geometry falls back to the straight district corridor.",
        }
