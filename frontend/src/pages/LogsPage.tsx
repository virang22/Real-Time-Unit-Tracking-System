import { useMemo, useState } from "react";
import Card from "../components/dashboard/Card";

type Level = "all" | "info" | "warn" | "error";

type LogLine = { t: string; level: Exclude<Level, "all">; msg: string };

const MOCK_LOGS: LogLine[] = [
  { t: "10:42:01.228", level: "info", msg: "sync: block 19,204,881 applied (latency 12ms)" },
  { t: "10:41:58.104", level: "info", msg: "meter: HVAC-1 sample 3.18 kW" },
  { t: "10:41:55.881", level: "warn", msg: "p2p: counterparty NODE-BETA-04 slow ACK (2.1s)" },
  { t: "10:41:50.002", level: "info", msg: "wallet: prepaid balance check OK" },
  { t: "10:41:44.330", level: "error", msg: "rpc: fallback endpoint timeout, switched primary" },
  { t: "10:41:40.115", level: "info", msg: "validator: heartbeat sent" },
  { t: "10:41:33.900", level: "info", msg: "contract: EnergySettlement view call success" },
  { t: "10:41:28.441", level: "warn", msg: "disk: log buffer 78% full (rotation in 4h)" },
  { t: "10:41:22.008", level: "info", msg: "auth: session refreshed" },
];

export default function LogsPage() {
  const [filter, setFilter] = useState<Level>("all");

  const lines = useMemo(() => {
    if (filter === "all") return MOCK_LOGS;
    return MOCK_LOGS.filter((l) => l.level === filter);
  }, [filter]);

  const onCopy = () => {
    const text = lines.map((l) => `${l.t} [${l.level.toUpperCase()}] ${l.msg}`).join("\n");
    void navigator.clipboard.writeText(text).then(
      () => window.alert("Copied to clipboard (demo)."),
      () => window.alert("Copy failed."),
    );
  };

  const onClear = () => {
    window.alert("Demo only — logs are static in this build.");
  };

  return (
    <>
      <header className="gridos-page-head">
        <h1 className="gridos-page-title">Logs</h1>
        <p className="gridos-page-desc">
          Recent node, RPC, and metering events. Filter by level or copy for support tickets.
        </p>
      </header>

      <Card className="gridos-logs-card">
        <div className="gridos-logs-toolbar">
          <div className="gridos-logs-filters" role="tablist" aria-label="Log level">
            {(["all", "info", "warn", "error"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                role="tab"
                aria-selected={filter === lvl}
                className={`gridos-logs-filter${filter === lvl ? " is-active" : ""}`}
                onClick={() => setFilter(lvl)}
              >
                {lvl === "all" ? "All" : lvl.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="gridos-logs-actions">
            <button type="button" className="gridos-logs-btn" onClick={onCopy}>
              Copy visible
            </button>
            <button type="button" className="gridos-logs-btn gridos-logs-btn--ghost" onClick={onClear}>
              Clear (demo)
            </button>
          </div>
        </div>
        <div className="gridos-logs-view" role="log" aria-live="polite">
          {lines.map((line, i) => (
            <div key={`${line.t}-${i}`} className={`gridos-log-line gridos-log-line--${line.level}`}>
              <span className="gridos-log-time">{line.t}</span>
              <span className="gridos-log-level">{line.level}</span>
              <span className="gridos-log-msg">{line.msg}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
