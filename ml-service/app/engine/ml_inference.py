"""
ML Model Inference Module for Raahi Platform.

Loads trained models and provides prediction functions:
1. Risk Score Prediction (XGBoost)
2. Disruption Prediction (XGBoost multi-model)
3. Route Optimization (XGBoost multi-output)
4. CNN Incident Detection (PyTorch)

Models are loaded once at startup and reused for fast inference.
Falls back to rule-based computation if models aren't available.
"""

import os
import json
import numpy as np
import joblib
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════════════════
# Model paths
# ═══════════════════════════════════════════════════════════════════════════════

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_models")

# Feature definitions
RISK_FEATURES = [
    "slope_risk", "rainfall_24h_mm", "road_condition", "bridge_condition",
    "historical_disruptions", "congestion_level", "flood_risk_level",
    "landslide_probability", "elevation_m", "river_proximity", "month",
    "road_distance_km",
]

DISRUPTION_FEATURES = [
    "elevation_m", "slope_risk", "flood_susceptibility", "landslide_susceptibility",
    "temp_celsius", "humidity_percent", "wind_kmh", "rainfall_24h_mm",
    "rainfall_48h_mm", "rainfall_72h_mm", "seasonal_rainfall_avg_mm", "month",
]

ROUTE_FEATURES = [
    "distance_km", "road_condition", "bridge_condition", "avg_slope_risk",
    "avg_elevation_m", "rainfall_24h_mm", "temp_celsius", "congestion_level",
    "flood_risk_level", "landslide_probability", "priority", "month",
]


class MLModels:
    """Singleton class to load and manage all ML models."""

    _instance = None
    _loaded = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._loaded:
            self.load_models()

    def load_models(self):
        """Load all trained models from disk."""
        self.risk_model = None
        self.risk_scaler = None
        self.disruption_models = {}
        self.disruption_scaler = None
        self.route_delay_model = None
        self.route_safety_model = None
        self.route_rank_model = None
        self.route_scaler = None
        self.commodity_encoder = None
        self.incident_cnn = None
        self.incident_classes = []
        self.model_status = {}

        # Load Risk Model
        try:
            risk_path = os.path.join(MODELS_DIR, "risk_model.joblib")
            risk_scaler_path = os.path.join(MODELS_DIR, "risk_scaler.joblib")
            if os.path.exists(risk_path) and os.path.exists(risk_scaler_path):
                self.risk_model = joblib.load(risk_path)
                self.risk_scaler = joblib.load(risk_scaler_path)
                self.model_status["risk"] = "loaded"
                print("[OK] Risk model loaded")
            else:
                self.model_status["risk"] = "not_found"
                print("[WARN] Risk model not found - using rule-based fallback")
        except Exception as e:
            self.model_status["risk"] = f"error: {e}"
            print(f"[ERROR] Risk model load failed: {e}")

        # Load Disruption Models
        for name in ["landslide", "flood", "road_block", "severity"]:
            try:
                path = os.path.join(MODELS_DIR, f"disruption_{name}_model.joblib")
                if os.path.exists(path):
                    self.disruption_models[name] = joblib.load(path)
                    self.model_status[f"disruption_{name}"] = "loaded"
                else:
                    self.model_status[f"disruption_{name}"] = "not_found"
            except Exception as e:
                self.model_status[f"disruption_{name}"] = f"error: {e}"

        try:
            scaler_path = os.path.join(MODELS_DIR, "disruption_scaler.joblib")
            if os.path.exists(scaler_path):
                self.disruption_scaler = joblib.load(scaler_path)
                print("[OK] Disruption models loaded")
            else:
                print("[WARN] Disruption models not found - using rule-based fallback")
        except Exception as e:
            print(f"[ERROR] Disruption model load failed: {e}")

        # Load Route Optimization Models
        try:
            delay_path = os.path.join(MODELS_DIR, "route_delay_model.joblib")
            safety_path = os.path.join(MODELS_DIR, "route_safety_model.joblib")
            rank_path = os.path.join(MODELS_DIR, "route_rank_model.joblib")
            scaler_path = os.path.join(MODELS_DIR, "route_scaler.joblib")
            encoder_path = os.path.join(MODELS_DIR, "commodity_encoder.joblib")

            if all(os.path.exists(p) for p in [delay_path, safety_path, rank_path, scaler_path]):
                self.route_delay_model = joblib.load(delay_path)
                self.route_safety_model = joblib.load(safety_path)
                self.route_rank_model = joblib.load(rank_path)
                self.route_scaler = joblib.load(scaler_path)
                if os.path.exists(encoder_path):
                    self.commodity_encoder = joblib.load(encoder_path)
                self.model_status["route"] = "loaded"
                print("[OK] Route optimization models loaded")
            else:
                self.model_status["route"] = "not_found"
                print("[WARN] Route models not found - using rule-based fallback")
        except Exception as e:
            self.model_status["route"] = f"error: {e}"
            print(f"[ERROR] Route model load failed: {e}")

        # Load CNN Incident Model
        try:
            cnn_path = os.path.join(MODELS_DIR, "incident_cnn.pth")
            if os.path.exists(cnn_path):
                try:
                    import torch
                    checkpoint = torch.load(cnn_path, map_location="cpu", weights_only=False)
                    self.incident_classes = checkpoint.get("classes", [])
                    self.model_status["incident_cnn"] = "loaded"
                    print("[OK] CNN Incident model loaded")
                except ImportError:
                    self.model_status["incident_cnn"] = "torch_not_available"
                    print("[WARN] PyTorch not available - CNN model not loaded")
            else:
                self.model_status["incident_cnn"] = "not_found"
                print("[WARN] CNN model not found")
        except Exception as e:
            self.model_status["incident_cnn"] = f"error: {e}"

        self._loaded = True

    def get_status(self) -> Dict[str, Any]:
        """Get model loading status."""
        return {
            "models_loaded": self.model_status,
            "all_loaded": all("loaded" in v for v in self.model_status.values()),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Risk Score Prediction
# ═══════════════════════════════════════════════════════════════════════════════

def predict_risk_score(
    slope_risk: float = 25.0,
    rainfall_24h_mm: float = 12.0,
    road_condition: str = "good",
    bridge_condition: str = "operational",
    historical_disruptions: int = 0,
    congestion_level: str = "low",
    flood_risk_level: float = 0.0,
    landslide_probability: float = 0.1,
    elevation_m: float = 500.0,
    river_proximity: float = 0.5,
    month: int = None,
    road_distance_km: float = 100.0,
    route_id: str = "",
) -> Dict[str, Any]:
    """
    Predict risk score using ML model or rule-based fallback.
    """
    if month is None:
        month = datetime.utcnow().month

    # Encode categorical features
    road_cond_map = {"good": 0, "damaged": 1, "blocked": 2}
    bridge_cond_map = {"operational": 0, "damaged": 1, "closed": 2}
    congestion_map = {"low": 0, "moderate": 1, "high": 2, "blocked": 3}

    features = np.array([[
        slope_risk,
        rainfall_24h_mm,
        road_cond_map.get(road_condition, 0),
        bridge_cond_map.get(bridge_condition, 0),
        historical_disruptions,
        congestion_map.get(congestion_level, 0),
        flood_risk_level,
        landslide_probability,
        elevation_m,
        river_proximity,
        month,
        road_distance_km,
    ]])

    models = MLModels()

    if models.risk_model is not None and models.risk_scaler is not None:
        try:
            features_scaled = models.risk_scaler.transform(features)
            score = int(np.clip(models.risk_model.predict(features_scaled)[0], 0, 100))
        except Exception as e:
            print(f"ML prediction failed, using rule-based: {e}")
            score = _rule_based_risk(slope_risk, rainfall_24h_mm, road_condition,
                                     bridge_condition, historical_disruptions,
                                     congestion_level, flood_risk_level, landslide_probability)
    else:
        score = _rule_based_risk(slope_risk, rainfall_24h_mm, road_condition,
                                 bridge_condition, historical_disruptions,
                                 congestion_level, flood_risk_level, landslide_probability)

    # Determine risk level
    if score > 80:
        level = "critical"
    elif score > 60:
        level = "high"
    elif score > 30:
        level = "medium"
    else:
        level = "low"

    # Detailed factor breakdown
    terrain_sub = min(100, slope_risk)
    rain_sub = min(100, (rainfall_24h_mm / 80) * 100)
    history_sub = min(100, (historical_disruptions / 12) * 100)
    condition_sub = min(100, road_cond_map.get(road_condition, 0) * 35 + bridge_cond_map.get(bridge_condition, 0) * 20)
    traffic_sub = congestion_map.get(congestion_level, 0) * 25
    flood_sub = flood_risk_level * 0.5
    landslide_sub = landslide_probability * 100 * 0.5

    engine = "ml_xgboost" if (models.risk_model is not None) else "rule_based_composite"

    return {
        "score": score,
        "level": level,
        "engine": engine,
        "computedAt": datetime.utcnow().isoformat() + "Z",
        "factors": {
            "terrainSlopeRisk": round(terrain_sub, 1),
            "rainfallIntensity": round(rain_sub, 1),
            "historicalDisruptionScore": round(history_sub, 1),
            "roadConditionScore": round(condition_sub, 1),
            "trafficCongestionScore": round(traffic_sub, 1),
            "floodRiskContribution": round(flood_sub, 1),
            "landslideRiskContribution": round(landslide_sub, 1),
            "recordedRainfallMm": rainfall_24h_mm,
            "historicalDisruptionCount": historical_disruptions,
            "bridgeCondition": bridge_condition,
            "congestionLevel": congestion_level,
        },
    }


def _rule_based_risk(slope_risk, rainfall_24h_mm, road_condition, bridge_condition,
                      historical_disruptions, congestion_level, flood_risk_level, landslide_probability):
    """Rule-based fallback risk computation."""
    road_cond_map = {"good": 15, "damaged": 65, "blocked": 100}
    bridge_cond_map = {"operational": 0, "damaged": 20, "closed": 40}
    congestion_map = {"low": 10, "moderate": 35, "high": 65, "blocked": 100}

    raw = (
        slope_risk * 0.15 +
        min(100, (rainfall_24h_mm / 80) * 100) * 0.20 +
        min(100, (historical_disruptions / 12) * 100) * 0.15 +
        min(100, road_cond_map.get(road_condition, 15) + bridge_cond_map.get(bridge_condition, 0)) * 0.15 +
        congestion_map.get(congestion_level, 10) * 0.10 +
        flood_risk_level * 0.5 * 0.15 +
        landslide_probability * 100 * 0.5 * 0.10
    )
    return int(min(100, max(0, round(raw))))


# ═══════════════════════════════════════════════════════════════════════════════
# Disruption Prediction
# ═══════════════════════════════════════════════════════════════════════════════

def predict_disruption(
    elevation_m: float = 500.0,
    slope_risk: float = 25.0,
    flood_susceptibility: float = 0.3,
    landslide_susceptibility: float = 0.3,
    temp_celsius: float = 25.0,
    humidity_percent: float = 75.0,
    wind_kmh: float = 10.0,
    rainfall_24h_mm: float = 12.0,
    rainfall_48h_mm: float = 20.0,
    rainfall_72h_mm: float = 30.0,
    seasonal_rainfall_avg_mm: float = 150.0,
    month: int = None,
) -> Dict[str, Any]:
    """
    Predict disruption probability for a district.
    """
    if month is None:
        month = datetime.utcnow().month

    features = np.array([[
        elevation_m, slope_risk, flood_susceptibility, landslide_susceptibility,
        temp_celsius, humidity_percent, wind_kmh, rainfall_24h_mm,
        rainfall_48h_mm, rainfall_72h_mm, seasonal_rainfall_avg_mm, month,
    ]])

    models = MLModels()

    results = {}

    if models.disruption_scaler and models.disruption_models:
        try:
            features_scaled = models.disruption_scaler.transform(features)

            for name, model in models.disruption_models.items():
                if name == "severity":
                    pred = float(np.clip(model.predict(features_scaled)[0], 0, 100))
                    results[name] = round(pred, 1)
                else:
                    prob = float(model.predict_proba(features_scaled)[0][1]) if hasattr(model, "predict_proba") else float(model.predict(features_scaled)[0])
                    results[name] = round(prob, 3)

            engine = "ml_xgboost"
        except Exception as e:
            print(f"ML disruption prediction failed: {e}")
            results = _rule_based_disruption(
                slope_risk, rainfall_24h_mm, rainfall_48h_mm,
                flood_susceptibility, landslide_susceptibility, elevation_m
            )
            engine = "rule_based_fallback"
    else:
        results = _rule_based_disruption(
            slope_risk, rainfall_24h_mm, rainfall_48h_mm,
            flood_susceptibility, landslide_susceptibility, elevation_m
        )
        engine = "rule_based"

    # Compute risk levels
    landslide_prob = results.get("landslide", 0.1)
    flood_prob = results.get("flood", 0.1)
    severity = results.get("severity", 20)

    landslide_risk = "High" if landslide_prob >= 0.6 else "Medium" if landslide_prob >= 0.3 else "Low"
    flood_risk = "High" if flood_prob >= 0.6 else "Medium" if flood_prob >= 0.3 else "Low"

    return {
        "landslideRisk": landslide_risk,
        "landslideProbability": landslide_prob,
        "floodRisk": flood_risk,
        "floodProbability": flood_prob,
        "roadBlocked": bool(results.get("road_block", 0) > 0.5),
        "disruptionSeverity": severity,
        "confidenceScore": 0.92 if engine == "ml_xgboost" else 0.82,
        "engine": engine,
        "computedAt": datetime.utcnow().isoformat() + "Z",
    }


def _rule_based_disruption(slope_risk, rainfall_24h, rainfall_48h, flood_susc, land_susc, elevation):
    """Rule-based disruption prediction fallback."""
    landslide_trigger = (rainfall_24h / 50 * 0.35 + rainfall_48h / 100 * 0.25 +
                         slope_risk / 100 * 0.25 + land_susc * 0.15)
    flood_trigger = (rainfall_24h / 60 * 0.30 + rainfall_48h / 120 * 0.25 +
                     flood_susc * 0.25 + (1 if elevation < 200 else 0.5) * 0.10)

    return {
        "landslide": min(1.0, landslide_trigger),
        "flood": min(1.0, flood_trigger),
        "road_block": min(1.0, (landslide_trigger + flood_trigger) / 2),
        "severity": min(100, (landslide_trigger * 40 + flood_trigger * 35 + 25)),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Route Optimization Prediction
# ═══════════════════════════════════════════════════════════════════════════════

def predict_route_optimization(
    distance_km: float = 100.0,
    road_condition: str = "good",
    bridge_condition: str = "operational",
    avg_slope_risk: float = 25.0,
    avg_elevation_m: float = 500.0,
    rainfall_24h_mm: float = 12.0,
    temp_celsius: float = 25.0,
    congestion_level: str = "low",
    flood_risk_level: float = 0.0,
    landslide_probability: float = 0.1,
    commodity_type: str = "general",
    weight_kg: float = 1000.0,
    priority: int = 1,
    month: int = None,
) -> Dict[str, Any]:
    """
    Predict delay, safety score, and route recommendation.
    """
    if month is None:
        month = datetime.utcnow().month

    road_cond_map = {"good": 0, "damaged": 1, "blocked": 2}
    bridge_cond_map = {"operational": 0, "damaged": 1, "closed": 2}
    congestion_map = {"low": 0, "moderate": 1, "high": 2, "blocked": 3}

    # Encode commodity
    commodity_priority = {"medicine": 5, "food": 4, "fuel": 3, "agri": 2, "construction": 1, "general": 1}
    priority_val = commodity_priority.get(commodity_type, priority)

    # Encode commodity type if encoder is available
    models = MLModels()
    commodity_encoded = 0
    if models.commodity_encoder is not None:
        try:
            commodity_encoded = int(models.commodity_encoder.transform([commodity_type])[0])
        except Exception:
            commodity_encoded = 0
    else:
        # Fallback encoding
        commodity_list = ['agri', 'construction', 'food', 'fuel', 'general', 'medicine']
        commodity_encoded = commodity_list.index(commodity_type) if commodity_type in commodity_list else 4

    features = np.array([[
        distance_km,
        road_cond_map.get(road_condition, 0),
        bridge_cond_map.get(bridge_condition, 0),
        avg_slope_risk,
        avg_elevation_m,
        rainfall_24h_mm,
        temp_celsius,
        congestion_map.get(congestion_level, 0),
        flood_risk_level,
        landslide_probability,
        priority_val,
        month,
        commodity_encoded,
    ]])

    models = MLModels()

    if models.route_delay_model and models.route_scaler:
        try:
            features_scaled = models.route_scaler.transform(features)
            delay_min = float(np.clip(models.route_delay_model.predict(features_scaled)[0], 0, None))
            safety_score = int(np.clip(models.route_safety_model.predict(features_scaled)[0], 0, 100))
            route_rank = int(models.route_rank_model.predict(features_scaled)[0])
            engine = "ml_xgboost"
        except Exception as e:
            print(f"ML route prediction failed: {e}")
            delay_min, safety_score, route_rank = _rule_based_route(
                distance_km, road_condition, bridge_condition, rainfall_24h_mm,
                congestion_level, flood_risk_level, landslide_probability
            )
            engine = "rule_based_fallback"
    else:
        delay_min, safety_score, route_rank = _rule_based_route(
            distance_km, road_condition, bridge_condition, rainfall_24h_mm,
            congestion_level, flood_risk_level, landslide_probability
        )
        engine = "rule_based"

    # Compute fuel cost
    weight_factor = 1.0 + (weight_kg / 20000.0)
    fuel_cost = round(distance_km * 14.5 * weight_factor, 0)

    # Travel time
    base_speed = {"good": 48, "damaged": 35, "blocked": 15}.get(road_condition, 40)
    weather_penalty = max(0.3, 1 - rainfall_24h_mm / 100)
    effective_speed = max(5, base_speed * weather_penalty)
    estimated_hours = round(distance_km / effective_speed, 1)

    return {
        "delayMinutes": round(delay_min, 1),
        "safetyScore": safety_score,
        "routeRank": route_rank,
        "estimatedHours": estimated_hours,
        "fuelCostEstimate": fuel_cost,
        "effectiveSpeedKmh": round(effective_speed, 1),
        "engine": engine,
        "computedAt": datetime.utcnow().isoformat() + "Z",
    }


def _rule_based_route(distance_km, road_condition, bridge_condition, rainfall_24h,
                       congestion_level, flood_risk, landslide_prob):
    """Rule-based route optimization fallback."""
    base_speed = {"good": 48, "damaged": 35, "blocked": 15}.get(road_condition, 40)
    weather_penalty = max(0.3, 1 - rainfall_24h / 100)
    speed = max(5, base_speed * weather_penalty)

    travel_hours = distance_km / speed
    free_flow = distance_km / 48
    delay_min = max(0, (travel_hours - free_flow) * 60)

    road_map = {"good": 0, "damaged": 1, "blocked": 2}
    congestion_map = {"low": 0, "moderate": 1, "high": 2, "blocked": 3}
    risk = (road_map.get(road_condition, 0) * 25 + congestion_map.get(congestion_level, 0) * 15 +
            flood_risk * 0.3 + landslide_prob * 100 * 0.3)
    safety = int(max(0, min(100, 100 - risk)))

    rank = 1 if road_condition == "good" and rainfall_24h < 30 else 2 if rainfall_24h < 60 else 3
    return delay_min, safety, rank


# ═══════════════════════════════════════════════════════════════════════════════
# CNN Incident Detection
# ═══════════════════════════════════════════════════════════════════════════════

def predict_incident_from_image(image_path: str = None, image_bytes: bytes = None) -> Dict[str, Any]:
    """
    Detect road incidents from image using CNN model.

    Accepts either a file path or raw image bytes.
    Returns predicted class and confidence.

    For geo-tagged images, also extracts location and recalculates risk.
    """
    models = MLModels()

    CLASSES = [
        "normal_road", "pothole", "landslide_debris", "flood_damage",
        "fallen_tree", "accident", "road_crack", "erosion",
    ]

    if models.incident_classes:
        CLASSES = models.incident_classes

    try:
        import torch
        from torchvision import transforms
        from PIL import Image

        # Load and preprocess image
        if image_bytes:
            from io import BytesIO
            img = Image.open(BytesIO(image_bytes)).convert("RGB")
        elif image_path:
            img = Image.open(image_path).convert("RGB")
        else:
            return {"error": "No image provided"}

        transform = transforms.Compose([
            transforms.Resize((128, 128)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        input_tensor = transform(img).unsqueeze(0)

        # Try loading the trained CNN model
        cnn_path = os.path.join(MODELS_DIR, "incident_cnn.pth")
        if os.path.exists(cnn_path):
            # Load model architecture and weights
            try:
                from app.engine.train import IncidentCNN
                model = IncidentCNN(num_classes=len(CLASSES))
                checkpoint = torch.load(cnn_path, map_location="cpu", weights_only=False)
                model.load_state_dict(checkpoint["model_state_dict"])
                model.eval()

                with torch.no_grad():
                    output = model(input_tensor)
                    probs = torch.softmax(output, dim=1)
                    confidence, predicted_idx = probs.max(1)

                return {
                    "prediction": CLASSES[predicted_idx.item()],
                    "confidence": round(confidence.item(), 4),
                    "all_probabilities": {
                        CLASSES[i]: round(probs[0][i].item(), 4)
                        for i in range(len(CLASSES))
                    },
                    "severity": _incident_severity(CLASSES[predicted_idx.item()]),
                    "engine": "cnn_incident_detection",
                    "computedAt": datetime.utcnow().isoformat() + "Z",
                }
            except Exception as e:
                print(f"CNN inference failed: {e}")

        # Fallback: color-based heuristic
        return _color_based_detection(img)

    except ImportError:
        return {"error": "PyTorch/PIL not available", "engine": "unavailable"}
    except Exception as e:
        return {"error": str(e), "engine": "error"}


def _color_based_detection(img) -> Dict[str, Any]:
    """Simple color-based incident detection as fallback."""
    try:
        from PIL import ImageStat
        stat = ImageStat.Stat(img)
        avg_r, avg_g, avg_b = stat.mean[:3]

        CLASSES = [
            "normal_road", "pothole", "landslide_debris", "flood_damage",
            "fallen_tree", "accident", "road_crack", "erosion",
        ]

        # Simple color heuristics
        if avg_b > avg_r and avg_b > avg_g:
            prediction = "flood_damage"
            confidence = 0.6
        elif avg_r > avg_g and avg_r > avg_b:
            prediction = "landslide_debris"
            confidence = 0.55
        elif avg_g > avg_r and avg_g > avg_b:
            prediction = "fallen_tree"
            confidence = 0.5
        else:
            prediction = "normal_road"
            confidence = 0.65

        return {
            "prediction": prediction,
            "confidence": confidence,
            "engine": "color_heuristic",
            "severity": _incident_severity(prediction),
            "note": "Fallback detection - PyTorch CNN model recommended for production",
            "computedAt": datetime.utcnow().isoformat() + "Z",
        }
    except Exception:
        return {
            "prediction": "unknown",
            "confidence": 0.0,
            "engine": "fallback",
            "computedAt": datetime.utcnow().isoformat() + "Z",
        }


def _incident_severity(incident_type: str) -> str:
    """Map incident type to severity level."""
    severity_map = {
        "normal_road": "none",
        "pothole": "moderate",
        "landslide_debris": "critical",
        "flood_damage": "critical",
        "fallen_tree": "high",
        "accident": "critical",
        "road_crack": "low",
        "erosion": "moderate",
    }
    return severity_map.get(incident_type, "unknown")


# ═══════════════════════════════════════════════════════════════════════════════
# Utility: Get model status
# ═══════════════════════════════════════════════════════════════════════════════

def get_model_status() -> Dict[str, Any]:
    """Get status of all ML models."""
    models = MLModels()
    status = models.get_status()

    # Check for training summary
    summary_path = os.path.join(MODELS_DIR, "training_summary.json")
    if os.path.exists(summary_path):
        with open(summary_path) as f:
            status["training_summary"] = json.load(f)

    return status
