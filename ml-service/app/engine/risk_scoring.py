"""
NER Risk Scoring Engine — weighted composite model.
Accepts real inputs from core-backend (DB-sourced) and computes risk scores.
"""

from datetime import datetime
from typing import Dict, Any, Optional


def compute_route_risk(
    route_id: str,
    slope_risk: float = 25.0,
    road_condition: str = "good",
    rainfall_mm: float = 12.0,
    historical_disruptions: int = 0,
    bridge_condition: str = "operational",
    congestion_level: str = "low",
) -> Dict[str, Any]:
    """
    Compute a weighted composite risk score (0-100) for a route.

    Weights (per implementation.md):
      25% Terrain/slope risk
      25% Rainfall intensity (24h)
      20% Historical disruption frequency
      20% Road/bridge condition
      10% Traffic congestion
    """

    # --- Terrain / Slope Risk (0-100) ---
    terrain_sub = min(100.0, slope_risk * 1.0)

    # --- Rainfall Intensity (0-100) ---
    # 80mm in 24h = 100 (extreme), 0mm = 0
    rain_sub = min(100.0, (rainfall_mm / 80.0) * 100.0)

    # --- Historical Disruption Frequency (0-100) ---
    # 0 disruptions = 0, 12+ disruptions = 100
    history_sub = min(100.0, (historical_disruptions / 12.0) * 100.0)

    # --- Road / Bridge Condition (0-100) ---
    condition_scores = {
        "good": 15.0,
        "damaged": 65.0,
        "blocked": 100.0,
    }
    bridge_scores = {
        "operational": 0,
        "damaged": 20,
        "closed": 40,
    }
    condition_sub = condition_scores.get(road_condition, 15.0) + bridge_scores.get(bridge_condition, 0)
    condition_sub = min(100.0, condition_sub)

    # --- Traffic Congestion (0-100) ---
    congestion_scores = {
        "low": 10.0,
        "moderate": 35.0,
        "high": 65.0,
        "blocked": 100.0,
    }
    traffic_sub = congestion_scores.get(congestion_level, 20.0)

    # --- Weighted Composite ---
    raw_score = (
        terrain_sub * 0.25 +
        rain_sub * 0.25 +
        history_sub * 0.20 +
        condition_sub * 0.20 +
        traffic_sub * 0.10
    )

    final_score = int(min(100, max(0, round(raw_score))))

    # Risk level bands
    if final_score > 80:
        level = "critical"
    elif final_score > 60:
        level = "high"
    elif final_score > 30:
        level = "medium"
    else:
        level = "low"

    return {
        "score": final_score,
        "level": level,
        "factors": {
            "terrainSlopeRisk": round(terrain_sub, 1),
            "rainfallIntensity": round(rain_sub, 1),
            "historicalDisruptionScore": round(history_sub, 1),
            "roadConditionScore": round(condition_sub, 1),
            "trafficCongestionScore": round(traffic_sub, 1),
            "recordedRainfallMm": rainfall_mm,
            "historicalDisruptionCount": historical_disruptions,
            "bridgeCondition": bridge_condition,
            "congestionLevel": congestion_level,
        },
        "computedAt": datetime.utcnow().isoformat() + "Z",
        "engine": "fastapi_weighted_composite_v2",
    }
