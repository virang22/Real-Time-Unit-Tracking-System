import { useEffect, useState } from "react";
import Card from "../components/dashboard/Card";
import MetricGauge from "../components/dashboard/MetricGauge";
import { MonthlyLineChart, WeeklyBarChart } from "../components/analytics/UsageCharts";
import { apiRequest } from "../api/axios";

const WEEKLY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

type TelemetryData = {
  power?: number;
  energy?: number;
  voltage?: number;
  current?: number;
  frequency?: number;
  powerFactor?: number;
  gridStatus?: string;
  updatedAt?: string;
};

type EnergyAnalysisData = {
  weekDaily: number[];
  selectedMonthDaily: number[];
  availableMonths: string[];
};

export default function AnalyticsPage() {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    power: 0,
    energy: 0,
    voltage: 0,
    current: 0,
    gridStatus: "OFFLINE",
  });
  const [energyAnalysis, setEnergyAnalysis] = useState<EnergyAnalysisData>({
    weekDaily: Array(7).fill(0),
    selectedMonthDaily: [],
    availableMonths: [],
  });
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthValue(new Date()));

  useEffect(() => {
    let isMounted = true;
    const fetchTelemetry = async () => {
      try {
        const data = await apiRequest<TelemetryData>("/live-data");
        if (isMounted && data) {
          setTelemetry(data);
        }
      } catch {
        /* ignore polling errors */
      }
    };

    void fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchEnergyAnalysis = async () => {
      try {
        const data = await apiRequest<EnergyAnalysisData>(
          `/live-data/energy-analysis?month=${encodeURIComponent(selectedMonth)}`
        );
        if (isMounted && data) {
          const availableMonths = data.availableMonths ?? [];
          setEnergyAnalysis({
            weekDaily: data.weekDaily ?? Array(7).fill(0),
            selectedMonthDaily: data.selectedMonthDaily ?? [],
            availableMonths,
          });
          const currentMonth = getMonthValue(new Date());
          if (selectedMonth === currentMonth && availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
            setSelectedMonth(availableMonths[0]);
          }
        }
      } catch {
        /* ignore polling errors */
      }
    };

    void fetchEnergyAnalysis();
    const energyInterval = setInterval(fetchEnergyAnalysis, 30000);
    return () => {
      isMounted = false;
      clearInterval(energyInterval);
    };
  }, [selectedMonth]);

  const isOnline = Boolean(
    telemetry.gridStatus !== "OFFLINE" && telemetry.updatedAt &&
    Date.now() - new Date(telemetry.updatedAt).getTime() < 10000
  );
  const livePowerKw = isOnline ? Number((Number(telemetry.power || 0) / 1000).toFixed(2)) : 0;
  const weeklyKwh = energyAnalysis.weekDaily;
  const weeklyTotal = weeklyKwh.reduce((sum, value) => sum + value, 0);
  const selectedMonthKwh = energyAnalysis.selectedMonthDaily;
  const selectedMonthTotal = selectedMonthKwh.reduce((sum, value) => sum + value, 0);
  const selectedMonthLabels = selectedMonthKwh.map((_, index) => String(index + 1));
  const currentDate = new Date();
  const recentMonths = Array.from({ length: 12 }, (_, offset) =>
    getMonthValue(new Date(currentDate.getFullYear(), currentDate.getMonth() - offset, 1))
  );
  const monthOptions = Array.from(new Set([...recentMonths, ...energyAnalysis.availableMonths, selectedMonth])).sort().reverse();
  const fillPortion = livePowerKw > 0 ? Math.min(1, livePowerKw / 4.0) : 0;

  return (
    <>
      <header className="gridos-page-head">
        <h1 className="gridos-page-title">Analytics</h1>
        <p className="gridos-page-desc">
          Stored daily and monthly energy consumption and current load from your ESP32 meter.
        </p>
      </header>

      <div className="gridos-analytics-top">
        <Card className="gridos-usage-card">
          <div className="gridos-usage-head">
            <div>
              <p className="gridos-usage-label">This week</p>
              <p className="gridos-usage-total">
                {weeklyTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <span>kWh</span>
              </p>
            </div>
            <span
              className="gridos-usage-delta"
            >
              Current week
            </span>
          </div>
          <div className="gridos-chart-wrap">
            <WeeklyBarChart labels={WEEKLY_LABELS} valuesKwh={weeklyKwh} />
          </div>
        </Card>

        <Card className="gridos-usage-card">
          <div className="gridos-usage-head">
            <div>
              <p className="gridos-usage-label">Daily energy consumption</p>
              <p className="gridos-usage-total">
                {selectedMonthTotal.toFixed(1)}
                <span>kWh</span>
              </p>
            </div>
            <select
              className="gridos-usage-delta"
              aria-label="Select month and year"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              style={{ border: 0, cursor: "pointer" }}
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>{formatMonthLabel(month)}</option>
              ))}
            </select>
          </div>
          <div className="gridos-chart-wrap">
            <MonthlyLineChart labels={selectedMonthLabels} valuesKwh={selectedMonthKwh} />
          </div>
        </Card>
      </div>

      <section style={{ marginTop: 8 }}>
        <h3 className="gridos-section-title">Real-time meter monitoring</h3>
        <div className="gridos-analytics-mid">
          <Card className="gridos-rt-card">
            <MetricGauge
              label="Live load"
              value={isOnline ? livePowerKw.toFixed(2) : "—"}
              unit="kW"
              trend={isOnline ? "Streaming" : "No live data"}
              fillPortion={fillPortion}
            />
            <p className="gridos-rt-caption">
              Real-time load reported by the ESP32 PZEM meter.
            </p>
          </Card>
          <Card className="gridos-rt-card">
            <div className="ac-summary-list">
              {[
                { label: "Voltage", value: isOnline ? `${Number(telemetry.voltage).toFixed(2)} V` : "—" },
                { label: "Current", value: isOnline ? `${Number(telemetry.current).toFixed(3)} A` : "—" },
                { label: "Frequency", value: isOnline ? `${Number(telemetry.frequency).toFixed(2)} Hz` : "—" },
                { label: "Power factor", value: isOnline ? Number(telemetry.powerFactor).toFixed(2) : "—" },
              ].map((reading) => (
                <div key={reading.label} className="ac-summary-item">
                  <span className="ac-summary-label">{reading.label}</span>
                  <span className="ac-summary-value">{reading.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
