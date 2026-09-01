# ColdGuard AI + SAP Warehouse Agent

Merged project: the ColdGuard React/Vite dashboard now includes a real **SAP Warehouse Agent** connected to the supplied Python ML model, preprocessor and alert dataset.

## 1. Install frontend

```bash
npm install
```

## 2. Install SAP backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

The backend pins scikit-learn to **1.6.1**, matching the supplied serialized model artifacts.

## 3. Run

From the project root:

```bash
npm run dev
```

In another terminal:

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Or on Windows, after installing dependencies, double-click `start.bat`. On macOS/Linux use `./start.sh`.

Open the dashboard at `http://localhost:5173`.

## SAP Warehouse Agent

Dashboard → **SAP AGENTS** → **SAP Warehouse Agent**.

The agent can:
- Load live metrics from `ai_agent_alerts.csv`.
- Filter high/medium/low risk alerts.
- Find reorder-required records.
- Run demand predictions through `supply_chain_preprocessor.pkl` + `supply_chain_model.pkl`.
- Accept natural-language prompts for common warehouse queries.

API docs are available at `http://localhost:8000/docs` when the backend is running.

## SAP Warehouse Manager Bot
The dashboard now includes **SAP Warehouse Manager Bot** under SAP AGENTS. It uses the integrated FastAPI backend and provides warehouse status, network analysis, and transfer recommendations.

Manager API base: `http://localhost:8000/api/sap-warehouse-manager`


## Warehouse connections
- The Warehouses menu now shows only the main **Warehouse 1** by default.
- Use **+ Add Warehouse** to enter a warehouse name and ESP32 IP address.
- Added warehouses are saved in browser localStorage and automatically polled at `http://<IP>/api/data`.
- The warehouse is shown as **ONLINE** when that endpoint returns the expected `temperatureA`, `temperatureB`, and `humidity` fields.
