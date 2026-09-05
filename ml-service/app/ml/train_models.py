"""
Raahi ML Model Training Script
========================================
Trains two models on realistic NER (North East India) region data:
1. Risk Scoring Model — predicts composite route risk score (0-100)
2. Disruption Prediction Model — predicts if a route will be disrupted

Training data is generated from real NER region characteristics:
- Terrain profiles (slope, elevation) per NH corridor
- Monsoon rainfall patterns (June-September) per district
- Historical disruption rates per route segment
- Road condition degradation under various weather scenarios
- Bridge load stress patterns

Models use scikit-learn (Random Forest / Gradient Boosting) and are saved
as joblib files for production inference.
"""

import os
import numpy as np
import joblib
from typing import Tuple, List, Dict
from datetime import datetime

# NER region-specific constants for realistic data generation
NER_CORRIDORS = {
    "NH-27": {"base_slope": 15, "base_elevation": 55, "monsoon_rain_multiplier": 1.2, "disruption_rate": 0.08},
    "NH-37": {"base_slope": 20, "base_elevation": 80, "monsoon_rain_multiplier": 1.4, "disruption_rate": 0.12},
    "NH-6":  {"base_slope": 75, "base_elevation": 1200, "monsoon_rain_multiplier": 2.1, "disruption_rate": 0.35},
    "NH-2":  {"base_slope": 85, "base_elevation": 1800, "monsoon_rain_multiplier": 2.5, "disruption_rate": 0.45},
    "NH-306":{"base_slope": 65, "base_elevation": 900, "monsoon_rain_multiplier": 2.0, "disruption_rate": 0.30},
    "NH-415":{"base_slope": 30, "base_elevation": 400, "monsoon_rain_multiplier": 1.5, "disruption_rate": 0.10},
}

NER_MONTHLY_RAINFALL = {  # mm per month for Assam/NER average
    1: 12, 2: 20, 3: 55, 4: 120, 5: 180, 6: 280,
    7: 350, 8: 310, 9: 220, 10: 90, 11: 25, 12: 10,
}

ROAD_CONDITIONS = ["good", "good", "good", "damaged", "blocked"]
BRIDGE_CONDITIONS = ["operational", "operational", "operational", "damaged"]
CONGESTION_LEVELS = ["low", "low", "moderate", "moderate", "high"]
DIRECTIONS = ["low", "moderate", "high", "blocked"]


def generate_risk_training_data(n_samples: int = 5000, seed: int = 42) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate training data for risk scoring model.
    
    Features:
    0: slope_risk (0-100)
    1: elevation_m (0-2500)
    2: rainfall_24h_mm (0-120)
    3: rainfall_7d_mm (0-600)
    4: historical_disruptions (0-20)
    5: road_condition_encoded (0-2: good=0, damaged=1, blocked=2)
    6: bridge_condition_encoded (0-2: operational=0, damaged=1, closed=2)
    7: congestion_encoded (0-3: low=0, moderate=1, high=2, blocked=3)
    8: month (1-12)
    9: is_monsoon (0 or 1)
    10: district_connectivity_score (0-100)
    
    Target: risk_score (0-100)
    """
    rng = np.random.RandomState(seed)
    
    road_enc = {"good": 0, "damaged": 1, "blocked": 2}
    bridge_enc = {"operational": 0, "damaged": 1, "closed": 2}
    cong_enc = {"low": 0, "moderate": 1, "high": 2, "blocked": 3}
    
    X_list = []
    y_list = []
    
    for _ in range(n_samples):
        # Pick a random corridor
        corridor_name = rng.choice(list(NER_CORRIDORS.keys()))
        corridor = NER_CORRIDORS[corridor_name]
        
        month = rng.randint(1, 13)
        is_monsoon = 1 if month in [6, 7, 8, 9] else 0
        
        # Terrain features (with some noise)
        slope_risk = np.clip(corridor["base_slope"] + rng.normal(0, 10), 0, 100)
        elevation = max(0, corridor["base_elevation"] + rng.normal(0, 200))
        
        # Rainfall (monsoon months get heavier rain)
        base_rain = NER_MONTHLY_RAINFALL[month] / 30.0  # daily average
        rain_multiplier = corridor["monsoon_rain_multiplier"]
        rainfall_24h = max(0, base_rain * rain_multiplier * rng.uniform(0.3, 2.5))
        rainfall_7d = rainfall_24h * rng.uniform(3, 8)
        
        # Historical disruptions
        hist_disruptions = rng.poisson(corridor["disruption_rate"] * 30)
        
        # Road/bridge conditions (degrade more in monsoon)
        condition_idx = rng.choice(len(ROAD_CONDITIONS))
        if is_monsoon and rainfall_24h > 30:
            condition_idx = min(2, condition_idx + rng.choice([0, 1]))
        road_cond = ROAD_CONDITIONS[condition_idx]
        
        bridge_idx = rng.choice(len(BRIDGE_CONDITIONS))
        if is_monsoon and rainfall_24h > 40:
            bridge_idx = min(2, bridge_idx + rng.choice([0, 1]))
        bridge_cond = BRIDGE_CONDITIONS[bridge_idx]
        
        congestion = rng.choice(CONGESTION_LEVELS)
        if is_monsoon:
            congestion = rng.choice(["low", "moderate", "high", "blocked"])
        
        connectivity = np.clip(
            95 - corridor["base_slope"] * 0.5 - hist_disruptions * 2 + rng.normal(0, 5),
            10, 100
        )
        
        # Compute realistic target risk score
        terrain_component = slope_risk * 0.22 + (elevation / 25.0) * 0.03
        rain_component = min(100, (rainfall_24h / 80.0) * 100) * 0.25
        history_component = min(100, hist_disruptions * 8) * 0.18
        condition_component = (road_enc[road_cond] * 35 + bridge_enc[bridge_cond] * 15) * 0.20
        traffic_component = cong_enc[congestion] * 25 * 0.12
        
        noise = rng.normal(0, 3)
        raw_score = terrain_component + rain_component + history_component + condition_component + traffic_component + noise
        risk_score = int(np.clip(raw_score, 0, 100))
        
        features = [
            slope_risk, elevation, rainfall_24h, rainfall_7d,
            hist_disruptions, road_enc[road_cond], bridge_enc[bridge_cond],
            cong_enc[congestion], month, is_monsoon, connectivity
        ]
        X_list.append(features)
        y_list.append(risk_score)
    
    return np.array(X_list), np.array(y_list)


def generate_disruption_training_data(n_samples: int = 4000, seed: int = 42) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate training data for disruption prediction model.
    
    Features: same as risk model + time_of_day, vehicle_count, emergency_alert_active
    
    Target: 0 = no disruption, 1 = disruption within 24h
    """
    rng = np.random.RandomState(seed)
    
    road_enc = {"good": 0, "damaged": 1, "blocked": 2}
    bridge_enc = {"operational": 0, "damaged": 1, "closed": 2}
    cong_enc = {"low": 0, "moderate": 1, "high": 2, "blocked": 3}
    
    X_list = []
    y_list = []
    
    for _ in range(n_samples):
        corridor_name = rng.choice(list(NER_CORRIDORS.keys()))
        corridor = NER_CORRIDORS[corridor_name]
        month = rng.randint(1, 13)
        is_monsoon = 1 if month in [6, 7, 8, 9] else 0
        
        slope_risk = np.clip(corridor["base_slope"] + rng.normal(0, 10), 0, 100)
        elevation = max(0, corridor["base_elevation"] + rng.normal(0, 200))
        base_rain = NER_MONTHLY_RAINFALL[month] / 30.0
        rainfall_24h = max(0, base_rain * corridor["monsoon_rain_multiplier"] * rng.uniform(0.3, 2.5))
        rainfall_7d = rainfall_24h * rng.uniform(3, 8)
        hist_disruptions = rng.poisson(corridor["disruption_rate"] * 30)
        
        condition_idx = rng.choice(len(ROAD_CONDITIONS))
        if is_monsoon and rainfall_24h > 30:
            condition_idx = min(2, condition_idx + rng.choice([0, 1]))
        road_cond = ROAD_CONDITIONS[condition_idx]
        bridge_idx = rng.choice(len(BRIDGE_CONDITIONS))
        bridge_cond = BRIDGE_CONDITIONS[bridge_idx]
        congestion = rng.choice(CONGESTION_LEVELS)
        connectivity = np.clip(95 - corridor["base_slope"] * 0.5 - hist_disruptions * 2 + rng.normal(0, 5), 10, 100)
        
        time_of_day = rng.randint(0, 24)
        vehicle_count = rng.poisson(15)
        emergency_alert = 1 if (is_monsoon and rainfall_24h > 50) else 0
        
        features = [
            slope_risk, elevation, rainfall_24h, rainfall_7d,
            hist_disruptions, road_enc[road_cond], bridge_enc[bridge_cond],
            cong_enc[congestion], month, is_monsoon, connectivity,
            time_of_day, vehicle_count, emergency_alert,
        ]
        X_list.append(features)
        
        # Compute disruption probability
        disruption_prob = (
            0.05 +  # base rate
            corridor["disruption_rate"] * 0.5 +
            (rainfall_24h / 120.0) * 0.3 +
            (slope_risk / 100.0) * 0.15 +
            road_enc[road_cond] * 0.1 +
            (1 - connectivity / 100.0) * 0.1
        )
        disruption_prob = min(0.95, disruption_prob)
        disrupted = 1 if rng.random() < disruption_prob else 0
        
        X_list[-1] = features
        y_list.append(disrupted)
    
    return np.array(X_list), np.array(y_list)


def train_risk_model(X: np.ndarray, y: np.ndarray) -> dict:
    """Train Random Forest model for risk score prediction."""
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingClassifier
    from sklearn.model_selection import cross_val_score
    from sklearn.metrics import mean_absolute_error, r2_score
    from sklearn.model_selection import train_test_split
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_split=5,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    cv_scores = cross_val_score(model, X, y, cv=5, scoring='r2')
    
    feature_names = [
        "slope_risk", "elevation_m", "rainfall_24h_mm", "rainfall_7d_mm",
        "historical_disruptions", "road_condition", "bridge_condition",
        "congestion_level", "month", "is_monsoon", "district_connectivity_score",
    ]
    importances = dict(zip(feature_names, [round(float(x), 4) for x in model.feature_importances_]))
    
    return {
        "model": model,
        "metrics": {
            "mae": round(float(mae), 2),
            "r2": round(float(r2), 4),
            "cv_r2_mean": round(float(cv_scores.mean()), 4),
            "cv_r2_std": round(float(cv_scores.std()), 4),
        },
        "feature_importances": importances,
    }


def train_disruption_model(X: np.ndarray, y: np.ndarray) -> dict:
    """Train Gradient Boosting classifier for disruption prediction."""
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.model_selection import cross_val_score
    from sklearn.metrics import accuracy_score, f1_score, classification_report
    from sklearn.model_selection import train_test_split
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        min_samples_split=5,
        random_state=42,
    )
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    
    cv_scores = cross_val_score(model, X, y, cv=5, scoring='f1')
    
    feature_names = [
        "slope_risk", "elevation_m", "rainfall_24h_mm", "rainfall_7d_mm",
        "historical_disruptions", "road_condition", "bridge_condition",
        "congestion_level", "month", "is_monsoon", "district_connectivity_score",
        "time_of_day", "vehicle_count", "emergency_alert",
    ]
    importances = dict(zip(feature_names, [round(float(x), 4) for x in model.feature_importances_]))
    
    return {
        "model": model,
        "metrics": {
            "accuracy": round(float(accuracy), 4),
            "f1_score": round(float(f1), 4),
            "cv_f1_mean": round(float(cv_scores.mean()), 4),
            "cv_f1_std": round(float(cv_scores.std()), 4),
        },
        "feature_importances": importances,
    }


def main():
    models_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models")
    os.makedirs(models_dir, exist_ok=True)
    
    print("=" * 60)
    print("Raahi ML Model Training")
    print(f"Started at: {datetime.utcnow().isoformat()}Z")
    print("=" * 60)
    
    # 1. Train Risk Scoring Model
    print("\n📊 Training Risk Scoring Model...")
    print("  Generating 5000 samples from NER corridor data...")
    X_risk, y_risk = generate_risk_training_data(n_samples=5000)
    print(f"  Feature matrix: {X_risk.shape}")
    print(f"  Target range: [{y_risk.min()}, {y_risk.max()}], mean={y_risk.mean():.1f}")
    
    risk_result = train_risk_model(X_risk, y_risk)
    print(f"\n  ✅ Risk Model Trained:")
    print(f"     MAE: {risk_result['metrics']['mae']}")
    print(f"     R²:  {risk_result['metrics']['r2']}")
    print(f"     CV R² (5-fold): {risk_result['metrics']['cv_r2_mean']} ± {risk_result['metrics']['cv_r2_std']}")
    print(f"\n  Top Feature Importances:")
    sorted_fi = sorted(risk_result['feature_importances'].items(), key=lambda x: x[1], reverse=True)
    for name, imp in sorted_fi[:5]:
        print(f"     {name}: {imp}")
    
    risk_path = os.path.join(models_dir, "risk_scoring_model.joblib")
    joblib.dump(risk_result["model"], risk_path)
    print(f"\n  💾 Saved to: {risk_path}")
    
    # 2. Train Disruption Prediction Model
    print("\n🔮 Training Disruption Prediction Model...")
    print("  Generating 4000 samples from NER corridor data...")
    X_disr, y_disr = generate_disruption_training_data(n_samples=4000)
    print(f"  Feature matrix: {X_disr.shape}")
    print(f"  Disruption rate: {y_disr.mean():.1%}")
    
    disr_result = train_disruption_model(X_disr, y_disr)
    print(f"\n  ✅ Disruption Model Trained:")
    print(f"     Accuracy: {disr_result['metrics']['accuracy']}")
    print(f"     F1 Score: {disr_result['metrics']['f1_score']}")
    print(f"     CV F1 (5-fold): {disr_result['metrics']['cv_f1_mean']} ± {disr_result['metrics']['cv_f1_std']}")
    print(f"\n  Top Feature Importances:")
    sorted_fi = sorted(disr_result['feature_importances'].items(), key=lambda x: x[1], reverse=True)
    for name, imp in sorted_fi[:5]:
        print(f"     {name}: {imp}")
    
    disr_path = os.path.join(models_dir, "disruption_prediction_model.joblib")
    joblib.dump(disr_result["model"], disr_path)
    print(f"\n  💾 Saved to: {disr_path}")
    
    # 3. Save metadata
    metadata = {
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "risk_scoring": {
            "algorithm": "RandomForestRegressor",
            "n_estimators": 200,
            "n_samples": 5000,
            "features": [
                "slope_risk", "elevation_m", "rainfall_24h_mm", "rainfall_7d_mm",
                "historical_disruptions", "road_condition", "bridge_condition",
                "congestion_level", "month", "is_monsoon", "district_connectivity_score",
            ],
            "metrics": risk_result["metrics"],
            "feature_importances": risk_result["feature_importances"],
        },
        "disruption_prediction": {
            "algorithm": "GradientBoostingClassifier",
            "n_estimators": 200,
            "n_samples": 4000,
            "features": [
                "slope_risk", "elevation_m", "rainfall_24h_mm", "rainfall_7d_mm",
                "historical_disruptions", "road_condition", "bridge_condition",
                "congestion_level", "month", "is_monsoon", "district_connectivity_score",
                "time_of_day", "vehicle_count", "emergency_alert",
            ],
            "metrics": disr_result["metrics"],
            "feature_importances": disr_result["feature_importances"],
        },
    }
    
    meta_path = os.path.join(models_dir, "training_metadata.json")
    import json
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"\n  💾 Metadata saved to: {meta_path}")
    
    print("\n" + "=" * 60)
    print("🎉 All models trained and saved successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
