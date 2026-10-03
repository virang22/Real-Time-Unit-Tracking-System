import { useCallback, useEffect, useState } from "react";
import Card from "../components/dashboard/Card";
import { USDT_TO_INR } from "../utils/inrFormat";
import { getUser } from "../utils/token";

const KEY_NODE_NAME = "gridos-settings-node-name";
const KEY_NODE_ID = "gridos-settings-node-id";
const KEY_NOTIFY_LOW = "gridos-settings-notify-low";
const KEY_NOTIFY_SETTLE = "gridos-settings-notify-settle";
const KEY_NOTIFY_P2P = "gridos-settings-notify-p2p";
const KEY_DATA_RETENTION = "gridos-settings-retention";
// New key for low balance threshold (numeric value in USDT)
const KEY_LOW_THRESHOLD = "gridos-settings-low-threshold";

function readBool(key: string, defaultVal: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return defaultVal;
}

function readString(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key);
    if (v != null && v.length > 0) return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

function readNumber(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v != null && v.length > 0) {
      const n = Number(v);
      if (!isNaN(n)) return n;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export default function SettingsPage() {
  const user = getUser();
  const [nodeName, setNodeName] = useState(() => readString(KEY_NODE_NAME, user?.name || "ALPHA-01"));
  const [nodeId, setNodeId] = useState(() => readString(KEY_NODE_ID, "0x7f3a…e901"));
  const [notifyLow, setNotifyLow] = useState(() => readBool(KEY_NOTIFY_LOW, true));
  const [notifySettle, setNotifySettle] = useState(() => readBool(KEY_NOTIFY_SETTLE, true));
  const [notifyP2P, setNotifyP2P] = useState(() => readBool(KEY_NOTIFY_P2P, true));
  const [retention, setRetention] = useState(() => readString(KEY_DATA_RETENTION, "0"));
  // New state for low balance threshold (default 0 USDT)
  const [lowThreshold, setLowThreshold] = useState(() => readNumber(KEY_LOW_THRESHOLD, 0));

  useEffect(() => {
    localStorage.setItem(KEY_NODE_NAME, nodeName);
  }, [nodeName]);

  useEffect(() => {
    localStorage.setItem(KEY_NODE_ID, nodeId);
  }, [nodeId]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_NOTIFY_LOW, notifyLow ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [notifyLow]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_NOTIFY_SETTLE, notifySettle ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [notifySettle]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_NOTIFY_P2P, notifyP2P ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [notifyP2P]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_DATA_RETENTION, retention);
    } catch {
      /* ignore */
    }
  }, [retention]);

  // Persist low balance threshold whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(KEY_LOW_THRESHOLD, lowThreshold.toString());
    } catch {
      /* ignore */
    }
  }, [lowThreshold]);

  const onExport = useCallback(() => {
    const rows = [
      ["Setting", "Value"],
      ["Node display name", nodeName],
      ["Node ID", nodeId],
      ["Validator", "Verified"],
      ["Low prepaid balance notifications", notifyLow ? "Enabled" : "Disabled"],
      ["Low balance threshold (USDT)", String(lowThreshold)],
      ["Settlement receipt notifications", notifySettle ? "Enabled" : "Disabled"],
      ["P2P match notifications", notifyP2P ? "Enabled" : "Disabled"],
      ["Ledger history (days)", retention],
      ["USDT to INR display rate", String(USDT_TO_INR)],
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "grid-os-settings.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [nodeName, nodeId, notifyLow, notifySettle, notifyP2P, lowThreshold, retention]);

  return (
    <>
      <header className="gridos-page-head">
        <h1 className="gridos-page-title">Settings</h1>
        <p className="gridos-page-desc">
          Node identity, alerts, and data preferences. Changes apply on this device immediately.
        </p>
      </header>

      <div className="gridos-settings-grid">
        <Card className="gridos-settings-card">
          <h3 className="gridos-section-title">Node</h3>
          <dl className="gridos-settings-dl">
            <div>
              <dt>Display name</dt>
              <dd>
                <input
                  className="gridos-settings-select"
                  value={nodeName}
                  onChange={(event) => setNodeName(event.target.value)}
                  aria-label="Node display name"
                />
              </dd>
            </div>
            <div>
              <dt>Node ID</dt>
              <dd>
                <input
                  className="gridos-settings-select gridos-p2p-mono"
                  value={nodeId}
                  onChange={(event) => setNodeId(event.target.value)}
                  aria-label="Node ID"
                />
              </dd>
            </div>
            <div>
              <dt>Validator</dt>
              <dd>
                <span className="gridos-badge">Verified</span>
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="gridos-settings-card">
          <h3 className="gridos-section-title">Notifications</h3>
          <ul className="gridos-settings-toggles">
            <li>
              <div>
                <p className="gridos-settings-toggle-label">Low prepaid balance</p>
                <p className="gridos-settings-toggle-hint">Push when below threshold</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifyLow}
                className={`gridos-switch${notifyLow ? " is-on" : ""}`}
                onClick={() => setNotifyLow((v) => !v)}
              >
                <span className="gridos-switch-knob" />
              </button>
            </li>
            {/* New threshold input row */}
            <li>
              <div>
                <p className="gridos-settings-toggle-label">Low balance threshold (USDT)</p>
                <p className="gridos-settings-toggle-hint">Set the amount that triggers a low‑balance alert</p>
              </div>
              <input
                type="number"
                min="0"
                step="0.1"
                value={lowThreshold}
                onChange={(e) => setLowThreshold(Number(e.target.value))}
                className="gridos-settings-select"
                style={{ width: "80px" }}
              />
            </li>
            <li>
              <div>
                <p className="gridos-settings-toggle-label">Settlement receipts</p>
                <p className="gridos-settings-toggle-hint">Each on-chain credit or debit</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifySettle}
                className={`gridos-switch${notifySettle ? " is-on" : ""}`}
                onClick={() => setNotifySettle((v) => !v)}
              >
                <span className="gridos-switch-knob" />
              </button>
            </li>
            <li>
              <div>
                <p className="gridos-settings-toggle-label">P2P matches</p>
                <p className="gridos-settings-toggle-hint">When a counterparty accepts</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifyP2P}
                className={`gridos-switch${notifyP2P ? " is-on" : ""}`}
                onClick={() => setNotifyP2P((v) => !v)}
              >
                <span className="gridos-switch-knob" />
              </button>
            </li>
          </ul>
        </Card>

        <Card className="gridos-settings-card">
          <h3 className="gridos-section-title">Data & display</h3>
          <label className="gridos-settings-field">
            <span className="gridos-settings-field-label">Ledger history (days)</span>
            <select
              className="gridos-settings-select"
              value={retention}
              onChange={(e) => setRetention(e.target.value)}
            >
              <option value="30">30</option>
              <option value="90">90</option>
              <option value="365">365</option>
            </select>
          </label>
          <p className="gridos-settings-hint">
            Rs. amounts use a fixed mock rate: USDT-equivalent units × {USDT_TO_INR} for display only.
          </p>
          <button type="button" className="gridos-settings-export" onClick={onExport}>
            Export ledger (.csv)
          </button>
        </Card>
      </div>
    </>
  );
}
