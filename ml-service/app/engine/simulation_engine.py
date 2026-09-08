"""
Disaster Digital Twin Simulation Engine for Raahi.

Provides comprehensive in-memory "What-If" disaster scenario modeling:
- River gauge surge & bridge inundation modeling
- Landslide & slope instability modeling across Northeast India mountain passes
- Soil saturation & seismic shock (earthquake) triggers
- Multi-district supply chain isolation & stockout forecasting
- Active fleet stranding impact & emergency diversion planning
- Relief staging, Drone drop corridors & BRO (Border Roads Organisation) clearance ops
- Automated Situation Report (SITREP) synthesis
"""

from typing import Dict, Any, List, Optional
from datetime import datetime

# Regional bridge elevations and river crossing data
NER_BRIDGES = [
    {"id": "BR-01", "name": "Saraighat Bridge (Guwahati)", "river": "Brahmaputra", "district": "kamrup", "deck_clearance_m": 2.2, "criticality": "high"},
    {"id": "BR-02", "name": "Kalia Bhomora Bridge (Tezpur)", "river": "Brahmaputra", "district": "sonitpur", "deck_clearance_m": 2.0, "criticality": "critical"},
    {"id": "BR-03", "name": "Naranarayan Setu (Jogighopa)", "river": "Brahmaputra", "district": "goalpara", "deck_clearance_m": 2.5, "criticality": "high"},
    {"id": "BR-04", "name": "Dhola-Sadiya Bridge (Lohit)", "river": "Lohit", "district": "tinsukia", "deck_clearance_m": 3.0, "criticality": "moderate"},
    {"id": "BR-05", "name": "Bogibeel Bridge (Dibrugarh)", "river": "Brahmaputra", "district": "dibrugarh", "deck_clearance_m": 2.8, "criticality": "high"},
    {"id": "BR-06", "name": "Jatinga River Causeway", "river": "Jatinga", "district": "dima_hasao", "deck_clearance_m": 1.2, "criticality": "critical"},
    {"id": "BR-07", "name": "Barak River Suspension Span", "river": "Barak", "district": "cachar", "deck_clearance_m": 1.5, "criticality": "critical"},
    {"id": "BR-08", "name": "Umiam Spillway Bridge", "river": "Umiam", "district": "east_khasi", "deck_clearance_m": 1.7, "criticality": "moderate"},
]

# Vulnerable Mountain Passes & Landslide Sinking Corridors in Northeast India
NER_MOUNTAIN_PASSES = [
    {
        "id": "LP-01",
        "name": "NH-6 Sonapur Tunnel & Sinking Zone",
        "highway": "NH-6",
        "state": "Meghalaya / Assam border",
        "district": "east_jaintia_cachar",
        "corridorKey": "kamrup-dima_hasao",
        "elevationM": 780,
        "slopeAngleDeg": 48,
        "soilType": "Weathered Shale & Fractured Sandstone",
        "saturationTriggerPct": 68,
        "broTaskForce": "Project Pushpak (765 BRTF)",
        "baseDebrisM3": 8500,
        "criticality": "catastrophic",
        "description": "Primary lifeline connecting Guwahati to Barak Valley, Tripura & Mizoram. Chronic monsoon mudslides bury tunnel portal."
    },
    {
        "id": "LP-02",
        "name": "NH-27 Jatinga / Haflong Hill Ghat",
        "highway": "NH-27",
        "state": "Assam (Barail Range)",
        "district": "dima_hasao",
        "corridorKey": "dima_hasao-cachar",
        "elevationM": 920,
        "slopeAngleDeg": 52,
        "soilType": "Unconsolidated Sedimentary Clay",
        "saturationTriggerPct": 62,
        "broTaskForce": "Project Vartak (14 BRTF)",
        "baseDebrisM3": 12000,
        "criticality": "critical",
        "description": "Crucial East-West corridor traverse through Barail mountains. Severe slope subsidence cuts Southern Assam."
    },
    {
        "id": "LP-03",
        "name": "NH-2 Kohima - Maram Landslide Zone",
        "highway": "NH-2",
        "state": "Nagaland / Manipur",
        "district": "dimapur",
        "corridorKey": "dimapur-cachar",
        "elevationM": 1440,
        "slopeAngleDeg": 45,
        "soilType": "Flysch Mudstone & Soil Creep",
        "saturationTriggerPct": 75,
        "broTaskForce": "Project Sewak (15 BRTF)",
        "baseDebrisM3": 6500,
        "criticality": "high",
        "description": "Vital supply link for Imphal Valley. Sinking zone at KM-15 to KM-22 suffers recurring mass movements."
    },
    {
        "id": "LP-04",
        "name": "NH-306 Silchar - Kolasib Ridge Incline",
        "highway": "NH-306",
        "state": "Assam / Mizoram border",
        "district": "cachar",
        "corridorKey": "cachar-aizawl",
        "elevationM": 610,
        "slopeAngleDeg": 40,
        "soilType": "Red Lateritic Soil & Bamboo Silt",
        "saturationTriggerPct": 70,
        "broTaskForce": "Project Pushpak (23 BRTF)",
        "baseDebrisM3": 5200,
        "criticality": "high",
        "description": "Solitary heavy highway connecting Mizoram to rest of India. Debris deposits obstruct truck convoys at Vairengte."
    },
    {
        "id": "LP-05",
        "name": "Bhalukpong - Tawang Mountain Pass",
        "highway": "NH-13",
        "state": "Arunachal Pradesh",
        "district": "sonitpur",
        "corridorKey": "sonitpur-dima_hasao",
        "elevationM": 2150,
        "slopeAngleDeg": 60,
        "soilType": "Gneissic Scree & Boulder Talus",
        "saturationTriggerPct": 80,
        "broTaskForce": "Project Vartak (42 BRTF)",
        "baseDebrisM3": 9800,
        "criticality": "critical",
        "description": "Strategic Himalayan mountain ascent. Rockfall and mudslides frequently isolate border forward bases."
    },
    {
        "id": "LP-06",
        "name": "Nongstoin - Rongjeng Escarpment",
        "highway": "NH-127B",
        "state": "Meghalaya (West Khasi)",
        "district": "east_khasi",
        "corridorKey": "kamrup-sonitpur",
        "elevationM": 1100,
        "slopeAngleDeg": 42,
        "soilType": "High Plasticity Kaolinitic Clay",
        "saturationTriggerPct": 72,
        "broTaskForce": "Project Setu (Meghalaya PWD / BRO)",
        "baseDebrisM3": 4400,
        "criticality": "moderate",
        "description": "Mountain bypass through central Meghalaya plateau. Mudflows impede heavy vehicle movement."
    }
]

# Relief Staging Bases, Helipads & Drone Deployment Hubs
RELIEF_AIR_HUBS = [
    {"id": "AIR-01", "name": "Kumbhirgram IAF Airbase (Silchar)", "type": "IAF Airbase", "district": "cachar", "capacity": "Heavy Transport (C-130J, An-32, Mi-17)", "readiness": "ready"},
    {"id": "AIR-02", "name": "Umroi Airport & Helipad (Shillong)", "type": "Regional Airstrip", "district": "east_khasi", "capacity": "Helicopters & ATR-72", "readiness": "standby"},
    {"id": "AIR-03", "name": "Tezpur Air Force Station", "type": "IAF Tactical Base", "district": "sonitpur", "capacity": "Full Fleet Disaster Staging Hub", "readiness": "ready"},
    {"id": "AIR-04", "name": "Lengpui Emergency Airfield (Aizawl)", "type": "Hill Runway", "district": "aizawl", "capacity": "Medium Airlift & Helis", "readiness": "ready"},
    {"id": "AIR-05", "name": "Haflong Hill Helipad", "type": "Disaster Drop Zone", "district": "dima_hasao", "capacity": "Light / Medium Choppers (Dhruv, Cheetah)", "readiness": "active"},
]

SCENARIO_PRESETS = [
    {
        "id": "brahmaputra_catastrophic_flood",
        "title": "Brahmaputra Major Basin Inundation (+2.6m)",
        "description": "Severe monsoon surge causing simultaneous overtopping of middle Brahmaputra bridges and arterial NH-27/NH-37 highway cutoffs.",
        "riverSurgeMeters": 2.6,
        "rainfallIntensityMm": 175.0,
        "soilSaturationPct": 72.0,
        "earthquakeMagnitude": 0.0,
        "dykeBreach": True,
        "severedCorridors": ["kamrup-sonitpur", "sonitpur-dima_hasao"],
        "triggeredLandslidePasses": ["LP-05"],
        "severity": "critical",
    },
    {
        "id": "barail_mountain_severance",
        "title": "Barail Range Mega-Landslide (NH-6 Collapse)",
        "description": "Continuous heavy downpour in Meghalaya and Dima Hasao triggering massive slope failures at Sonapur Tunnel and Jatinga, severing Barak Valley.",
        "riverSurgeMeters": 1.4,
        "rainfallIntensityMm": 220.0,
        "soilSaturationPct": 92.0,
        "earthquakeMagnitude": 0.0,
        "dykeBreach": False,
        "severedCorridors": ["kamrup-dima_hasao", "cachar-aizawl", "dima_hasao-cachar"],
        "triggeredLandslidePasses": ["LP-01", "LP-02", "LP-04"],
        "severity": "critical",
    },
    {
        "id": "zone_v_seismic_deluge",
        "title": "Zone-V Seismic Shock (M6.4) + Monsoon Cloudburst",
        "description": "Simultaneous 6.4 Richter earthquake along Kopili Fault with torrential rain, triggering multiple catastrophic landslides across all hill tracts.",
        "riverSurgeMeters": 2.2,
        "rainfallIntensityMm": 260.0,
        "soilSaturationPct": 96.0,
        "earthquakeMagnitude": 6.4,
        "dykeBreach": True,
        "severedCorridors": ["kamrup-sonitpur", "kamrup-dima_hasao", "dima_hasao-cachar", "cachar-aizawl", "cachar-west_tripura"],
        "triggeredLandslidePasses": ["LP-01", "LP-02", "LP-03", "LP-04", "LP-05", "LP-06"],
        "severity": "catastrophic",
    },
    {
        "id": "flash_flood_cloudburst",
        "title": "Barak Basin Flash Flood Cloudburst (180mm/6h)",
        "description": "Sudden cloudburst inundating urban Silchar and Southern Assam connector corridors with swift water currents.",
        "riverSurgeMeters": 2.1,
        "rainfallIntensityMm": 180.0,
        "soilSaturationPct": 65.0,
        "earthquakeMagnitude": 0.0,
        "dykeBreach": False,
        "severedCorridors": ["cachar-dima_hasao", "cachar-west_tripura"],
        "triggeredLandslidePasses": ["LP-04"],
        "severity": "high",
    },
]

# Baseline district commodity consumption and stockpiles (standard average days of stock)
DISTRICT_SUPPLIES = {
    "cachar": {"name": "Cachar (Silchar)", "pop": 1736000, "oxygen_days": 5.0, "food_days": 8.0, "fuel_days": 4.5, "grains_days": 12.0},
    "dima_hasao": {"name": "Dima Hasao (Haflong)", "pop": 214000, "oxygen_days": 3.0, "food_days": 4.0, "fuel_days": 3.0, "grains_days": 7.0},
    "aizawl": {"name": "Aizawl (Mizoram)", "pop": 400000, "oxygen_days": 6.0, "food_days": 7.0, "fuel_days": 5.0, "grains_days": 14.0},
    "sonitpur": {"name": "Sonitpur (Tezpur)", "pop": 1924000, "oxygen_days": 7.0, "food_days": 10.0, "fuel_days": 6.0, "grains_days": 18.0},
    "kamrup": {"name": "Kamrup (Guwahati Hub)", "pop": 2500000, "oxygen_days": 15.0, "food_days": 20.0, "fuel_days": 14.0, "grains_days": 30.0},
    "east_khasi": {"name": "East Khasi Hills (Shillong)", "pop": 825000, "oxygen_days": 8.0, "food_days": 9.0, "fuel_days": 6.5, "grains_days": 15.0},
    "west_tripura": {"name": "West Tripura (Agartala)", "pop": 918000, "oxygen_days": 5.5, "food_days": 6.5, "fuel_days": 4.0, "grains_days": 11.0},
    "dimapur": {"name": "Dimapur (Nagaland Hub)", "pop": 378000, "oxygen_days": 7.0, "food_days": 8.0, "fuel_days": 6.0, "grains_days": 14.0},
}


class DisasterDigitalTwin:
    """Simulation engine for in-memory what-if scenario testing with advanced geo-hazard modelling."""

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
        1. Hydrological: River surge, bridge overtopping, dyke failure.
        2. Geotechnical: Landslide slips, soil saturation, debris volume, BRO clearance ETA.
        3. Logistics & Supply: Multi-district isolation, commodity depletion, stranded fleet diversion.
        4. Tactical Relief: IAF airdrops, drone medicine delivery, IWAI NW-2 Ro-Ro waterway bypass.
        """
        severed = set(severed_corridors or [])
        manual_passes = set(triggered_landslide_passes or [])
        sim_timestamp = datetime.utcnow().isoformat() + "Z"

        # -------------------------------------------------------------
        # 1. Assess Bridge Inundation & Hydrology
        # -------------------------------------------------------------
        effective_surge = river_surge_m + (0.5 if dyke_breach else 0.0)
        submerged_bridges = []
        threatened_bridges = []
        safe_bridges = []

        for b in NER_BRIDGES:
            deck = b["deck_clearance_m"]
            clearance_left = round(deck - effective_surge, 2)
            b_info = {
                "id": b["id"],
                "name": b["name"],
                "river": b["river"],
                "district": b["district"],
                "deckClearanceM": deck,
                "surgeLevelM": round(effective_surge, 2),
                "effectiveClearanceM": clearance_left,
                "status": "submerged" if clearance_left <= 0 else "threatened" if clearance_left < 0.5 else "operational",
            }

            if clearance_left <= 0:
                submerged_bridges.append(b_info)
            elif clearance_left < 0.5:
                threatened_bridges.append(b_info)
            else:
                safe_bridges.append(b_info)

        # -------------------------------------------------------------
        # 2. Landslide & Mountain Pass Geotechnical Modelling
        # -------------------------------------------------------------
        active_landslides = []
        threatened_passes = []
        total_debris_m3 = 0
        max_clearing_hours = 0

        for lp in NER_MOUNTAIN_PASSES:
            # Landslide triggers if:
            # a) Explicitly selected by user
            # b) Soil saturation >= pass threshold
            # c) Earthquake shock >= 5.0 (causes seismic slope slips)
            # d) Torrential rainfall >= 180mm combined with steep slopes (>45 deg)
            is_manual = lp["id"] in manual_passes
            saturation_exceeded = soil_saturation_pct >= lp["saturationTriggerPct"]
            earthquake_trigger = earthquake_magnitude >= 5.0
            heavy_rain_trigger = (rainfall_mm >= 170.0 and lp["slopeAngleDeg"] >= 45)

            is_active_collapse = is_manual or saturation_exceeded or earthquake_trigger or heavy_rain_trigger
            is_threatened = not is_active_collapse and (soil_saturation_pct >= (lp["saturationTriggerPct"] - 12) or rainfall_mm >= 130)

            # Calculate debris volume & clearing time
            multiplier = 1.0
            if earthquake_trigger:
                multiplier += (earthquake_magnitude - 4.5) * 0.8
            if soil_saturation_pct > 80:
                multiplier += ((soil_saturation_pct - 80) / 20.0) * 0.6
            if rainfall_mm > 150:
                multiplier += ((rainfall_mm - 150) / 100.0) * 0.5

            debris_m3 = int(lp["baseDebrisM3"] * multiplier) if is_active_collapse else (int(lp["baseDebrisM3"] * 0.2) if is_threatened else 0)
            
            # BRO clearing speed: average 150 m3/hour per heavy equipment team
            # Number of equipment units dispatched based on debris
            equipment_units = max(2, min(8, debris_m3 // 2000 + 1))
            clearing_hours = round(debris_m3 / (equipment_units * 120), 1) if debris_m3 > 0 else 0.0

            lp_result = {
                "id": lp["id"],
                "name": lp["name"],
                "highway": lp["highway"],
                "state": lp["state"],
                "district": lp["district"],
                "elevationM": lp["elevationM"],
                "slopeAngleDeg": lp["slopeAngleDeg"],
                "soilType": lp["soilType"],
                "broTaskForce": lp["broTaskForce"],
                "corridorKey": lp.get("corridorKey", ""),
                "status": "collapsed" if is_active_collapse else "high_risk" if is_threatened else "stable",
                "debrisVolumeM3": debris_m3,
                "clearingEtaHours": clearing_hours,
                "equipmentRequired": f"{equipment_units}x Hydraulic Excavators, {max(1, equipment_units - 1)}x Heavy Dozers, Rock Breaker",
                "triggerCause": "Seismic slip & high saturation" if (earthquake_trigger and saturation_exceeded) else "Earthquake shock" if earthquake_trigger else "Soil saturation & rain liquefaction" if saturation_exceeded else "Heavy rainfall on steep incline" if heavy_rain_trigger else "Manual trigger" if is_manual else "Pre-saturation risk",
                "recommendedAction": "Immediate road closure. BRO heavy clearing underway. Divert via Ro-Ro or alternative ridge line.",
            }

            if is_active_collapse:
                active_landslides.append(lp_result)
                total_debris_m3 += debris_m3
                if clearing_hours > max_clearing_hours:
                    max_clearing_hours = clearing_hours
                # Collapse severs its associated highway corridor automatically
                if lp.get("corridorKey"):
                    severed.add(lp["corridorKey"])
            elif is_threatened:
                threatened_passes.append(lp_result)

        # -------------------------------------------------------------
        # 3. Derive Corridor Severance
        # -------------------------------------------------------------
        auto_cutoffs = set(severed)
        for sb in submerged_bridges:
            if sb["district"] == "kamrup":
                auto_cutoffs.add("kamrup-sonitpur")
            elif sb["district"] == "sonitpur":
                auto_cutoffs.add("sonitpur-dima_hasao")
                auto_cutoffs.add("kamrup-sonitpur")
            elif sb["district"] == "dima_hasao":
                auto_cutoffs.add("kamrup-dima_hasao")
                auto_cutoffs.add("dima_hasao-cachar")
            elif sb["district"] == "cachar":
                auto_cutoffs.add("cachar-aizawl")
                auto_cutoffs.add("cachar-west_tripura")

        # -------------------------------------------------------------
        # 4. District Isolation & Supply Depletion Modelling
        # -------------------------------------------------------------
        districts_impact = {}
        critical_shortage_districts = []

        # Depletion rate multiplier increases with rain, landslides and severance
        depletion_factor = 1.0 + (rainfall_mm / 100.0) * 0.35 + (len(active_landslides) * 0.15)

        for d_id, stock in DISTRICT_SUPPLIES.items():
            is_isolated = False
            # If primary feeding corridor is severed
            if d_id == "dima_hasao" and ("kamrup-dima_hasao" in auto_cutoffs or "sonitpur-dima_hasao" in auto_cutoffs):
                is_isolated = True
            elif d_id == "cachar" and ("kamrup-dima_hasao" in auto_cutoffs or "dima_hasao-cachar" in auto_cutoffs):
                is_isolated = True
            elif d_id == "aizawl" and ("cachar-aizawl" in auto_cutoffs):
                is_isolated = True
            elif d_id == "west_tripura" and ("cachar-west_tripura" in auto_cutoffs):
                is_isolated = True
            elif d_id == "sonitpur" and ("kamrup-sonitpur" in auto_cutoffs):
                is_isolated = True

            # Calculate remaining supply days under stress
            burn_rate = depletion_factor if is_isolated else 1.0
            ox_rem = max(0.2, round(stock["oxygen_days"] / burn_rate, 1))
            food_rem = max(0.5, round(stock["food_days"] / burn_rate, 1))
            fuel_rem = max(0.2, round(stock["fuel_days"] / burn_rate, 1))
            grain_rem = max(1.0, round(stock["grains_days"] / burn_rate, 1))

            d_result = {
                "id": d_id,
                "name": stock["name"],
                "status": "isolated" if is_isolated else "partial_access" if len(auto_cutoffs) > 2 else "operational",
                "population": stock["pop"],
                "stockDaysRemaining": {
                    "medicalOxygen": ox_rem,
                    "infantFood": food_rem,
                    "petroleumFuel": fuel_rem,
                    "essentialGrains": grain_rem,
                },
                "alarm": "red" if (ox_rem <= 2.5 or fuel_rem <= 2.0) else "orange" if (ox_rem <= 4.0 or food_rem <= 4.0) else "green",
            }
            districts_impact[d_id] = d_result

            if d_result["alarm"] == "red":
                critical_shortage_districts.append(stock["name"])

        # -------------------------------------------------------------
        # 5. Fleet Impact & Trapped Convoy Diversions
        # -------------------------------------------------------------
        simulated_fleet = [
            {"id": "AS-01-GC-4412", "vehicleType": "heavy_multi_axle", "cargo": "medical_oxygen", "currentRoute": "kamrup-cachar", "from": "kamrup", "to": "cachar", "lat": 25.82, "lng": 92.45},
            {"id": "AS-11-BC-8921", "vehicleType": "hazardous_tanker", "cargo": "diesel", "currentRoute": "kamrup-dima_hasao", "from": "kamrup", "to": "dima_hasao", "lat": 25.65, "lng": 92.75},
            {"id": "TR-01-X-3301", "vehicleType": "medium_commercial", "cargo": "infant_food", "currentRoute": "cachar-west_tripura", "from": "cachar", "to": "west_tripura", "lat": 24.62, "lng": 92.20},
            {"id": "MZ-01-T-7740", "vehicleType": "heavy_multi_axle", "cargo": "grains", "currentRoute": "cachar-aizawl", "from": "cachar", "to": "aizawl", "lat": 24.45, "lng": 92.72},
            {"id": "AS-03-D-1199", "vehicleType": "light_commercial", "cargo": "medicine", "currentRoute": "kamrup-sonitpur", "from": "kamrup", "to": "sonitpur", "lat": 26.35, "lng": 92.12},
            {"id": "NL-07-A-5520", "vehicleType": "heavy_multi_axle", "cargo": "diesel", "currentRoute": "dimapur-cachar", "from": "dimapur", "to": "cachar", "lat": 25.70, "lng": 93.30},
        ]

        stranded_vehicles = []
        rerouted_vehicles = []

        for v in simulated_fleet:
            route = v["currentRoute"]
            is_severed = route in auto_cutoffs
            
            # Check if route blocked specifically by landslide or bridge
            blockage_reason = "Bridge Inundation"
            for lp in active_landslides:
                if lp.get("corridorKey") == route:
                    blockage_reason = f"Landslide: {lp['name']}"
                    break

            if is_severed:
                stranded_vehicles.append({
                    **v,
                    "impact": f"Route Severed ({blockage_reason})",
                    "actionRequired": "Emergency diversion to safe-haven logistics hub or IWAI Ro-Ro barge.",
                    "recommendedHoldingPoint": "Nagaon Highway Logistics Depot (KM-120)",
                    "alternateAction": "Activate Pandu / Silghat Ro-Ro ferry crossing for heavy commercial trucks",
                })
            else:
                rerouted_vehicles.append({
                    **v,
                    "impact": "Route Clear with Cautionary Advisory",
                })

        # -------------------------------------------------------------
        # 6. Strategic Response & Relief Strategy Synthesis
        # -------------------------------------------------------------
        # Active Ro-Ro Waterway Routes to mobilize
        active_roro_bypass = []
        if "kamrup-sonitpur" in auto_cutoffs or "sonitpur-dima_hasao" in auto_cutoffs:
            active_roro_bypass.append({
                "service": "IWAI Pandu - Silghat Ro-Ro",
                "waterway": "National Waterway 2 (Brahmaputra)",
                "terminalA": "Pandu Multi-Modal Port, Guwahati",
                "terminalB": "Silghat IWT Terminal, Nagaon",
                "capacity": "20 Heavy Commercial Vehicles / Voyage",
                "transitTime": "3h 45m",
                "status": "OPERATIONAL - READY FOR MOBILIZATION",
            })
        if "cachar-west_tripura" in auto_cutoffs or "cachar-aizawl" in auto_cutoffs:
            active_roro_bypass.append({
                "service": "IWAI Dhubri - Jogighopa Ro-Ro Link",
                "waterway": "National Waterway 2 (Lower Assam)",
                "terminalA": "Dhubri River Terminal",
                "terminalB": "Jogighopa Multi-Modal Logistics Park",
                "capacity": "16 Heavy Trucks / Voyage",
                "transitTime": "2h 10m",
                "status": "OPERATIONAL - READY FOR MOBILIZATION",
            })

        # Priority Drone Medicine Delivery Drop Zones for isolated sub-divisions
        drone_drop_zones = []
        if districts_impact.get("dima_hasao", {}).get("status") == "isolated":
            drone_drop_zones.append({
                "location": "Haflong Civil Hospital Helipad Ground",
                "district": "Dima Hasao",
                "payload": "High-altitude Blood Units & Snake Antivenom",
                "droneModel": "Heavy-Lift VTOL Logistics Drone (30kg)",
                "flightDistanceKm": 68,
                "flightTimeMin": 42,
            })
        if districts_impact.get("cachar", {}).get("status") == "isolated":
            drone_drop_zones.append({
                "location": "Silchar Medical College & Hospital (SMCH)",
                "district": "Cachar",
                "payload": "Dialysis Fluids & Critical Antibiotics",
                "droneModel": "Long-Range Hybrid VTOL (25kg)",
                "flightDistanceKm": 84,
                "flightTimeMin": 54,
            })
        if districts_impact.get("aizawl", {}).get("status") == "isolated":
            drone_drop_zones.append({
                "location": "Kolasib District Civil Hospital Drop Zone",
                "district": "Aizawl border",
                "payload": "Emergency Insulin & Surgical Kits",
                "droneModel": "Long-Range Hybrid VTOL (25kg)",
                "flightDistanceKm": 52,
                "flightTimeMin": 36,
            })

        # -------------------------------------------------------------
        # 7. Executive Situation Report (SITREP) Generation
        # -------------------------------------------------------------
        sitrep = f"""================================================================================
DISASTER DIGITAL TWIN — EXECUTIVE SITUATION REPORT (SITREP)
================================================================================
Generated Timestamp: {sim_timestamp}
Scenario Name:       {scenario_name}
Hydrological State:  River Surge +{round(effective_surge, 2)}m | 24h Rainfall: {rainfall_mm}mm | Dyke Breach: {'YES' if dyke_breach else 'NO'}
Geotechnical State:  Soil Saturation: {soil_saturation_pct}% | Seismic Shock: {earthquake_magnitude} Richter | Active Landslides: {len(active_landslides)}
Total Severed Arteries: {len(auto_cutoffs)} Highway Corridors

1. GEOTECHNICAL & LANDSLIDE DISASTERS:
   - Active Slope Collapses: {len(active_landslides)} mountain pass(es) blocked
     * {chr(10).join(['[COLLAPSE] ' + lp['name'] + ' (' + lp['highway'] + '): ' + str(lp['debrisVolumeM3']) + ' m3 debris, Clearance ETA: ' + str(lp['clearingEtaHours']) + 'h by ' + lp['broTaskForce'] for lp in active_landslides]) if active_landslides else 'None detected at current saturation'}
   - Total Slope Debris to be Cleared: {total_debris_m3:,} m3
   - Maximum Road Clearance ETA: {max_clearing_hours} Hours ({round(max_clearing_hours/24, 1)} Days)

2. CRITICAL RIVER BRIDGES & WATERWAYS:
   - Bridges Submerged (Deck Overtopped): {len(submerged_bridges)} ({', '.join([b['name'] for b in submerged_bridges]) if submerged_bridges else 'None'})
   - Threatened Spans (< 0.5m clearance): {len(threatened_bridges)} ({', '.join([b['name'] for b in threatened_bridges]) if threatened_bridges else 'None'})
   - Severed Highway Links: {', '.join(auto_cutoffs) if auto_cutoffs else 'None'}

3. DISTRICT SUPPLY CHAIN ISOLATION & VULNERABILITY:
   - Completely Isolated Districts: {', '.join([d['name'] for d in districts_impact.values() if d['status'] == 'isolated']) or 'None'}
   - Critical Supply Shortage (< 48h Oxygen/Fuel): {', '.join(critical_shortage_districts) or 'None'}

4. FLEET STRANDING & EMERGENCY DIVERSIONS:
   - En-Route Trucks Trapped: {len(stranded_vehicles)} vehicles
   - Primary Holding Depots: Nagaon Highway Logistics Hub (KM-120) & Guwahati Pandu Port
   - Alternate Multi-Modal Action: Activate IWAI NW-2 Ro-Ro Waterway shuttles to bypass submerged bridges.

5. TACTICAL RELIEF & EVACUATION MOBILIZATION:
   - IAF Tactical Airlift Hubs: Kumbhirgram Airbase, Umroi Airport, Tezpur AFS
   - Drone Medical Drop Corridors: {len(drone_drop_zones)} active routes (Haflong / Silchar / Kolasib)
   - BRO Heavy Machinery Required: {sum([lp['debrisVolumeM3'] // 2000 + 1 for lp in active_landslides])} Excavators & Dozers deployed
================================================================================
"""

        return {
            "scenarioName": scenario_name,
            "simulatedAt": sim_timestamp,
            "inputs": {
                "riverSurgeMeters": river_surge_m,
                "rainfallIntensityMm": rainfall_mm,
                "soilSaturationPct": soil_saturation_pct,
                "earthquakeMagnitude": earthquake_magnitude,
                "dykeBreach": dyke_breach,
                "severedCorridors": list(auto_cutoffs),
                "triggeredLandslidePasses": list(manual_passes),
            },
            "metrics": {
                "submergedBridgesCount": len(submerged_bridges),
                "threatenedBridgesCount": len(threatened_bridges),
                "activeLandslidesCount": len(active_landslides),
                "threatenedPassesCount": len(threatened_passes),
                "totalDebrisVolumeM3": total_debris_m3,
                "maxClearingHours": max_clearing_hours,
                "isolatedDistrictsCount": sum(1 for d in districts_impact.values() if d["status"] == "isolated"),
                "criticalAlarmDistrictsCount": len(critical_shortage_districts),
                "strandedVehiclesCount": len(stranded_vehicles),
            },
            "submergedBridges": submerged_bridges,
            "threatenedBridges": threatened_bridges,
            "activeLandslides": active_landslides,
            "threatenedPasses": threatened_passes,
            "districtsImpact": districts_impact,
            "criticalShortageDistricts": critical_shortage_districts,
            "strandedVehicles": stranded_vehicles,
            "activeRoroBypass": active_roro_bypass,
            "droneDropZones": drone_drop_zones,
            "reliefAirHubs": RELIEF_AIR_HUBS,
            "executiveSitrep": sitrep,
        }
