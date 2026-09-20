# Raahi Road Risk & ML Engine (`ml-service`)

Production Machine Learning microservice for the **Raahi Smart Logistics Platform**, providing real-time composite road risk assessment, disruption forecasting (floods, landslides, roadblocks), and dynamic route optimization for North East India (NER corridors).

---

## 📁 Repository Structure

```text
ml-service/
│
├── app.py                  # Primary FastAPI service & endpoint router
├── requirements.txt        # Production dependencies (scikit-learn, xgboost, fastapi)
├── Dockerfile              # Container deployment recipe with dynamic $PORT support
├── model/
│   └── raahi_risk_model.pkl # Bundled pre-trained model, scalers, and feature maps
│
└── README.md               # Documentation & deployment guide
```

---

## 🧠 Machine Learning Model Specifications

- **Model File**: `model/raahi_risk_model.pkl`
- **Primary Algorithm**: XGBoost Regressor (`xgb.XGBRegressor`)
- **Target**: Composite Route Risk Score (`0 - 100`)
- **Severity Categories**:
  - `0 - 30`: **LOW**
  - `31 - 60`: **MEDIUM**
  - `61 - 80`: **HIGH**
  - `81 - 100`: **CRITICAL**

### Input Features (12 Vector)
| # | Feature | Type | Range / Description |
|---|---|---|---|
| 1 | `slope_risk` | Float | 0 - 100 (Terrain gradient risk) |
| 2 | `rainfall_24h_mm` | Float | 0 - 500 mm (24-hour precipitation) |
| 3 | `road_condition` | Int | Encoded: 0 = good, 1 = damaged, 2 = blocked |
| 4 | `bridge_condition` | Int | Encoded: 0 = operational, 1 = damaged, 2 = closed |
| 5 | `historical_disruptions` | Int | Count of past incidents on segment |
| 6 | `congestion_level` | Int | Encoded: 0 = low, 1 = moderate, 2 = high, 3 = blocked |
| 7 | `flood_risk_level` | Float | 0.0 - 1.0 (Google Flood Hub / IMD) |
| 8 | `landslide_probability` | Float | 0.0 - 1.0 (NASA LHASA hazard score) |
| 9 | `elevation_m` | Float | 0 - 3500 m above sea level |
| 10 | `river_proximity` | Float | 0.0 - 1.0 (Proximity index to major rivers) |
| 11 | `month` | Int | 1 - 12 (Monsoon seasonality weighting) |
| 12 | `road_distance_km` | Float | Total corridor length in km |

---

## 🚀 Running Locally

### Option 1: Direct Python Execution
```bash
# 1. Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate    # On Linux/macOS
# or: .\.venv\Scripts\activate  # On Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the application
python app.py
# or: uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

The service will be live at `http://localhost:8000`.
Interactive Swagger API docs: `http://localhost:8000/docs`.

### Option 2: Docker
```bash
# Build Docker image
docker build -t raahi-road-risk:latest .

# Run container
docker run -p 8000:8000 raahi-road-risk:latest
```

---

## ☁️ 1-Click Cloud Deployment Guides

### 1. Deploying to Render (Recommended)
1. Fork or push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com/), click **New +** -> **Web Service**.
3. Connect your repository and select the `ml-service` directory (Root Directory: `ml-service`).
4. Settings:
   - **Runtime**: `Python 3` (or `Docker`)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Click **Create Web Service**. Render automatically assigns `$PORT` and provides a public HTTPS URL.

### 2. Deploying to Railway
1. Go to [Railway.app](https://railway.app/) and click **New Project** -> **Deploy from GitHub repo**.
2. Select your repository. Railway automatically detects `Dockerfile` and deploys the container.
3. Add environment variable `PORT=8000` (optional; Railway injects `$PORT` automatically).

### 3. Deploying to Hugging Face Spaces
1. Create a new Space with SDK: **Docker**.
2. Push `app.py`, `requirements.txt`, `Dockerfile`, and `model/raahi_risk_model.pkl`.
3. In `Dockerfile`, set `EXPOSE 7860` and `CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]`.

---

## 📡 Key API Endpoints & Usage

### 1. Health Check
```bash
curl -X GET http://localhost:8000/health
```
**Response:**
```json
{
  "status": "online",
  "service": "Raahi ML Engine (FastAPI)",
  "version": "3.0.0",
  "engineMode": "ml_powered_hybrid",
  "modelFile": "model/raahi_risk_model.pkl",
  "modelLoaded": true
}
```

### 2. Predict Route Risk Score
```bash
curl -X POST http://localhost:8000/risk/route-score \
  -H "Content-Type: application/json" \
  -d '{
    "routeId": "ROUTE-NH27-GUW-TEZ",
    "roadIds": ["kamrup", "sonitpur"],
    "slopeRisk": 35.0,
    "roadCondition": "damaged",
    "bridgeCondition": "operational",
    "congestionLevel": "moderate",
    "historicalDisruptions": 3,
    "weatherSnapshot": {
      "city": "Guwahati",
      "rainfall_24h_mm": 45.0,
      "temp_celsius": 28.0,
      "humidity_percent": 88.0
    }
  }'
```
**Response:**
```json
{
  "score": 68,
  "level": "HIGH",
  "factors": {
    "rainfall": "Heavy monsoon rainfall",
    "terrain": "Moderate hill incline",
    "road": "Damaged surface penalty"
  },
  "computedAt": "2026-09-18T16:30:00Z",
  "engine": "xgboost_v3"
}
```

### 3. Real-Time Route Plan (OSRM + Real Roads)
```bash
curl -X POST http://localhost:8000/route/plan \
  -H "Content-Type: application/json" \
  -d '{
    "originDistrictId": "kamrup",
    "destDistrictId": "sonitpur",
    "vehicleType": "medium_commercial",
    "commodity": "medical_oxygen"
  }'
```

---

## 🔒 Environment Variables (Optional)
Configure in `.env` for real-time external data enrichment:
- `PORT` — Server listening port (default: `8000`)
- `IMD_API_KEY` — Indian Meteorological Department alerts
- `TOMTOM_API_KEY` — Real-time live traffic congestion
- `NASA_EARTHDATA_USER` — NASA LHASA landslide susceptibility
- `GOOGLE_FLOOD_KEY` — Google Flood Hub river gauges
