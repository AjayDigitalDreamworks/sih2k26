"""
Alert Service — monitors real-time data and generates multimodal alerts
when thresholds are breached. Supports WebSocket, SMS, and push notifications.
Alerts are published to core-backend via Redis pub/sub for Socket.io broadcast.
"""
import asyncio
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.services.data_aggregator import DataAggregator
from app.services.config import APIConfig


class AlertService:
    """
    Monitors real-time data streams and generates alerts when:
    - Rainfall exceeds safe thresholds
    - Flood risk escalates to High/Very High
    - Landslide probability exceeds danger level
    - Road conditions change (blocked/damaged)
    - Traffic congestion becomes severe
    """

    # Threshold definitions
    THRESHOLDS = {
        "rainfall_warning_mm": 40,      # IMD heavy rain warning
        "rainfall_danger_mm": 80,       # IMD very heavy rain
        "flood_risk_high": 60,          # Google Flood Hub High
        "flood_risk_very_high": 80,     # Google Flood Hub Very High
        "landslide_prob_high": 0.5,     # NASA LHASA High
        "landslide_prob_very_high": 0.7,# NASA LHASA Very High
        "congestion_high": "high",      # TomTom severe congestion
        "wind_speed_warning_kmh": 60,   # Strong wind warning
    }

    _active_alerts: List[Dict] = []
    _alert_history: List[Dict] = []

    @classmethod
    async def check_district_alerts(cls, district_id: str) -> List[Dict[str, Any]]:
        """Check all data sources for a district and generate alerts if thresholds breached."""
        alerts = []

        try:
            ctx = await DataAggregator.get_full_district_context(district_id)
            weather = ctx.get("weather", {})
            flood = ctx.get("flood", {})
            landslide = ctx.get("landslide", {})
            district_name = ctx.get("district_name", district_id)

            # --- Rainfall Alerts ---
            rainfall = weather.get("rainfall_24h_mm", 0)
            if rainfall >= cls.THRESHOLDS["rainfall_danger_mm"]:
                alerts.append(cls._create_alert(
                    district_id=district_name,
                    type="extreme_rainfall",
                    severity="critical",
                    title=f"EXTREME RAINFALL: {rainfall:.0f}mm in {district_name}",
                    message=f"Very heavy rainfall of {rainfall:.0f}mm recorded in last 24 hours. High risk of flooding and landslides. All freight movement should be suspended on vulnerable routes.",
                    source=weather.get("source", "imd"),
                ))
            elif rainfall >= cls.THRESHOLDS["rainfall_warning_mm"]:
                alerts.append(cls._create_alert(
                    district_id=district_name,
                    type="heavy_rainfall",
                    severity="high",
                    title=f"Heavy Rainfall Warning: {rainfall:.0f}mm in {district_name}",
                    message=f"Heavy rainfall of {rainfall:.0f}mm in 24 hours. Monitor road conditions and consider alternate routes.",
                    source=weather.get("source", "imd"),
                ))

            # --- Flood Alerts ---
            flood_level = flood.get("flood_risk_level", 0)
            if flood_level >= cls.THRESHOLDS["flood_risk_very_high"]:
                alerts.append(cls._create_alert(
                    district_id=district_name,
                    type="flood_warning",
                    severity="critical",
                    title=f"FLOOD ALERT: High flood risk in {district_name}",
                    message=f"Google Flood Hub reports {flood.get('flood_risk_label', 'high')} flood risk. Water level: {flood.get('forecasted_water_level_m', 0):.1f}m. Avoid low-lying routes.",
                    source="google_flood_hub",
                ))
            elif flood_level >= cls.THRESHOLDS["flood_risk_high"]:
                alerts.append(cls._create_alert(
                    district_id=district_name,
                    type="flood_watch",
                    severity="high",
                    title=f"Flood Watch: Elevated risk in {district_name}",
                    message=f"Flood risk elevated in {district_name}. Monitor conditions closely.",
                    source="google_flood_hub",
                ))

            # --- Landslide Alerts ---
            landslide_prob = landslide.get("hazard_probability", 0)
            if landslide_prob >= cls.THRESHOLDS["landslide_prob_very_high"]:
                alerts.append(cls._create_alert(
                    district_id=district_name,
                    type="landslide_warning",
                    severity="critical",
                    title=f"LANDSLIDE ALERT: Very high risk in {district_name}",
                    message=f"NASA LHASA reports {landslide_prob:.0%} landslide probability. Terrain: {landslide.get('hazard_level', 'unknown')}. All hill highway traffic should be diverted.",
                    source=landslide.get("source", "nasa_lhasa"),
                ))
            elif landslide_prob >= cls.THRESHOLDS["landslide_prob_high"]:
                alerts.append(cls._create_alert(
                    district_id=district_name,
                    type="landslide_watch",
                    severity="high",
                    title=f"Landslide Watch: Elevated risk in {district_name}",
                    message=f"Landslide probability elevated ({landslide_prob:.0%}). Monitor hill road conditions.",
                    source=landslide.get("source", "nasa_lhasa"),
                ))

            # --- Wind Alerts ---
            wind = weather.get("wind_kmh", 0)
            if wind >= cls.THRESHOLDS["wind_speed_warning_kmh"]:
                alerts.append(cls._create_alert(
                    district_id=district_name,
                    type="wind_warning",
                    severity="medium",
                    title=f"Strong Wind: {wind:.0f} km/h in {district_name}",
                    message=f"Wind speed of {wind:.0f} km/h reported. High vehicles should exercise caution.",
                    source=weather.get("source", "imd"),
                ))

        except Exception as e:
            alerts.append(cls._create_alert(
                district_id=district_id,
                type="system_error",
                severity="low",
                title=f"Data fetch error for {district_id}",
                message=f"Could not fetch real-time data: {str(e)}",
                source="system",
            ))

        # Store alerts
        cls._active_alerts.extend(alerts)
        cls._alert_history.extend(alerts)

        return alerts

    @classmethod
    async def check_all_districts(cls) -> List[Dict[str, Any]]:
        """Check all NER districts for alerts."""
        all_alerts = []
        for district_id in APIConfig.NER_DISTRICTS:
            alerts = await cls.check_district_alerts(district_id)
            all_alerts.extend(alerts)
        return all_alerts

    @classmethod
    def get_active_alerts(cls) -> List[Dict[str, Any]]:
        """Get all currently active alerts."""
        return cls._active_alerts

    @classmethod
    def get_alert_history(cls, limit: int = 50) -> List[Dict[str, Any]]:
        """Get alert history."""
        return cls._alert_history[-limit:]

    @classmethod
    def acknowledge_alert(cls, alert_id: str) -> bool:
        """Acknowledge an alert."""
        for alert in cls._active_alerts:
            if alert.get("id") == alert_id:
                alert["status"] = "acknowledged"
                alert["acknowledged_at"] = datetime.utcnow().isoformat()
                return True
        return False

    @classmethod
    def resolve_alert(cls, alert_id: str) -> bool:
        """Resolve an alert."""
        for alert in cls._active_alerts:
            if alert.get("id") == alert_id:
                alert["status"] = "resolved"
                alert["resolved_at"] = datetime.utcnow().isoformat()
                cls._active_alerts = [a for a in cls._active_alerts if a.get("id") != alert_id]
                return True
        return False

    @classmethod
    def _create_alert(cls, district_id: str, type: str, severity: str,
                       title: str, message: str, source: str) -> Dict[str, Any]:
        """Create a standardized alert object."""
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
            "translations": {
                "en": title,
            },
        }

    @classmethod
    async def get_multilingual_alert(cls, alert: Dict[str, Any], languages: List[str] = None) -> Dict[str, Any]:
        """
        Generate multilingual versions of an alert.
        For now, returns the alert with language tags.
        In production, this would call Bhashini/Google Translate API.
        """
        if languages is None:
            languages = ["en", "as", "bn", "hi", "mni", "lus"]

        translations = {}
        for lang in languages:
            if lang == "en":
                translations[lang] = alert.get("message", "")
            else:
                # Placeholder — in production, call translation API
                translations[lang] = f"[{lang.upper()}] {alert.get('message', '')}"

        alert["translations"] = translations
        return alert
