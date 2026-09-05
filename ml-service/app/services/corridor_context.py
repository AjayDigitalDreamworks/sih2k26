"""
Corridor Context Service — pulls REAL disruption/road/bridge/district state
from the core-backend database (service-to-service, internal key) so the ML
background pipeline can enrich route risk scores with actual inputs instead of
static config or hardcoded zeros.

Data flows: core-backend DB  →  GET /api/internal/ml/corridor-context  →  this
service  →  realtime_pipeline._risk_recalculation_task  →  predict_risk_score
"""
import httpx
from typing import Dict, Any, Optional
from datetime import datetime

from app.services.config import APIConfig

_SEVERITY_ROAD = {"blocked": 3, "damaged": 2, "good": 1}
_SEVERITY_BRIDGE = {"closed": 3, "damaged": 2, "operational": 1}


class CorridorContextService:
    """Fetches and caches the real corridor context from core-backend."""

    _cache: Optional[Dict[str, Any]] = None
    _cache_ts: Optional[datetime] = None
    _cache_ttl = 600  # 10 minutes

    @classmethod
    async def get_context(cls, force_refresh: bool = False) -> Dict[str, Any]:
        """Return cached corridor context, refreshing from core-backend when stale."""
        now = datetime.utcnow()
        if (
            not force_refresh
            and cls._cache is not None
            and cls._cache_ts is not None
            and (now - cls._cache_ts).total_seconds() < cls._cache_ttl
        ):
            return cls._cache

        ctx: Dict[str, Any] = {"generatedAt": None, "districts": [], "roads": [], "bridges": [], "routes": [],
                               "disruptions": {"districtCounts": {}, "routeAlerts": {}}}
        url = f"{APIConfig.CORE_BACKEND_URL}/api/internal/ml/corridor-context"
        headers = {"x-internal-key": APIConfig.CORE_BACKEND_INTERNAL_KEY}
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    body = resp.json()
                    if body.get("success") and body.get("data"):
                        ctx = body["data"]
        except Exception as e:
            print(f"  [WARN] Corridor context fetch failed: {e}")
            return ctx  # empty → callers fall back to static config

        cls._cache = ctx
        cls._cache_ts = now
        return ctx

    # ------------------------------------------------------------------
    # Helpers to resolve real per-corridor inputs
    # ------------------------------------------------------------------
    @classmethod
    def _worst_road(cls, roads: list) -> Optional[str]:
        if not roads:
            return None
        return max((r.get("condition", "good") for r in roads), key=lambda c: _SEVERITY_ROAD.get(c, 1))

    @classmethod
    def _worst_bridge(cls, bridges: list) -> Optional[str]:
        if not bridges:
            return None
        return max((b.get("status", "operational") for b in bridges), key=lambda s: _SEVERITY_BRIDGE.get(s, 1))

    @classmethod
    def _max_slope(cls, roads: list) -> Optional[float]:
        if not roads:
            return None
        slopes = [float(r.get("slope_risk") or 0) for r in roads]
        return max(slopes) if slopes else None

    @classmethod
    def _connectivity(cls, ctx: Dict[str, Any], district_id: str) -> Dict[str, Any]:
        for d in ctx.get("districts", []):
            if d.get("id") == district_id:
                return d
        return {}

    @classmethod
    def _district_roads_and_bridges(cls, ctx: Dict[str, Any], district_ids: set, road_ids: Optional[set] = None):
        """Real roads for a corridor: prefer route road_ids, else roads of origin/dest districts."""
        if road_ids:
            roads = [r for r in ctx.get("roads", []) if r.get("id") in road_ids]
        else:
            roads = [r for r in ctx.get("roads", []) if r.get("district_id") in district_ids]
        road_id_set = {r.get("id") for r in roads}
        bridges = [b for b in ctx.get("bridges", []) if b.get("road_id") in road_id_set]
        return roads, bridges

    @classmethod
    def disruption_count(cls, ctx: Dict[str, Any], district_ids: set, route_id: Optional[str] = None) -> int:
        """Real open disruption count = active alerts + pending field reports in involved districts."""
        counts = ctx.get("disruptions", {}).get("districtCounts", {})
        total = 0
        for did in district_ids:
            c = counts.get(did)
            if c:
                total += (c.get("fieldReports", 0) or 0) + (c.get("alerts", 0) or 0)
        if route_id:
            route_alerts = ctx.get("disruptions", {}).get("routeAlerts", {}).get(route_id, 0)
            total += route_alerts or 0
        return total

    @classmethod
    def match_route(cls, ctx: Dict[str, Any], from_id: str, to_id: str) -> Optional[Dict[str, Any]]:
        """Find the DB route row matching this corridor (either direction)."""
        for r in ctx.get("routes", []):
            if (r.get("origin_district_id") == from_id and r.get("dest_district_id") == to_id) or \
               (r.get("origin_district_id") == to_id and r.get("dest_district_id") == from_id):
                return r
        return None
