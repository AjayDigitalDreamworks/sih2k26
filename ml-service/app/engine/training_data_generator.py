"""
Training Data Generator for Raahi ML Models.

Generates realistic synthetic training data based on:
- Real NER district coordinates, terrain, and weather patterns
- Historical incident patterns for North East India
- Seasonal monsoon patterns (June-September peak)
- Known road condition data from NH corridors
- Geological susceptibility of different terrain types

Data is used to train:
1. Risk Scoring Model (route-level risk assessment)
2. Disruption Prediction Model (flood/landslide/traffic forecasting)
3. Route Optimization Model (delay estimation + route selection)
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
import random
import os
import json


# ═══════════════════════════════════════════════════════════════════════════════
# NER District Base Data (real coordinates and characteristics)
# ═══════════════════════════════════════════════════════════════════════════════

NER_DISTRICTS = {
    "kamrup": {
        "name": "Guwahati", "lat": 26.1445, "lng": 91.7362,
        "elevation_m": 55, "terrain": "plain", "slope_risk": 12,
        "river_proximity": 0.8, "monsoon_rainfall_mm": 1800,
        "flood_susceptibility": 0.7, "landslide_susceptibility": 0.1,
        "road_density": 0.9, "bridge_count": 8, "state": "Assam"
    },
    "sonitpur": {
        "name": "Tezpur", "lat": 26.6528, "lng": 92.7926,
        "elevation_m": 80, "terrain": "plain", "slope_risk": 15,
        "river_proximity": 0.9, "monsoon_rainfall_mm": 1700,
        "flood_susceptibility": 0.6, "landslide_susceptibility": 0.15,
        "road_density": 0.7, "bridge_count": 5, "state": "Assam"
    },
    "cachar": {
        "name": "Silchar", "lat": 24.8170, "lng": 92.7985,
        "elevation_m": 25, "terrain": "plain", "slope_risk": 18,
        "river_proximity": 0.7, "monsoon_rainfall_mm": 2200,
        "flood_susceptibility": 0.65, "landslide_susceptibility": 0.2,
        "road_density": 0.6, "bridge_count": 4, "state": "Assam"
    },
    "dima_hasao": {
        "name": "Haflong", "lat": 25.1764, "lng": 93.0232,
        "elevation_m": 950, "terrain": "hills", "slope_risk": 65,
        "river_proximity": 0.4, "monsoon_rainfall_mm": 2500,
        "flood_susceptibility": 0.3, "landslide_susceptibility": 0.8,
        "road_density": 0.3, "bridge_count": 6, "state": "Assam"
    },
    "east_khasi": {
        "name": "Shillong", "lat": 25.5788, "lng": 91.8933,
        "elevation_m": 1525, "terrain": "hills", "slope_risk": 55,
        "river_proximity": 0.3, "monsoon_rainfall_mm": 2200,
        "flood_susceptibility": 0.2, "landslide_susceptibility": 0.7,
        "road_density": 0.5, "bridge_count": 3, "state": "Meghalaya"
    },
    "west_khasi": {
        "name": "Nongstoin", "lat": 25.5244, "lng": 91.2662,
        "elevation_m": 1350, "terrain": "hills", "slope_risk": 60,
        "river_proximity": 0.5, "monsoon_rainfall_mm": 2800,
        "flood_susceptibility": 0.25, "landslide_susceptibility": 0.75,
        "road_density": 0.3, "bridge_count": 2, "state": "Meghalaya"
    },
    "dimapur": {
        "name": "Dimapur", "lat": 25.9060, "lng": 93.7270,
        "elevation_m": 150, "terrain": "foothills", "slope_risk": 25,
        "river_proximity": 0.6, "monsoon_rainfall_mm": 1600,
        "flood_susceptibility": 0.4, "landslide_susceptibility": 0.2,
        "road_density": 0.6, "bridge_count": 3, "state": "Nagaland"
    },
    "kohima": {
        "name": "Kohima", "lat": 25.6751, "lng": 94.1086,
        "elevation_m": 1444, "terrain": "hills", "slope_risk": 70,
        "river_proximity": 0.2, "monsoon_rainfall_mm": 1900,
        "flood_susceptibility": 0.15, "landslide_susceptibility": 0.85,
        "road_density": 0.35, "bridge_count": 2, "state": "Nagaland"
    },
    "imphal_west": {
        "name": "Imphal", "lat": 24.8170, "lng": 93.9368,
        "elevation_m": 790, "terrain": "hills", "slope_risk": 50,
        "river_proximity": 0.5, "monsoon_rainfall_mm": 1500,
        "flood_susceptibility": 0.35, "landslide_susceptibility": 0.5,
        "road_density": 0.45, "bridge_count": 4, "state": "Manipur"
    },
    "aizawl": {
        "name": "Aizawl", "lat": 23.7271, "lng": 92.7176,
        "elevation_m": 1132, "terrain": "hills", "slope_risk": 75,
        "river_proximity": 0.2, "monsoon_rainfall_mm": 2000,
        "flood_susceptibility": 0.1, "landslide_susceptibility": 0.8,
        "road_density": 0.3, "bridge_count": 2, "state": "Mizoram"
    },
    "papum_pare": {
        "name": "Itanagar", "lat": 27.0844, "lng": 93.6053,
        "elevation_m": 350, "terrain": "foothills", "slope_risk": 40,
        "river_proximity": 0.6, "monsoon_rainfall_mm": 2300,
        "flood_susceptibility": 0.5, "landslide_susceptibility": 0.4,
        "road_density": 0.4, "bridge_count": 3, "state": "Arunachal Pradesh"
    },
    "west_tripura": {
        "name": "Agartala", "lat": 23.8315, "lng": 91.2868,
        "elevation_m": 15, "terrain": "plain", "slope_risk": 8,
        "river_proximity": 0.9, "monsoon_rainfall_mm": 2100,
        "flood_susceptibility": 0.75, "landslide_susceptibility": 0.05,
        "road_density": 0.7, "bridge_count": 5, "state": "Tripura"
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# Inter-district road network with real NH data
# ═══════════════════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════════════════
# Monsoon season patterns (June-September peak)
# ═══════════════════════════════════════════════════════════════════════════════

def get_seasonal_modifier(month: int, district_id: str) -> Dict[str, float]:
    """Get seasonal modifiers based on NER monsoon patterns."""
    district = NER_DISTRICTS.get(district_id, {})
    annual_rainfall = district.get("monsoon_rainfall_mm", 1500)

    # Monthly rainfall distribution for NER (% of annual)
    monthly_distribution = {
        1: 0.02, 2: 0.03, 3: 0.05, 4: 0.10, 5: 0.14,
        6: 0.22, 7: 0.25, 8: 0.22, 9: 0.15, 10: 0.06,
        11: 0.02, 12: 0.01,
    }

    month_fraction = monthly_distribution.get(month, 0.05)
    estimated_monthly_rainfall = annual_rainfall * month_fraction

    # Seasonal risk multipliers
    if month in [6, 7, 8, 9]:  # Peak monsoon
        return {
            "rainfall_multiplier": 2.5,
            "flood_multiplier": 2.0,
            "landslide_multiplier": 2.5,
            "road_degradation": 1.3,
            "estimated_monthly_rainfall_mm": estimated_monthly_rainfall,
        }
    elif month in [4, 5, 10]:  # Pre/post monsoon
        return {
            "rainfall_multiplier": 1.3,
            "flood_multiplier": 1.2,
            "landslide_multiplier": 1.3,
            "road_degradation": 1.1,
            "estimated_monthly_rainfall_mm": estimated_monthly_rainfall,
        }
    else:  # Dry season
        return {
            "rainfall_multiplier": 0.3,
            "flood_multiplier": 0.2,
            "landslide_multiplier": 0.2,
            "road_degradation": 0.8,
            "estimated_monthly_rainfall_mm": estimated_monthly_rainfall,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Risk Score Training Data Generator
# ═══════════════════════════════════════════════════════════════════════════════

def generate_risk_training_data(n_samples: int = 5000, seed: int = 42) -> pd.DataFrame:
    """
    Generate training data for the Risk Scoring Model.

    Features:
    - slope_risk (0-100): terrain steepness
    - rainfall_24h_mm: current 24h rainfall
    - road_condition (encoded: good=0, damaged=1, blocked=2)
    - bridge_condition (encoded: operational=0, damaged=1, closed=2)
    - historical_disruptions (count): past incidents on this route
    - congestion_level (encoded: low=0, moderate=1, high=2, blocked=3)
    - flood_risk_level (0-100): current flood risk
    - landslide_probability (0-1): current landslide probability
    - elevation_m: route elevation
    - river_proximity (0-1): proximity to rivers
    - month (1-12): seasonal factor
    - road_distance_km: length of route segment

    Target:
    - risk_score (0-100): composite risk score
    - risk_level: low/medium/high/critical
    """
    np.random.seed(seed)
    random.seed(seed)

    data = []
    road_conditions_map = {"good": 0, "damaged": 1, "blocked": 2}
    bridge_conditions_map = {"operational": 0, "damaged": 1, "closed": 2}
    congestion_map = {"low": 0, "moderate": 1, "high": 2, "blocked": 3}

    for _ in range(n_samples):
        # Pick a random road segment
        road = random.choice(ROAD_NETWORK)
        from_district = NER_DISTRICTS[road["from"]]
        to_district = NER_DISTRICTS[road["to"]]

        # Pick a random month
        month = random.randint(1, 12)
        seasonal = get_seasonal_modifier(month, road["from"])

        # Generate features with realistic variation
        slope_risk = np.clip(
            (from_district["slope_risk"] + to_district["slope_risk"]) / 2
            + np.random.normal(0, 10), 0, 100
        )

        base_rainfall = seasonal["estimated_monthly_rainfall_mm"] / 30
        rainfall_24h = max(0, base_rainfall * np.random.exponential(1.5))

        # Road condition can degrade during monsoon
        base_condition = road["road_condition"]
        if month in [6, 7, 8, 9] and np.random.random() < 0.3:
            conditions = ["good", "damaged", "blocked"]
            idx = min(conditions.index(base_condition) + 1, 2)
            road_condition = conditions[idx]
        else:
            road_condition = base_condition

        bridge_condition = road["bridge_condition"]
        if month in [6, 7, 8, 9] and np.random.random() < 0.15:
            if bridge_condition == "operational":
                bridge_condition = "damaged"

        historical_disruptions = int(np.random.poisson(
            3 * seasonal["landslide_multiplier"]
        ))

        congestion_level = random.choices(
            ["low", "moderate", "high", "blocked"],
            weights=[0.4, 0.3, 0.2, 0.1]
        )[0]
        if month in [6, 7, 8, 9]:
            congestion_level = random.choices(
                ["low", "moderate", "high", "blocked"],
                weights=[0.2, 0.3, 0.3, 0.2]
            )[0]

        # Compute flood and landslide risk from features
        flood_risk = np.clip(
            from_district["flood_susceptibility"] * 100
            * seasonal["flood_multiplier"]
            * (1 + rainfall_24h / 50),
            0, 100
        )
        landslide_prob = np.clip(
            from_district["landslide_susceptibility"]
            * seasonal["landslide_multiplier"]
            * (1 + rainfall_24h / 40),
            0, 1
        )

        elevation = (from_district["elevation_m"] + to_district["elevation_m"]) / 2
        river_prox = (from_district["river_proximity"] + to_district["river_proximity"]) / 2

        # Compute the target risk score using a realistic formula
        terrain_sub = slope_risk
        rain_sub = min(100, (rainfall_24h / 80) * 100)
        history_sub = min(100, (historical_disruptions / 12) * 100)
        condition_sub = min(100, road_conditions_map[road_condition] * 35 + bridge_conditions_map[bridge_condition] * 20)
        traffic_sub = congestion_map[congestion_level] * 25
        flood_sub = flood_risk * 0.5
        landslide_sub = landslide_prob * 100 * 0.5

        raw_score = (
            terrain_sub * 0.15 +
            rain_sub * 0.20 +
            history_sub * 0.15 +
            condition_sub * 0.15 +
            traffic_sub * 0.10 +
            flood_sub * 0.15 +
            landslide_sub * 0.10
        )

        # Add noise to simulate real-world variation
        noise = np.random.normal(0, 3)
        risk_score = int(np.clip(raw_score + noise, 0, 100))

        # Determine risk level
        if risk_score > 80:
            risk_level = "critical"
        elif risk_score > 60:
            risk_level = "high"
        elif risk_score > 30:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Add delay estimation as secondary target
        base_speed = {"good": 48, "damaged": 35, "blocked": 15}.get(road_condition, 40)
        weather_penalty = 1 - (rainfall_24h / 200)
        effective_speed = max(5, base_speed * weather_penalty)
        estimated_hours = road["distance_km"] / effective_speed
        delay_hours = max(0, estimated_hours - road["distance_km"] / 48)

        data.append({
            "slope_risk": round(slope_risk, 1),
            "rainfall_24h_mm": round(rainfall_24h, 1),
            "road_condition": road_conditions_map[road_condition],
            "bridge_condition": bridge_conditions_map[bridge_condition],
            "historical_disruptions": historical_disruptions,
            "congestion_level": congestion_map[congestion_level],
            "flood_risk_level": round(flood_risk, 1),
            "landslide_probability": round(landslide_prob, 3),
            "elevation_m": round(elevation, 0),
            "river_proximity": round(river_prox, 2),
            "month": month,
            "road_distance_km": road["distance_km"],
            "risk_score": risk_score,
            "risk_level": risk_level,
            "estimated_hours": round(estimated_hours, 1),
            "delay_hours": round(delay_hours, 1),
        })

    return pd.DataFrame(data)


# ═══════════════════════════════════════════════════════════════════════════════
# Disruption Prediction Training Data Generator
# ═══════════════════════════════════════════════════════════════════════════════

def generate_disruption_training_data(n_samples: int = 4000, seed: int = 42) -> pd.DataFrame:
    """
    Generate training data for the Disruption Prediction Model.

    This model predicts future disruptions (24-72h ahead) based on:
    - Current weather conditions
    - Terrain characteristics
    - Historical patterns
    - Seasonal factors

    Targets:
    - landslide_occurred (binary)
    - flood_occurred (binary)
    - road_blocked (binary)
    - disruption_severity (0-100)
    """
    np.random.seed(seed)
    random.seed(seed)

    data = []

    for _ in range(n_samples):
        district_id = random.choice(list(NER_DISTRICTS.keys()))
        district = NER_DISTRICTS[district_id]
        month = random.randint(1, 12)
        seasonal = get_seasonal_modifier(month, district_id)

        # Current conditions
        rainfall_24h = max(0, seasonal["estimated_monthly_rainfall_mm"] / 30 * np.random.exponential(1.5))
        rainfall_48h = rainfall_24h * np.random.uniform(0.8, 2.5)
        rainfall_72h = rainfall_48h * np.random.uniform(0.7, 2.0)
        temp_celsius = np.random.uniform(18, 35)
        humidity = np.random.uniform(60, 98)
        wind_kmh = max(0, np.random.exponential(10))

        # Terrain features
        slope_risk = district["slope_risk"] + np.random.normal(0, 5)
        elevation = district["elevation_m"] + np.random.normal(0, 50)
        flood_susceptibility = district["flood_susceptibility"]
        landslide_susceptibility = district["landslide_susceptibility"]

        # Compute disruption probabilities based on physics
        # Landslide: triggered by heavy rain on steep slopes
        landslide_trigger = (
            rainfall_24h / 50 * 0.35 +
            rainfall_48h / 100 * 0.25 +
            slope_risk / 100 * 0.25 +
            landslide_susceptibility * 0.15
        )
        landslide_prob = min(1.0, landslide_trigger * seasonal["landslide_multiplier"])
        landslide_occurred = 1 if np.random.random() < landslide_prob else 0

        # Flood: triggered by heavy rain in low-lying areas near rivers
        flood_trigger = (
            rainfall_24h / 60 * 0.30 +
            rainfall_48h / 120 * 0.25 +
            flood_susceptibility * 0.25 +
            (1 if elevation < 200 else 0.5) * 0.10
        )
        flood_prob = min(1.0, flood_trigger * seasonal["flood_multiplier"])
        flood_occurred = 1 if np.random.random() < flood_prob else 0

        # Road blocked: caused by landslide, flood, or wind
        road_block_trigger = (
            landslide_occurred * 0.4 +
            flood_occurred * 0.3 +
            (1 if wind_kmh > 60 else 0) * 0.15 +
            (1 if rainfall_24h > 80 else 0) * 0.15
        )
        road_blocked = 1 if np.random.random() < road_block_trigger else 0

        # Disruption severity (continuous)
        severity = np.clip(
            landslide_prob * 40 +
            flood_prob * 35 +
            (road_blocked * 25) +
            np.random.normal(0, 5),
            0, 100
        )

        data.append({
            "district_id": district_id,
            "month": month,
            "elevation_m": round(elevation, 0),
            "slope_risk": round(np.clip(slope_risk, 0, 100), 1),
            "flood_susceptibility": flood_susceptibility,
            "landslide_susceptibility": landslide_susceptibility,
            "temp_celsius": round(temp_celsius, 1),
            "humidity_percent": round(humidity, 1),
            "wind_kmh": round(wind_kmh, 1),
            "rainfall_24h_mm": round(rainfall_24h, 1),
            "rainfall_48h_mm": round(rainfall_48h, 1),
            "rainfall_72h_mm": round(rainfall_72h, 1),
            "seasonal_rainfall_avg_mm": round(seasonal["estimated_monthly_rainfall_mm"], 1),
            "landslide_occurred": landslide_occurred,
            "flood_occurred": flood_occurred,
            "road_blocked": road_blocked,
            "disruption_severity": round(severity, 1),
        })

    return pd.DataFrame(data)


# ═══════════════════════════════════════════════════════════════════════════════
# Route Optimization Training Data Generator
# ═══════════════════════════════════════════════════════════════════════════════

def generate_route_optimization_data(n_samples: int = 3000, seed: int = 42) -> pd.DataFrame:
    """
    Generate training data for Route Optimization Model.

    Predicts optimal route selection and delay estimation.

    Features:
    - Route characteristics (distance, road conditions, terrain)
    - Real-time conditions (weather, traffic, flood, landslide)
    - Cargo characteristics (type, weight, priority)

    Targets:
    - actual_delay_minutes: estimated delay
    - route_safety_score (0-100)
    - recommended_route_rank: 1=primary, 2=alternate1, 3=alternate2
    """
    np.random.seed(seed)
    random.seed(seed)

    commodity_types = ["medicine", "food", "agri", "construction", "fuel", "general"]
    priority_map = {"medicine": 5, "food": 4, "fuel": 3, "agri": 2, "construction": 1, "general": 1}

    data = []

    for _ in range(n_samples):
        road = random.choice(ROAD_NETWORK)
        from_district = NER_DISTRICTS[road["from"]]
        to_district = NER_DISTRICTS[road["to"]]
        month = random.randint(1, 12)
        seasonal = get_seasonal_modifier(month, road["from"])

        # Route features
        distance_km = road["distance_km"] * np.random.uniform(0.95, 1.05)
        road_conditions_map = {"good": 0, "damaged": 1, "blocked": 2}
        road_condition = road_conditions_map[road["road_condition"]]
        bridge_conditions_map = {"operational": 0, "damaged": 1, "closed": 2}
        bridge_condition = bridge_conditions_map[road["bridge_condition"]]

        # Weather
        rainfall_24h = max(0, seasonal["estimated_monthly_rainfall_mm"] / 30 * np.random.exponential(1.2))
        temp_celsius = np.random.uniform(18, 35)

        # Terrain
        avg_slope = (from_district["slope_risk"] + to_district["slope_risk"]) / 2 + np.random.normal(0, 5)
        avg_elevation = (from_district["elevation_m"] + to_district["elevation_m"]) / 2

        # Traffic
        congestion = np.random.choice([0, 1, 2, 3], p=[0.4, 0.3, 0.2, 0.1])

        # Flood/landslide risk
        flood_risk = np.clip(from_district["flood_susceptibility"] * 100 * seasonal["flood_multiplier"], 0, 100)
        landslide_prob = np.clip(from_district["landslide_susceptibility"] * seasonal["landslide_multiplier"], 0, 1)

        # Commodity
        commodity = random.choice(commodity_types)
        weight_kg = np.random.uniform(500, 15000)
        priority = priority_map[commodity]

        # Compute delay based on conditions
        base_speed = 48  # km/h on good road
        speed = base_speed
        speed *= (1 - road_condition * 0.3)  # Road condition penalty
        speed *= (1 - bridge_condition * 0.2)  # Bridge condition penalty
        speed *= max(0.3, 1 - rainfall_24h / 100)  # Rain penalty
        speed *= max(0.4, 1 - congestion * 0.2)  # Congestion penalty
        speed *= max(0.5, 1 - landslide_prob * 0.3)  # Landslide risk

        travel_hours = distance_km / max(5, speed)
        free_flow_hours = distance_km / 48
        delay_hours = max(0, travel_hours - free_flow_hours)
        delay_minutes = delay_hours * 60

        # Route safety score
        risk_score = (
            avg_slope * 0.15 +
            min(100, rainfall_24h / 80 * 100) * 0.20 +
            road_condition * 35 * 0.15 +
            congestion * 25 * 0.10 +
            flood_risk * 0.20 +
            landslide_prob * 100 * 0.20
        )
        safety_score = int(np.clip(100 - risk_score + np.random.normal(0, 3), 0, 100))

        # Route rank (1=best, 3=worst)
        route_rank = 1 if road["road_condition"] == "good" and rainfall_24h < 30 else 2 if rainfall_24h < 60 else 3

        data.append({
            "distance_km": round(distance_km, 1),
            "road_condition": road_condition,
            "bridge_condition": bridge_condition,
            "avg_slope_risk": round(np.clip(avg_slope, 0, 100), 1),
            "avg_elevation_m": round(avg_elevation, 0),
            "rainfall_24h_mm": round(rainfall_24h, 1),
            "temp_celsius": round(temp_celsius, 1),
            "congestion_level": congestion,
            "flood_risk_level": round(flood_risk, 1),
            "landslide_probability": round(landslide_prob, 3),
            "commodity_type": commodity,
            "weight_kg": round(weight_kg, 0),
            "priority": priority,
            "month": month,
            "delay_minutes": round(delay_minutes, 1),
            "safety_score": safety_score,
            "route_rank": route_rank,
        })

    return pd.DataFrame(data)


# ═══════════════════════════════════════════════════════════════════════════════
# Save generated data to disk
# ═══════════════════════════════════════════════════════════════════════════════

def generate_all_training_data(output_dir: str = "ml-service/app/engine/training_data"):
    """Generate and save all training datasets."""
    os.makedirs(output_dir, exist_ok=True)

    print("Generating Risk Scoring training data...")
    risk_df = generate_risk_training_data(n_samples=5000)
    risk_df.to_csv(f"{output_dir}/risk_training.csv", index=False)
    print(f"  -> {len(risk_df)} samples saved")

    print("Generating Disruption Prediction training data...")
    disruption_df = generate_disruption_training_data(n_samples=4000)
    disruption_df.to_csv(f"{output_dir}/disruption_training.csv", index=False)
    print(f"  -> {len(disruption_df)} samples saved")

    print("Generating Route Optimization training data...")
    route_df = generate_route_optimization_data(n_samples=3000)
    route_df.to_csv(f"{output_dir}/route_optimization.csv", index=False)
    print(f"  -> {len(route_df)} samples saved")

    print(f"\nAll training data saved to {output_dir}/")
    return risk_df, disruption_df, route_df


if __name__ == "__main__":
    generate_all_training_data()
