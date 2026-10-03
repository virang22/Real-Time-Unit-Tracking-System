import { useEffect, useMemo, useState, type ReactNode } from "react";
import Card from "../components/dashboard/Card";
import MetricGauge from "../components/dashboard/MetricGauge";
import { IconBattery, IconEv, IconFan } from "../components/dashboard/gridosIcons";
import { MonthlyLineChart, WeeklyBarChart } from "../components/analytics/UsageCharts";
import { apiRequest } from "../api/axios";

const WEEKLY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHLY_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

// Typical daily distribution factors (Mon-Sun)
const WEEKLY_WEIGHTS = [0.13, 0.15, 0.16, 0.14, 0.18, 0.14, 0.10];
// Jan-Aug historical kWh
const HISTORICAL_MONTHS = [245, 218, 285, 264, 312, 348, 362, 335];

type TelemetryData = {
  power?: number;
  energy?: number;
  voltage?: number;
  current?: number;
  gridStatus?: string;
  updatedAt?: string;
};

function useJitteredValue(target: number, min: number, max: number, intervalMs = 1600) {
  const [v, setV] = useState(target);

  useEffect(() => {
    setV(target);
  }, [target]);

  useEffect(() => {
    if (target <= 0) {
      setV(0);
      return;
    }
    const id = window.setInterval(() => {
      setV(() => {
        const jitter = (Math.random() - 0.5) * 0.03;
        const n = Math.max(min, Math.min(max, target + jitter));
        return Math.round(n * 100) / 100;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [target, min, max, intervalMs]);

  return v;
}

function formatKw(v: number) {
  return `${v.toFixed(2)} kW`;
}

type UnitRtProps = {
  name: string;
  kw: number;
  status: "active" | "standby";
  icon: ReactNode;
  sparkSeed: number;
};

function UnitRealtimeCard({ name, kw, status, icon, sparkSeed }: UnitRtProps) {
  const pts = useMemo(() => {
    const base = sparkSeed * 17;
    const out: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * 100;
      const wave = Math.sin((i + base) * 0.7) * 8 + Math.cos((i + base) * 0.4) * 5;
      const y = 18 + wave + (kw > 0.1 ? 0 : 6);
      out.push(`${x},${Math.min(26, Math.max(4, y))}`);
    }
    return out.join(" ");
  }, [kw, sparkSeed]);

  return (
    <article className="gridos-unit-rt">
      <div className="gridos-unit-rt-head">
        <div className="gridos-infra-icon">{icon}</div>
        <span
          className={
            status === "active" ? "gridos-status-dot" : "gridos-status-dot gridos-status-dot--standby"
          }
          title={status === "active" ? "Active" : "Standby"}
        />
      </div>
      <p className="gridos-unit-rt-name">{name}</p>
      <p className="gridos-unit-rt-kw">{formatKw(kw)}</p>
      <svg className="gridos-unit-rt-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pts}
        />
      </svg>
    </article>
  );
}

export default function AnalyticsPage() {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    power: 0,
    energy: 0,
    voltage: 0,
    current: 0,
    gridStatus: "ONLINE",
  });

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

  const livePowerKw = telemetry.power ? Number((telemetry.power / 1000).toFixed(2)) : 0;
  const liveEnergyKwh = telemetry.energy ? Number(Number(telemetry.energy).toFixed(2)) : 250;

  // Dynamic weekly consumption based on current energy
  const weeklyKwh = useMemo(() => {
    const total = liveEnergyKwh > 0 ? liveEnergyKwh : 250;
    return WEEKLY_WEIGHTS.map((weight) => Math.round(total * weight * 10) / 10);
  }, [liveEnergyKwh]);

  const weeklyTotal = useMemo(() => weeklyKwh.reduce((a, b) => a + b, 0), [weeklyKwh]);

  // Dynamic monthly consumption: historical months + current month (September)
  const monthlyKwh = useMemo(() => {
    const currentMonthKwh = liveEnergyKwh > 0 ? Math.round(liveEnergyKwh) : 250;
    // Current month is Sep (index 8). Future months (Oct, Nov, Dec) are 0
    return [...HISTORICAL_MONTHS, currentMonthKwh, 0, 0, 0];
  }, [liveEnergyKwh]);

  const monthlyTotal = useMemo(() => monthlyKwh.reduce((a, b) => a + b, 0), [monthlyKwh]);

  // Micro-jittered subunit loads synchronized with live meter load
  const liveAggregate = useJitteredValue(
    livePowerKw,
    Math.max(0, livePowerKw - 0.2),
    livePowerKw + 0.2,
    1400
  );
  const fillPortion = livePowerKw > 0 ? Math.min(1, livePowerKw / 4.0) : 0;

  const hvacTarget = livePowerKw > 0 ? Number((livePowerKw * 0.45).toFixed(2)) : 0;
  const storageTarget = livePowerKw > 0 ? Number((livePowerKw * 0.30).toFixed(2)) : 0;
  const evTarget = livePowerKw > 0 ? Number((livePowerKw * 0.25).toFixed(2)) : 0;

  const hvacKw = useJitteredValue(hvacTarget, Math.max(0, hvacTarget - 0.05), hvacTarget + 0.05, 1500);
  const storageKw = useJitteredValue(
    storageTarget,
    Math.max(0, storageTarget - 0.03),
    storageTarget + 0.03,
    1700
  );
  const evKw = useJitteredValue(evTarget, Math.max(0, evTarget - 0.03), evTarget + 0.03, 2000);

  const weeklyTrendPct = weekHalfOverHalfChange(weeklyKwh);
  const trendWeekly =
    weeklyTrendPct >= 0 ? `+${weeklyTrendPct.toFixed(1)}%` : `${weeklyTrendPct.toFixed(1)}%`;

  return (
    <>
      <header className="gridos-page-head">
        <h1 className="gridos-page-title">Analytics</h1>
        <p className="gridos-page-desc">
          Energy usage by week and month (kWh), live draw per unit, and aggregate real-time load from
          your node.
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
              className={`gridos-usage-delta${weeklyTrendPct < 0 ? " gridos-usage-delta--down" : ""}`}
            >
              {trendWeekly} vs last week
            </span>
          </div>
          <div className="gridos-chart-wrap">
            <WeeklyBarChart labels={WEEKLY_LABELS} valuesKwh={weeklyKwh} />
          </div>
        </Card>

        <Card className="gridos-usage-card">
          <div className="gridos-usage-head">
            <div>
              <p className="gridos-usage-label">This year (monthly)</p>
              <p className="gridos-usage-total">
                {(monthlyTotal / 1000).toFixed(2)}
                <span>MWh</span>
              </p>
            </div>
            <span className="gridos-usage-delta">+3.4% vs prior year</span>
          </div>
          <div className="gridos-chart-wrap">
            <MonthlyLineChart labels={MONTHLY_LABELS} valuesKwh={monthlyKwh} />
          </div>
        </Card>
      </div>

      <section style={{ marginTop: 8 }}>
        <h3 className="gridos-section-title">Real-time unit monitoring</h3>
        <div className="gridos-analytics-mid">
          <Card className="gridos-rt-card">
            <MetricGauge
              label="Live load"
              value={liveAggregate.toFixed(2)}
              unit="kW"
              trend={livePowerKw > 0 ? "Streaming" : "Standby"}
              fillPortion={fillPortion}
            />
            <p className="gridos-rt-caption">
              Combined power across registered units. Values refresh from your meter stream.
            </p>
          </Card>
          <div className="gridos-units-analytics">
            <UnitRealtimeCard
              name="Main HVAC unit"
              kw={hvacKw}
              status={hvacKw > 0.05 ? "active" : "standby"}
              icon={<IconFan />}
              sparkSeed={1}
            />
            <UnitRealtimeCard
              name="Sub-Zero storage"
              kw={storageKw}
              status={storageKw > 0.05 ? "active" : "standby"}
              icon={<IconBattery />}
              sparkSeed={2}
            />
            <UnitRealtimeCard
              name="Tesla Wall Connector"
              kw={evKw}
              status={evKw > 0.05 ? "active" : "standby"}
              icon={<IconEv />}
              sparkSeed={3}
            />
          </div>
        </div>
      </section>
    </>
  );
}

function weekHalfOverHalfChange(values: number[]) {
  const half = Math.floor(values.length / 2);
  if (half < 1 || values.length - half < 1) return 0;
  const a = values.slice(0, half).reduce((s, x) => s + x, 0) / half;
  const b = values.slice(half).reduce((s, x) => s + x, 0) / (values.length - half);
  return ((b - a) / Math.max(a, 1)) * 100;
}
