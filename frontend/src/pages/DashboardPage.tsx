import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/axios";
import { getToken } from "../utils/token";
import { playAlarmSound } from "../utils/alertSound";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:11020/api";
const configuredHighPowerThreshold = Number(import.meta.env.VITE_HIGH_POWER_THRESHOLD_W);
const HIGH_POWER_THRESHOLD_W = Number.isFinite(configuredHighPowerThreshold) && configuredHighPowerThreshold > 0
  ? configuredHighPowerThreshold
  : 40;

type TelemetryData = {
  deviceId?: string;
  voltage: number;
  current: number;
  power: number;
  energy: number;
  frequency: number;
  powerFactor: number;
  gridStatus?: string;
  relayState?: string;
  updatedAt?: string;
};

type EnergyAnalysis = {
  today: number | null;
  thisWeek: number | null;
  thisMonth: number | null;
  total: number | null;
};

export default function DashboardPage() {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    deviceId: "ESP32-GRID-NODE-01",
    voltage: 0,
    current: 0,
    power: 0,
    energy: 0,
    frequency: 0,
    powerFactor: 0,
    gridStatus: "OFFLINE",
  });
  const [energyHistory, setEnergyHistory] = useState<number[]>([]);
  const [powerHistory, setPowerHistory] = useState<number[]>([]);
  const [energyAnalysis, setEnergyAnalysis] = useState<EnergyAnalysis>({
    today: null,
    thisWeek: null,
    thisMonth: null,
    total: null,
  });
  const [chartMode, setChartMode] = useState<"energy" | "power">("energy");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [energyLimit, setEnergyLimit] = useState<number | null>(null);
  const [activeEnergyAlert, setActiveEnergyAlert] = useState<{ limit: number; current: number } | null>(null);
  const [loadChangeAlert, setLoadChangeAlert] = useState<{ from: number; to: number; change: number } | null>(null);
  const [highPowerAlert, setHighPowerAlert] = useState<number | null>(null);
  const energyAlertShown = useRef(false);
  const lastPowerSample = useRef<{ power: number; updatedAt: string } | null>(null);
  const highPowerSamples = useRef(0);
  const highPowerAlertActive = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const fetchLiveTelemetry = async () => {
      try {
        const data = await apiRequest<TelemetryData>("/live-data");
        if (isMounted && data) {
          setTelemetry((prev) => ({ ...prev, ...data }));
          const valE = Number(data.energy) || 0;
          const valP = Number(data.power) || 0;

          if (data.gridStatus === "OFFLINE" || !data.updatedAt || !Number.isFinite(Number(data.power))) {
            lastPowerSample.current = null;
            highPowerSamples.current = 0;
            highPowerAlertActive.current = false;
            setHighPowerAlert(null);
          } else {
            const previousSample = lastPowerSample.current;
            const isFreshSample = !previousSample || data.updatedAt !== previousSample.updatedAt;
            if (!previousSample) {
              lastPowerSample.current = { power: valP, updatedAt: data.updatedAt };
            } else if (isFreshSample) {
              const change = valP - previousSample.power;
              const threshold = Math.max(3, Math.abs(previousSample.power) * 0.2);
              if (Math.abs(change) >= threshold) {
                setLoadChangeAlert({ from: previousSample.power, to: valP, change });
                lastPowerSample.current = { power: valP, updatedAt: data.updatedAt };
              } else {
                lastPowerSample.current = { ...previousSample, updatedAt: data.updatedAt };
              }
            }

            if (isFreshSample) {
              if (valP > HIGH_POWER_THRESHOLD_W) {
                highPowerSamples.current += 1;
                if (highPowerSamples.current >= 2 && !highPowerAlertActive.current) {
                  highPowerAlertActive.current = true;
                  setHighPowerAlert(valP);
                }
              } else {
                highPowerSamples.current = 0;
                if (valP <= HIGH_POWER_THRESHOLD_W * 0.95) {
                  highPowerAlertActive.current = false;
                  setHighPowerAlert(null);
                }
              }
            }
          }

          setEnergyHistory((prev) => {
            if (prev.length === 0) {
              return Array.from({ length: 15 }, () => valE);
            }
            return [...prev, valE].slice(-30);
          });

          setPowerHistory((prev) => {
            if (prev.length === 0) {
              return Array.from({ length: 15 }, () => valP);
            }
            return [...prev, valP].slice(-30);
          });

          setCurrentTime(Date.now());
        }
      } catch {
        /* ignore polling errors */
      }
    };

    fetchLiveTelemetry();

    const fetchEnergyAnalysis = async () => {
      try {
        const data = await apiRequest<EnergyAnalysis>("/live-data/energy-analysis");
        if (isMounted && data) setEnergyAnalysis(data);
      } catch {
        /* ignore polling errors */
      }
    };

    const fetchEnergyLimit = async () => {
      const token = getToken() ?? localStorage.getItem("auth_token");
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE_URL}/alerts/energy-limit`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (typeof data.energyLimit === "number" && data.energyLimit > 0) {
          setEnergyLimit(data.energyLimit);
        }
      } catch {
        /* ignore */
      }
    };

    void fetchEnergyAnalysis();
    void fetchEnergyLimit();
    const interval = setInterval(fetchLiveTelemetry, 2000);
    const energyAnalysisInterval = setInterval(fetchEnergyAnalysis, 30000);
    const limitInterval = setInterval(fetchEnergyLimit, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(energyAnalysisInterval);
      clearInterval(limitInterval);
    };
  }, []);

  useEffect(() => {
    if (!loadChangeAlert) return;
    const timeout = window.setTimeout(() => setLoadChangeAlert(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [loadChangeAlert]);

  useEffect(() => {
    if (energyLimit === null || !telemetry.energy) return;

    const alertStorageKey = `energy-alert-shown-${energyLimit}`;
    const alreadyShown = localStorage.getItem(alertStorageKey) === "true";
    energyAlertShown.current = alreadyShown;

    if (telemetry.energy < energyLimit) {
      energyAlertShown.current = false;
      localStorage.removeItem(alertStorageKey);
      setActiveEnergyAlert(null);
    }

    if (telemetry.energy >= energyLimit && !energyAlertShown.current && !alreadyShown) {
      energyAlertShown.current = true;
      localStorage.setItem(alertStorageKey, "true");
      setActiveEnergyAlert({ limit: energyLimit, current: telemetry.energy });
      playAlarmSound(4);
    }
  }, [energyLimit, telemetry.energy]);

  // Consider online if gridStatus returned from backend is not OFFLINE
  const isOnline = Boolean(
    telemetry.gridStatus && telemetry.gridStatus !== "OFFLINE"
  );

  const deviceDisplayName = isOnline
    ? (telemetry.deviceId === "ESP32-GRID-NODE-01" ? "ESP32 (MyPhone)" : (telemetry.deviceId || "ESP32 Connected"))
    : "ESP32 Offline (Disconnected)";

  const metrics = [
    {
      title: "VOLTAGE",
      value: isOnline ? Number(telemetry.voltage).toFixed(2) : "—",
      unit: "V",
      subtitle: isOnline ? "AC input level" : "Waiting for ESP32 telemetry",
      tone: "blue",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2 6 13h5l-1 9 7-11h-5l1-9Z" fill="currentColor" />
        </svg>
      )
    },
    {
      title: "CURRENT",
      value: isOnline ? Number(telemetry.current).toFixed(3) : "—",
      unit: "A",
      subtitle: isOnline ? "Load current" : "Waiting for ESP32 telemetry",
      tone: "green",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h4l2-5 3 10 2-5h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: "POWER",
      value: isOnline ? Number(telemetry.power).toFixed(2) : "—",
      unit: "W",
      subtitle: isOnline ? "Real-time wattage" : "Waiting for ESP32 telemetry",
      tone: "cream",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 16.5h10M8 13.5l2-5h4l-2 5h2.5l-5.5 7 1.5-6H8l2-6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: "ENERGY",
      value: isOnline ? Number(telemetry.energy || 0).toFixed(4) : Number(telemetry.energy || 0).toFixed(4),
      unit: "kWh",
      subtitle: "Total consumed",
      tone: "purple",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 18h10M9 18V9m6 9V6m-3 12V4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    },
    {
      title: "FREQUENCY",
      value: isOnline ? Number(telemetry.frequency).toFixed(2) : "—",
      unit: "Hz",
      subtitle: isOnline ? "AC line frequency" : "Waiting for ESP32 telemetry",
      tone: "lavender",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12c2.5-4 5.5-6 8-6 3.6 0 6.4 3.3 8 6-2.5 4-5.5 6-8 6-3.6 0-6.4-3.3-8-6Zm8-2v4m-2-2h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: "POWER FACTOR",
      value: isOnline ? Number(telemetry.powerFactor).toFixed(2) : "—",
      unit: "",
      subtitle: isOnline ? "Load efficiency" : "Waiting for ESP32 telemetry",
      tone: "pink",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 12h3l2-4 2 8 2-4h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ];

  const summaryRows = [
    { label: "CONNECTION", value: deviceDisplayName },
    { label: "VOLTAGE", value: isOnline ? `${Number(telemetry.voltage).toFixed(2)} V` : "— (Waiting for telemetry)" },
    { label: "CURRENT", value: isOnline ? `${Number(telemetry.current).toFixed(3)} A` : "—" },
    { label: "POWER",   value: isOnline ? `${Number(telemetry.power).toFixed(2)} W` : "—" }
  ];

  const energyPeriods = [
    { label: "Today", value: energyAnalysis.today },
    { label: "This Week", value: energyAnalysis.thisWeek },
    { label: "This Month", value: energyAnalysis.thisMonth },
    { label: "Total", value: energyAnalysis.total },
  ];
  const maxPeriodEnergy = Math.max(0, ...energyPeriods.map(({ value }) => value ?? 0));

  const activeHistory = chartMode === "energy" ? energyHistory : powerHistory;
  const activeVal = chartMode === "energy" ? Number(telemetry.energy || 0) : Number(telemetry.power || 0);
  const activeUnit = chartMode === "energy" ? "kWh" : "W";
  const activeLabel = chartMode === "energy" ? "Energy Consumption (kWh)" : "Real-Time Power (W)";

  const pointsList = activeHistory.length > 0 ? activeHistory : [activeVal];
  const rawMin = Math.min(...pointsList);
  const rawMax = Math.max(...pointsList);
  const diff = rawMax - rawMin;

  const pad = diff > 0.05
    ? diff * 0.25
    : (rawMax > 0 ? Math.max(0.5, rawMax * 0.08) : 1);
  const chartMin = Math.max(0, rawMin - pad);
  const chartMax = rawMax + pad;
  const range = chartMax - chartMin || 1;

  const points = pointsList.map((val, index) => {
    const x = pointsList.length > 1 ? (index / (pointsList.length - 1)) * 670 + 15 : 350;
    const normalized = (val - chartMin) / range;
    const y = 205 - normalized * 155;
    return { x, y };
  });

  let linePath = "";
  if (points.length === 1) {
    linePath = `M 0 ${points[0].y.toFixed(1)} L 700 ${points[0].y.toFixed(1)}`;
  } else if (points.length > 1) {
    linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
  }

  const lastPoint = points[points.length - 1] || { x: 685, y: 205 };
  const firstPoint = points[0] || { x: 15, y: 205 };
  const areaPath = points.length > 1
    ? `${linePath} L ${lastPoint.x.toFixed(1)} 220 L ${firstPoint.x.toFixed(1)} 220 Z`
    : "";

  const chartPointX = lastPoint.x;
  const chartPointY = lastPoint.y;
  const chartLabelX = chartPointX > 590 ? chartPointX - 16 : chartPointX + 16;
  const chartLabelY = Math.max(45, Math.min(195, chartPointY - 10));
  const chartLabelAnchor = chartPointX > 590 ? "end" : "start";

  return (
    <div className="ac-dashboard-wrapper">
      <header className="ac-header">
        <div className="ac-header-left">
          <div className="ac-header-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M13 2 6 13h5l-1 9 7-11h-5l1-9Z" fill="currentColor" />
            </svg>
          </div>
          <div className="ac-header-text">
            <h1>AC Energy Dashboard</h1>
            <p>Live voltage, current, power, energy, frequency and power factor monitoring</p>
          </div>
        </div>

        <div className="ac-device-status">
          <span className="ac-device-label">Device Status</span>
          <div className="ac-device-value">
            <span className={`ac-status-dot ${!isOnline ? "ac-status-dot--offline" : ""}`} />
            {deviceDisplayName}
          </div>
        </div>
      </header>

      {activeEnergyAlert && (
        <div
          role="alert"
          style={{
            margin: "0 0 20px 0",
            padding: "16px 22px",
            borderRadius: "14px",
            backgroundColor: "#dc2626",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            boxShadow: "0 10px 25px -5px rgba(220, 38, 38, 0.45)",
            border: "2px solid #f87171",
            animation: "pulse 2s infinite ease-in-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "2rem" }}>🚨</span>
            <div>
              <strong style={{ fontSize: "1.15rem", letterSpacing: "0.5px", display: "block" }}>
                CRITICAL ALERT: ENERGY LIMIT EXCEEDED!
              </strong>
              <span style={{ fontSize: "0.95rem", opacity: 0.95 }}>
                Current consumption has reached <strong>{activeEnergyAlert.current.toFixed(2)} kWh</strong> (Configured limit: <strong>{activeEnergyAlert.limit.toFixed(2)} kWh</strong>).
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => playAlarmSound(3)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#ffffff",
                color: "#dc2626",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              🔔 Replay Alarm
            </button>
            <button
              type="button"
              onClick={() => setActiveEnergyAlert(null)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.7)",
                backgroundColor: "rgba(0,0,0,0.2)",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {loadChangeAlert && (
        <div
          role="status"
          aria-live="polite"
          style={{
            margin: "0 0 20px 0",
            padding: "14px 18px",
            border: "1px solid #93c5fd",
            borderRadius: "8px",
            backgroundColor: "#eff6ff",
            color: "#1e3a8a",
            fontWeight: 600,
          }}
        >
          Load Change Detected: {loadChangeAlert.from.toFixed(1)}W {"\u2192"} {loadChangeAlert.to.toFixed(1)}W ({loadChangeAlert.change >= 0 ? "+" : ""}{loadChangeAlert.change.toFixed(1)}W)
        </div>
      )}

      {highPowerAlert !== null && (
        <div
          role="alert"
          style={{
            margin: "0 0 20px 0",
            padding: "14px 18px",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          ⚠️ High Power Consumption Detected: {highPowerAlert.toFixed(0)}W
        </div>
      )}

      <div className="ac-metrics-grid">
        {metrics.map((metric) => (
          <div key={metric.title} className={`ac-metric-card ac-metric-card--${metric.tone}`}>
            <div className="ac-metric-header">
              <h2 className="ac-metric-title">{metric.title}</h2>
              <div className="ac-metric-icon" aria-hidden="true">
                {metric.icon}
              </div>
            </div>

            <div className="ac-metric-value">
              {metric.value}
              {metric.unit ? <span className="ac-metric-unit">{metric.unit}</span> : null}
            </div>
            <div className="ac-metric-subtitle">{metric.subtitle}</div>
            <span className="ac-metric-orb" aria-hidden="true" />
          </div>
        ))}
      </div>

      <div className="ac-bottom-section">
        <div className="ac-chart-card">
          <div className="ac-chart-header-row">
            <div className="ac-card-title">
              {chartMode === "energy" ? "Daily Energy Consumption" : "Real-Time Power Trend"}
            </div>
            <div className="ac-chart-tabs">
              <button
                type="button"
                className={`ac-chart-tab ${chartMode === "energy" ? "ac-chart-tab--active" : ""}`}
                onClick={() => setChartMode("energy")}
              >
                Energy (kWh)
              </button>
              <button
                type="button"
                className={`ac-chart-tab ${chartMode === "power" ? "ac-chart-tab--active" : ""}`}
                onClick={() => setChartMode("power")}
              >
                Power (W)
              </button>
            </div>
          </div>

          <svg className="ac-power-chart" viewBox="0 0 700 260" preserveAspectRatio="none" aria-label="Power trend chart">
            <defs>
              <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2B6DEB" stopOpacity="0.30" />
                <stop offset="80%" stopColor="#2B6DEB" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#2B6DEB" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            <g className="ac-chart-grid" aria-hidden="true">
              <line x1="0" y1="40" x2="700" y2="40" />
              <line x1="0" y1="100" x2="700" y2="100" />
              <line x1="0" y1="160" x2="700" y2="160" />
              <line x1="0" y1="220" x2="700" y2="220" />
            </g>

            <text x="24" y="22" className="ac-chart-label ac-chart-label--left">{activeLabel}</text>
            
            {areaPath ? <path d={areaPath} className="ac-chart-area" fill="url(#chartAreaGradient)" /> : null}
            <path d={linePath} className="ac-chart-line" />

            <circle cx={chartPointX} cy={chartPointY} className="ac-live-dot-pulse" />
            <circle cx={chartPointX} cy={chartPointY} r="5.5" className="ac-chart-main-dot" />

            <text x="660" y="214" textAnchor="end" className="ac-chart-label">Min {chartMin.toFixed(1)} {activeUnit}</text>
            <text x="660" y="30" textAnchor="end" className="ac-chart-label">Max {chartMax.toFixed(1)} {activeUnit}</text>
            <text x={chartLabelX} y={chartLabelY} textAnchor={chartLabelAnchor} className="ac-chart-label">
              Now {activeVal.toFixed(1)} {activeUnit}
            </text>
            <text x="16" y="246" className="ac-chart-label">Recent</text>
            <text x="660" y="246" textAnchor="end" className="ac-chart-label">Live</text>
          </svg>
        </div>

        <div className="ac-summary-card">
          <div className="ac-card-title">Live Summary</div>
          <div className="ac-summary-list">
            {summaryRows.map((row) => (
              <div key={row.label} className="ac-summary-item">
                <span className="ac-summary-label">{row.label}</span>
                <span className="ac-summary-value">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="ac-progress-bar-container" aria-label="Power level indicator">
            <div
              className="ac-progress-bar-fill"
              style={{ width: `${Math.min(100, ((telemetry.power || 0) / 1000) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <section className="ac-chart-card" style={{ marginTop: 20 }} aria-label="Energy consumption analysis">
        <h2 className="ac-card-title">Energy Consumption Analysis</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))", gap: 18 }}>
          {energyPeriods.map(({ label, value }) => (
            <div key={label}>
              <div className="ac-summary-label">{label}</div>
              <div className="ac-summary-value" style={{ margin: "8px 0" }}>
                {value === null ? "—" : value.toFixed(4)} <span>kWh</span>
              </div>
              <div style={{ height: 6, overflow: "hidden", borderRadius: 3, background: "rgba(148, 163, 184, 0.2)" }}>
                <div
                  style={{
                    height: "100%",
                    width: value === null || maxPeriodEnergy === 0 ? "0%" : `${(value / maxPeriodEnergy) * 100}%`,
                    background: "#2b6deb",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="ac-footer-label">AC Energy Meter By Circuit Diagrams</div>
    </div>
  );
}

