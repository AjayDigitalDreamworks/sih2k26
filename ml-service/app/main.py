"""
Raahi ML & Risk Engine — FastAPI Application

Microservice providing:
- ML-powered route risk scoring (XGBoost)
- Disruption prediction (flood/landslide/traffic) (XGBoost)
- Route optimization with delay estimation (XGBoost)
- CNN incident detection from images (PyTorch)
- Real-time background processing pipeline
- Live data from IMD, NASA LHASA, Google Flood Hub, TomTom, Mappls, Bhuvan

Integrations: Open-Meteo (free fallback), OSRM (free routing)
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import risk, disruption, route_suggestion, route_planner, realtime, alerts, pipeline, simulation
from app.services.config import APIConfig
from app.engine.ml_inference import get_model_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events for the FastAPI application."""
    # Startup: Train models if not present, then start pipeline
    print("\n[START] Raahi ML Engine starting...")

    # Check if models are trained
    import os
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "engine", "saved_models")
    if not os.path.exists(models_dir) or not os.listdir(models_dir):
        print("[INFO] No trained models found. Running training pipeline...")
        try:
            from app.engine.train import train_all_models
            train_all_models()
            print("[OK] Models trained successfully!")
        except Exception as e:
            print(f"[WARN]  Model training failed: {e}")
            print("   Using rule-based fallback engines.")
    else:
        print("[OK] Pre-trained models found.")

    # Load models into memory
    from app.engine.ml_inference import MLModels
    models = MLModels()
    print(f"[MODELS] Status: {models.get_status()}")

    # Start real-time background pipeline
    print("[PIPELINE] Starting real-time processing pipeline...")
    try:
        from app.engine.realtime_pipeline import start_pipeline
        pipeline_tasks = await start_pipeline()
        print("[OK] Pipeline started!")
    except Exception as e:
        print(f"[WARN]  Pipeline start failed: {e}")
        print("   API endpoints still available, background processing disabled.")

    yield

    # Shutdown
    print("\n[STOP] Shutting down ML Engine...")
    try:
        from app.engine.realtime_pipeline import stop_pipeline
        stop_pipeline()
    except Exception:
        pass
    print("[OK] ML Engine stopped.")


app = FastAPI(
    title="Raahi ML & Risk Engine",
    description=(
        "Raahi ML microservice providing real-time route risk scoring, disruption forecasting, "
        "and alternate route generation for North East India. "
        "Integrated with IMD, NASA LHASA, Google Flood Hub, TomTom, Mappls, Bhuvan/ISRO."
    ),
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(risk.router)
app.include_router(disruption.router)
app.include_router(route_suggestion.router)
app.include_router(route_planner.router)
app.include_router(realtime.router)
app.include_router(alerts.router)
app.include_router(pipeline.router)
app.include_router(simulation.router)


@app.get("/health")
async def health_check():
    """Health check with API integration status and ML model status."""
    integrations = {
        "imd_weather": bool(APIConfig.IMD_API_KEY),
        "nasa_lhasa": bool(APIConfig.NASA_EARTHDATA_USER),
        "google_flood_hub": bool(APIConfig.GOOGLE_FLOOD_KEY),
        "tomtom_traffic": bool(APIConfig.TOMTOM_API_KEY),
        "mappls_routing": bool(APIConfig.MAPPLS_ACCESS_TOKEN),
        "bhuvan_terrain": bool(APIConfig.BHUVAN_TOKEN),
        "open_meteo_fallback": True,
        "osrm_routing": True,
    }

    active_count = sum(1 for v in integrations.values() if v)
    model_status = get_model_status()

    return {
        "status": "online",
        "service": "Raahi ML Engine (FastAPI)",
        "version": "3.0.0",
        "engineMode": "ml_powered_hybrid",
        "integrations": integrations,
        "activeIntegrations": active_count,
        "totalIntegrations": len(integrations),
        "mlModels": model_status.get("models_loaded", {}),
        "supportedRegions": list(APIConfig.NER_DISTRICTS.keys()),
        "endpoints": {
            # Risk Scoring (ML)
            "risk_scoring": "/risk/route-score",
            "live_risk_scoring": "/risk/route-score/live",
            "incident_detection": "/risk/incident-detect",
            "model_status": "/risk/model-status",

            # Disruption Prediction (ML)
            "disruption_prediction": "/risk/disruption-predict",
            "live_disruption": "/risk/disruption-predict/live",
            "all_disruptions": "/risk/disruption-predict/all",

            # Route Optimization (ML)
            "route_suggestion": "/route/suggest",
            "route_plan_real_roads": "/route/plan",
            "live_route_optimization": "/route/optimize/live",

            # Real-Time Data (External APIs)
            "realtime_weather": "/realtime/weather/all",
            "realtime_flood": "/realtime/flood/all",
            "realtime_landslide": "/realtime/landslide/{district_id}",
            "realtime_traffic": "/realtime/traffic/route",

            # Alerts
            "alerts_check": "/alerts/check/{district_id}",
            "alerts_check_all": "/alerts/check-all",
            "alerts_active": "/alerts/active",

            # Pipeline Management
            "pipeline_status": "/pipeline/status",
            "pipeline_alerts": "/pipeline/alerts",
            "pipeline_risk_scores": "/pipeline/risk-scores",
            "pipeline_disruptions": "/pipeline/disruptions",
            "pipeline_map_data": "/pipeline/map-data",
            "pipeline_models": "/pipeline/models",

            # Context & Summary
            "district_context": "/realtime/context/district/{district_id}",
            "route_context": "/realtime/context/route",
            "full_summary": "/realtime/summary",
        },
    }
