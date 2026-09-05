"""
NER Route Optimizer — covers all seeded districts with realistic inter-district distances.
Distances based on actual NH corridor lengths for North East India.
"""

from typing import Dict, Any, List, Optional

# Full inter-district distance matrix (km) based on real NH corridors
NER_DISTANCES: Dict[str, Dict[str, float]] = {
    "kamrup": {
        "sonitpur": 175.0,
        "east_khasi": 98.0,
        "cachar": 310.0,
        "dima_hasao": 270.0,
        "dimapur": 270.0,
        "kohima": 340.0,
        "imphal_west": 485.0,
        "papum_pare": 330.0,
        "west_tripura": 550.0,
        "aizawl": 440.0,
        "west_khasi": 170.0,
    },
    "sonitpur": {
        "kamrup": 175.0,
        "dima_hasao": 190.0,
        "dimapur": 195.0,
        "kohima": 265.0,
        "papum_pare": 280.0,
        "east_khasi": 270.0,
    },
    "cachar": {
        "kamrup": 310.0,
        "aizawl": 168.0,
        "imphal_west": 240.0,
        "dima_hasao": 140.0,
        "west_khasi": 210.0,
        "west_tripura": 320.0,
    },
    "dima_hasao": {
        "kamrup": 270.0,
        "cachar": 140.0,
        "sonitpur": 190.0,
        "dimapur": 110.0,
        "kohima": 180.0,
        "imphal_west": 310.0,
        "aizawl": 200.0,
    },
    "east_khasi": {
        "kamrup": 98.0,
        "west_khasi": 85.0,
        "cachar": 245.0,
        "dima_hasao": 190.0,
        "sonitpur": 270.0,
    },
    "west_khasi": {
        "kamrup": 170.0,
        "east_khasi": 85.0,
        "cachar": 210.0,
        "dima_hasao": 165.0,
    },
    "dimapur": {
        "kamrup": 270.0,
        "kohima": 74.0,
        "imphal_west": 215.0,
        "sonitpur": 195.0,
        "dima_hasao": 110.0,
    },
    "kohima": {
        "dimapur": 74.0,
        "imphal_west": 145.0,
        "kamrup": 340.0,
        "sonitpur": 265.0,
        "dima_hasao": 180.0,
    },
    "imphal_west": {
        "kohima": 145.0,
        "dimapur": 215.0,
        "kamrup": 485.0,
        "cachar": 240.0,
        "dima_hasao": 310.0,
        "aizawl": 390.0,
    },
    "papum_pare": {
        "kamrup": 330.0,
        "sonitpur": 280.0,
        "dimapur": 230.0,
    },
    "west_tripura": {
        "kamrup": 550.0,
        "cachar": 320.0,
        "aizawl": 380.0,
    },
    "aizawl": {
        "cachar": 168.0,
        "kamrup": 440.0,
        "imphal_west": 390.0,
        "dima_hasao": 200.0,
        "west_tripura": 380.0,
    },
}

# Known risk factors per route segment (from seed data)
SEGMENT_RISK: Dict[str, Dict[str, Any]] = {
    ("kamrup", "sonitpur"): {"slope_risk": 18, "road_condition": "good", "nh": "NH-27/NH-37"},
    ("kamrup", "east_khasi"): {"slope_risk": 35, "road_condition": "good", "nh": "NH-6"},
    ("cachar", "aizawl"): {"slope_risk": 70, "road_condition": "damaged", "nh": "NH-306"},
    ("dimapur", "imphal_west"): {"slope_risk": 85, "road_condition": "blocked", "nh": "NH-2"},
    ("kamrup", "papum_pare"): {"slope_risk": 25, "road_condition": "good", "nh": "NH-27/NH-415"},
    ("dima_hasao", "cachar"): {"slope_risk": 65, "road_condition": "damaged", "nh": "NH-6"},
}


ROAD_NETWORK = [
    {"from": "kamrup", "to": "sonitpur", "distance_km": 175, "nh": "NH-27/NH-37", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "kamrup", "to": "east_khasi", "distance_km": 98, "nh": "NH-6", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "kamrup", "to": "cachar", "distance_km": 310, "nh": "NH-37/NH-6", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "kamrup", "to": "dima_hasao", "distance_km": 270, "nh": "NH-27/NH-6", "road_condition": "damaged", "bridge_condition": "operational"},
    {"from": "kamrup", "to": "dimapur", "distance_km": 270, "nh": "NH-27/NH-2", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "kamrup", "to": "papum_pare", "distance_km": 330, "nh": "NH-27/NH-415", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "kamrup", "to": "west_tripura", "distance_km": 550, "nh": "NH-37/NH-8", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "kamrup", "to": "aizawl", "distance_km": 440, "nh": "NH-37/NH-306", "road_condition": "good", "bridge_condition": "damaged"},
    {"from": "sonitpur", "to": "dima_hasao", "distance_km": 190, "nh": "NH-37/NH-6", "road_condition": "damaged", "bridge_condition": "operational"},
    {"from": "sonitpur", "to": "dimapur", "distance_km": 195, "nh": "NH-37/NH-2", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "sonitpur", "to": "kohima", "distance_km": 265, "nh": "NH-2", "road_condition": "damaged", "bridge_condition": "operational"},
    {"from": "sonitpur", "to": "east_khasi", "distance_km": 270, "nh": "NH-37/NH-6", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "cachar", "to": "aizawl", "distance_km": 168, "nh": "NH-306", "road_condition": "damaged", "bridge_condition": "damaged"},
    {"from": "cachar", "to": "imphal_west", "distance_km": 240, "nh": "NH-37/NH-2", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "cachar", "to": "dima_hasao", "distance_km": 140, "nh": "NH-6", "road_condition": "damaged", "bridge_condition": "operational"},
    {"from": "cachar", "to": "west_khasi", "distance_km": 210, "nh": "NH-6", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "cachar", "to": "west_tripura", "distance_km": 320, "nh": "NH-8", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "dima_hasao", "to": "dimapur", "distance_km": 110, "nh": "NH-6/NH-2", "road_condition": "damaged", "bridge_condition": "damaged"},
    {"from": "dima_hasao", "to": "kohima", "distance_km": 180, "nh": "NH-2", "road_condition": "damaged", "bridge_condition": "operational"},
    {"from": "dima_hasao", "to": "imphal_west", "distance_km": 310, "nh": "NH-2", "road_condition": "blocked", "bridge_condition": "closed"},
    {"from": "dima_hasao", "to": "aizawl", "distance_km": 200, "nh": "NH-306", "road_condition": "damaged", "bridge_condition": "damaged"},
    {"from": "east_khasi", "to": "west_khasi", "distance_km": 85, "nh": "NH-106", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "east_khasi", "to": "cachar", "distance_km": 245, "nh": "NH-6", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "east_khasi", "to": "dima_hasao", "distance_km": 190, "nh": "NH-6", "road_condition": "damaged", "bridge_condition": "operational"},
    {"from": "dimapur", "to": "kohima", "distance_km": 74, "nh": "NH-2", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "dimapur", "to": "imphal_west", "distance_km": 215, "nh": "NH-2", "road_condition": "damaged", "bridge_condition": "operational"},
    {"from": "dimapur", "to": "sonitpur", "distance_km": 195, "nh": "NH-2/NH-37", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "kohima", "to": "imphal_west", "distance_km": 145, "nh": "NH-2", "road_condition": "damaged", "bridge_condition": "damaged"},
    {"from": "kohima", "to": "kamrup", "distance_km": 340, "nh": "NH-2/NH-27", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "imphal_west", "to": "aizawl", "distance_km": 390, "nh": "NH-37/NH-306", "road_condition": "damaged", "bridge_condition": "damaged"},
    {"from": "imphal_west", "to": "kamrup", "distance_km": 485, "nh": "NH-2/NH-37", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "papum_pare", "to": "sonitpur", "distance_km": 280, "nh": "NH-415/NH-37", "road_condition": "good", "bridge_condition": "operational"},
    {"from": "papum_pare", "to": "dimapur", "distance_km": 230, "nh": "NH-415/NH-2", "road_condition": "damaged", "bridge_condition": "operational"},
    {"from": "west_tripura", "to": "aizawl", "distance_km": 380, "nh": "NH-8/NH-306", "road_condition": "damaged", "bridge_condition": "damaged"},
]


def optimize_route(
    origin: str,
    destination: str,
    commodity: str = "general",
    weight_kg: float = 1000.0,
    historical_disruptions: int = 0,
    rainfall_mm: float = 12.0,
) -> Dict[str, Any]:
    """Generate primary + alternate routes between two NER districts."""

    origin = origin.lower().strip()
    destination = destination.lower().strip()

    # Lookup distance
    base_distance = NER_DISTANCES.get(origin, {}).get(destination)
    if base_distance is None:
        # Try reverse
        base_distance = NER_DISTANCES.get(destination, {}).get(origin)
    if base_distance is None:
        base_distance = 200.0  # sensible fallback

    # Road conditions for this segment
    seg_key_fwd = (origin, destination)
    seg_key_rev = (destination, origin)
    segment = SEGMENT_RISK.get(seg_key_fwd) or SEGMENT_RISK.get(seg_key_rev) or {}

    slope_risk = segment.get("slope_risk", 25)
    road_condition = segment.get("road_condition", "good")
    nh_label = segment.get("nh", "National Highway")

    # Speed depends on road condition
    speed_map = {"good": 48.0, "damaged": 35.0, "blocked": 15.0}
    avg_speed = speed_map.get(road_condition, 45.0)

    base_hours = round(base_distance / avg_speed, 1)

    # Fuel cost: ₹14.5/km base + weight surcharge
    weight_factor = 1.0 + (weight_kg / 20000.0)
    base_fuel = round(base_distance * 14.5 * weight_factor, 0)

    # Risk score from ML engine or computed locally
    condition_penalty = {"good": 15, "damaged": 65, "blocked": 100}.get(road_condition, 15)
    rain_factor = min(100, (rainfall_mm / 80.0) * 100)
    disruption_factor = min(100, historical_disruptions * 8)

    risk_score = int(min(100, round(
        slope_risk * 0.25 +
        rain_factor * 0.25 +
        disruption_factor * 0.20 +
        condition_penalty * 0.20 +
        20 * 0.10  # traffic placeholder
    )))

    risk_level = "critical" if risk_score > 80 else "high" if risk_score > 60 else "medium" if risk_score > 30 else "low"

    primary = {
        "name": f"Primary Highway — {nh_label} ({origin.title()} → {destination.title()})",
        "distanceKm": base_distance,
        "estimatedHours": base_hours,
        "fuelCostEstimate": base_fuel,
        "riskScore": risk_score,
        "riskLevel": risk_level,
        "efficiencyGain": "Direct corridor via main NH",
    }

    # Alternate 1: Low-elevation bypass (longer but safer)
    alt1_distance = round(base_distance * 1.15, 1)
    alt1_hours = round(alt1_distance / (avg_speed * 0.92), 1)
    alt1_fuel = round(alt1_distance * 14.5 * weight_factor, 0)
    alt1_risk = max(10, risk_score - 35)

    alt1 = {
        "name": f"Low Elevation Foothill Bypass ({origin.title()} → {destination.title()})",
        "distanceKm": alt1_distance,
        "estimatedHours": alt1_hours,
        "fuelCostEstimate": alt1_fuel,
        "riskScore": alt1_risk,
        "riskLevel": "low" if alt1_risk <= 30 else "medium",
        "efficiencyGain": "Avoids high-risk landslide slopes",
    }

    # Alternate 2: Riverine conjunction (longest but safest)
    alt2_distance = round(base_distance * 1.28, 1)
    alt2_hours = round(alt2_distance / (avg_speed * 0.88), 1)
    alt2_fuel = round(alt2_distance * 15.5 * weight_factor, 0)

    alt2 = {
        "name": f"Riverine Freight Conjunction ({origin.title()} → {destination.title()})",
        "distanceKm": alt2_distance,
        "estimatedHours": alt2_hours,
        "fuelCostEstimate": alt2_fuel,
        "riskScore": 12,
        "riskLevel": "low",
        "efficiencyGain": "Maximum bridge load tolerance, avoids mountain passes",
    }

    return {
        "primaryRoute": primary,
        "alternateRoutes": [alt1, alt2],
    }
