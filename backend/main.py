from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "supply_chain_model.pkl"
PREPROCESSOR_PATH = BASE_DIR / "supply_chain_preprocessor.pkl"
ALERTS_PATH = BASE_DIR / "ai_agent_alerts.csv"

app = FastAPI(title="ColdGuard AI — SAP Warehouse Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://coldguard-ai.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
preprocessor = None
load_error = None

# Latest live data received from ESP32.
# Note: this is stored in memory and resets if the Render service restarts.
esp32_latest_data: dict[str, Any] = {}

try:
    model = joblib.load(MODEL_PATH)
    preprocessor = joblib.load(PREPROCESSOR_PATH)
except Exception as exc:
    load_error = str(exc)

try:
    alerts_df = pd.read_csv(ALERTS_PATH)
except Exception:
    alerts_df = pd.DataFrame()


def json_records(df: pd.DataFrame):
    return df.where(pd.notnull(df), None).to_dict(orient="records")


# =====================================================
# ESP32 CLOUD API
# =====================================================

@app.post("/api/esp32/data")
def receive_esp32_data(payload: dict[str, Any]):
    global esp32_latest_data

    esp32_latest_data = payload

    return {
        "status": "received",
        "data": esp32_latest_data,
    }


@app.get("/api/esp32/data")
def get_esp32_data():
    if not esp32_latest_data:
        return {
            "status": "waiting",
            "message": "No ESP32 data received yet",
            "data": None,
        }

    return {
        "status": "online",
        "data": esp32_latest_data,
    }


# =====================================================
# SAP WAREHOUSE AGENT
# =====================================================

@app.get("/api/sap-warehouse/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None and preprocessor is not None,
        "load_error": load_error,
    }


@app.get("/api/sap-warehouse/schema")
def schema():
    if preprocessor is None:
        raise HTTPException(status_code=503, detail=f"ML model unavailable: {load_error}")
    return {"features": list(getattr(preprocessor, "feature_names_in_", []))}


@app.get("/api/sap-warehouse/overview")
def overview():
    if alerts_df.empty:
        return {
            "total_alerts": 0,
            "high_risk": 0,
            "medium_risk": 0,
            "low_risk": 0,
            "reorder_required": 0,
        }

    risk = alerts_df.get("Supply_Chain_Risk", pd.Series(dtype=str)).astype(str)
    reorder = alerts_df.get("Reorder_Flag", pd.Series(dtype=str)).astype(str)

    return {
        "total_alerts": int(len(alerts_df)),
        "high_risk": int((risk == "HIGH").sum()),
        "medium_risk": int((risk == "MEDIUM").sum()),
        "low_risk": int((risk == "LOW").sum()),
        "reorder_required": int((reorder == "REORDER").sum()),
    }


@app.get("/api/sap-warehouse/alerts")
def alerts(risk: str = Query("ALL"), reorder: str = Query("")):
    if alerts_df.empty:
        return {"count": 0, "items": []}

    df = alerts_df.copy()

    if risk != "ALL":
        df = df[df.get("Supply_Chain_Risk", "") == risk]

    if reorder:
        df = df[df.get("Reorder_Flag", "") == reorder]

    return {
        "count": int(len(df)),
        "items": json_records(df.head(250)),
    }


@app.post("/api/sap-warehouse/predict")
def predict(payload: dict[str, Any]):
    if model is None or preprocessor is None:
        raise HTTPException(status_code=503, detail=f"ML model unavailable: {load_error}")

    features = list(getattr(preprocessor, "feature_names_in_", []))

    if not features:
        raise HTTPException(status_code=500, detail="Model input schema could not be determined")

    row = {}

    numeric = {
        "Opening_Stock",
        "Incoming_Stock",
        "Lead_Time_Days",
        "Supplier_Delay_Days",
        "Demand_7D_Avg",
        "Demand_30D_Avg",
        "Demand_7D_Std",
        "Stock_Cover_Days",
        "Previous_Day_Demand",
        "Demand_Change_Pct",
        "Day_Number",
        "Day_of_Week_Num",
        "Month",
        "Demand_Lag_1",
        "Demand_Lag_7",
        "Demand_Lag_30",
    }

    missing = []

    for feature in features:
        if feature not in payload or payload[feature] in (None, ""):
            missing.append(feature)
            continue

        value = payload[feature]

        if feature in numeric:
            try:
                value = float(value)
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail=f"{feature} must be numeric")

        row[feature] = value

    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required fields: {', '.join(missing)}",
        )

    try:
        input_df = pd.DataFrame([row], columns=features)
        transformed = preprocessor.transform(input_df)
        prediction = float(model.predict(transformed)[0])

        return {
            "predicted_demand": prediction,
            "model": "supply_chain_model",
        }

    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Prediction failed: {exc}",
        ) from exc


# =====================================================
# SAP WAREHOUSE MANAGER BOT
# =====================================================

from math import radians, sin, cos, sqrt, atan2

manager_warehouses = [
    {
        "id": "WH-01",
        "name": "Delhi Cold Storage",
        "city": "Delhi",
        "lat": 28.6139,
        "lon": 77.2090,
        "capacity": 10000,
        "occupied": 8800,
        "temperature": 7.6,
        "min_temp": 2,
        "max_temp": 8,
        "power": "BATTERY",
        "battery": 18,
        "solar_kw": 42,
        "cooling": "ACTIVE",
        "risk": "CRITICAL",
    },
    {
        "id": "WH-02",
        "name": "Jaipur Cold Storage",
        "city": "Jaipur",
        "lat": 26.9124,
        "lon": 75.7873,
        "capacity": 8000,
        "occupied": 4500,
        "temperature": 5.0,
        "min_temp": 2,
        "max_temp": 8,
        "power": "GRID",
        "battery": 82,
        "solar_kw": 60,
        "cooling": "ACTIVE",
        "risk": "NORMAL",
    },
    {
        "id": "WH-03",
        "name": "Lucknow Cold Storage",
        "city": "Lucknow",
        "lat": 26.8467,
        "lon": 80.9462,
        "capacity": 12000,
        "occupied": 6000,
        "temperature": 3.5,
        "min_temp": 2,
        "max_temp": 8,
        "power": "GRID",
        "battery": 90,
        "solar_kw": 45,
        "cooling": "ACTIVE",
        "risk": "NORMAL",
    },
]


def manager_distance(lat1, lon1, lat2, lon2):
    r = 6371

    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = radians(lat2 - lat1), radians(lon2 - lon1)

    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2

    return r * 2 * atan2(sqrt(a), sqrt(1 - a))


def manager_metrics(w):
    result = dict(w)
    result["available"] = max(w["capacity"] - w["occupied"], 0)
    result["utilization"] = round((w["occupied"] / w["capacity"]) * 100, 1)
    return result


@app.get("/api/sap-warehouse-manager/health")
def manager_health():
    return {
        "status": "ok",
        "agent": "SAP Warehouse Manager Bot",
    }


@app.get("/api/sap-warehouse-manager/warehouses")
def manager_warehouses_list():
    return [manager_metrics(w) for w in manager_warehouses]


@app.get("/api/sap-warehouse-manager/warehouse/{warehouse_id}")
def manager_warehouse(warehouse_id: str):
    w = next(
        (x for x in manager_warehouses if x["id"] == warehouse_id),
        None,
    )

    if not w:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    return manager_metrics(w)


@app.get("/api/sap-warehouse-manager/warehouse/{warehouse_id}/network")
def manager_network(warehouse_id: str):
    source = next(
        (x for x in manager_warehouses if x["id"] == warehouse_id),
        None,
    )

    if not source:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    network = []

    for w in manager_warehouses:
        if w["id"] == warehouse_id:
            continue

        available = max(w["capacity"] - w["occupied"], 0)

        dist = manager_distance(
            source["lat"],
            source["lon"],
            w["lat"],
            w["lon"],
        )

        temperature_ok = w["min_temp"] <= w["temperature"] <= w["max_temp"]

        score = 100 - min(dist / 20, 30)

        if available < 1000:
            score -= 30

        if not temperature_ok:
            score -= 25

        if w["power"] == "BATTERY":
            score -= 10

        network.append(
            {
                "id": w["id"],
                "name": w["name"],
                "city": w["city"],
                "distance_km": round(dist, 1),
                "available_capacity": available,
                "temperature": w["temperature"],
                "power": w["power"],
                "score": round(max(score, 0), 1),
            }
        )

    return sorted(
        network,
        key=lambda x: x["score"],
        reverse=True,
    )


@app.get("/api/sap-warehouse-manager/warehouse/{warehouse_id}/recommendation")
def manager_recommendation(warehouse_id: str):
    source = next(
        (x for x in manager_warehouses if x["id"] == warehouse_id),
        None,
    )

    if not source:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    risk = (
        source["battery"] < 20
        or source["temperature"] > source["max_temp"]
        or source["temperature"] < source["min_temp"]
        or source["risk"] == "CRITICAL"
    )

    if not risk:
        return {
            "status": "NORMAL",
            "message": "Warehouse conditions are stable.",
            "action": "CONTINUE_MONITORING",
        }

    alternatives = []

    for w in manager_warehouses:
        if w["id"] == warehouse_id:
            continue

        free = max(w["capacity"] - w["occupied"], 0)

        if free <= 0 or not (w["min_temp"] <= w["temperature"] <= w["max_temp"]):
            continue

        dist = manager_distance(
            source["lat"],
            source["lon"],
            w["lat"],
            w["lon"],
        )

        score = 100 - min(dist / 20, 30) + (10 if w["power"] == "GRID" else 0)

        alternatives.append(
            {
                "warehouse": w["name"],
                "warehouse_id": w["id"],
                "distance_km": round(dist, 1),
                "available_capacity": free,
                "score": round(score, 1),
            }
        )

    alternatives.sort(
        key=lambda x: x["score"],
        reverse=True,
    )

    return {
        "status": "CRITICAL",
        "source_warehouse": source["name"],
        "battery": source["battery"],
        "temperature": source["temperature"],
        "action": "PROTECT_COOLING_AND_EVALUATE_TRANSFER",
        "recommended_destination": alternatives[0] if alternatives else None,
        "alternatives": alternatives,
    }
