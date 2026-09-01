@echo off
setlocal
start "ColdGuard SAP Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000"
start "ColdGuard Dashboard" cmd /k "cd /d %~dp0 && npm run dev"
echo.
echo ColdGuard AI dashboard and SAP Warehouse Agent backend are starting...
echo Dashboard: http://localhost:5173
 echo SAP API: http://localhost:8000/docs
