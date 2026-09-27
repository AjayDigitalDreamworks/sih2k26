"""
Disaster Digital Twin Simulation Engine for Raahi - v2.0
=========================================================
Enhanced in-memory What-If disaster scenario modelling for Northeast India.

Improvements over v1:
  - Probabilistic hydrology: stage-discharge model, backwater and flood extent
  - Multi-factor landslide model: slope x saturation x pore-pressure (infinite-slope Fs)
  - Cascading corridor failures (bridge failure -> downstream corridor severed)
  - Population-weighted triage urgency and humanitarian impact scoring
  - Per-district secondary / tertiary access routes (alternative connectivity graph)
  - Time-phased response plan (0-6h / 6-24h / 24-72h / 72h+)
  - BRO clearance with realistic equipment speed and shift constraints
  - Fuel / oxygen depletion with panic-demand surge multiplier
  - Medicine tracked as 5th commodity alongside O2, food, fuel, grains
  - Humanitarian cost estimation in Rs crore
  - Richer SITREP with severity tier labels
  - Two new scenario presets: Cyclone Mora analog, Cold Wave logistics freeze
  - Imphal West district + LP-07 Tupul Zone + BR-09 Ijai + BR-10 Tuivai added
  - 8 logistics vehicles (was 6), with cargo value in Rs lakh
  - 3rd Ro-Ro option: Silchar-Jiribam Barak River Barge
"""

import math
from typing import Dict, Any, List, Optional
from datetime import datetime

# ---------------------------------------------------------------------------
# Static Geospatial Data
# ---------------------------------------------------------------------------

NER_BRIDGES = [
    {"id": "BR-01", "name": "Saraighat Bridge (Guwahati)", "river": "Brahmaputra", "district": "kamrup", "deck_clearance_m": 2.2, "criticality": "high", "lat": 26.1555, "lng": 91.6396, "alternate_crossing": "Pandu Ghat Ro-Ro Ferry (3.5 km upstream)", "daily_truck_count": 4200},
    {"id": "BR-02", "name": "Kalia Bhomora Bridge (Tezpur)", "river": "Brahmaputra", "district": "sonitpur", "deck_clearance_m": 2.0, "criticality": "critical", "lat": 26.6528, "lng": 92.7926, "alternate_crossing": "None - NH-15 divergence via Golaghat adds 140 km", "daily_truck_count": 1800},
    {"id": "BR-03", "name": "Naranarayan Setu (Jogighopa)", "river": "Brahmaputra", "district": "goalpara", "deck_clearance_m": 2.5, "criticality": "high", "lat": 26.2310, "lng": 90.6160, "alternate_crossing": "Jogighopa Railway Bridge (freight only)", "daily_truck_count": 2600},
    {"id": "BR-04", "name": "Dhola-Sadiya Bridge (Lohit)", "river": "Lohit", "district": "tinsukia", "deck_clearance_m": 3.0, "criticality": "moderate", "lat": 27.7880, "lng": 95.6580, "alternate_crossing": "Dibrugarh-Saikhoa Ferry (seasonal)", "daily_truck_count": 600},
    {"id": "BR-05", "name": "Bogibeel Bridge (Dibrugarh)", "river": "Brahmaputra", "district": "dibrugarh", "deck_clearance_m": 2.8, "criticality": "high", "lat": 27.4632, "lng": 94.9174, "alternate_crossing": "Neamati-Majuli Ferry (not suitable for heavy cargo)", "daily_truck_count": 1100},
    {"id": "BR-06", "name": "Jatinga River Causeway", "river": "Jatinga", "district": "dima_hasao", "deck_clearance_m": 1.2, "criticality": "critical", "lat": 25.0000, "lng": 92.9500, "alternate_crossing": "None", "daily_truck_count": 850},
    {"id": "BR-07", "name": "Barak River Suspension Span", "river": "Barak", "district": "cachar", "deck_clearance_m": 1.5, "criticality": "critical", "lat": 24.8317, "lng": 92.7789, "alternate_crossing": "Jiribam ferry crossing (6h detour, limited capacity)", "daily_truck_count": 1350},
    {"id": "BR-08", "name": "Umiam Spillway Bridge", "river": "Umiam", "district": "east_khasi", "deck_clearance_m": 1.7, "criticality": "moderate", "lat": 25.6770, "lng": 91.9140, "alternate_crossing": "Shillong bypass road via Mawlai (30 min extra)", "daily_truck_count": 420},
    {"id": "BR-09", "name": "Ijai River Bridge (Imphal)", "river": "Ijai", "district": "imphal_west", "deck_clearance_m": 1.6, "criticality": "high", "lat": 24.8170, "lng": 93.9368, "alternate_crossing": "NH-37 detour via Bishnupur (2h extra)", "daily_truck_count": 780},
    {"id": "BR-10", "name": "Tuivai River Bridge (Aizawl foothills)", "river": "Tuivai", "district": "aizawl", "deck_clearance_m": 1.4, "criticality": "high", "lat": 23.7200, "lng": 92.6800, "alternate_crossing": "None - single connectivity point for Mizoram", "daily_truck_count": 540},
]

NER_MOUNTAIN_PASSES = [
    {"id": "LP-01", "name": "NH-6 Sonapur Tunnel & Sinking Zone", "highway": "NH-6", "state": "Meghalaya / Assam border", "district": "east_jaintia_cachar", "corridorKey": "kamrup-dima_hasao", "elevationM": 780, "slopeAngleDeg": 48, "soilType": "Weathered Shale & Fractured Sandstone", "saturationTriggerPct": 68, "porePressureCoeff": 0.42, "broTaskForce": "Project Pushpak (765 BRTF)", "broStrength": 320, "baseDebrisM3": 8500, "criticality": "catastrophic", "historySlides": 14, "description": "Primary lifeline connecting Guwahati to Barak Valley, Tripura & Mizoram."},
    {"id": "LP-02", "name": "NH-27 Jatinga / Haflong Hill Ghat", "highway": "NH-27", "state": "Assam (Barail Range)", "district": "dima_hasao", "corridorKey": "dima_hasao-cachar", "elevationM": 920, "slopeAngleDeg": 52, "soilType": "Unconsolidated Sedimentary Clay", "saturationTriggerPct": 62, "porePressureCoeff": 0.51, "broTaskForce": "Project Vartak (14 BRTF)", "broStrength": 280, "baseDebrisM3": 12000, "criticality": "critical", "historySlides": 22, "description": "Crucial East-West corridor traverse through Barail mountains."},
    {"id": "LP-03", "name": "NH-2 Kohima - Maram Landslide Zone", "highway": "NH-2", "state": "Nagaland / Manipur", "district": "dimapur", "corridorKey": "dimapur-cachar", "elevationM": 1440, "slopeAngleDeg": 45, "soilType": "Flysch Mudstone & Soil Creep", "saturationTriggerPct": 75, "porePressureCoeff": 0.37, "broTaskForce": "Project Sewak (15 BRTF)", "broStrength": 210, "baseDebrisM3": 6500, "criticality": "high", "historySlides": 9, "description": "Vital supply link for Imphal Valley."},
    {"id": "LP-04", "name": "NH-306 Silchar - Kolasib Ridge Incline", "highway": "NH-306", "state": "Assam / Mizoram border", "district": "cachar", "corridorKey": "cachar-aizawl", "elevationM": 610, "slopeAngleDeg": 40, "soilType": "Red Lateritic Soil & Bamboo Silt", "saturationTriggerPct": 70, "porePressureCoeff": 0.33, "broTaskForce": "Project Pushpak (23 BRTF)", "broStrength": 190, "baseDebrisM3": 5200, "criticality": "high", "historySlides": 11, "description": "Solitary heavy highway connecting Mizoram to rest of India."},
    {"id": "LP-05", "name": "Bhalukpong - Tawang Mountain Pass", "highway": "NH-13", "state": "Arunachal Pradesh", "district": "sonitpur", "corridorKey": "sonitpur-dima_hasao", "elevationM": 2150, "slopeAngleDeg": 60, "soilType": "Gneissic Scree & Boulder Talus", "saturationTriggerPct": 80, "porePressureCoeff": 0.28, "broTaskForce": "Project Vartak (42 BRTF)", "broStrength": 360, "baseDebrisM3": 9800, "criticality": "critical", "historySlides": 17, "description": "Strategic Himalayan mountain ascent."},
    {"id": "LP-06", "name": "Nongstoin - Rongjeng Escarpment", "highway": "NH-127B", "state": "Meghalaya (West Khasi)", "district": "east_khasi", "corridorKey": "kamrup-sonitpur", "elevationM": 1100, "slopeAngleDeg": 42, "soilType": "High Plasticity Kaolinitic Clay", "saturationTriggerPct": 72, "porePressureCoeff": 0.44, "broTaskForce": "Project Setu (Meghalaya PWD / BRO)", "broStrength": 150, "baseDebrisM3": 4400, "criticality": "moderate", "historySlides": 6, "description": "Mountain bypass through central Meghalaya plateau."},
    {"id": "LP-07", "name": "Imphal - Jiribam Tupul Zone", "highway": "NH-37", "state": "Manipur", "district": "imphal_west", "corridorKey": "imphal_west-cachar", "elevationM": 890, "slopeAngleDeg": 47, "soilType": "Decomposed Granite & Colluvial Fill", "saturationTriggerPct": 71, "porePressureCoeff": 0.39, "broTaskForce": "Project Bishenpur (BRO 753 BRTF)", "broStrength": 240, "baseDebrisM3": 7200, "criticality": "critical", "historySlides": 19, "description": "Only road link for Manipur valley goods transport. Tupul station sinking zone causes repeat closures."},
]

RELIEF_AIR_HUBS = [
    {"id": "AIR-01", "name": "Kumbhirgram IAF Airbase (Silchar)", "type": "IAF Airbase", "district": "cachar", "lat": 24.9124, "lng": 92.9786, "capacity": "Heavy Transport (C-130J, An-32, Mi-17)", "readiness": "ready", "sorties_per_day": 8},
    {"id": "AIR-02", "name": "Umroi Airport & Helipad (Shillong)", "type": "Regional Airstrip", "district": "east_khasi", "lat": 25.6827, "lng": 91.9659, "capacity": "Helicopters & ATR-72", "readiness": "standby", "sorties_per_day": 4},
    {"id": "AIR-03", "name": "Tezpur Air Force Station", "type": "IAF Tactical Base", "district": "sonitpur", "lat": 26.7082, "lng": 92.7841, "capacity": "Full Fleet Disaster Staging Hub", "readiness": "ready", "sorties_per_day": 12},
    {"id": "AIR-04", "name": "Lengpui Emergency Airfield (Aizawl)", "type": "Hill Runway", "district": "aizawl", "lat": 23.8406, "lng": 92.6196, "capacity": "Medium Airlift & Helis", "readiness": "ready", "sorties_per_day": 5},
    {"id": "AIR-05", "name": "Haflong Hill Helipad", "type": "Disaster Drop Zone", "district": "dima_hasao", "lat": 25.1686, "lng": 93.0175, "capacity": "Light / Medium Choppers (Dhruv, Cheetah)", "readiness": "active", "sorties_per_day": 6},
    {"id": "AIR-06", "name": "Imphal Airport (Civil-Military Shared)", "type": "Civil-Military Dual Use", "district": "imphal_west", "lat": 24.7600, "lng": 93.8967, "capacity": "Wide-body cargo & IAF transport", "readiness": "ready", "sorties_per_day": 10},
]

SCENARIO_PRESETS = [
    {"id": "brahmaputra_catastrophic_flood", "title": "Brahmaputra Major Basin Inundation (+2.6m)", "description": "Severe monsoon surge causing simultaneous overtopping of middle Brahmaputra bridges and arterial NH-27/NH-37 highway cutoffs.", "riverSurgeMeters": 2.6, "rainfallIntensityMm": 175.0, "soilSaturationPct": 72.0, "earthquakeMagnitude": 0.0, "dykeBreach": True, "severedCorridors": ["kamrup-sonitpur", "sonitpur-dima_hasao"], "triggeredLandslidePasses": ["LP-05"], "severity": "critical", "historicalAnalog": "Brahmaputra Flood Event, July 2020"},
    {"id": "barail_mountain_severance", "title": "Barail Range Mega-Landslide (NH-6 Collapse)", "description": "Continuous heavy downpour in Meghalaya and Dima Hasao triggering massive slope failures at Sonapur Tunnel and Jatinga, severing Barak Valley.", "riverSurgeMeters": 1.4, "rainfallIntensityMm": 220.0, "soilSaturationPct": 92.0, "earthquakeMagnitude": 0.0, "dykeBreach": False, "severedCorridors": ["kamrup-dima_hasao", "cachar-aizawl", "dima_hasao-cachar"], "triggeredLandslidePasses": ["LP-01", "LP-02", "LP-04"], "severity": "critical", "historicalAnalog": "Barail Landslide Series, August 2022"},
    {"id": "zone_v_seismic_deluge", "title": "Zone-V Seismic Shock (M6.4) + Monsoon Cloudburst", "description": "Simultaneous 6.4 Richter earthquake along Kopili Fault with torrential rain, triggering multiple catastrophic landslides across all hill tracts.", "riverSurgeMeters": 2.2, "rainfallIntensityMm": 260.0, "soilSaturationPct": 96.0, "earthquakeMagnitude": 6.4, "dykeBreach": True, "severedCorridors": ["kamrup-sonitpur", "kamrup-dima_hasao", "dima_hasao-cachar", "cachar-aizawl", "cachar-west_tripura"], "triggeredLandslidePasses": ["LP-01", "LP-02", "LP-03", "LP-04", "LP-05", "LP-06"], "severity": "catastrophic", "historicalAnalog": "Kopili Fault Earthquake Cluster, 1950 and 1988 analogue"},
    {"id": "flash_flood_cloudburst", "title": "Barak Basin Flash Flood Cloudburst (180mm/6h)", "description": "Sudden cloudburst inundating urban Silchar and Southern Assam connector corridors with swift water currents.", "riverSurgeMeters": 2.1, "rainfallIntensityMm": 180.0, "soilSaturationPct": 65.0, "earthquakeMagnitude": 0.0, "dykeBreach": False, "severedCorridors": ["dima_hasao-cachar", "cachar-west_tripura"], "triggeredLandslidePasses": ["LP-04"], "severity": "high", "historicalAnalog": "Silchar Urban Flood, June 2022"},
    {"id": "cyclone_mora_analog", "title": "Bay of Bengal Cyclone Landfall (Mora Analog)", "description": "Category-3 equivalent cyclone tracking north from Cox Bazar, driving 300mm rainfall over Tripura, Mizoram, and Cachar.", "riverSurgeMeters": 1.8, "rainfallIntensityMm": 295.0, "soilSaturationPct": 98.0, "earthquakeMagnitude": 0.0, "dykeBreach": True, "severedCorridors": ["cachar-west_tripura", "cachar-aizawl", "dima_hasao-cachar"], "triggeredLandslidePasses": ["LP-04", "LP-07"], "severity": "catastrophic", "historicalAnalog": "Cyclone Mora landfall, May 2017"},
    {"id": "winter_logistics_freeze", "title": "High-Altitude Cold Wave and Mountain Pass Snow Closure", "description": "Severe cold wave with heavy snowfall above 1500m blocking Tawang, Sela and Manipur passes; freezing rain disrupts NH-27 valley convoy movement.", "riverSurgeMeters": 0.0, "rainfallIntensityMm": 0.0, "soilSaturationPct": 15.0, "earthquakeMagnitude": 0.0, "dykeBreach": False, "severedCorridors": ["sonitpur-dima_hasao", "dimapur-cachar"], "triggeredLandslidePasses": ["LP-05"], "severity": "high", "historicalAnalog": "Sela Pass winter closures, January 2024"},
]

DISTRICT_SUPPLIES = {
    "cachar":       {"name": "Cachar (Silchar)",            "pop": 1736000, "oxygen_days": 5.0,  "food_days": 8.0,  "fuel_days": 4.5, "grains_days": 12.0, "medicine_days": 6.0},
    "dima_hasao":   {"name": "Dima Hasao (Haflong)",        "pop": 214000,  "oxygen_days": 3.0,  "food_days": 4.0,  "fuel_days": 3.0, "grains_days": 7.0,  "medicine_days": 3.5},
    "aizawl":       {"name": "Aizawl (Mizoram)",            "pop": 400000,  "oxygen_days": 6.0,  "food_days": 7.0,  "fuel_days": 5.0, "grains_days": 14.0, "medicine_days": 7.0},
    "sonitpur":     {"name": "Sonitpur (Tezpur)",           "pop": 1924000, "oxygen_days": 7.0,  "food_days": 10.0, "fuel_days": 6.0, "grains_days": 18.0, "medicine_days": 8.0},
    "kamrup":       {"name": "Kamrup (Guwahati Hub)",       "pop": 2500000, "oxygen_days": 15.0, "food_days": 20.0, "fuel_days": 14.0,"grains_days": 30.0, "medicine_days": 18.0},
    "east_khasi":   {"name": "East Khasi Hills (Shillong)", "pop": 825000,  "oxygen_days": 8.0,  "food_days": 9.0,  "fuel_days": 6.5, "grains_days": 15.0, "medicine_days": 9.0},
    "west_tripura": {"name": "West Tripura (Agartala)",     "pop": 918000,  "oxygen_days": 5.5,  "food_days": 6.5,  "fuel_days": 4.0, "grains_days": 11.0, "medicine_days": 6.0},
    "dimapur":      {"name": "Dimapur (Nagaland Hub)",      "pop": 378000,  "oxygen_days": 7.0,  "food_days": 8.0,  "fuel_days": 6.0, "grains_days": 14.0, "medicine_days": 7.5},
    "imphal_west":  {"name": "Imphal West (Manipur)",       "pop": 514000,  "oxygen_days": 4.5,  "food_days": 6.0,  "fuel_days": 3.5, "grains_days": 10.0, "medicine_days": 5.0},
}

DISTRICT_FEED_CORRIDORS: Dict[str, List[str]] = {
    "dima_hasao":   ["kamrup-dima_hasao", "sonitpur-dima_hasao"],
    "cachar":       ["kamrup-dima_hasao", "dima_hasao-cachar"],
    "aizawl":       ["cachar-aizawl"],
    "west_tripura": ["cachar-west_tripura"],
    "sonitpur":     ["kamrup-sonitpur"],
    "dimapur":      ["kamrup-sonitpur", "sonitpur-dima_hasao"],
    "imphal_west":  ["dimapur-cachar", "imphal_west-cachar"],
    "east_khasi":   ["kamrup-sonitpur"],
}

SIMULATED_FLEET = [
    {"id": "AS-01-GC-4412", "vehicleType": "heavy_multi_axle",  "cargo": "Medical Oxygen Cylinders",       "currentRoute": "kamrup-cachar",      "from": "kamrup",     "to": "cachar",      "lat": 25.82, "lng": 92.45, "cargoValueLakh": 28},
    {"id": "AS-11-BC-8921", "vehicleType": "hazardous_tanker",   "cargo": "High-Speed Diesel",              "currentRoute": "kamrup-dima_hasao",  "from": "kamrup",     "to": "dima_hasao",  "lat": 25.65, "lng": 92.75, "cargoValueLakh": 14},
    {"id": "TR-01-X-3301",  "vehicleType": "medium_commercial",  "cargo": "Infant Formula and RUTF",        "currentRoute": "cachar-west_tripura","from": "cachar",     "to": "west_tripura","lat": 24.62, "lng": 92.20, "cargoValueLakh": 9},
    {"id": "MZ-01-T-7740",  "vehicleType": "heavy_multi_axle",   "cargo": "Essential Grain (Rice/Wheat)",   "currentRoute": "cachar-aizawl",      "from": "cachar",     "to": "aizawl",      "lat": 24.45, "lng": 92.72, "cargoValueLakh": 18},
    {"id": "AS-03-D-1199",  "vehicleType": "light_commercial",   "cargo": "IV Fluids and Antibiotics",      "currentRoute": "kamrup-sonitpur",    "from": "kamrup",     "to": "sonitpur",    "lat": 26.35, "lng": 92.12, "cargoValueLakh": 12},
    {"id": "NL-07-A-5520",  "vehicleType": "heavy_multi_axle",   "cargo": "Petroleum (HSD)",                "currentRoute": "dimapur-cachar",     "from": "dimapur",    "to": "cachar",      "lat": 25.70, "lng": 93.30, "cargoValueLakh": 22},
    {"id": "MN-02-J-8812",  "vehicleType": "medium_commercial",  "cargo": "Dialysis Consumables",           "currentRoute": "imphal_west-cachar", "from": "imphal_west","to": "cachar",      "lat": 24.80, "lng": 93.40, "cargoValueLakh": 35},
    {"id": "AS-15-K-3341",  "vehicleType": "heavy_multi_axle",   "cargo": "Steel and Construction Materials","currentRoute": "sonitpur-dima_hasao","from": "sonitpur",   "to": "dima_hasao",  "lat": 26.10, "lng": 93.10, "cargoValueLakh": 8},
]


# ---------------------------------------------------------------------------
# Physics and Helper Utilities
# ---------------------------------------------------------------------------

def _slope_failure_probability(slope_deg: float, sat_pct: float, pore_coeff: float, rainfall_mm: float, eq_mag: float) -> float:
    """Simplified infinite-slope factor-of-safety (Fs) model -> failure probability [0-1]."""
    phi_rad = math.radians(slope_deg - 5)
    beta_rad = math.radians(slope_deg)
    u_factor = pore_coeff * (sat_pct / 100.0)
    k_s = 0.0 if eq_mag < 5.0 else min(0.35, (eq_mag - 4.5) * 0.07)
    rain_loss = min(0.4, (rainfall_mm - 80) / 500) if rainfall_mm > 80 else 0.0
    cos_b = math.cos(beta_rad)
    sin_b = math.sin(beta_rad)
    if sin_b < 0.01:
        return 0.0
    fs = max(0.0, (math.tan(phi_rad) * (cos_b ** 2 - u_factor) - rain_loss) / (sin_b * cos_b + k_s * cos_b ** 2))
    prob = 1.0 / (1.0 + math.exp(4.5 * (fs - 1.0)))
    return round(min(1.0, max(0.0, prob)), 3)


def _river_stage_discharge(surge_m: float, dyke_breach: bool, rainfall_mm: float) -> Dict[str, Any]:
    """Approximate stage-discharge and backwater metrics."""
    effective_surge = surge_m + (0.6 if dyke_breach else 0.0) + min(0.4, rainfall_mm / 800)
    flood_extent_km2 = round(max(0, effective_surge ** 1.8 * 42), 1)
    velocity_ms = round(min(4.5, 0.8 + effective_surge * 0.6), 2)
    return {
        "effective_surge_m": round(effective_surge, 2),
        "flood_extent_km2": flood_extent_km2,
        "flow_velocity_ms": velocity_ms,
        "debris_transport_risk": "extreme" if velocity_ms > 3.5 else "high" if velocity_ms > 2.5 else "moderate",
    }


def _bro_clearance_eta(debris_m3: int, bro_strength: int, active_count: int) -> Dict[str, Any]:
    """Realistic BRO clearance estimate with competition penalty and night-ops factor."""
    equipment_units = max(2, min(10, debris_m3 // 1800 + 1))
    equipment_units = max(1, equipment_units - max(0, active_count - 1))
    effective_rate = equipment_units * 110 * 0.60
    raw_hours = debris_m3 / effective_rate if effective_rate > 0 else 999
    total_hours = raw_hours * 1.15
    return {
        "clearingEtaHours": round(total_hours, 1),
        "clearingEtaDays": round(total_hours / 24, 1),
        "equipmentRequired": f"{equipment_units}x Hydraulic Excavators, {max(1, equipment_units - 1)}x Heavy Dozers, 1x Rock Breaker Unit",
        "equipmentUnits": equipment_units,
    }


def _humanitarian_cost_crore(isolated_pop: int, days_isolated: float, stranded_count: int) -> float:
    """Rough humanitarian plus economic cost estimate in Rs crore."""
    relief_cost = (isolated_pop * 450 * days_isolated) / 1e7
    stranding_cost = stranded_count * 2.5
    infra_repair = max(0, days_isolated * 18)
    return round(relief_cost + stranding_cost + infra_repair, 1)


def _triage_urgency(ox_rem: float, fuel_rem: float, food_rem: float, med_rem: float, pop: int) -> str:
    """Population-weighted urgency tier P1_CRITICAL to P4_LOW."""
    score = 0
    if ox_rem <= 1.5:    score += 40
    elif ox_rem <= 3.0:  score += 20
    if fuel_rem <= 1.0:  score += 30
    elif fuel_rem <= 2.5: score += 15
    if med_rem <= 2.0:   score += 25
    elif med_rem <= 4.0: score += 10
    if food_rem <= 2.0:  score += 15
    pop_factor = min(1.5, 1.0 + (pop / 2_000_000) * 0.5)
    score = score * pop_factor
    if score >= 70: return "P1_CRITICAL"
    if score >= 40: return "P2_HIGH"
    if score >= 15: return "P3_MEDIUM"
    return "P4_LOW"


def _time_phased_response(
    active_landslides: List,
    stranded_vehicles: List,
    isolated_districts: List,
    drone_zones: List,
    roro: List,
    max_clearing_h: float,
) -> Dict[str, List[str]]:
    """Generate a prioritised time-phased response action plan."""
    p0 = [
        "Activate State Emergency Operations Centre (SEOC) and NDRF Coordination Cell",
        "Issue RED ALERT on all severed highway corridors via NIC VHF network",
        "Mobilise NDRF teams from Guwahati and Kolkata standby nodes",
    ]
    p6 = [
        "BRO heavy clearing teams begin debris removal at all collapsed passes",
        "IWAI issue NW-2 Ro-Ro mobilisation orders to Pandu Port Commandant",
    ]
    p24 = [
        "IAF C-130J and An-32 sorties commence from Tezpur AFS",
        "NDRF swift-water rescue deployed to all submerged bridge approach zones",
    ]
    p72 = [
        "Establish temporary Bailey bridge or pontoon crossing at submerged critical spans",
        "Relief camps operationalised for displaced population",
    ]
    for v in stranded_vehicles:
        p0.append(f"Divert {v['id']} (cargo: {v['cargo']}) to Nagaon Logistics Depot - urgent")
    for d in isolated_districts:
        p0.append(f"Activate humanitarian airlift for {d['name']} (pop: {d['population']:,})")
    for dz in drone_zones:
        p6.append(f"Deploy drone medical delivery to {dz['location']} - {dz['payload']}")
    for rr in roro:
        p6.append(f"Commission {rr['service']} - capacity: {rr['capacity']} per voyage")
    for lp in active_landslides:
        p24.append(f"BRO {lp['broTaskForce']}: target clearance {lp['clearingEtaHours']}h at {lp['name']}")
    if max_clearing_h > 48:
        p24.append("Request additional heavy equipment from MoRTH National Pool")
        p72.append("Geo-technical survey and slope stabilisation works post-clearance (GSI)")
    return {"0_to_6h": p0, "6_to_24h": p6, "24_to_72h": p24, "beyond_72h": p72}


# ---------------------------------------------------------------------------
# Main Simulation Class
# ---------------------------------------------------------------------------

class DisasterDigitalTwin:
    """v2.0 - Enhanced simulation engine for in-memory what-if scenario testing."""

    @staticmethod
    def get_presets() -> List[Dict[str, Any]]:
        return SCENARIO_PRESETS

    @staticmethod
    def get_mountain_passes() -> List[Dict[str, Any]]:
        return NER_MOUNTAIN_PASSES

    @staticmethod
    def run_simulation(
        river_surge_m: float = 2.0,
        rainfall_mm: float = 120.0,
        soil_saturation_pct: float = 65.0,
        earthquake_magnitude: float = 0.0,
        dyke_breach: bool = False,
        severed_corridors: Optional[List[str]] = None,
        triggered_landslide_passes: Optional[List[str]] = None,
        scenario_name: str = "Custom Simulation",
    ) -> Dict[str, Any]:
        """
        Executes a rapid in-memory stress test across:
        1. Hydrological: Stage-discharge surge, backwater effects, bridge overtopping.
        2. Geotechnical: Probabilistic landslide failure via infinite-slope Fs model.
        3. Cascade: Bridge failure -> corridor severance propagation.
        4. Logistics: Multi-district isolation, commodity depletion with panic-demand surge.
        5. Triage: Population-weighted urgency scoring.
        6. Response: Time-phased action plan and humanitarian cost estimate.
        """
        severed: set = set(severed_corridors or [])
        manual_passes: set = set(triggered_landslide_passes or [])
        sim_timestamp = datetime.utcnow().isoformat() + "Z"

        # 1. HYDROLOGY
        hydro = _river_stage_discharge(river_surge_m, dyke_breach, rainfall_mm)
        effective_surge = hydro["effective_surge_m"]
        submerged_bridges: List[Dict] = []
        threatened_bridges: List[Dict] = []
        safe_bridges: List[Dict] = []

        for b in NER_BRIDGES:
            deck = b["deck_clearance_m"]
            cl = round(deck - effective_surge, 2)
            status = "submerged" if cl <= 0 else "threatened" if cl < 0.4 else "operational"
            bi = {
                **b,
                "deckClearanceM": deck,
                "surgeLevelM": effective_surge,
                "effectiveClearanceM": cl,
                "status": status,
                "alternateCrossing": b.get("alternate_crossing", "None"),
                "dailyTruckCount": b.get("daily_truck_count", 0),
                "closureCostLakhPerDay": round(b.get("daily_truck_count", 0) * 0.12, 1),
            }
            if cl <= 0:
                submerged_bridges.append(bi)
            elif cl < 0.4:
                threatened_bridges.append(bi)
            else:
                safe_bridges.append(bi)

        # 2. GEOTECHNICAL
        active_landslides: List[Dict] = []
        threatened_passes: List[Dict] = []
        stable_passes: List[Dict] = []
        total_debris_m3 = 0
        max_clearing_hours = 0.0

        for lp in NER_MOUNTAIN_PASSES:
            is_manual = lp["id"] in manual_passes
            fp = _slope_failure_probability(
                lp["slopeAngleDeg"], soil_saturation_pct,
                lp.get("porePressureCoeff", 0.35), rainfall_mm, earthquake_magnitude,
            )
            is_active = is_manual or fp >= 0.55
            is_threatened = not is_active and fp >= 0.25

            mult = 1.0
            if earthquake_magnitude >= 5.0:
                mult += (earthquake_magnitude - 4.5) * 0.85
            if soil_saturation_pct > 80:
                mult += ((soil_saturation_pct - 80) / 20.0) * 0.65
            if rainfall_mm > 150:
                mult += ((rainfall_mm - 150) / 100.0) * 0.55
            mult += lp.get("historySlides", 0) * 0.008

            debris_m3 = (
                int(lp["baseDebrisM3"] * mult) if is_active
                else (int(lp["baseDebrisM3"] * 0.15) if is_threatened else 0)
            )
            bro = _bro_clearance_eta(debris_m3, lp.get("broStrength", 200), len(active_landslides))

            triggers = []
            if earthquake_magnitude >= 5.0 and soil_saturation_pct >= lp["saturationTriggerPct"]:
                triggers.append("Seismic liquefaction and high pore-pressure")
            elif earthquake_magnitude >= 5.0:
                triggers.append(f"Seismic shock M{earthquake_magnitude}")
            if soil_saturation_pct >= lp["saturationTriggerPct"]:
                triggers.append("Soil saturation exceeded trigger threshold")
            if rainfall_mm >= 170 and lp["slopeAngleDeg"] >= 45:
                triggers.append("Torrential rainfall on steep incline")
            if is_manual:
                triggers.append("Operator manual trigger")
            if not triggers:
                triggers.append("Elevated failure probability (pre-saturation risk)")

            lr = {
                "id": lp["id"],
                "name": lp["name"],
                "highway": lp["highway"],
                "state": lp["state"],
                "district": lp["district"],
                "elevationM": lp["elevationM"],
                "slopeAngleDeg": lp["slopeAngleDeg"],
                "soilType": lp["soilType"],
                "broTaskForce": lp["broTaskForce"],
                "broStrength": lp.get("broStrength", 0),
                "corridorKey": lp.get("corridorKey", ""),
                "failureProbability": fp,
                "status": "collapsed" if is_active else "high_risk" if is_threatened else "stable",
                "debrisVolumeM3": debris_m3,
                "clearingEtaHours": bro["clearingEtaHours"],
                "clearingEtaDays": bro["clearingEtaDays"],
                "equipmentRequired": bro["equipmentRequired"],
                "triggerCause": " + ".join(triggers),
                "historicalEvents": lp.get("historySlides", 0),
                "recommendedAction": (
                    "IMMEDIATE road closure and BRO deployment. Activate Ro-Ro / air alternate."
                    if is_active else
                    "Advisory: Pre-position BRO equipment. Restrict overloaded vehicles."
                    if is_threatened else
                    "Monitor - issue cautionary speed restriction for heavy vehicles."
                ),
            }

            if is_active:
                active_landslides.append(lr)
                total_debris_m3 += debris_m3
                if bro["clearingEtaHours"] > max_clearing_hours:
                    max_clearing_hours = bro["clearingEtaHours"]
                if lp.get("corridorKey"):
                    severed.add(lp["corridorKey"])
            elif is_threatened:
                threatened_passes.append(lr)
            else:
                stable_passes.append(lr)

        # 3. CASCADE - corridor severance from bridge failures
        auto_cutoffs: set = set(severed)
        bridge_caused_cutoffs: List[str] = []
        cascade_map = {
            "kamrup":      ["kamrup-sonitpur"],
            "sonitpur":    ["sonitpur-dima_hasao", "kamrup-sonitpur"],
            "dima_hasao":  ["kamrup-dima_hasao", "dima_hasao-cachar"],
            "cachar":      ["cachar-aizawl", "cachar-west_tripura"],
            "imphal_west": ["imphal_west-cachar", "dimapur-cachar"],
            "aizawl":      ["cachar-aizawl"],
        }
        for sb in submerged_bridges:
            for c in cascade_map.get(sb["district"], []):
                if c not in auto_cutoffs:
                    auto_cutoffs.add(c)
                    bridge_caused_cutoffs.append(c)

        # 4. DISTRICT ISOLATION AND SUPPLY DEPLETION
        districts_impact: Dict[str, Any] = {}
        critical_shortage_districts: List[str] = []
        total_isolated_pop = 0
        base_dep = 1.0 + (rainfall_mm / 100.0) * 0.30 + len(active_landslides) * 0.12
        panic_surge = min(1.6, 1.0 + len(auto_cutoffs) * 0.08)

        for d_id, stock in DISTRICT_SUPPLIES.items():
            feeds = DISTRICT_FEED_CORRIDORS.get(d_id, [])
            sev_feeds = [c for c in feeds if c in auto_cutoffs]
            is_iso = len(sev_feeds) == len(feeds) and len(feeds) > 0
            is_part = len(sev_feeds) > 0 and not is_iso
            br = base_dep * panic_surge if is_iso else (base_dep * 1.2 if is_part else 1.0)

            ox   = max(0.2, round(stock["oxygen_days"]   / br, 1))
            food = max(0.5, round(stock["food_days"]     / br, 1))
            fuel = max(0.2, round(stock["fuel_days"]     / br, 1))
            grain= max(1.0, round(stock["grains_days"]   / br, 1))
            med  = max(0.3, round(stock["medicine_days"] / br, 1))

            alarm = (
                "red"    if (ox <= 2.5 or fuel <= 2.0 or med <= 2.0) else
                "orange" if (ox <= 4.0 or food <= 4.0) else
                "green"
            )
            urgency = _triage_urgency(ox, fuel, food, med, stock["pop"])
            dr = {
                "id": d_id,
                "name": stock["name"],
                "status": "isolated" if is_iso else "partial_access" if is_part else "operational",
                "population": stock["pop"],
                "severedFeedCorridors": sev_feeds,
                "burnRateMultiplier": round(br, 2),
                "stockDaysRemaining": {
                    "medicalOxygen":   ox,
                    "infantFood":      food,
                    "petroleumFuel":   fuel,
                    "essentialGrains": grain,
                    "medicine":        med,
                },
                "alarm": alarm,
                "triageUrgency": urgency,
            }
            districts_impact[d_id] = dr
            if alarm == "red":
                critical_shortage_districts.append(stock["name"])
            if is_iso:
                total_isolated_pop += stock["pop"]

        # 5. FLEET STRANDING
        stranded_vehicles: List[Dict] = []
        rerouted_vehicles: List[Dict] = []
        total_stranded_value = 0

        for v in SIMULATED_FLEET:
            is_sev = v["currentRoute"] in auto_cutoffs
            reason = "Bridge Inundation and Road Flooding"
            for lp in active_landslides:
                if lp.get("corridorKey") == v["currentRoute"]:
                    reason = f"Landslide Collapse: {lp['name']}"
                    break
            if is_sev:
                priority = "P1" if any(kw in v["cargo"].lower() for kw in ("oxygen", "dialysis", "fluids")) else "P2"
                stranded_vehicles.append({
                    **v,
                    "impact": f"Route Severed - {reason}",
                    "urgencyPriority": priority,
                    "actionRequired": "Emergency diversion to nearest logistics hub or IWAI Ro-Ro terminal.",
                    "recommendedHoldingPoint": "Nagaon NH Logistics Depot (KM-120) or Guwahati Pandu Port IWT Terminal",
                    "alternateAction": "Activate IWAI NW-2 Ro-Ro waterway shuttle for heavy cargo bypass",
                })
                total_stranded_value += v.get("cargoValueLakh", 0)
            else:
                rerouted_vehicles.append({
                    **v,
                    "impact": "Route Clear - Cautionary Advisory Issued",
                    "advisory": "Reduced speed. BRO escort recommended through threatened sections.",
                })

        # 6. STRATEGIC RELIEF
        active_roro_bypass: List[Dict] = []
        if "kamrup-sonitpur" in auto_cutoffs or "sonitpur-dima_hasao" in auto_cutoffs:
            active_roro_bypass.append({"service": "IWAI Pandu - Silghat Ro-Ro", "waterway": "National Waterway 2 (Brahmaputra)", "terminalA": "Pandu Multi-Modal Port, Guwahati", "terminalB": "Silghat IWT Terminal, Nagaon", "capacity": "20 Heavy Commercial Vehicles / Voyage", "transitTime": "3h 45m", "dailyCapacityVehicles": 80, "status": "OPERATIONAL - READY FOR MOBILIZATION"})
        if "cachar-west_tripura" in auto_cutoffs or "cachar-aizawl" in auto_cutoffs:
            active_roro_bypass.append({"service": "IWAI Dhubri - Jogighopa Ro-Ro Link", "waterway": "National Waterway 2 (Lower Assam)", "terminalA": "Dhubri River Terminal", "terminalB": "Jogighopa Multi-Modal Logistics Park", "capacity": "16 Heavy Trucks / Voyage", "transitTime": "2h 10m", "dailyCapacityVehicles": 60, "status": "OPERATIONAL - READY FOR MOBILIZATION"})
        if "dima_hasao-cachar" in auto_cutoffs:
            active_roro_bypass.append({"service": "Silchar - Jiribam River Barge (Emergency)", "waterway": "Barak River (inland stretch)", "terminalA": "Silchar River Ghat", "terminalB": "Jiribam IWT Point", "capacity": "8 Medium Trucks / Voyage", "transitTime": "5h 30m", "dailyCapacityVehicles": 24, "status": "STANDBY - REQUIRES 6H MOBILIZATION"})

        drone_drop_zones: List[Dict] = []
        drone_map = {
            "dima_hasao":  {"location": "Haflong Civil Hospital Helipad Ground",   "district": "Dima Hasao",    "payload": "High-altitude Blood Units and Snake Antivenom",   "droneModel": "Heavy-Lift VTOL (30kg)",                     "flightDistanceKm": 68,  "flightTimeMin": 42, "sortiesPerDay": 6},
            "cachar":      {"location": "Silchar Medical College and Hospital",     "district": "Cachar",        "payload": "Dialysis Fluids and Critical Antibiotics",         "droneModel": "Long-Range Hybrid VTOL (25kg)",               "flightDistanceKm": 84,  "flightTimeMin": 54, "sortiesPerDay": 4},
            "aizawl":      {"location": "Kolasib District Civil Hospital",          "district": "Aizawl border", "payload": "Emergency Insulin and Surgical Kits",              "droneModel": "Long-Range Hybrid VTOL (25kg)",               "flightDistanceKm": 52,  "flightTimeMin": 36, "sortiesPerDay": 5},
            "imphal_west": {"location": "RIMS Imphal Helipad",                      "district": "Imphal West",   "payload": "Blood Plasma, Ventilator Parts and Dialysis Kits", "droneModel": "Heavy-Lift VTOL (30kg) via Tezpur relay",     "flightDistanceKm": 120, "flightTimeMin": 78, "sortiesPerDay": 3},
        }
        for d_id, d_info in districts_impact.items():
            if d_info["status"] == "isolated" and d_id in drone_map:
                drone_drop_zones.append({**drone_map[d_id], "triageUrgency": d_info["triageUrgency"]})

        days_iso_est = round(max_clearing_hours / 24, 1) if max_clearing_hours > 0 else 1.5
        humanitarian_cost = _humanitarian_cost_crore(total_isolated_pop, days_iso_est, len(stranded_vehicles))
        isolated_list = [d for d in districts_impact.values() if d["status"] == "isolated"]
        response_plan = _time_phased_response(
            active_landslides, stranded_vehicles, isolated_list,
            drone_drop_zones, active_roro_bypass, max_clearing_hours,
        )

        # 7. SITREP
        def st(v, w, c):
            return "[CRITICAL]" if v >= c else "[HIGH]" if v >= w else "[NORMAL]"

        ls_lines = "\n".join([
            f"  [COLLAPSED] {lp['name']} ({lp['highway']})\n"
            f"     Debris: {lp['debrisVolumeM3']:,} m3 | ETA: {lp['clearingEtaHours']}h | BRO: {lp['broTaskForce']}\n"
            f"     Failure Prob: {lp['failureProbability']:.0%} | Cause: {lp['triggerCause']}"
            for lp in active_landslides
        ]) or "  No active collapses at current parameters."

        br_lines = "\n".join([
            f"  [SUBMERGED] {b['name']} - Alt: {b['alternateCrossing']} - Cost: Rs {b['closureCostLakhPerDay']} lakh/day"
            for b in submerged_bridges
        ]) or "  No bridges submerged."

        dist_lines = "\n".join([
            f"  [{d['alarm'].upper()}] {d['name']} [{d['triageUrgency']}]"
            f" O2: {d['stockDaysRemaining']['medicalOxygen']}d | Fuel: {d['stockDaysRemaining']['petroleumFuel']}d"
            f" | Food: {d['stockDaysRemaining']['infantFood']}d | Med: {d['stockDaysRemaining']['medicine']}d"
            for d in districts_impact.values() if d["alarm"] != "green"
        ]) or "  All district stocks within safe range."

        veh_lines = "\n".join([
            f"  [{v.get('urgencyPriority','P2')}] {v['id']} - {v['cargo']} ({v['from']} -> {v['to']}) Rs {v.get('cargoValueLakh',0)} lakh"
            for v in stranded_vehicles
        ]) or "  No vehicles currently stranded."

        sitrep = f"""================================================================================
DISASTER DIGITAL TWIN v2.0 - EXECUTIVE SITUATION REPORT (SITREP)
================================================================================
Generated : {sim_timestamp}
Scenario  : {scenario_name}

--- ENVIRONMENTAL STATE ---
  River Surge    : +{effective_surge}m  {st(effective_surge, 1.5, 2.2)}
  24h Rainfall   : {rainfall_mm} mm  {st(rainfall_mm, 100, 200)}
  Soil Saturation: {soil_saturation_pct}%  {st(soil_saturation_pct, 60, 85)}
  Seismic Shock  : M{earthquake_magnitude}  {st(earthquake_magnitude, 4.5, 6.0)}
  Dyke Breach    : {'YES' if dyke_breach else 'NO'}
  Flood Extent   : ~{hydro['flood_extent_km2']} km2  |  Flow Velocity: {hydro['flow_velocity_ms']} m/s
  Debris Transport Risk: {hydro['debris_transport_risk'].upper()}

--- GEOTECHNICAL HAZARDS  {st(len(active_landslides), 2, 4)} ---
  Active Collapses: {len(active_landslides)} passes  |  Threatened: {len(threatened_passes)}
  Total Debris   : {total_debris_m3:,} m3  |  Max BRO Clearance: {round(max_clearing_hours, 1)}h ({round(max_clearing_hours/24, 1)} days)
{ls_lines}

--- BRIDGE AND WATERWAY STATUS  {st(len(submerged_bridges), 1, 3)} ---
  Submerged: {len(submerged_bridges)}  |  Threatened: {len(threatened_bridges)}
  Severed Corridors: {len(auto_cutoffs)}  {st(len(auto_cutoffs), 2, 4)}
{br_lines}
  Severed Links: {', '.join(sorted(auto_cutoffs)) if auto_cutoffs else 'None'}

--- SUPPLY CHAIN AND DISTRICTS  {st(len(isolated_list), 1, 3)} ---
  Isolated Districts: {len(isolated_list)}  |  Affected Population: {total_isolated_pop:,}
  Critical Shortages: {', '.join(critical_shortage_districts) if critical_shortage_districts else 'None'}
{dist_lines}

--- FLEET AND LOGISTICS  {st(len(stranded_vehicles), 2, 4)} ---
  Stranded Vehicles : {len(stranded_vehicles)}  |  Cargo Value: Rs {total_stranded_value} lakh
  Estimated Humanitarian Cost: Rs {humanitarian_cost} crore
{veh_lines}

--- TACTICAL RELIEF ASSETS ---
  Ro-Ro Waterways : {len(active_roro_bypass)} activated
  Drone Drop Zones: {len(drone_drop_zones)} active
  IAF Air Hubs    : {len(RELIEF_AIR_HUBS)} staging bases (Tezpur, Kumbhirgram, Imphal...)

--- IMMEDIATE ACTIONS (0-6h) ---
{chr(10).join(['  * ' + a for a in response_plan['0_to_6h'][:6]])}
================================================================================
"""

        return {
            "scenarioName":  scenario_name,
            "simulatedAt":   sim_timestamp,
            "engineVersion": "2.0",
            "inputs": {
                "riverSurgeMeters":         river_surge_m,
                "rainfallIntensityMm":      rainfall_mm,
                "soilSaturationPct":        soil_saturation_pct,
                "earthquakeMagnitude":      earthquake_magnitude,
                "dykeBreach":               dyke_breach,
                "severedCorridors":         list(auto_cutoffs),
                "triggeredLandslidePasses": list(manual_passes),
            },
            "hydrology": hydro,
            "metrics": {
                "submergedBridgesCount":       len(submerged_bridges),
                "threatenedBridgesCount":      len(threatened_bridges),
                "activeLandslidesCount":       len(active_landslides),
                "threatenedPassesCount":       len(threatened_passes),
                "totalDebrisVolumeM3":         total_debris_m3,
                "maxClearingHours":            round(max_clearing_hours, 1),
                "maxClearingDays":             round(max_clearing_hours / 24, 1),
                "isolatedDistrictsCount":      len(isolated_list),
                "totalIsolatedPopulation":     total_isolated_pop,
                "criticalAlarmDistrictsCount": len(critical_shortage_districts),
                "strandedVehiclesCount":       len(stranded_vehicles),
                "strandedCargoValueLakh":      total_stranded_value,
                "severedCorridorsCount":       len(auto_cutoffs),
                "bridgeCausedCutoffs":         bridge_caused_cutoffs,
                "humanitarianCostCrore":       humanitarian_cost,
                "activeRoroCount":             len(active_roro_bypass),
                "droneDropZoneCount":          len(drone_drop_zones),
            },
            "submergedBridges":          submerged_bridges,
            "threatenedBridges":         threatened_bridges,
            "safeBridges":               safe_bridges,
            "activeLandslides":          active_landslides,
            "threatenedPasses":          threatened_passes,
            "stablePasses":              stable_passes,
            "districtsImpact":           districts_impact,
            "criticalShortageDistricts": critical_shortage_districts,
            "strandedVehicles":          stranded_vehicles,
            "reroutedVehicles":          rerouted_vehicles,
            "activeRoroBypass":          active_roro_bypass,
            "droneDropZones":            drone_drop_zones,
            "reliefAirHubs":             RELIEF_AIR_HUBS,
            "responsePlan":              response_plan,
            "executiveSitrep":           sitrep,
        }
