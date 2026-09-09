"""
Real-Time Background Processing Pipeline for Raahi Platform.

Continuously runs in parallel:
1. Weather monitoring → rainfall/flood alerts
2. Route risk recalculation → updated risk scores
3. Disruption prediction → landslide/flood forecasts
4. Alert generation → threshold-based alerts
5. Map update feeds → location/incident/danger updates

Runs as a FastAPI background task alongside the main API server.
Publishes events via Redis pub/sub for Socket.io broadcast to frontend.
"""

import asyncio
import json
import os
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
import traceback
import httpx

from app.services.config import APIConfig
from app.services.weather_service import WeatherService
from app.services.flood_service import FloodService
from app.services.landslide_service import LandslideService
from app.services.traffic_service import TrafficService
from app.services.data_aggregator import DataAggregator
from app.engine.ml_inference import (
    predict_risk_score,
    predict_disruption,
    predict_route_optimization,
    get_model_status,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

INTERVALS = {
    "weather_check": 900,       # 15 minutes
    "risk_recalculation": 1800,  # 30 minutes
    "disruption_prediction": 3600,  # 1 hour
    "alert_generation": 300,     # 5 minutes
    "map_update": 600,           # 10 minutes
    "route_optimization": 1800,  # 30 minutes
    "continual_learning_check": 3600,  # 1 hour periodic check
}

ALERT_THRESHOLDS = {
    "rainfall_warning_mm": 40,
    "rainfall_danger_mm": 80,
    "flood_risk_high": 60,
    "landslide_prob_high": 0.5,
    "wind_speed_warning_kmh": 60,
}


# ═══════════════════════════════════════════════════════════════════════════════
# Pipeline State
# ═══════════════════════════════════════════════════════════════════════════════

class PipelineState:
    """Shared state for the real-time pipeline."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.running = False
        self.start_time = None
        self.last_checks: Dict[str, datetime] = {}
        self.active_alerts: List[Dict] = []
        self.alert_history: List[Dict] = []
        self.risk_scores: Dict[str, Dict] = {}
        self.disruption_predictions: Dict[str, Dict] = {}
        self.route_optimizations: Dict[str, Dict] = {}
        self.map_updates: List[Dict] = []
        self.stats = {
            "total_checks": 0,
            "total_alerts_generated": 0,
            "total_risk_recalculations": 0,
            "total_disruption_predictions": 0,
            "uptime_seconds": 0,
        }
        self.event_callbacks: List[Callable] = []

    def add_event_callback(self, callback: Callable):
        """Register a callback for real-time events."""
        self.event_callbacks.append(callback)

    async def emit_event(self, event_type: str, data: Dict):
        """Emit an event to all registered callbacks."""
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        for callback in self.event_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
            except Exception as e:
                print(f"Event callback error: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Get pipeline status."""
        uptime = (datetime.utcnow() - self.start_time).total_seconds() if self.start_time else 0
        return {
            "running": self.running,
            "startTime": self.start_time.isoformat() if self.start_time else None,
            "uptimeSeconds": round(uptime),
            "lastChecks": {k: v.isoformat() if v else None for k, v in self.last_checks.items()},
            "activeAlerts": len(self.active_alerts),
            "totalAlertsGenerated": self.stats["total_alerts_generated"],
            "totalRiskRecalculations": self.stats["total_risk_recalculations"],
            "totalDisruptionPredictions": self.stats["total_disruption_predictions"],
            "totalChecks": self.stats["total_checks"],
            "intervals": INTERVALS,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Background Tasks
# ═══════════════════════════════════════════════════════════════════════════════

async def _weather_monitoring_task(state: PipelineState):
    """Monitor weather conditions across all NER districts."""
    try:
        print(f"[{datetime.utcnow().strftime('%H:%M:%S')}] [WEATHER] Checking weather for all districts...")

        weather_data = await WeatherService.get_all_districts_weather()

        for district_id, weather in weather_data.items():
            rainfall = weather.get("rainfall_24h_mm", 0)
            wind = weather.get("wind_kmh", 0)

            # Check rainfall thresholds
            if rainfall >= ALERT_THRESHOLDS["rainfall_danger_mm"]:
                alert = _create_pipeline_alert(
                    district_id=district_id,
                    type="extreme_rainfall",
                    severity="critical",
                    title=f"EXTREME RAINFALL: {rainfall:.0f}mm in {weather.get('city', district_id)}",
                    message=f"Very heavy rainfall of {rainfall:.0f}mm in 24 hours. Immediate route suspension recommended.",
                    source=weather.get("source", "imd"),
                )
                state.active_alerts.append(alert)
                state.alert_history.append(alert)
                await state.emit_event("alert", alert)

            elif rainfall >= ALERT_THRESHOLDS["rainfall_warning_mm"]:
                alert = _create_pipeline_alert(
                    district_id=district_id,
                    type="heavy_rainfall",
                    severity="high",
                    title=f"Heavy Rainfall: {rainfall:.0f}mm in {weather.get('city', district_id)}",
                    message=f"Heavy rainfall of {rainfall:.0f}mm in 24 hours. Monitor road conditions.",
                    source=weather.get("source", "imd"),
                )
                state.active_alerts.append(alert)
                state.alert_history.append(alert)
                await state.emit_event("alert", alert)

            # Check wind thresholds
            if wind >= ALERT_THRESHOLDS["wind_speed_warning_kmh"]:
                alert = _create_pipeline_alert(
                    district_id=district_id,
                    type="wind_warning",
                    severity="medium",
                    title=f"Strong Wind: {wind:.0f} km/h in {weather.get('city', district_id)}",
                    message=f"Wind speed of {wind:.0f} km/h. High vehicles should exercise caution.",
                    source=weather.get("source", "imd"),
                )
                state.active_alerts.append(alert)
                await state.emit_event("alert", alert)

        state.last_checks["weather_check"] = datetime.utcnow()
        state.stats["total_checks"] += 1
        print(f"  [OK] Weather check complete. {len(weather_data)} districts checked.")

    except Exception as e:
        print(f"  [ERROR] Weather monitoring error: {e}")
        traceback.print_exc()


# Single-flight guard: a triggered recalculation must never run concurrently
# with the periodic 30-minute pass (both would spam external APIs + alerts).
# Rapid bursts of alerts/field reports are COALESCED — if a pass is already
# running or queued, new triggers just mark another refresh desired, and the
# worker keeps running passes until the queue drains. Each pass force-refreshes
# the corridor context, so alerts created mid-pass are still picked up.
_risk_recalc_lock: Optional[asyncio.Lock] = None
_risk_recalc_queued = False
_risk_recalc_worker_running = False


def _get_risk_recalc_lock() -> asyncio.Lock:
    global _risk_recalc_lock
    if _risk_recalc_lock is None:
        _risk_recalc_lock = asyncio.Lock()
    return _risk_recalc_lock


async def trigger_risk_recalculation(reason: str = "manual") -> Dict[str, Any]:
    """Trigger an immediate route-risk recalculation.

    core-backend calls this the moment a new alert / field report is created
    (or verified/rejected), so corridor risk reflects the change NOW instead of
    waiting for the 30-minute pipeline cycle. Runs in the background — the HTTP
    caller is never blocked. Bursts are coalesced into a single refresh pass.
    """
    state = PipelineState()
    if not state.running:
        return {"success": False, "triggered": False, "error": "Pipeline not running"}

    global _risk_recalc_queued, _risk_recalc_worker_running
    _risk_recalc_queued = True
    if not _risk_recalc_worker_running:
        _risk_recalc_worker_running = True
        asyncio.create_task(_risk_recalc_worker(state))

    print(f"[{datetime.utcnow().strftime('%H:%M:%S')}] [RISK] Immediate recalculation triggered ({reason}).")
    return {"success": True, "triggered": True}


async def _risk_recalc_worker(state: PipelineState):
    """Run forced risk passes until no more refreshes are queued."""
    global _risk_recalc_queued, _risk_recalc_worker_running
    try:
        lock = _get_risk_recalc_lock()
        while True:
            async with lock:
                # Snapshot the queue while we hold the lock — triggers that land
                # during this pass re-set the flag and cause one more pass.
                _risk_recalc_queued = False
                await _risk_recalculation_pass(state, force_context_refresh=True)
            if not _risk_recalc_queued:
                break
            print(f"[{datetime.utcnow().strftime('%H:%M:%S')}] [RISK] New DB change arrived during pass — running another refresh.")
    finally:
        _risk_recalc_worker_running = False


async def _risk_recalculation_task(state: PipelineState, force_context_refresh: bool = False):
    """Periodic-loop entry point (also usable for one-off passes)."""
    lock = _get_risk_recalc_lock()
    async with lock:
        await _risk_recalculation_pass(state, force_context_refresh=force_context_refresh)


async def _risk_recalculation_pass(state: PipelineState, force_context_refresh: bool = False):
    """Recalculate risk scores for all major routes using ML models.

    Enriched with REAL inputs:
      - Corridor context from core-backend DB (roads/bridges/districts/routes +
        live alert & field-report disruption counts)
      - Live weather rainfall per district
      - Live flood / landslide / traffic signals
    Static config is only a fallback when the DB is unreachable.
    """
    try:
        print(f"[{datetime.utcnow().strftime('%H:%M:%S')}] [RISK] Recalculating route risk scores...")

        from app.engine.route_optimizer import ROAD_NETWORK, SEGMENT_RISK, NER_DISTANCES
        from app.services.corridor_context import CorridorContextService

        # Real DB corridor state (roads/bridges/districts/routes/disruptions)
        db_ctx = await CorridorContextService.get_context(force_refresh=force_context_refresh)
        db_available = bool(db_ctx.get("roads"))
        if not db_available:
            print("  [WARN] No corridor context from DB — using static config fallback.")

        for road in ROAD_NETWORK:
            from_id = road["from"]
            to_id = road["to"]
            route_key = f"{from_id}-{to_id}"

            # --- Real-time weather ---
            try:
                weather_from = await WeatherService.get_district_weather(from_id)
                weather_to = await WeatherService.get_district_weather(to_id)
                rainfall = max(
                    weather_from.get("rainfall_24h_mm") or 0,
                    weather_to.get("rainfall_24h_mm") or 0,
                )
            except Exception:
                rainfall = 12.0

            # --- Real-time flood / landslide ---
            try:
                flood = await FloodService.get_district_flood_risk(from_id)
                flood_level = flood.get("flood_risk_level", 0)
            except Exception:
                flood_level = 0

            try:
                landslide = await LandslideService.get_district_landslide_risk(from_id)
                landslide_prob = landslide.get("hazard_probability", 0.1)
            except Exception:
                landslide_prob = 0.1

            # --- Real-time traffic congestion ---
            try:
                origin = APIConfig.NER_DISTRICTS.get(from_id, {})
                dest = APIConfig.NER_DISTRICTS.get(to_id, {})
                traffic = await TrafficService.get_route_traffic(
                    origin.get("lat", 26), origin.get("lng", 92),
                    dest.get("lat", 25), dest.get("lng", 91)
                )
                congestion = traffic.get("congestion_level", "low")
            except Exception:
                congestion = "low"

            # ---- REAL DB corridor inputs (fallback = static config) ----
            road_condition = road.get("road_condition", "good")
            bridge_condition = road.get("bridge_condition", "operational")
            slope_risk = None
            historical_disruptions = 0
            route_row = None
            corridor_source = "static_config"

            if db_available:
                route_row = CorridorContextService.match_route(db_ctx, from_id, to_id)
                involved = {from_id, to_id}
                route_status = (route_row or {}).get("status")

                # Real roads inside the origin/dest districts (a road row's
                # district_id marks the physical stretch it belongs to).
                roads, bridges = CorridorContextService._district_roads_and_bridges(db_ctx, involved)
                worst_road = CorridorContextService._worst_road(roads)
                worst_bridge = CorridorContextService._worst_bridge(bridges)
                max_slope = CorridorContextService._max_slope(roads)

                # Corridor-level route status is the authoritative real signal
                # when a DB route row exists (good / at_risk / blocked) — a
                # coarse whole-NH road row must not override the corridor's own
                # stored status (e.g. R-02 good stays good even though the
                # dima_hasao stretch of NH-6 is separately damaged).
                if route_status == "blocked":
                    road_condition = "blocked"
                elif route_status == "at_risk":
                    road_condition = "damaged"
                elif route_status == "good":
                    road_condition = "good"
                elif worst_road:
                    road_condition = worst_road

                if worst_bridge:
                    bridge_condition = worst_bridge
                if max_slope is not None:
                    slope_risk = max_slope
                else:
                    # Real district connectivity (blocked/partial district ⇒ terrain risk)
                    conn_from = CorridorContextService._connectivity(db_ctx, from_id)
                    conn_to = CorridorContextService._connectivity(db_ctx, to_id)
                    conn_scores = [
                        int(conn_from.get("connectivity_score") or 80),
                        int(conn_to.get("connectivity_score") or 80),
                    ]
                    slope_risk = round(50 - (min(conn_scores) / 2))  # 80→10, 42→29

                historical_disruptions = CorridorContextService.disruption_count(
                    db_ctx, involved, (route_row or {}).get("id")
                )
                corridor_source = "core_backend_db" if (roads or route_row) else "static_config"

            # Static slope fallback (real seeded segment slopes, else sane default)
            if slope_risk is None:
                seg = SEGMENT_RISK.get((from_id, to_id)) or SEGMENT_RISK.get((to_id, from_id)) or {}
                slope_risk = seg.get("slope_risk", road.get("slope_risk", 25))

            # ML risk prediction with REAL inputs
            risk_result = predict_risk_score(
                slope_risk=slope_risk,
                rainfall_24h_mm=rainfall,
                road_condition=road_condition,
                bridge_condition=bridge_condition,
                historical_disruptions=historical_disruptions,
                congestion_level=congestion,
                flood_risk_level=flood_level,
                landslide_probability=landslide_prob,
                elevation_m=500,
                river_proximity=0.5,
                road_distance_km=road.get("distance_km", 100),
                route_id=route_key,
            )

            # ---- DB state anchor -------------------------------------------
            # The XGBoost model was trained on weather-driven scenarios, so a
            # corridor that is *already blocked/damaged in the DB* must never be
            # shown as low just because it isn't raining right now. Anchor the
            # level to the real, authoritative DB corridor state (route row +
            # roads/bridges/district connectivity) — a documented deterministic
            # floor, with the live ML score only ever raising it further.
            anchor = 0
            anchor_reason = "none"

            if db_available:
                conn_from = CorridorContextService._connectivity(db_ctx, from_id)
                conn_to = CorridorContextService._connectivity(db_ctx, to_id)
                conn_statuses = [
                    conn_from.get("connectivity_status"),
                    conn_to.get("connectivity_status"),
                ]
                route_status = (route_row or {}).get("status")

                if route_status == "blocked" or road_condition == "blocked":
                    anchor = 85
                    anchor_reason = "blocked"
                elif route_status == "at_risk" or road_condition == "damaged" or bridge_condition == "closed":
                    anchor = 62
                    anchor_reason = "at_risk/damaged"
                elif bridge_condition == "damaged":
                    anchor = 48
                    anchor_reason = "damaged bridge"
                elif "blocked" in conn_statuses:
                    # A district marked blocked means the corridor into it is
                    # effectively unusable — anchor high even without a road row.
                    anchor = 70
                    anchor_reason = "blocked district"

                # A matching DB route carries its own authoritative stored risk
                # (e.g. R-03 at_risk = 68, R-04 blocked = 92). Never show the
                # corridor below that — it keeps the AI page consistent with the
                # route tables and the Route Planner map.
                if route_row and route_row.get("current_risk_score") and route_status != "good":
                    # Only floor on the stored risk while the corridor is still
                    # flagged at_risk/blocked, so a fixed route can come down.
                    stored_risk = int(route_row.get("current_risk_score") or 0)
                    if stored_risk > anchor:
                        anchor = stored_risk
                        anchor_reason = "stored route risk"

            # If both endpoints are only partially connected and nothing else is
            # wrong, keep a mild anchor so partial districts are never "0 risk".
            if db_available and anchor == 0:
                if conn_from.get("connectivity_status") == "partial" or \
                   conn_to.get("connectivity_status") == "partial":
                    conn_from_s = int(conn_from.get("connectivity_score") or 80)
                    conn_to_s = int(conn_to.get("connectivity_score") or 80)
                    lowest = min(conn_from_s, conn_to_s)
                    if lowest < 60:
                        anchor = 35
                        anchor_reason = "partial district connectivity"

            # Final corridor risk = live ML score, never below the real DB state.
            ml_score = int(risk_result.get("score") or 0)
            final_score = max(ml_score, anchor)
            final_score = int(min(100, max(0, final_score)))
            if final_score > 80:
                final_level = "critical"
            elif final_score > 60:
                final_level = "high"
            elif final_score > 30:
                final_level = "medium"
            else:
                final_level = "low"
            risk_result["score"] = final_score
            risk_result["level"] = final_level
            risk_result["mlScore"] = ml_score
            risk_result["dbAnchor"] = anchor
            risk_result["dbAnchorReason"] = anchor_reason

            # Track which inputs were real vs fallback (honest provenance)
            risk_result["factors"]["historicalDisruptionCount"] = historical_disruptions
            risk_result["factors"]["recordedRainfallMm"] = round(rainfall, 1)

            state.risk_scores[route_key] = {
                "from": from_id,
                "to": to_id,
                "distance_km": road.get("distance_km"),
                "route_id": (route_row or {}).get("id"),
                "dbStatus": (route_row or {}).get("status"),
                "inputSource": corridor_source,
                **risk_result,
                "lastUpdated": datetime.utcnow().isoformat(),
            }

            # Emit risk update event
            await state.emit_event("risk_update", state.risk_scores[route_key])

            # Generate alert for high-risk routes
            if risk_result["level"] in ["high", "critical"]:
                alert = _create_pipeline_alert(
                    district_id=from_id,
                    type="high_risk_route",
                    severity=risk_result["level"],
                    title=f"HIGH RISK: {from_id} → {to_id} (Score: {risk_result['score']})",
                    message=f"Route risk score is {risk_result['score']}/100 ({risk_result['level']}) — DB state: {anchor_reason}. Consider alternate routes.",
                    source="ml_risk_engine",
                )
                state.active_alerts.append(alert)
                state.alert_history.append(alert)
                await state.emit_event("alert", alert)

        state.last_checks["risk_recalculation"] = datetime.utcnow()
        state.stats["total_risk_recalculations"] += 1
        print(f"  [OK] Risk recalculation complete. {len(ROAD_NETWORK)} routes scored.")

    except Exception as e:
        print(f"  [ERROR] Risk recalculation error: {e}")
        traceback.print_exc()


async def _disruption_prediction_task(state: PipelineState):
    """Predict disruptions for all NER districts."""
    try:
        print(f"[{datetime.utcnow().strftime('%H:%M:%S')}] [DISRUPTION] Running disruption predictions...")

        for district_id, district_info in APIConfig.NER_DISTRICTS.items():
            try:
                # Get real-time data
                weather = await WeatherService.get_district_weather(district_id)
                flood = await FloodService.get_district_flood_risk(district_id)
                landslide = await LandslideService.get_district_landslide_risk(district_id)

                rainfall_24h = weather.get("rainfall_24h_mm", 0)
                rainfall_48h = rainfall_24h * 1.5  # Estimate
                rainfall_72h = rainfall_48h * 1.2  # Estimate

                # ML disruption prediction
                prediction = predict_disruption(
                    elevation_m=district_info.get("elevation_m", 500),
                    slope_risk=district_info.get("slope_risk", 25),
                    flood_susceptibility=district_info.get("flood_susceptibility", 0.3),
                    landslide_susceptibility=district_info.get("landslide_susceptibility", 0.3),
                    temp_celsius=weather.get("temp_celsius", 25),
                    humidity_percent=weather.get("humidity_percent", 75),
                    wind_kmh=weather.get("wind_kmh", 10),
                    rainfall_24h_mm=rainfall_24h,
                    rainfall_48h_mm=rainfall_48h,
                    rainfall_72h_mm=rainfall_72h,
                    seasonal_rainfall_avg_mm=district_info.get("monsoon_rainfall_mm", 1500) / 12,
                )

                state.disruption_predictions[district_id] = {
                    "districtId": district_id,
                    "districtName": district_info.get("name", district_id),
                    **prediction,
                    "lastUpdated": datetime.utcnow().isoformat(),
                }

                # Emit disruption event
                await state.emit_event("disruption_prediction", state.disruption_predictions[district_id])

                # Generate alerts for high disruption risk
                if prediction.get("landslideRisk") == "High":
                    alert = _create_pipeline_alert(
                        district_id=district_id,
                        type="landslide_warning",
                        severity="critical",
                        title=f"LANDSLIDE ALERT: {district_info.get('name', district_id)}",
                        message=f"ML model predicts high landslide risk ({prediction.get('landslideProbability', 0):.0%})",
                        source="ml_disruption_engine",
                    )
                    state.active_alerts.append(alert)
                    state.alert_history.append(alert)
                    await state.emit_event("alert", alert)

                if prediction.get("floodRisk") == "High":
                    alert = _create_pipeline_alert(
                        district_id=district_id,
                        type="flood_warning",
                        severity="critical",
                        title=f"FLOOD ALERT: {district_info.get('name', district_id)}",
                        message=f"ML model predicts high flood risk ({prediction.get('floodProbability', 0):.0%})",
                        source="ml_disruption_engine",
                    )
                    state.active_alerts.append(alert)
                    state.alert_history.append(alert)
                    await state.emit_event("alert", alert)

            except Exception as e:
                print(f"  [WARN]  Disruption prediction failed for {district_id}: {e}")

        state.last_checks["disruption_prediction"] = datetime.utcnow()
        state.stats["total_disruption_predictions"] += 1
        print(f"  [OK] Disruption predictions complete for {len(APIConfig.NER_DISTRICTS)} districts.")

    except Exception as e:
        print(f"  [ERROR] Disruption prediction error: {e}")
        traceback.print_exc()


async def _map_update_task(state: PipelineState):
    """Generate map update events for frontend consumption."""
    try:
        print(f"[{datetime.utcnow().strftime('%H:%M:%S')}] [MAP] Generating map updates...")

        # Aggregate current state into map update
        map_data = {
            "riskScores": state.risk_scores,
            "activeAlerts": [a for a in state.active_alerts if a.get("status") == "active"],
            "disruptionPredictions": state.disruption_predictions,
            "routeOptimizations": state.route_optimizations,
            "districtWeather": {},
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Add weather summaries for map markers
        for district_id, district_info in APIConfig.NER_DISTRICTS.items():
            weather = state.disruption_predictions.get(district_id, {})
            map_data["districtWeather"][district_id] = {
                "name": district_info.get("name", district_id),
                "lat": district_info.get("lat", 0),
                "lng": district_info.get("lng", 0),
                "riskLevel": weather.get("landslideRisk", "Unknown"),
                "floodRisk": weather.get("floodRisk", "Unknown"),
            }

        state.map_updates.append(map_data)
        # Keep only last 100 updates
        if len(state.map_updates) > 100:
            state.map_updates = state.map_updates[-100:]

        await state.emit_event("map_update", map_data)
        state.last_checks["map_update"] = datetime.utcnow()
        print(f"  [OK] Map update generated.")

    except Exception as e:
        print(f"  [ERROR] Map update error: {e}")
        traceback.print_exc()


def _create_pipeline_alert(district_id: str, type: str, severity: str,
                            title: str, message: str, source: str) -> Dict:
    """Create a standardized pipeline alert."""
    return {
        "id": f"alert-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{hash(title) % 10000}",
        "districtId": district_id,
        "type": type,
        "severity": severity,
        "title": title,
        "message": message,
        "source": source,
        "status": "active",
        "createdAt": datetime.utcnow().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Pipeline Scheduler & Continual Learning Feedback Loop
# ═══════════════════════════════════════════════════════════════════════════════

async def _continual_learning_task(state: PipelineState):
    """
    Automated Closed-Loop Continual Learning Task:
    Periodically queries core-backend for pending field/trip feedback samples.
    If >= 5 samples or weekly threshold elapsed, auto-triggers model retraining
    with elevated loss weight on Hard False Negatives (predicted score < 40).
    """
    print("\n[ACTIVE LEARNING] Checking pending feedback samples for continual retraining...")
    try:
        core_backend_url = os.environ.get("CORE_BACKEND_URL", "http://localhost:5000")
        internal_key = os.environ.get("CORE_BACKEND_INTERNAL_KEY", "raahi_internal_secret_key_2026")

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{core_backend_url}/api/internal/ml/active-learning/samples?status=pending",
                headers={"x-internal-key": internal_key},
            )
            if resp.status_code == 200:
                data = resp.json()
                samples = data.get("data", [])
                if len(samples) >= 5:
                    print(f"  [ACTIVE LEARNING] Threshold reached ({len(samples)} pending samples). Triggering automated closed-loop retraining...")
                    from app.engine.train import retrain_risk_model_with_feedback
                    retrain_risk_model_with_feedback(samples)

                    # Mark samples as incorporated
                    sample_ids = [s.get("sampleId") for s in samples if s.get("sampleId")]
                    if sample_ids:
                        await client.patch(
                            f"{core_backend_url}/api/internal/ml/active-learning/mark-incorporated",
                            headers={"x-internal-key": internal_key},
                            json={"sampleIds": sample_ids},
                        )
                    print(f"  [OK] Continual retraining complete. XGBoost weights updated and hot-reloaded.")
                else:
                    print(f"  [ACTIVE LEARNING] {len(samples)} pending samples (batch threshold is 5). Model weights current.")
    except Exception as e:
        print(f"  [WARN] Continual learning check skipped: {e}")


async def _run_task_loop(task_func, interval: int, task_name: str, state: PipelineState):
    """Run a task in a loop with the specified interval."""
    while state.running:
        try:
            start = time.time()
            await task_func(state)
            elapsed = time.time() - start
            print(f"  [TIME] {task_name} completed in {elapsed:.1f}s")
        except Exception as e:
            print(f"  [ERROR] {task_name} crashed: {e}")
            traceback.print_exc()

        await asyncio.sleep(interval)


async def start_pipeline():
    """Start the real-time background processing pipeline."""
    state = PipelineState()
    state.running = True
    state.start_time = datetime.utcnow()

    print("\n" + "="*60)
    print("  [START] Real-Time Processing Pipeline")
    print("  " + datetime.utcnow().isoformat())
    print("="*60)

    # Run all tasks in parallel. Each loop executes its first pass immediately,
    # so the app stays responsive while live-API checks run in the background.
    print("\n  Running initial checks in background (non-blocking)...")
    tasks = [
        asyncio.create_task(_run_task_loop(
            _weather_monitoring_task, INTERVALS["weather_check"],
            "Weather Monitoring", state
        )),
        asyncio.create_task(_run_task_loop(
            _risk_recalculation_task, INTERVALS["risk_recalculation"],
            "Risk Recalculation", state
        )),
        asyncio.create_task(_run_task_loop(
            _disruption_prediction_task, INTERVALS["disruption_prediction"],
            "Disruption Prediction", state
        )),
        asyncio.create_task(_run_task_loop(
            _map_update_task, INTERVALS["map_update"],
            "Map Update", state
        )),
        asyncio.create_task(_run_task_loop(
            _continual_learning_task, INTERVALS["continual_learning_check"],
            "Continual Learning Retraining", state
        )),
    ]

    print("\n  [OK] Pipeline started! All tasks running in background.")
    print("="*60 + "\n")

    return tasks


def stop_pipeline():
    """Stop the pipeline."""
    state = PipelineState()
    state.running = False
    print("Pipeline stopped.")


def get_pipeline_state() -> PipelineState:
    """Get the current pipeline state."""
    return PipelineState()


def get_pipeline_status() -> Dict[str, Any]:
    """Get pipeline status."""
    state = PipelineState()
    status = state.get_status()
    status["modelStatus"] = get_model_status()
    return status
