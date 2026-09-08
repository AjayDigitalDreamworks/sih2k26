"""
Disaster Digital Twin Simulation Router.
Exposes endpoints to test hypothetical scenarios, retrieve presets, and query mountain passes.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional
from app.engine.simulation_engine import DisasterDigitalTwin

router = APIRouter(prefix="/simulation", tags=["Disaster Digital Twin"])


class SimulationRequest(BaseModel):
    riverSurgeMeters: float = Field(2.0, ge=0.0, le=6.0, description="Hypothetical river water level surge in meters")
    rainfallIntensityMm: float = Field(120.0, ge=0.0, le=500.0, description="Hypothetical 24h continuous rainfall in mm")
    soilSaturationPct: float = Field(65.0, ge=0.0, le=100.0, description="Soil saturation percentage (0-100%)")
    earthquakeMagnitude: float = Field(0.0, ge=0.0, le=9.0, description="Richter scale seismic shock magnitude (0-9)")
    dykeBreach: bool = Field(False, description="Whether river dykes/embankments have breached")
    severedCorridors: Optional[List[str]] = Field(default_factory=list, description="Explicit severed highway corridor keys")
    triggeredLandslidePasses: Optional[List[str]] = Field(default_factory=list, description="Explicit triggered mountain passes")
    scenarioName: Optional[str] = Field("Custom Disaster Scenario", description="Human-readable scenario title")


@router.get("/presets")
async def get_simulation_presets():
    """Retrieve pre-configured regional catastrophe presets."""
    return {
        "success": True,
        "presets": DisasterDigitalTwin.get_presets(),
        "mountainPasses": DisasterDigitalTwin.get_mountain_passes(),
    }


@router.get("/mountain-passes")
async def get_mountain_passes():
    """Retrieve list of vulnerable mountain passes and sinking zones in Northeast India."""
    return {
        "success": True,
        "mountainPasses": DisasterDigitalTwin.get_mountain_passes(),
    }


@router.post("/run")
async def run_scenario_simulation(payload: SimulationRequest):
    """Run an in-memory disaster scenario simulation without affecting live operational DB."""
    result = DisasterDigitalTwin.run_simulation(
        river_surge_m=payload.riverSurgeMeters,
        rainfall_mm=payload.rainfallIntensityMm,
        soil_saturation_pct=payload.soilSaturationPct,
        earthquake_magnitude=payload.earthquakeMagnitude,
        dyke_breach=payload.dykeBreach,
        severed_corridors=payload.severedCorridors,
        triggered_landslide_passes=payload.triggeredLandslidePasses,
        scenario_name=payload.scenarioName or "Custom Simulation",
    )
    return {
        "success": True,
        "data": result,
    }
