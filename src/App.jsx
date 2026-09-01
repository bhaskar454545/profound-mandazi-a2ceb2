import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./styles.css";

// =====================================================
// ESP32
// =====================================================

const ESP32_IP = "10.149.179.1";
const API_URL = `http://${ESP32_IP}/api/data`;

const SAP_API_URL =
  import.meta.env.VITE_SAP_API_URL ||
  "https://coldguard-ai-backend.onrender.com/api/sap-warehouse";

const SAP_MANAGER_API_URL =
  import.meta.env.VITE_SAP_MANAGER_API_URL ||
  "https://coldguard-ai-backend.onrender.com/api/sap-warehouse-manager";
// =====================================================
// WAREHOUSES
// =====================================================

const DEFAULT_WAREHOUSE = {
  id: "warehouse1",
  name: "Warehouse 1",
  deviceId: "ColdGuard-01",
  ip: ESP32_IP,
};

const normalizeWarehouseIp = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
};

const warehouseStorageKey = "coldguard_custom_warehouses";

const loadCustomWarehouses = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(warehouseStorageKey) || "[]");
    return Array.isArray(saved)
      ? saved.filter((warehouse) => warehouse?.id && warehouse?.name && warehouse?.ip)
      : [];
  } catch {
    return [];
  }
};

const createWarehouseState = (warehouse) => ({
  ...warehouse,
  ip: normalizeWarehouseIp(warehouse.ip),
  connected: false,
  lastUpdate: null,
  sensorData: null,
  chambers: createChambers(),
  commonLed: false,
});

const createWarehouses = () => {
  const all = [DEFAULT_WAREHOUSE, ...loadCustomWarehouses()];
  return Object.fromEntries(all.map((warehouse) => [warehouse.id, createWarehouseState(warehouse)]));
};

// =====================================================
// CHAMBERS
// =====================================================

const createChambers = () => ({
  A: {
    name: "Chamber A",
    priority: "P1",
    temperature: null,
    humidity: null,
    setpoint: 4,
    status: false,
    led: false,
  },
  B: {
    name: "Chamber B",
    priority: "P2",
    temperature: null,
    humidity: null,
    setpoint: 6,
    status: false,
    led: false,
  },
});

// =====================================================
// CHAMBERS PAGE
// =====================================================

function ChambersPage({
  current,
  selectedChamber,
  setSelectedChamber,
  selected,
  updateSelectedChamber,
  onBack,
}) {
  return (
    <section className="chambers-page">
      <header className="header">
        <div>
          <h1>CHAMBER MONITOR</h1>
          <p>{current.name} — Monitor and manually control both chambers</p>
        </div>
        <button type="button" className="cg-history-back" onClick={onBack}>
          ← DASHBOARD
        </button>
      </header>

      <div className="content">
        <section className="left">
          <div className="section-title">
            <div>
              <h2>CHAMBER STATUS</h2>
              <p>
                {current.connected
                  ? `Live readings from ${current.name}`
                  : `${current.name} chambers are not connected`}
              </p>
            </div>
            <div className="auto">🛡 AUTO MODE</div>
          </div>

          <div className="chambers">
            {Object.entries(current.chambers).map(([id, chamber]) => (
              <div
                key={id}
                className={`chamber ${selectedChamber === id ? "selected" : ""}`}
                onClick={() => setSelectedChamber(id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedChamber(id);
                }}
              >
                <div className="priority">
                  {chamber.priority} — {chamber.priority === "P1" ? "CRITICAL" : "HIGH"}
                </div>
                <h3>{chamber.name}</h3>
                <div className="snow">❄</div>
                <div className="temperature">
                  {current.connected && chamber.temperature !== null
                    ? `${Number(chamber.temperature).toFixed(1)}°C`
                    : "--"}
                </div>
                <div className="set">Set: {chamber.setpoint}°C</div>
                <div className={current.connected ? "working" : "offline"}>
                  {current.connected ? "● WORKING" : "● NOT CONNECTED"}
                </div>
                <div className="details">
                  <div>Temperature <b>{current.connected && chamber.temperature !== null ? `${Number(chamber.temperature).toFixed(1)}°C` : "--"}</b></div>
                  <div>Humidity <b>{current.connected && chamber.humidity !== null ? `${Number(chamber.humidity).toFixed(0)}%` : "--"}</b></div>
                  <div>Priority <b>{chamber.priority}</b></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="control">
          <h2>🎮 MANUAL CONTROL</h2>
          <p className="control-sub">Operate selected chamber</p>

          <label>Select Chamber</label>
          <select value={selectedChamber} onChange={(e) => setSelectedChamber(e.target.value)}>
            <option value="A">Chamber A</option>
            <option value="B">Chamber B</option>
          </select>

          <label>Action</label>
          <div className="buttons">
            <button className="on" onClick={() => updateSelectedChamber({ status: true })}>⚡ TURN ON</button>
            <button className="off" onClick={() => updateSelectedChamber({ status: false })}>⏻ TURN OFF</button>
          </div>

          <label>Automation Priority</label>
          <div className="priority-buttons">
            <button
              className={selected.priority === "P1" ? "priority-active" : ""}
              onClick={() => updateSelectedChamber({ priority: "P1" })}
            >P1 — CRITICAL</button>
            <button
              className={selected.priority === "P2" ? "priority-active" : ""}
              onClick={() => updateSelectedChamber({ priority: "P2" })}
            >P2 — HIGH</button>
          </div>

          <label>Temperature Setpoint</label>
          <div className="temperature-control">
            <button onClick={() => updateSelectedChamber({ setpoint: selected.setpoint - 1 })}>−</button>
            <strong>{selected.setpoint}°C</strong>
            <button onClick={() => updateSelectedChamber({ setpoint: selected.setpoint + 1 })}>+</button>
          </div>

          <button className="apply">APPLY SETPOINT</button>

          <div className="selected">
            <p>SELECTED CHAMBER</p>
            <h3>{current.name} — Chamber {selectedChamber}</h3>
            <div>Temperature <b>{current.connected && selected.temperature !== null ? `${Number(selected.temperature).toFixed(1)}°C` : "--"}</b></div>
            <div>Humidity <b>{current.connected && selected.humidity !== null ? `${Number(selected.humidity).toFixed(0)}%` : "--"}</b></div>
            <div>Priority <b>{selected.priority}</b></div>
            <div>State <b className={current.connected && selected.status ? "green" : "red"}>{current.connected && selected.status ? "ON" : "NOT CONNECTED"}</b></div>
          </div>
        </aside>
      </div>
    </section>
  );
}


// =====================================================
// SAP AGENTS PAGE
// =====================================================

const sapAgents = [
  {
    id: "sap-warehouse",
    name: "SAP Warehouse Agent",
    icon: "🏭",
    description: "AI-powered warehouse demand prediction, inventory risk and reorder intelligence.",
    actions: ["Check warehouse overview", "Find high-risk items", "Check reorder required", "Predict demand"],
  },
  {
    id: "sap-warehouse-manager",
    name: "SAP Warehouse Manager Bot",
    icon: "🧑‍💼",
    description: "Monitor the warehouse network, capacity, cold-storage conditions and transfer recommendations.",
    actions: ["Show all warehouses", "Check WH-01 status", "Analyze WH-01 network", "Get transfer recommendation"],
  },
];

function SAPAgentsPage({ selectedAgentId, setSelectedAgentId, onBack }) {
  const agent = sapAgents.find((item) => item.id === selectedAgentId) || sapAgents[0];
  const isWarehouseAgent = agent.id === "sap-warehouse";
  const isWarehouseManager = agent.id === "sap-warehouse-manager";
  const [messages, setMessages] = useState([
    {
      role: "agent",
      text: isWarehouseAgent
        ? "Hello! I’m the SAP Warehouse Agent. I can analyze warehouse alerts, inventory risk, reorder requirements and demand forecasts."
        : `Hello! I’m the ${agent.name}. Select an action below or ask me about your SAP data.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [showAlerts, setShowAlerts] = useState(false);
  const [managerWarehouses, setManagerWarehouses] = useState([]);
  const [managerSelectedWarehouse, setManagerSelectedWarehouse] = useState(null);
  const [managerNetwork, setManagerNetwork] = useState([]);
  const [managerRecommendation, setManagerRecommendation] = useState(null);

  useEffect(() => {
    setMessages([{
      role: "agent",
      text: isWarehouseAgent
        ? "Hello! I’m the SAP Warehouse Agent. I can analyze warehouse alerts, inventory risk, reorder requirements and demand forecasts."
        : `Hello! I’m the ${agent.name}. Select an action below or ask me about your SAP data.`,
    }]);
    setOverview(null);
    setAlerts([]);
    setShowAlerts(false);
    setManagerWarehouses([]);
    setManagerSelectedWarehouse(null);
    setManagerNetwork([]);
    setManagerRecommendation(null);
  }, [agent.id]);

  useEffect(() => {
    if (!isWarehouseManager) return;
    let cancelled = false;
    fetch(`${SAP_MANAGER_API_URL}/warehouses`)
      .then((response) => { if (!response.ok) throw new Error("Warehouse Manager API unavailable"); return response.json(); })
      .then((data) => {
        if (cancelled) return;
        setManagerWarehouses(data || []);
        if (data?.length) setManagerSelectedWarehouse(data[0]);
      })
      .catch(() => {
        if (!cancelled) addAgentMessage("The SAP Warehouse Manager backend is not running. Start the backend with the included run instructions.");
      });
    return () => { cancelled = true; };
  }, [isWarehouseManager]);

  useEffect(() => {
    if (!isWarehouseAgent) return;
    let cancelled = false;
    fetch(`${SAP_API_URL}/overview`)
      .then((response) => {
        if (!response.ok) throw new Error("SAP Warehouse API unavailable");
        return response.json();
      })
      .then((data) => { if (!cancelled) setOverview(data); })
      .catch(() => {
        if (!cancelled) setMessages((previous) => [
          ...previous,
          { role: "agent", text: "The SAP Warehouse Agent UI is ready, but the Python backend is not running. Start the backend with the included run instructions." },
        ]);
      });
    return () => { cancelled = true; };
  }, [isWarehouseAgent]);

  const addAgentMessage = (text) => {
    setMessages((previous) => [...previous, { role: "agent", text }]);
  };

  const runWarehouseAction = async (action) => {
    setLoading(true);
    try {
      if (action === "Check warehouse overview") {
        const response = await fetch(`${SAP_API_URL}/overview`);
        if (!response.ok) throw new Error("Overview request failed");
        const data = await response.json();
        setOverview(data);
        addAgentMessage(`Warehouse overview: ${data.total_alerts} alerts, ${data.high_risk} high-risk, ${data.medium_risk} medium-risk and ${data.reorder_required} items requiring reorder.`);
      } else if (action === "Find high-risk items") {
        const response = await fetch(`${SAP_API_URL}/alerts?risk=HIGH`);
        if (!response.ok) throw new Error("Alert request failed");
        const data = await response.json();
        setAlerts(data.items || []);
        setRiskFilter("HIGH");
        setShowAlerts(true);
        addAgentMessage(`I found ${data.count} high-risk alert records. The alert table below is filtered to HIGH risk.`);
      } else if (action === "Check reorder required") {
        const response = await fetch(`${SAP_API_URL}/alerts?reorder=REORDER`);
        if (!response.ok) throw new Error("Reorder request failed");
        const data = await response.json();
        setAlerts(data.items || []);
        setRiskFilter("ALL");
        setShowAlerts(true);
        addAgentMessage(`I found ${data.count} alert records marked REORDER. The alert table below shows the current reorder candidates.`);
      } else if (action === "Predict demand") {
        addAgentMessage("Demand prediction is available from the Python ML backend. Use the Predict Demand panel below to enter the model features.");
      } else if (isWarehouseManager) {
        if (action === "Show all warehouses") {
          const response = await fetch(`${SAP_MANAGER_API_URL}/warehouses`);
          if (!response.ok) throw new Error("Warehouse list request failed");
          const data = await response.json();
          setManagerWarehouses(data || []);
          if (data?.length) setManagerSelectedWarehouse(data[0]);
          addAgentMessage(`I found ${data.length} warehouses in the network. ${data.filter((w) => w.risk === "CRITICAL").length} are currently critical.`);
        } else if (action === "Check WH-01 status") {
          const response = await fetch(`${SAP_MANAGER_API_URL}/warehouse/WH-01`);
          if (!response.ok) throw new Error("Warehouse status request failed");
          const data = await response.json();
          setManagerSelectedWarehouse(data);
          addAgentMessage(`${data.name} is ${data.risk}. Utilization is ${data.utilization}% with ${data.available} units of available capacity. Temperature is ${data.temperature}°C and battery is ${data.battery}%.`);
        } else if (action === "Analyze WH-01 network") {
          const response = await fetch(`${SAP_MANAGER_API_URL}/warehouse/WH-01/network`);
          if (!response.ok) throw new Error("Network analysis failed");
          const data = await response.json();
          setManagerNetwork(data || []);
          addAgentMessage(`Network analysis complete. Best available destination: ${data[0]?.name || "No suitable warehouse found"}.`);
        } else if (action === "Get transfer recommendation") {
          const response = await fetch(`${SAP_MANAGER_API_URL}/warehouse/WH-01/recommendation`);
          if (!response.ok) throw new Error("Recommendation request failed");
          const data = await response.json();
          setManagerRecommendation(data);
          addAgentMessage(data.recommended_destination ? `Recommended transfer destination: ${data.recommended_destination.warehouse}. Action: ${data.action}.` : `No transfer destination is currently recommended. Action: ${data.action}.`);
        }
      }
    } catch (error) {
      addAgentMessage(`I could not complete that action: ${error.message}. Please make sure the SAP backend is running.`);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text = input) => {
    const value = text.trim();
    if (!value || loading) return;
    setMessages((previous) => [...previous, { role: "user", text: value }]);
    setInput("");

    if (isWarehouseAgent) {
      const lower = value.toLowerCase();
      if (lower.includes("high risk") || lower.includes("high-risk")) return runWarehouseAction("Find high-risk items");
      if (lower.includes("reorder") || lower.includes("restock")) return runWarehouseAction("Check reorder required");
      if (lower.includes("overview") || lower.includes("summary") || lower.includes("alerts")) return runWarehouseAction("Check warehouse overview");
      addAgentMessage("I can help with warehouse overview, high-risk items, reorder requirements and demand prediction. Try one of the quick actions below.");
      return;
    }

    if (isWarehouseManager) {
      const lower = value.toLowerCase();
      if (lower.includes("network")) return runWarehouseAction("Analyze WH-01 network");
      if (lower.includes("recommend") || lower.includes("transfer")) return runWarehouseAction("Get transfer recommendation");
      if (lower.includes("status") || lower.includes("wh-01") || lower.includes("warehouse 1")) return runWarehouseAction("Check WH-01 status");
      if (lower.includes("all warehouse") || lower.includes("warehouses")) return runWarehouseAction("Show all warehouses");
      addAgentMessage("I can monitor all warehouses, check WH-01 status, analyze the warehouse network and provide transfer recommendations.");
      return;
    }

    setMessages((previous) => [
      ...previous,
      { role: "agent", text: `I’ve received “${value}”. This SAP agent is currently running in demo mode.` },
    ]);
  };

  return (
    <section className="sap-agents-page">
      <div className="sap-agents-header">
        <div>
          <p className="sap-eyebrow">SAP AGENTS</p>
          <h1>AI WORKSPACE</h1>
          <p>Choose an SAP agent and work with its dedicated interface.</p>
        </div>
        <button type="button" className="cg-history-back" onClick={onBack}>
          ← DASHBOARD
        </button>
      </div>

      <div className="sap-agent-layout">
        <aside className="sap-agent-list">
          <div className="sap-agent-list-title">AVAILABLE AGENTS</div>
          {sapAgents.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sap-agent-option ${item.id === agent.id ? "active" : ""}`}
              onClick={() => setSelectedAgentId(item.id)}
            >
              <span className="sap-agent-option-icon">{item.icon}</span>
              <span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </aside>

        <div className="sap-agent-workspace">
          <div className="sap-agent-workspace-head">
            <div>
              <span className="sap-agent-icon">{agent.icon}</span>
              <div>
                <span className="sap-agent-kicker">SAP AI AGENT</span>
                <h2>{agent.name}</h2>
                <p>{agent.description}</p>
              </div>
            </div>
            <span className={`sap-agent-status ${(isWarehouseAgent && !overview) || (isWarehouseManager && !managerWarehouses.length) ? "waiting" : ""}`}>● {(isWarehouseAgent && !overview) || (isWarehouseManager && !managerWarehouses.length) ? "CONNECTING" : "READY"}</span>
          </div>

          {isWarehouseAgent && overview && (
            <div className="sap-warehouse-metrics">
              <div><span>Total Alerts</span><strong>{overview.total_alerts}</strong></div>
              <div><span>🔴 High Risk</span><strong>{overview.high_risk}</strong></div>
              <div><span>🟠 Medium Risk</span><strong>{overview.medium_risk}</strong></div>
              <div><span>🔄 Reorder Required</span><strong>{overview.reorder_required}</strong></div>
            </div>
          )}

          <div className="sap-chat">
            <div className="sap-chat-messages">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`sap-message ${message.role}`}>
                  <span>{message.role === "agent" ? agent.icon : "You"}</span>
                  <p>{message.text}</p>
                </div>
              ))}
              {loading && <div className="sap-message agent"><span>{agent.icon}</span><p>Analyzing SAP warehouse data…</p></div>}
            </div>

            <div className="sap-quick-actions">
              {agent.actions.map((action) => (
                <button key={action} type="button" disabled={loading} onClick={() => isWarehouseAgent ? runWarehouseAction(action) : sendMessage(action)}>
                  {action}
                </button>
              ))}
            </div>

            {isWarehouseAgent && (
              <div className="sap-warehouse-tools">
                <div className="sap-tool-head">
                  <div><span className="sap-agent-kicker">ML MODEL</span><h3>Predict Demand</h3></div>
                  <span>Powered by saved supply-chain model</span>
                </div>
                <WarehousePredictionForm onResult={addAgentMessage} setLoading={setLoading} />
              </div>
            )}


            {isWarehouseManager && managerWarehouses.length > 0 && (
              <div className="sap-warehouse-manager-panel">
                <div className="sap-tool-head">
                  <div><span className="sap-agent-kicker">WAREHOUSE NETWORK</span><h3>Manager Control Center</h3></div>
                  <span>{managerWarehouses.length} warehouses</span>
                </div>
                <div className="sap-warehouse-manager-grid">
                  {managerWarehouses.map((w) => (
                    <button key={w.id} type="button" className={`sap-manager-card ${managerSelectedWarehouse?.id === w.id ? "active" : ""}`} onClick={() => setManagerSelectedWarehouse(w)}>
                      <strong>{w.name}</strong><span>{w.city}</span><b>{w.risk}</b><small>{w.utilization}% utilized · {w.temperature}°C</small>
                    </button>
                  ))}
                </div>
                {managerSelectedWarehouse && (
                  <div className="sap-manager-detail">
                    <div><span>Capacity</span><strong>{managerSelectedWarehouse.occupied} / {managerSelectedWarehouse.capacity}</strong></div>
                    <div><span>Available</span><strong>{managerSelectedWarehouse.available}</strong></div>
                    <div><span>Power</span><strong>{managerSelectedWarehouse.power}</strong></div>
                    <div><span>Battery</span><strong>{managerSelectedWarehouse.battery}%</strong></div>
                    <div><span>Cooling</span><strong>{managerSelectedWarehouse.cooling}</strong></div>
                    <div><span>Risk</span><strong>{managerSelectedWarehouse.risk}</strong></div>
                  </div>
                )}
                {managerNetwork.length > 0 && (
                  <div className="sap-manager-network"><h4>Network Analysis</h4>{managerNetwork.map((item) => <div key={item.id}><span>{item.name} · {item.distance_km} km</span><strong>Score {item.score}</strong></div>)}</div>
                )}
                {managerRecommendation && (
                  <div className="sap-manager-recommendation"><span>TRANSFER RECOMMENDATION</span><strong>{managerRecommendation.recommended_destination?.warehouse || "No destination available"}</strong><p>{managerRecommendation.action}</p></div>
                )}
              </div>
            )}

            {isWarehouseAgent && showAlerts && (
              <div className="sap-alerts-panel">
                <div className="sap-tool-head">
                  <div><span className="sap-agent-kicker">AI ALERTS</span><h3>Warehouse Risk Alerts</h3></div>
                  <select value={riskFilter} onChange={async (e) => {
                    const value = e.target.value;
                    setRiskFilter(value);
                    const url = value === "ALL" ? `${SAP_API_URL}/alerts` : `${SAP_API_URL}/alerts?risk=${value}`;
                    try { const response = await fetch(url); const data = await response.json(); setAlerts(data.items || []); } catch { addAgentMessage("Could not refresh the alert filter."); }
                  }}>
                    <option value="ALL">ALL</option><option value="HIGH">HIGH</option><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option>
                  </select>
                </div>
                <div className="sap-alert-table-wrap">
                  <table className="sap-alert-table">
                    <thead><tr><th>SKU</th><th>Category</th><th>Demand</th><th>Stock</th><th>Risk</th><th>Reorder</th><th>Priority</th><th>Action</th></tr></thead>
                    <tbody>{alerts.slice(0, 60).map((row, index) => <tr key={`${row.SKU_ID}-${index}`}><td>{row.SKU_ID}</td><td>{row.Category}</td><td>{Number(row.Predicted_Demand).toFixed(1)}</td><td>{row.Available_Stock}</td><td>{row.Supply_Chain_Risk}</td><td>{row.Reorder_Flag}</td><td>{row.Agent_Priority}</td><td>{row.Agent_Action}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="sap-chat-input">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                placeholder={`Ask ${agent.name}...`}
                aria-label={`Ask ${agent.name}`}
              />
              <button type="button" onClick={() => sendMessage()} disabled={loading}>SEND ↗</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WarehousePredictionForm({ onResult, setLoading }) {
  const [schema, setSchema] = useState([]);
  const [values, setValues] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${SAP_API_URL}/schema`)
      .then((response) => response.json())
      .then((data) => {
        setSchema(data.features || []);
        const defaults = {};
        (data.features || []).forEach((feature) => { defaults[feature] = feature === "SKU_ID" ? "FOOD001" : feature === "Category" ? "Food" : feature === "Supplier_ID" ? "SUP001" : "0"; });
        setValues(defaults);
      })
      .catch(() => setError("Could not load model input fields."));
  }, []);

  const predict = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${SAP_API_URL}/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Prediction failed");
      onResult(`Predicted demand: ${Number(data.predicted_demand).toFixed(2)} units.`);
    } catch (e) { setError(e.message); onResult(`Prediction failed: ${e.message}`); }
    finally { setLoading(false); }
  };

  return (
    <div className="sap-predict-form">
      {schema.map((feature) => <label key={feature}><span>{feature.replaceAll("_", " ")}</span><input value={values[feature] || ""} onChange={(e) => setValues((prev) => ({ ...prev, [feature]: e.target.value }))} type={feature.match(/Stock|Days|Avg|Std|Demand|Pct|Number|Month|Lag/) ? "number" : "text"} step="any" /></label>)}
      {error && <p className="sap-tool-error">{error}</p>}
      <button type="button" className="sap-predict-button" onClick={predict}>🚀 PREDICT DEMAND</button>
    </div>
  );
}

// =====================================================
// APP
// =====================================================

function App() {
  const [selectedWarehouse, setSelectedWarehouse] = useState("warehouse1");
  const [selectedChamber, setSelectedChamber] = useState("A");
  const [warehouseMenuOpen, setWarehouseMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [sapAgentsOpen, setSapAgentsOpen] = useState(false);
  const [selectedSAPAgent, setSelectedSAPAgent] = useState("sap-warehouse");
  const [addWarehouseOpen, setAddWarehouseOpen] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseIp, setNewWarehouseIp] = useState("");
  const [warehouseFormError, setWarehouseFormError] = useState("");

  const [warehouses, setWarehouses] = useState(createWarehouses);
  const [temperatureHistory, setTemperatureHistory] = useState([]);

  const current = warehouses[selectedWarehouse] || warehouses.warehouse1;
  const selected = current.chambers[selectedChamber];
  const isWarehouse1 = current.id === "warehouse1";

  // ===================================================
  // LIVE ESP32 DATA
  // Warehouse 1 uses the main ESP32. Added warehouses use the IP
  // entered by the user and expose the same /api/data contract.
  // ===================================================

  useEffect(() => {
    let mounted = true;

    const fetchWarehouseData = async (warehouse) => {
      if (!warehouse?.ip) return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(`http://${normalizeWarehouseIp(warehouse.ip)}/api/data`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("ESP32 API error");
        const data = await response.json();

        if (
          data.temperatureA === undefined ||
          data.temperatureB === undefined ||
          data.humidity === undefined
        ) {
          throw new Error("Invalid ESP32 data format");
        }

        if (!mounted) return;

        const tempA = Number(data.temperatureA);
        const tempB = Number(data.temperatureB);
        const hum = Number(data.humidity);
        const now = new Date();

        setWarehouses((prev) => ({
          ...prev,
          [warehouse.id]: {
            ...prev[warehouse.id],
            connected: true,
            lastUpdate: now,
            sensorData: data,
            chambers: {
              ...prev[warehouse.id].chambers,
              A: {
                ...prev[warehouse.id].chambers.A,
                temperature: Number.isFinite(tempA) ? tempA : null,
                humidity: Number.isFinite(hum) ? hum : null,
                status: true,
              },
              B: {
                ...prev[warehouse.id].chambers.B,
                temperature: Number.isFinite(tempB) ? tempB : null,
                humidity: Number.isFinite(hum) ? hum : null,
                status: true,
              },
            },
          },
        }));

        if (warehouse.id === "warehouse1") {
          setTemperatureHistory((previous) => {
            const point = {
              time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              A: Number.isFinite(tempA) ? tempA : null,
              B: Number.isFinite(tempB) ? tempB : null,
            };
            return [...previous, point].slice(-900);
          });
        }
      } catch (error) {
        console.log(`${warehouse.name} ESP32 DISCONNECTED:`, error.message);
        if (!mounted) return;

        setWarehouses((prev) => {
          const existing = prev[warehouse.id];
          if (!existing) return prev;
          return {
            ...prev,
            [warehouse.id]: {
              ...existing,
              connected: false,
              lastUpdate: null,
              sensorData: null,
              chambers: {
                ...existing.chambers,
                A: { ...existing.chambers.A, temperature: null, humidity: null, status: false },
                B: { ...existing.chambers.B, temperature: null, humidity: null, status: false },
              },
            },
          };
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    const fetchAll = () => {
      Object.values(warehouses).forEach(fetchWarehouseData);
    };

    fetchAll();
    const interval = setInterval(fetchAll, 2000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [Object.keys(warehouses).join(",")]);

  const persistCustomWarehouses = (nextWarehouses) => {
    const custom = Object.values(nextWarehouses)
      .filter((warehouse) => warehouse.id !== "warehouse1")
      .map(({ id, name, deviceId, ip }) => ({ id, name, deviceId, ip }));
    localStorage.setItem(warehouseStorageKey, JSON.stringify(custom));
  };

  const addWarehouse = async (event) => {
    event.preventDefault();
    setWarehouseFormError("");

    const name = newWarehouseName.trim();
    const ip = normalizeWarehouseIp(newWarehouseIp);

    if (!name) {
      setWarehouseFormError("Please enter a warehouse name.");
      return;
    }
    if (!ip) {
      setWarehouseFormError("Please enter the ESP32 IP address.");
      return;
    }
    if (Object.values(warehouses).some((warehouse) => warehouse.ip === ip)) {
      setWarehouseFormError("This IP address is already connected/added.");
      return;
    }

    const id = `warehouse-${Date.now()}`;
    const deviceId = `ColdGuard-${String(Object.keys(warehouses).length + 1).padStart(2, "0")}`;
    const next = {
      ...warehouses,
      [id]: createWarehouseState({ id, name, deviceId, ip }),
    };

    setWarehouses(next);
    persistCustomWarehouses(next);
    setSelectedWarehouse(id);
    setSelectedChamber("A");
    setWarehouseMenuOpen(false);
    setAddWarehouseOpen(false);
    setNewWarehouseName("");
    setNewWarehouseIp("");
  };

  // ===================================================
  // SELECT WAREHOUSE
  // ===================================================

  const selectWarehouse = (id) => {
    setSelectedWarehouse(id);
    setSelectedChamber("A");
    setWarehouseMenuOpen(false);
  };

  // ===================================================
  // CHAMBER CONTROL
  // ===================================================

  const updateSelectedChamber = (changes) => {
    setWarehouses((prev) => ({
      ...prev,
      [selectedWarehouse]: {
        ...prev[selectedWarehouse],
        chambers: {
          ...prev[selectedWarehouse].chambers,
          [selectedChamber]: {
            ...prev[selectedWarehouse].chambers[selectedChamber],
            ...changes,
          },
        },
      },
    }));
  };

  const updateCommonLed = (value) => {
    setWarehouses((prev) => ({
      ...prev,
      [selectedWarehouse]: {
        ...prev[selectedWarehouse],
        commonLed: value,
      },
    }));
  };

  const updateChamber = (chamberId, changes) => {
    setWarehouses((prev) => ({
      ...prev,
      [selectedWarehouse]: {
        ...prev[selectedWarehouse],
        chambers: {
          ...prev[selectedWarehouse].chambers,
          [chamberId]: {
            ...prev[selectedWarehouse].chambers[chamberId],
            ...changes,
          },
        },
      },
    }));
  };

  // ===================================================
  // CURRENT SENSOR DATA
  // ===================================================

  const sensorData = current.sensorData;

  const tempA = Number.isFinite(Number(sensorData?.temperatureA))
    ? Number(sensorData.temperatureA)
    : null;

  const tempB = Number.isFinite(Number(sensorData?.temperatureB))
    ? Number(sensorData.temperatureB)
    : null;

  const humidity = Number.isFinite(Number(sensorData?.humidity))
    ? Number(sensorData.humidity)
    : null;

  const averageTemperature =
    tempA !== null && tempB !== null
      ? ((tempA + tempB) / 2).toFixed(1)
      : tempA !== null
        ? tempA.toFixed(1)
        : tempB !== null
          ? tempB.toFixed(1)
          : "--";

  // ===================================================
  // BATTERY
  // ===================================================

  const batteryPercentage = Number.isFinite(
    Number(sensorData?.battery_percentage)
  )
    ? Number(sensorData.battery_percentage)
    : 68;

  const batteryVoltage = Number.isFinite(
    Number(sensorData?.battery_voltage)
  )
    ? Number(sensorData.battery_voltage)
    : null;

  // ===================================================
  // POWER SOURCE
  // ===================================================

  const powerSource = String(sensorData?.powersource ?? "adapter");
  const gridNormal = powerSource.toLowerCase() !== "battery";

  // ===================================================
  // FIXED PROJECT VALUES
  // ===================================================

  const SOLAR_POWER = "4.8 W";
  const TOTAL_LOAD = "18 W";

  // ===================================================
  // LAST UPDATE
  // ===================================================

  const lastUpdateText =
    current.connected && current.lastUpdate
      ? `${Math.max(
          0,
          Math.floor((Date.now() - current.lastUpdate.getTime()) / 1000)
        )} sec ago`
      : "No connection";

  // ===================================================
  // GRAPH
  // ===================================================

  const graphData = useMemo(() => temperatureHistory, [temperatureHistory]);

  return (
    <div className="dashboard">
      {/* ================================================= SIDEBAR ================================================= */}
      <aside className="sidebar">
        <div className="logo">
          ❄️
          <div>
            <h2>COLDGUARD AI</h2>
            <p>Smart Cold Chain</p>
          </div>
        </div>

        <nav>
          {/* DASHBOARD */}
          <button
            type="button"
            className={`nav ${activePage === "dashboard" ? "active" : ""}`}
            onClick={() => setActivePage("dashboard")}
          >
            ⌂ Dashboard
          </button>

          {/* WAREHOUSES */}
          <div className="cg-warehouse-menu">
            <button
              type="button"
              className="cg-warehouse-trigger"
              onClick={() => setWarehouseMenuOpen((prev) => !prev)}
              aria-expanded={warehouseMenuOpen}
              aria-haspopup="listbox"
            >
              <span className="cg-warehouse-title">
                <span className="cg-warehouse-icon">🏭</span>
                <span>WAREHOUSES</span>
              </span>

              <span
                className={`cg-warehouse-arrow ${
                  warehouseMenuOpen ? "open" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {warehouseMenuOpen && (
              <div
                className="cg-warehouse-dropdown"
                role="listbox"
                aria-label="Select warehouse"
              >
                {Object.values(warehouses).map((warehouse) => {
                  const isSelected = selectedWarehouse === warehouse.id;
                  const status = warehouse.connected ? "Online" : "Offline";

                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      key={warehouse.id}
                      className={`cg-warehouse-option ${
                        isSelected ? "cg-active" : ""
                      }`}
                      onClick={() => selectWarehouse(warehouse.id)}
                    >
                      <span className="cg-warehouse-name">
                        {warehouse.name}
                      </span>

                      {isSelected && (
                        <span
                          className={`cg-warehouse-status ${
                            warehouse.connected ? "online" : "offline"
                          }`}
                        >
                          {status}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className="cg-add-warehouse-button"
              onClick={() => {
                setWarehouseFormError("");
                setAddWarehouseOpen(true);
                setWarehouseMenuOpen(false);
              }}
            >
              ＋ Add Warehouse
            </button>
          </div>

          <div
            className={`nav ${activePage === "chambers" ? "active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => setActivePage("chambers")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setActivePage("chambers");
            }}
            style={{ cursor: "pointer" }}
          >
            ▣ Chambers
          </div>
          <div className="nav">⚙ Automation</div>
          <div className="nav">🔔 Alerts</div>

          {/* HISTORY */}
          <button
            type="button"
            className={`nav ${activePage === "history" ? "active" : ""}`}
            onClick={() => setActivePage("history")}
          >
            ◷ History
          </button>

          <div className="nav">⚙ Settings</div>
        </nav>

        {/* DEVICE STATUS */}
        <div className="device">
          <p className="device-title">DEVICE STATUS</p>

          <div className="connected">
            <span
              style={{
                background: current.connected ? "#22c55e" : "#ef4444",
              }}
            />
            {current.connected
              ? "ESP32 CONNECTED"
              : "ESP32 DISCONNECTED"}
          </div>

          <p>Warehouse</p>
          <strong>{current.name}</strong>

          <p>Device ID</p>
          <strong>{current.deviceId}</strong>

          <p>IP Address</p>
          <strong>{current.ip}</strong>

          <p>Last Update</p>
          <strong>{lastUpdateText}</strong>
        </div>
      </aside>

      {addWarehouseOpen && (
        <div className="cg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddWarehouseOpen(false); }}>
          <form className="cg-add-warehouse-modal" onSubmit={addWarehouse}>
            <div className="cg-modal-head">
              <div>
                <span className="banner-label">WAREHOUSE CONNECTION</span>
                <h2>＋ ADD WAREHOUSE</h2>
              </div>
              <button type="button" className="cg-modal-close" onClick={() => setAddWarehouseOpen(false)} aria-label="Close">×</button>
            </div>
            <p>Enter the warehouse name and the ESP32 IP address. The dashboard will automatically test <code>/api/data</code>.</p>
            <label>Warehouse Name<input autoFocus value={newWarehouseName} onChange={(event) => setNewWarehouseName(event.target.value)} placeholder="Warehouse 2" /></label>
            <label>ESP32 IP Address<input value={newWarehouseIp} onChange={(event) => setNewWarehouseIp(event.target.value)} placeholder="192.168.1.25" /></label>
            {warehouseFormError && <div className="cg-form-error">{warehouseFormError}</div>}
            <div className="cg-modal-actions">
              <button type="button" className="cg-modal-cancel" onClick={() => setAddWarehouseOpen(false)}>CANCEL</button>
              <button type="submit" className="cg-modal-connect">CONNECT WAREHOUSE</button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================= MAIN ================================================= */}
      <main className="main">
        {activePage === "sap-agents" ? (
          <SAPAgentsPage
            key={selectedSAPAgent}
            selectedAgentId={selectedSAPAgent}
            setSelectedAgentId={setSelectedSAPAgent}
            onBack={() => setActivePage("dashboard")}
          />
        ) : activePage === "history" ? (
          <section className="cg-history-page">
            <div className="cg-history-header">
              <div>
                <h1>HISTORY</h1>
                <p>{current.name} — Temperature history</p>
              </div>

              <button
                type="button"
                className="cg-history-back"
                onClick={() => setActivePage("dashboard")}
              >
                ← DASHBOARD
              </button>
            </div>

            <div className="cg-history-summary">
              <div>
                <span>WAREHOUSE</span>
                <strong>{current.name}</strong>
              </div>
              <div>
                <span>RECORDS</span>
                <strong>{graphData.length}</strong>
              </div>
              <div>
                <span>CHAMBERS</span>
                <strong>A &amp; B</strong>
              </div>
              <div>
                <span>STATUS</span>
                <strong className={current.connected ? "green" : "red"}>
                  {current.connected ? "LIVE" : "OFFLINE"}
                </strong>
              </div>
            </div>

            <div className="cg-history-panel">
              <div className="cg-history-panel-title">
                <div>
                  <h2>🌡 TEMPERATURE TREND</h2>
                  <p>Temperature readings from Chamber A and Chamber B</p>
                </div>
                <span>
                  {graphData.length ? "Last 30 minutes" : "Waiting for readings"}
                </span>
              </div>

              <div className="cg-history-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={graphData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" minTickGap={45} />
                    <YAxis unit="°C" domain={["auto", "auto"]} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="A"
                      name="Chamber A"
                      dot={false}
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="B"
                      name="Chamber B"
                      dot={false}
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {!current.connected && (
                <div className="cg-history-empty">
                  ESP32 is not connected. Temperature history will appear here
                  when Warehouse 1 comes online.
                </div>
              )}
            </div>
          </section>
        ) : activePage === "chambers" ? (
          <ChambersPage
            current={current}
            selectedChamber={selectedChamber}
            setSelectedChamber={setSelectedChamber}
            selected={selected}
            updateSelectedChamber={updateSelectedChamber}
            onBack={() => setActivePage("dashboard")}
          />
        ) : (
          <>
            {/* HEADER */}
            <header className="header">
              <div>
                <h1>LIVE DASHBOARD</h1>
                <p>
                  {current.name} — Monitor status &amp; control both chambers
                </p>
              </div>

              <div className="header-status">
                <div className="status-box">
                  {current.connected
                    ? "🟢 ESP32 CONNECTED"
                    : "🔴 ESP32 DISCONNECTED"}
                </div>

                <div className="status-box">⚡ AUTO MODE</div>
              </div>
            </header>

            {/* CURRENT WAREHOUSE + SAP AGENTS */}
            <div className="warehouse-sap-row">
              <div className="sap-agents-tab-wrap">
                <button
                  type="button"
                  className={`sap-agents-tab ${sapAgentsOpen ? "open" : ""}`}
                  onClick={() => setSapAgentsOpen((previous) => !previous)}
                  aria-expanded={sapAgentsOpen}
                  aria-haspopup="menu"
                >
                  <span className="sap-tab-icon">◈</span>
                  <span>SAP AGENTS</span>
                  <span className="sap-tab-arrow">{sapAgentsOpen ? "▲" : "▼"}</span>
                </button>

                {sapAgentsOpen && (
                  <div className="sap-agents-menu" role="menu">
                    <div className="sap-menu-title">SELECT SAP AGENT</div>
                    {sapAgents.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setSelectedSAPAgent(agent.id);
                          setSapAgentsOpen(false);
                          setActivePage("sap-agents");
                        }}
                      >
                        <span className="sap-menu-icon">{agent.icon}</span>
                        <span>
                          <strong>{agent.name}</strong>
                          <small>{agent.description}</small>
                        </span>
                        <span className="sap-menu-chevron">→</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="current-warehouse-banner">
              <div>
                <span className="banner-label">CURRENT WAREHOUSE</span>
                <strong>🏭 {current.name}</strong>
              </div>

              <span
                className={
                  current.connected
                    ? "warehouse-online"
                    : "warehouse-offline"
                }
              >
                {current.connected ? "● ONLINE" : "● NOT CONNECTED"}
              </span>
              </div>
            </div>

            {/* METRICS */}
            <section className="metrics">
              <div className="metric">
                <span>GRID STATUS</span>
                <strong
                  className={
                    current.connected
                      ? gridNormal
                        ? "green"
                        : "red"
                      : "red"
                  }
                >
                  {current.connected
                    ? gridNormal
                      ? "NORMAL"
                      : "FAILED"
                    : "--"}
                </strong>
                <small>
                  {current.connected
                    ? gridNormal
                      ? "Adapter active"
                      : "Battery backup active"
                    : "Not connected"}
                </small>
              </div>

              <div className="metric">
                <span>BATTERY</span>
                <strong className="green">
                  {current.connected ? `${batteryPercentage}%` : "--"}
                </strong>
                <small>
                  {current.connected && batteryVoltage !== null
                    ? `${batteryVoltage.toFixed(1)} V`
                    : current.connected
                      ? "-- V"
                      : "Not connected"}
                </small>
              </div>

              <div className="metric">
                <span>BACKUP TIME</span>
                <strong>{current.connected ? "1h 48m" : "--"}</strong>
                <small>
                  {current.connected ? "Remaining" : "Not connected"}
                </small>
              </div>

              <div className="metric">
                <span>SOLAR POWER</span>
                <strong>{SOLAR_POWER}</strong>
                <small>Fixed project value</small>
              </div>

              <div className="metric">
                <span>TOTAL LOAD</span>
                <strong>{TOTAL_LOAD}</strong>
                <small>Fixed project value</small>
              </div>
            </section>

            {/* CONTENT */}
            <div className="content">
              {/* LEFT */}
              <section className="left">
                <div className="section-title">
                  <div>
                    <h2>CHAMBER STATUS</h2>
                    <p>
                      {current.connected
                        ? `Live readings from ${current.name}`
                        : `${current.name} chambers are not connected`}
                    </p>
                  </div>

                  <div className="auto">🛡 AUTO MODE</div>
                </div>

                {/* CHAMBERS */}
                <div className="chambers">
                  {Object.entries(current.chambers).map(([id, chamber]) => (
                    <div
                      key={id}
                      className={`chamber ${
                        selectedChamber === id ? "selected" : ""
                      }`}
                      onClick={() => setSelectedChamber(id)}
                    >
                      <div className="priority">
                        {chamber.priority} — {chamber.priority === "P1" ? "CRITICAL" : "HIGH"}
                      </div>

                      <h3>{chamber.name}</h3>
                      <div className="snow">❄</div>

                      <div className="temperature">
                        {current.connected && chamber.temperature !== null
                          ? `${Number(chamber.temperature).toFixed(1)}°C`
                          : "--"}
                      </div>

                      <div className="set">Set: {chamber.setpoint}°C</div>

                      <div
                        className={current.connected ? "working" : "offline"}
                      >
                        {current.connected
                          ? "● WORKING"
                          : "● NOT CONNECTED"}
                      </div>

                      <div className="details">
                        <div>
                          Temperature
                          <b>
                            {current.connected && chamber.temperature !== null
                              ? `${Number(chamber.temperature).toFixed(1)}°C`
                              : "--"}
                          </b>
                        </div>

                        <div>
                          Humidity
                          <b>
                            {current.connected && chamber.humidity !== null
                              ? `${Number(chamber.humidity).toFixed(0)}%`
                              : "--"}
                          </b>
                        </div>

                        <div>
                          Priority
                          <b>{chamber.priority}</b>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* LOWER CARDS */}
                <div className="lower">
                  {/* GRAPH */}
                  <div className="panel">
                    <h3>🌡 TEMPERATURE TREND</h3>

                    <div
                      className="temperature-chart"
                      style={{ width: "100%", height: "280px" }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={graphData}
                          margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" minTickGap={40} />
                          <YAxis unit="°C" domain={["auto", "auto"]} />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="A"
                            name="Chamber A"
                            dot={false}
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="B"
                            name="Chamber B"
                            dot={false}
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {!current.connected && (
                      <p className="graph-note">
                        ESP32 is not connected. Graph is ready and will display
                        readings when Warehouse 1 comes online.
                      </p>
                    )}
                  </div>

                  {/* OVERVIEW */}
                  <div className="panel">
                    <h3>📊 SYSTEM OVERVIEW</h3>

                    <div className="overview">
                      <div>
                        <span>Avg. Temp</span>
                        <b>{averageTemperature}°C</b>
                      </div>

                      <div>
                        <span>Humidity</span>
                        <b>
                          {humidity !== null ? `${humidity.toFixed(0)}%` : "--"}
                        </b>
                      </div>

                      <div>
                        <span>Total Load</span>
                        <b>{TOTAL_LOAD}</b>
                      </div>

                      <div>
                        <span>Risk</span>
                        <b className={current.connected ? "green" : "red"}>
                          {current.connected ? "LOW" : "UNKNOWN"}
                        </b>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* RIGHT CONTROL */}
              <aside className="control">
                <h2>🎮 MANUAL CONTROL</h2>
                <p className="control-sub">Operate selected chamber</p>

                <label>Select Chamber</label>
                <select
                  value={selectedChamber}
                  onChange={(e) => setSelectedChamber(e.target.value)}
                >
                  <option value="A">Chamber A</option>
                  <option value="B">Chamber B</option>
                </select>

                <label>Action</label>
                <div className="buttons">
                  <button
                    className="on"
                    onClick={() => updateSelectedChamber({ status: true })}
                  >
                    ⚡ TURN ON
                  </button>
                  <button
                    className="off"
                    onClick={() => updateSelectedChamber({ status: false })}
                  >
                    ⏻ TURN OFF
                  </button>
                </div>

                <label>Common LED Control</label>
                <div className="led-controls">
                  <div className={`led-row ${current.commonLed ? 'led-on' : ''}`}>
                    <div className="led-name">
                      <span className={`led-indicator ${current.commonLed ? 'active' : ''}`}></span>
                      <span>Common LED</span>
                      <b>{current.commonLed ? 'ON' : 'OFF'}</b>
                    </div>
                    <div className="led-buttons">
                      <button
                        type="button"
                        className={current.commonLed ? 'led-active' : ''}
                        onClick={() => updateCommonLed(true)}
                      >
                        ON
                      </button>
                      <button
                        type="button"
                        className={!current.commonLed ? 'led-off-active' : ''}
                        onClick={() => updateCommonLed(false)}
                      >
                        OFF
                      </button>
                    </div>
                  </div>
                </div>

                <label>Chamber LED Control</label>
                <div className="led-controls">
                  {['A', 'B'].map((id) => {
                    const chamber = current.chambers[id];
                    return (
                      <div className={`led-row ${chamber.led ? 'led-on' : ''}`} key={id}>
                        <div className="led-name">
                          <span className={`led-indicator ${chamber.led ? 'active' : ''}`}></span>
                          <span>Chamber {id} LED</span>
                          <b>{chamber.led ? 'ON' : 'OFF'}</b>
                        </div>
                        <div className="led-buttons">
                          <button
                            type="button"
                            className={chamber.led ? 'led-active' : ''}
                            onClick={() => updateChamber(id, { led: true })}
                          >
                            ON
                          </button>
                          <button
                            type="button"
                            className={!chamber.led ? 'led-off-active' : ''}
                            onClick={() => updateChamber(id, { led: false })}
                          >
                            OFF
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <label>Automation Priority</label>
                <div className="priority-buttons">
                  <button
                    className={
                      selected.priority === "P1" ? "priority-active" : ""
                    }
                    onClick={() =>
                      updateSelectedChamber({ priority: "P1" })
                    }
                  >
                    P1 — CRITICAL
                  </button>
                  <button
                    className={
                      selected.priority === "P2" ? "priority-active" : ""
                    }
                    onClick={() =>
                      updateSelectedChamber({ priority: "P2" })
                    }
                  >
                    P2 — HIGH
                  </button>
                </div>

                <label>Temperature Setpoint</label>
                <div className="temperature-control">
                  <button
                    onClick={() =>
                      updateSelectedChamber({
                        setpoint: selected.setpoint - 1,
                      })
                    }
                  >
                    −
                  </button>

                  <strong>{selected.setpoint}°C</strong>

                  <button
                    onClick={() =>
                      updateSelectedChamber({
                        setpoint: selected.setpoint + 1,
                      })
                    }
                  >
                    +
                  </button>
                </div>

                <button className="apply">APPLY SETPOINT</button>

                <div className="automation">
                  <div>
                    <b>Automation</b>
                    <small>Priority based control</small>
                  </div>
                  <div className="toggle">
                    <span></span>
                  </div>
                </div>

                {/* SELECTED CHAMBER */}
                <div className="selected">
                  <p>SELECTED CHAMBER</p>
                  <h3>
                    {current.name} — Chamber {selectedChamber}
                  </h3>

                  <div>
                    Temperature
                    <b>
                      {current.connected && selected.temperature !== null
                        ? `${Number(selected.temperature).toFixed(1)}°C`
                        : "--"}
                    </b>
                  </div>

                  <div>
                    Humidity
                    <b>
                      {current.connected && selected.humidity !== null
                        ? `${Number(selected.humidity).toFixed(0)}%`
                        : "--"}
                    </b>
                  </div>

                  <div>
                    Priority
                    <b>{selected.priority}</b>
                  </div>

                  <div>
                    State
                    <b
                      className={
                        current.connected && selected.status ? "green" : "red"
                      }
                    >
                      {current.connected && selected.status
                        ? "ON"
                        : "NOT CONNECTED"}
                    </b>
                  </div>
                </div>

                {/* NOT CONNECTED MESSAGE */}
                {!current.connected && (
                  <div className="not-connected-box">
                    <strong>
                      {isWarehouse1
                        ? "Warehouse 1 ESP32 is offline."
                        : `${current.name} is offline.`}
                    </strong>
                    <br />
                    {isWarehouse1
                      ? "Connect the ESP32 to show live Chamber A and Chamber B readings."
                      : `Connect the ESP32 at ${current.ip} to show live Chamber A and Chamber B readings.`}
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
