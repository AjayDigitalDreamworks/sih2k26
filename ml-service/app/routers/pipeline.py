"""
Real-Time Pipeline Router — manages and monitors the background processing pipeline.
Provides endpoints to start/stop the pipeline, check status, and get real-time events.
"""
from fastapi import APIRouter, Query
from typing import Optional
from app.engine.realtime_pipeline import (
    start_pipeline, stop_pipeline, get_pipeline_status, get_pipeline_state,
    trigger_risk_recalculation
)
from app.engine.ml_inference import get_model_status

router = APIRouter(prefix="/pipeline", tags=["Real-Time Pipeline"])


@router.get("/status")
async def pipeline_status():
    """
    Get the current status of the real-time processing pipeline.
    Shows uptime, last check times, alert counts, and model status.
    """
    return get_pipeline_status()


@router.get("/alerts")
async def get_pipeline_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity: critical/high/medium/low"),
    district: Optional[str] = Query(None, description="Filter by district ID"),
    limit: int = Query(50, description="Max alerts to return"),
):
    """Get active alerts from the pipeline."""
    state = get_pipeline_state()
    alerts = state.active_alerts

    if severity:
        alerts = [a for a in alerts if a.get("severity") == severity]
    if district:
        alerts = [a for a in alerts if a.get("districtId") == district]

    return {
        "totalActive": len(alerts),
        "alerts": alerts[-limit:],
    }


@router.get("/alerts/history")
async def get_alert_history(limit: int = Query(100)):
    """Get alert history from the pipeline."""
    state = get_pipeline_state()
    return {
        "totalHistorical": len(state.alert_history),
        "alerts": state.alert_history[-limit:],
    }


@router.post("/risk/recalculate")
async def recalculate_risk_now():
    """
    Trigger an IMMEDIATE route-risk recalculation (instead of waiting for the
    30-minute background cycle). Called by core-backend right after a new
    alert/field report is created, verified or rejected so corridor risk levels
    reflect the changed DB state right away.
    """
    result = await trigger_risk_recalculation(reason="api")
    return result


@router.get("/risk-scores")
async def get_current_risk_scores():
    """Get latest ML risk scores for all routes."""
    state = get_pipeline_state()
    return {
        "totalRoutes": len(state.risk_scores),
        "scores": state.risk_scores,
    }


@router.get("/disruptions")
async def get_current_disruptions():
    """Get latest ML disruption predictions for all districts."""
    state = get_pipeline_state()
    return {
        "totalDistricts": len(state.disruption_predictions),
        "predictions": state.disruption_predictions,
    }


@router.get("/map-data")
async def get_latest_map_data():
    """Get the latest map update data for frontend consumption."""
    state = get_pipeline_state()
    latest = state.map_updates[-1] if state.map_updates else {}
    return latest


@router.get("/models")
async def get_model_information():
    """Get detailed status of all ML models."""
    return get_model_status()


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an active alert."""
    state = get_pipeline_state()
    for alert in state.active_alerts:
        if alert.get("id") == alert_id:
            alert["status"] = "acknowledged"
            alert["acknowledgedAt"] = __import__("datetime").datetime.utcnow().isoformat()
            return {"success": True, "alertId": alert_id}
    return {"success": False, "error": "Alert not found"}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    """Resolve an active alert."""
    state = get_pipeline_state()
    for i, alert in enumerate(state.active_alerts):
        if alert.get("id") == alert_id:
            alert["status"] = "resolved"
            alert["resolvedAt"] = __import__("datetime").datetime.utcnow().isoformat()
            state.active_alerts.pop(i)
            return {"success": True, "alertId": alert_id}
    return {"success": False, "error": "Alert not found"}
