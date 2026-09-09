"""
ML Model Training Pipeline for Raahi Platform.

Trains and saves:
1. Risk Scoring Model (XGBoost) - route-level risk assessment
2. Disruption Prediction Model (XGBoost) - multi-output: flood/landslide/road-block
3. Route Optimization Model (XGBoost) - delay estimation + safety scoring
4. CNN Incident Detection Model (PyTorch) - road damage image classification

All models are saved to ml-service/app/engine/saved_models/
"""

import os
import sys
import json
import numpy as np
import pandas as pd
import joblib
from datetime import datetime
from typing import Dict, Any, Tuple

# ML imports
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, classification_report, f1_score
)
import xgboost as xgb

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.engine.training_data_generator import (
    generate_risk_training_data,
    generate_disruption_training_data,
    generate_route_optimization_data,
    generate_all_training_data,
)

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_models")
TRAINING_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "training_data")

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


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Risk Scoring Model
# ═══════════════════════════════════════════════════════════════════════════════

def train_risk_model(df: pd.DataFrame) -> Dict[str, Any]:
    """Train XGBoost model for route risk scoring."""
    print("\n" + "="*60)
    print("Training Risk Scoring Model (XGBoost)")
    print("="*60)

    X = df[RISK_FEATURES].copy()
    y = df["risk_score"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train XGBoost regressor
    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=8,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        objective="reg:squarederror",
    )

    model.fit(
        X_train_scaled, y_train,
        eval_set=[(X_test_scaled, y_test)],
        verbose=False,
    )

    # Evaluate
    y_pred = model.predict(X_test_scaled)
    y_pred = np.clip(y_pred, 0, 100)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    # Classification accuracy for risk levels
    def score_to_level(s):
        if s > 80: return "critical"
        elif s > 60: return "high"
        elif s > 30: return "medium"
        else: return "low"

    true_levels = [score_to_level(s) for s in y_test]
    pred_levels = [score_to_level(s) for s in y_pred]
    level_accuracy = accuracy_score(true_levels, pred_levels)
    f1 = f1_score(true_levels, pred_levels, average="weighted")

    print(f"  MAE: {mae:.2f}")
    print(f"  RMSE: {rmse:.2f}")
    print(f"  R²: {r2:.4f}")
    print(f"  Risk Level Accuracy: {level_accuracy:.2%}")
    print(f"  F1 Score (weighted): {f1:.4f}")

    # Feature importance
    importance = dict(zip(RISK_FEATURES, [float(x) for x in model.feature_importances_]))
    sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    print("\n  Feature Importance:")
    for feat, imp in sorted_imp:
        print(f"    {feat}: {imp:.4f}")

    # Save model and scaler
    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump(model, os.path.join(MODELS_DIR, "risk_model.joblib"))
    joblib.dump(scaler, os.path.join(MODELS_DIR, "risk_scaler.joblib"))

    metrics = {
        "mae": round(float(mae), 3),
        "rmse": round(float(rmse), 3),
        "r2": round(float(r2), 4),
        "level_accuracy": round(float(level_accuracy), 4),
        "f1_score": round(float(f1), 4),
        "feature_importance": {k: round(float(v), 4) for k, v in sorted_imp},
        "trained_at": datetime.utcnow().isoformat(),
        "n_samples": int(len(df)),
    }

    with open(os.path.join(MODELS_DIR, "risk_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    return metrics


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Disruption Prediction Model
# ═══════════════════════════════════════════════════════════════════════════════

def train_disruption_model(df: pd.DataFrame) -> Dict[str, Any]:
    """Train XGBoost models for disruption prediction (multi-output)."""
    print("\n" + "="*60)
    print("Training Disruption Prediction Model (XGBoost Multi-Output)")
    print("="*60)

    X = df[DISRUPTION_FEATURES].copy()

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    results = {}
    models = {}

    # Train separate models for each disruption type
    targets = {
        "landslide": "landslide_occurred",
        "flood": "flood_occurred",
        "road_block": "road_blocked",
        "severity": "disruption_severity",
    }

    for name, target_col in targets.items():
        print(f"\n  Training {name} model...")
        y = df[target_col].values

        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

        if name == "severity":
            # Regression model for severity
            model = xgb.XGBRegressor(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
            )
            model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
            y_pred = np.clip(model.predict(X_test), 0, 100)
            mae = mean_absolute_error(y_test, y_pred)
            rmse = np.sqrt(mean_squared_error(y_test, y_pred))
            r2 = r2_score(y_test, y_pred)
            print(f"    MAE: {mae:.2f}, RMSE: {rmse:.2f}, R²: {r2:.4f}")
            results[name] = {"mae": round(float(mae), 3), "rmse": round(float(rmse), 3), "r2": round(float(r2), 4)}
        else:
            # Classification model for occurrence
            model = xgb.XGBClassifier(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                use_label_encoder=False,
                eval_metric="logloss",
            )
            model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
            y_pred = model.predict(X_test)
            acc = accuracy_score(y_test, y_pred)
            f1 = f1_score(y_test, y_pred, average="weighted")
            print(f"    Accuracy: {acc:.2%}, F1: {f1:.4f}")
            results[name] = {"accuracy": round(float(acc), 4), "f1": round(float(f1), 4)}

        models[name] = model

    # Save models
    os.makedirs(MODELS_DIR, exist_ok=True)
    for name, model in models.items():
        joblib.dump(model, os.path.join(MODELS_DIR, f"disruption_{name}_model.joblib"))
    joblib.dump(scaler, os.path.join(MODELS_DIR, "disruption_scaler.joblib"))

    metrics = {
        "results": results,
        "trained_at": datetime.utcnow().isoformat(),
        "n_samples": int(len(df)),
    }
    with open(os.path.join(MODELS_DIR, "disruption_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    return metrics


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Route Optimization Model
# ═══════════════════════════════════════════════════════════════════════════════

def train_route_optimization_model(df: pd.DataFrame) -> Dict[str, Any]:
    """Train XGBoost model for route delay estimation and safety scoring."""
    print("\n" + "="*60)
    print("Training Route Optimization Model (XGBoost)")
    print("="*60)

    # Encode commodity type
    le_commodity = LabelEncoder()
    df = df.copy()
    df["commodity_encoded"] = le_commodity.fit_transform(df["commodity_type"])

    features = ROUTE_FEATURES + ["commodity_encoded"]
    X = df[features].copy()

    # Scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    results = {}

    # --- Delay Prediction (Regression) ---
    print("\n  Training delay prediction model...")
    y_delay = df["delay_minutes"].values
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_delay, test_size=0.2, random_state=42)

    delay_model = xgb.XGBRegressor(
        n_estimators=250,
        max_depth=7,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )
    delay_model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    y_pred = np.clip(delay_model.predict(X_test), 0, None)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    print(f"    MAE: {mae:.1f} min, RMSE: {rmse:.1f} min, R²: {r2:.4f}")
    results["delay"] = {"mae": round(float(mae), 2), "rmse": round(float(rmse), 2), "r2": round(float(r2), 4)}

    # --- Safety Score Prediction (Regression) ---
    print("\n  Training safety score model...")
    y_safety = df["safety_score"].values
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_safety, test_size=0.2, random_state=42)

    safety_model = xgb.XGBRegressor(
        n_estimators=250,
        max_depth=7,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )
    safety_model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    y_pred = np.clip(safety_model.predict(X_test), 0, 100)

    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    print(f"    MAE: {mae:.1f}, R²: {r2:.4f}")
    results["safety"] = {"mae": round(float(mae), 2), "r2": round(float(r2), 4)}

    # --- Route Rank Prediction (Classification) ---
    print("\n  Training route rank model...")
    le_rank = LabelEncoder()
    y_rank = le_rank.fit_transform(df["route_rank"].values)
    joblib.dump(le_rank, os.path.join(MODELS_DIR, "rank_encoder.joblib"))
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_rank, test_size=0.2, random_state=42)

    rank_model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        use_label_encoder=False,
        eval_metric="mlogloss",
    )
    rank_model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    y_pred = rank_model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted")
    print(f"    Accuracy: {acc:.2%}, F1: {f1:.4f}")
    results["rank"] = {"accuracy": round(float(acc), 4), "f1": round(float(f1), 4)}
    results["rank_classes"] = [int(c) for c in le_rank.classes_]

    # Save models
    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump(delay_model, os.path.join(MODELS_DIR, "route_delay_model.joblib"))
    joblib.dump(safety_model, os.path.join(MODELS_DIR, "route_safety_model.joblib"))
    joblib.dump(rank_model, os.path.join(MODELS_DIR, "route_rank_model.joblib"))
    joblib.dump(scaler, os.path.join(MODELS_DIR, "route_scaler.joblib"))
    joblib.dump(le_commodity, os.path.join(MODELS_DIR, "commodity_encoder.joblib"))

    metrics = {
        "results": results,
        "trained_at": datetime.utcnow().isoformat(),
        "n_samples": int(len(df)),
        "features": features,
    }
    with open(os.path.join(MODELS_DIR, "route_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    return metrics


# ═══════════════════════════════════════════════════════════════════════════════
# 4. CNN Incident Detection Model
# ═══════════════════════════════════════════════════════════════════════════════

def train_cnn_incident_model():
    """
    Train a CNN model for road damage/incident detection from images.

    Architecture: Lightweight CNN for mobile/edge deployment.
    Classes: normal_road, pothole, landslide_debris, flood_damage,
             fallen_tree, accident, road_crack, erosion

    Since we don't have a real image dataset, we create the model architecture
    and train it with synthetic feature vectors that simulate image features.
    In production, this would be replaced with real labeled images from
    field reports (geotagged photos from the mobile app).
    """
    print("\n" + "="*60)
    print("Training CNN Incident Detection Model")
    print("="*60)

    try:
        import torch
        import torch.nn as nn
        import torch.optim as optim
        from torch.utils.data import DataLoader, TensorDataset
        HAS_TORCH = True
    except ImportError:
        print("  PyTorch not available, creating placeholder model...")
        HAS_TORCH = False

    CLASSES = [
        "normal_road", "pothole", "landslide_debris", "flood_damage",
        "fallen_tree", "accident", "road_crack", "erosion",
    ]

    if HAS_TORCH:
        # Define CNN architecture
        class IncidentCNN(nn.Module):
            def __init__(self, num_classes=8):
                super().__init__()
                self.features = nn.Sequential(
                    # Block 1: 3 -> 32 channels
                    nn.Conv2d(3, 32, kernel_size=3, padding=1),
                    nn.BatchNorm2d(32),
                    nn.ReLU(inplace=True),
                    nn.Conv2d(32, 32, kernel_size=3, padding=1),
                    nn.BatchNorm2d(32),
                    nn.ReLU(inplace=True),
                    nn.MaxPool2d(2, 2),
                    nn.Dropout2d(0.25),

                    # Block 2: 32 -> 64 channels
                    nn.Conv2d(32, 64, kernel_size=3, padding=1),
                    nn.BatchNorm2d(64),
                    nn.ReLU(inplace=True),
                    nn.Conv2d(64, 64, kernel_size=3, padding=1),
                    nn.BatchNorm2d(64),
                    nn.ReLU(inplace=True),
                    nn.MaxPool2d(2, 2),
                    nn.Dropout2d(0.25),

                    # Block 3: 64 -> 128 channels
                    nn.Conv2d(64, 128, kernel_size=3, padding=1),
                    nn.BatchNorm2d(128),
                    nn.ReLU(inplace=True),
                    nn.Conv2d(128, 128, kernel_size=3, padding=1),
                    nn.BatchNorm2d(128),
                    nn.ReLU(inplace=True),
                    nn.MaxPool2d(2, 2),
                    nn.Dropout2d(0.25),
                )
                self.classifier = nn.Sequential(
                    nn.AdaptiveAvgPool2d((1, 1)),
                    nn.Flatten(),
                    nn.Linear(128, 256),
                    nn.ReLU(inplace=True),
                    nn.Dropout(0.5),
                    nn.Linear(256, 128),
                    nn.ReLU(inplace=True),
                    nn.Dropout(0.3),
                    nn.Linear(128, num_classes),
                )

            def forward(self, x):
                x = self.features(x)
                x = self.classifier(x)
                return x

        model = IncidentCNN(num_classes=len(CLASSES))

        # Generate synthetic training data (in production, use real images)
        # Create random image-like tensors to validate the pipeline
        print("  Generating synthetic training tensors...")
        n_samples = 800
        img_size = 128

        # Random images with class-specific patterns
        images = []
        labels = []
        for i in range(n_samples):
            cls = i % len(CLASSES)
            # Create class-specific texture patterns
            img = torch.randn(3, img_size, img_size) * 0.3
            # Add class-specific features
            if cls == 0:  # normal_road - smooth
                img += 0.1
            elif cls == 1:  # pothole - dark circular
                cx, cy = img_size//2, img_size//2
                for x in range(img_size):
                    for y in range(img_size):
                        if (x-cx)**2 + (y-cy)**2 < (img_size//4)**2:
                            img[0, x, y] -= 0.5
            elif cls == 2:  # landslide_debris - brown/rough texture
                img[0] += 0.3  # reddish
                img[1] += 0.1
                img[2] -= 0.1
            elif cls == 3:  # flood_damage - blue tones
                img[2] += 0.4
            elif cls == 4:  # fallen_tree - green/brown
                img[1] += 0.3
                img[0] += 0.2
            elif cls == 5:  # accident - mixed colors
                img[0] += 0.4
                img[1] -= 0.2
            elif cls == 6:  # road_crack - dark lines
                img -= 0.3
                for x in range(img_size):
                    img[:, x, img_size//2 + np.random.randint(-5, 5)] -= 0.5
            elif cls == 7:  # erosion - texture variation
                img += torch.randn(3, img_size, img_size) * 0.5

            images.append(img)
            labels.append(cls)

        images = torch.stack(images)
        labels = torch.tensor(labels, dtype=torch.long)

        # Split data
        split = int(0.8 * n_samples)
        train_dataset = TensorDataset(images[:split], labels[:split])
        test_dataset = TensorDataset(images[split:], labels[split:])
        train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
        test_loader = DataLoader(test_dataset, batch_size=32)

        # Train
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = model.to(device)
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)
        scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.5)

        print(f"  Training on {device} for 15 epochs...")
        model.train()
        for epoch in range(15):
            total_loss = 0
            correct = 0
            total = 0
            for batch_imgs, batch_labels in train_loader:
                batch_imgs, batch_labels = batch_imgs.to(device), batch_labels.to(device)
                optimizer.zero_grad()
                outputs = model(batch_imgs)
                loss = criterion(outputs, batch_labels)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()
                _, predicted = outputs.max(1)
                correct += predicted.eq(batch_labels).sum().item()
                total += batch_labels.size(0)
            scheduler.step()
            if (epoch + 1) % 5 == 0:
                print(f"    Epoch {epoch+1}/15 - Loss: {total_loss/len(train_loader):.4f}, Acc: {100*correct/total:.1f}%")

        # Evaluate
        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for batch_imgs, batch_labels in test_loader:
                batch_imgs, batch_labels = batch_imgs.to(device), batch_labels.to(device)
                outputs = model(batch_imgs)
                _, predicted = outputs.max(1)
                correct += predicted.eq(batch_labels).sum().item()
                total += batch_labels.size(0)
        print(f"  Test Accuracy: {100*correct/total:.1f}%")

        # Save model
        os.makedirs(MODELS_DIR, exist_ok=True)
        torch.save({
            "model_state_dict": model.state_dict(),
            "classes": CLASSES,
            "img_size": img_size,
            "model_architecture": "IncidentCNN",
        }, os.path.join(MODELS_DIR, "incident_cnn.pth"))

        # Also save via TorchScript for production
        model.eval()
        example_input = torch.randn(1, 3, img_size, img_size).to(device)
        try:
            traced_model = torch.jit.trace(model, example_input)
            traced_model.save(os.path.join(MODELS_DIR, "incident_cnn_traced.pt"))
            print("  TorchScript model saved.")
        except Exception as e:
            print(f"  TorchScript trace failed: {e}")

        metrics = {
            "classes": CLASSES,
            "n_classes": len(CLASSES),
            "img_size": img_size,
            "device": str(device),
            "trained_at": datetime.utcnow().isoformat(),
            "n_samples": n_samples,
        }
    else:
        # Create placeholder model info
        os.makedirs(MODELS_DIR, exist_ok=True)
        metrics = {
            "classes": CLASSES,
            "n_classes": len(CLASSES),
            "img_size": 128,
            "model_architecture": "IncidentCNN",
            "status": "placeholder - PyTorch not installed",
            "trained_at": datetime.utcnow().isoformat(),
        }

    with open(os.path.join(MODELS_DIR, "incident_cnn_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"  Classes: {CLASSES}")
    return metrics


# ═══════════════════════════════════════════════════════════════════════════════
# Main Training Pipeline
# ═══════════════════════════════════════════════════════════════════════════════

def train_all_models():
    """Train all ML models and save to disk."""
    print("\n" + "="*60)
    print("  Raahi Platform - ML Model Training Pipeline")
    print("  " + datetime.utcnow().isoformat())
    print("="*60)

    # Generate training data
    print("\n--- Generating Training Data ---")
    risk_df, disruption_df, route_df = generate_all_training_data(
        output_dir=TRAINING_DATA_DIR
    )

    all_metrics = {}

    # 1. Risk Scoring Model
    all_metrics["risk"] = train_risk_model(risk_df)

    # 2. Disruption Prediction Model
    all_metrics["disruption"] = train_disruption_model(disruption_df)

    # 3. Route Optimization Model
    all_metrics["route_optimization"] = train_route_optimization_model(route_df)

    # 4. CNN Incident Detection Model
    all_metrics["incident_cnn"] = train_cnn_incident_model()

    # Save overall metrics
    os.makedirs(MODELS_DIR, exist_ok=True)
    with open(os.path.join(MODELS_DIR, "training_summary.json"), "w") as f:
        json.dump(all_metrics, f, indent=2)

    print("\n" + "="*60)
    print("  All models trained and saved!")
    print(f"  Models directory: {MODELS_DIR}")
    print("="*60)

    return all_metrics


def retrain_risk_model_with_feedback(feedback_samples: list = None) -> Dict[str, Any]:
    """
    Automated Closed-Loop Continual Retraining:
    Incorporates operational feedback (smooth transits & hard false negatives)
    with elevated sample_weights into the XGBoost Risk Scoring model.
    """
    print("\n" + "="*60)
    print("  Raahi Continual Learning: Retraining Risk Model with Feedback")
    print("  " + datetime.utcnow().isoformat())
    print("="*60)

    # 1. Load base training data or generate fresh baseline
    base_data_path = os.path.join(TRAINING_DATA_DIR, "risk_training_data.csv")
    if os.path.exists(base_data_path):
        base_df = pd.read_csv(base_data_path)
    else:
        base_df = generate_risk_training_data(n_samples=3000)

    base_df["sample_weight"] = 1.0

    feedback_rows = []
    hard_samples_count = 0
    smooth_samples_count = 0

    road_cond_map = {"good": 0, "damaged": 1, "blocked": 2}
    bridge_cond_map = {"operational": 0, "damaged": 1, "closed": 2}
    congestion_map = {"low": 0, "moderate": 1, "high": 2, "blocked": 3}

    if feedback_samples and len(feedback_samples) > 0:
        for s in feedback_samples:
            feat = s.get("features", {})

            # Scale slope_risk to 0-100 if given as ratio
            slope = float(feat.get("slope_risk", 25.0))
            if slope <= 1.0:
                slope *= 100.0

            # Encode categorical / handle string features
            rc = feat.get("road_condition", 0)
            if isinstance(rc, str):
                rc = road_cond_map.get(rc.lower(), 0)

            bc = feat.get("bridge_condition", 0)
            if isinstance(bc, str):
                bc = bridge_cond_map.get(bc.lower(), 0)

            cg = feat.get("congestion_level", 0)
            if isinstance(cg, str):
                cg = congestion_map.get(cg.lower(), 0)

            # Flood risk scale
            fr = float(feat.get("flood_risk_level", 15.0))
            if fr <= 1.0:
                fr *= 100.0

            # Landslide prob scale
            lp = float(feat.get("landslide_probability", 0.2))
            if lp > 1.0:
                lp /= 100.0

            predicted_score = float(s.get("predictedRiskScore", 50.0))
            actual_score = float(s.get("actualRiskScore", 80.0))
            outcome = s.get("actualOutcome", "disruption")
            is_fn = s.get("isFalseNegative", False)

            # Automated Hard Sample Mining:
            # If model predicted score < 40 and disruption occurred, elevate sample weight to 4.0x
            if (predicted_score < 40.0 and (outcome in ["disruption", "stranded"] or actual_score >= 70.0)) or is_fn:
                sample_weight = max(float(s.get("sampleWeight", 4.0)), 4.0)
                hard_samples_count += 1
            elif outcome == "smooth_transit":
                sample_weight = 1.0
                smooth_samples_count += 1
            else:
                sample_weight = float(s.get("sampleWeight", 1.5))

            row = {
                "slope_risk": slope,
                "rainfall_24h_mm": float(feat.get("rainfall_24h_mm", 20.0)),
                "road_condition": float(rc),
                "bridge_condition": float(bc),
                "historical_disruptions": float(feat.get("historical_disruptions", 2)),
                "congestion_level": float(cg),
                "flood_risk_level": fr,
                "landslide_probability": lp,
                "elevation_m": float(feat.get("elevation_m", 300.0)),
                "river_proximity": float(feat.get("river_proximity", 1.5)),
                "month": float(feat.get("month", datetime.utcnow().month)),
                "road_distance_km": float(feat.get("road_distance_km", 70.0)),
                "risk_score": actual_score,
                "sample_weight": sample_weight,
            }
            feedback_rows.append(row)

        print(f"  [ACTIVE LEARNING] Ingested {len(feedback_rows)} operational samples ({hard_samples_count} Hard False Negatives with 4.0x+ weights, {smooth_samples_count} smooth runs).")

    if feedback_rows:
        feedback_df = pd.DataFrame(feedback_rows)
        combined_df = pd.concat([base_df, feedback_df], ignore_index=True)
    else:
        combined_df = base_df

    X = combined_df[RISK_FEATURES].copy()
    y = combined_df["risk_score"].values
    weights = combined_df["sample_weight"].values

    # Train / test split (preserving weights)
    X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
        X, y, weights, test_size=0.2, random_state=42
    )

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train XGBoost regressor with sample weights
    model = xgb.XGBRegressor(
        n_estimators=320,
        max_depth=8,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        objective="reg:squarederror",
    )

    model.fit(
        X_train_scaled, y_train,
        sample_weight=w_train,
        eval_set=[(X_test_scaled, y_test)],
        verbose=False,
    )

    # Evaluate
    y_pred = model.predict(X_test_scaled)
    y_pred = np.clip(y_pred, 0, 100)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    def score_to_level(s):
        if s > 80: return "critical"
        elif s > 60: return "high"
        elif s > 30: return "medium"
        else: return "low"

    true_levels = [score_to_level(s) for s in y_test]
    pred_levels = [score_to_level(s) for s in y_pred]
    level_accuracy = accuracy_score(true_levels, pred_levels)
    f1 = f1_score(true_levels, pred_levels, average="weighted")

    # Feature importance
    importance = dict(zip(RISK_FEATURES, [float(x) for x in model.feature_importances_]))
    sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)

    # Save updated weights and scaler
    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump(model, os.path.join(MODELS_DIR, "risk_model.joblib"))
    joblib.dump(scaler, os.path.join(MODELS_DIR, "risk_scaler.joblib"))

    # Track continual learning history
    history_path = os.path.join(MODELS_DIR, "continual_learning_history.json")
    history = []
    if os.path.exists(history_path):
        try:
            with open(history_path, "r") as f:
                history = json.load(f)
        except Exception:
            history = []

    iteration_num = len(history) + 1
    record = {
        "iteration": iteration_num,
        "timestamp": datetime.utcnow().isoformat(),
        "total_samples": int(len(combined_df)),
        "new_feedback_samples": len(feedback_rows),
        "hard_false_negatives": hard_samples_count,
        "smooth_transits": smooth_samples_count,
        "metrics": {
            "mae": round(float(mae), 3),
            "rmse": round(float(rmse), 3),
            "r2": round(float(r2), 4),
            "level_accuracy": round(float(level_accuracy), 4),
            "f1_score": round(float(f1), 4),
        },
        "top_features": sorted_imp[:5],
    }
    history.append(record)
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)

    metrics = {
        "mae": round(float(mae), 3),
        "rmse": round(float(rmse), 3),
        "r2": round(float(r2), 4),
        "level_accuracy": round(float(level_accuracy), 4),
        "f1_score": round(float(f1), 4),
        "feature_importance": {k: round(float(v), 4) for k, v in sorted_imp},
        "trained_at": datetime.utcnow().isoformat(),
        "n_samples": int(len(combined_df)),
        "continual_learning": record,
    }

    with open(os.path.join(MODELS_DIR, "risk_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # Hot-reload in-memory model in MLModels singleton
    try:
        from app.engine.ml_inference import MLModels
        MLModels().reload_risk_model()
        print("  [OK] Hot-reloaded MLModels into active FastAPI memory!")
    except Exception as reload_err:
        print(f"  [WARN] In-memory hot-reload notification: {reload_err}")

    print(f"  [OK] Retraining complete (Iteration #{iteration_num}) | MAE: {mae:.2f} | R²: {r2:.4f} | Accuracy: {level_accuracy:.2%}")
    return metrics


if __name__ == "__main__":
    train_all_models()
