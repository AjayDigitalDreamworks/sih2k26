"""
Alert Monitoring Endpoints — real-time threshold monitoring and multimodal alert generation.
"""
from fastapi import APIRouter, Query
from typing import Optional
from app.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["Real-Time Alerts"])


@router.get("/check/{district_id}")
async def check_district_alerts(district_id: str):
    """Check all real-time data sources for alerts in a specific district."""
    alerts = await AlertService.check_district_alerts(district_id)
    return {
        "districtId": district_id,
        "alertsFound": len(alerts),
        "alerts": alerts,
    }


@router.get("/check-all")
async def check_all_districts():
    """Check all 12 NER districts for alerts."""
    alerts = await AlertService.check_all_districts()
    return {
        "totalAlerts": len(alerts),
        "critical": len([a for a in alerts if a.get("severity") == "critical"]),
        "high": len([a for a in alerts if a.get("severity") == "high"]),
        "medium": len([a for a in alerts if a.get("severity") == "medium"]),
        "low": len([a for a in alerts if a.get("severity") == "low"]),
        "alerts": alerts,
    }


@router.get("/active")
async def get_active_alerts():
    """Get all currently active (unresolved) alerts."""
    alerts = AlertService.get_active_alerts()
    return {
        "totalActive": len(alerts),
        "alerts": alerts,
    }


@router.get("/history")
async def get_alert_history(limit: int = Query(50)):
    """Get alert history."""
    return {
        "alerts": AlertService.get_alert_history(limit),
    }


@router.post("/acknowledge/{alert_id}")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert."""
    success = AlertService.acknowledge_alert(alert_id)
    return {"success": success, "alertId": alert_id}


@router.post("/resolve/{alert_id}")
async def resolve_alert(alert_id: str):
    """Resolve an alert."""
    success = AlertService.resolve_alert(alert_id)
    return {"success": success, "alertId": alert_id}


@router.get("/translate")
async def get_translated_alert(
    message: str = Query(...),
    languages: str = Query("en,as,bn,hi", description="Comma-separated language codes"),
):
    """Get alert message translated to multiple languages."""
    lang_list = [l.strip() for l in languages.split(",")]
    alert = {"message": message, "translations": {}}
    translated = await AlertService.get_multilingual_alert(alert, lang_list)
    return translated.get("translations", {})
