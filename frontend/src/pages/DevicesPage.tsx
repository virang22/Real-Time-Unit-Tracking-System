import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getToken } from "../utils/token";
import "../styles/alerts.css";

type Device = {
  _id: string;
  deviceId: string;
  deviceName: string;
  location?: string;
  deviceType?: string;
  status: "ACTIVE" | "INACTIVE" | "FAULT";
  lastHeartbeat: string;
  powerThreshold: number;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:11020/api";

const api = async (path: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("auth_token") || localStorage.getItem("token") || getToken() || "";
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || body?.message || "Request failed");
  return body;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [form, setForm] = useState({ deviceId: "", deviceName: "", location: "", powerThreshold: "3000" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadDevices = async () => {
    try {
      const result = await api("/devices");
      if (result && Array.isArray(result.data)) {
        setDevices(result.data);
      } else if (Array.isArray(result)) {
        setDevices(result);
      } else {
        setDevices([]);
      }
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load devices");
    }
  };

  useEffect(() => {
    void loadDevices();
  }, []);

  const registerDevice = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/devices", {
        method: "POST",
        body: JSON.stringify({ ...form, powerThreshold: Number(form.powerThreshold) }),
      });
      setForm({ deviceId: "", deviceName: "", location: "", powerThreshold: "3000" });
      await loadDevices();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to register device");
    } finally {
      setSaving(false);
    }
  };

  const deleteDevice = async (id: string) => {
    if (!window.confirm("Remove this device?")) return;
    try {
      await api(`/devices/${id}`, { method: "DELETE" });
      await loadDevices();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to remove device");
    }
  };

  return (
    <section className="alerts-container">
      <div className="alerts-header">
        <div>
          <h1 className="alerts-title">Devices</h1>
          <p>Register and monitor your connected smart meters.</p>
        </div>
      </div>

      <form className="device-form" onSubmit={registerDevice}>
        <input required placeholder="Device ID" value={form.deviceId} onChange={(event) => setForm({ ...form, deviceId: event.target.value })} />
        <input required placeholder="Device name" value={form.deviceName} onChange={(event) => setForm({ ...form, deviceName: event.target.value })} />
        <input placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        <input required min="1" type="number" placeholder="Power threshold (W)" value={form.powerThreshold} onChange={(event) => setForm({ ...form, powerThreshold: event.target.value })} />
        <button className="action-btn action-btn-resolve" disabled={saving} type="submit">{saving ? "Adding..." : "Add device"}</button>
      </form>

      {error ? <p className="api-error">{error}</p> : null}

      <div className="alerts-table-container">
        {devices.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">◌</div><div className="empty-state-text">No devices registered yet.</div></div>
        ) : (
          <table className="alerts-table">
            <thead><tr><th>Device</th><th>Location</th><th>Status</th><th>Threshold</th><th>Last heartbeat</th><th /></tr></thead>
            <tbody>{devices.map((device) => (
              <tr key={device._id}>
                <td>
                  <strong>{device.deviceName}</strong>
                  {device.deviceId === "ESP32-GRID-NODE-01" ? (
                    <span style={{ marginLeft: "8px", background: "rgba(16, 185, 129, 0.15)", color: "#059669", padding: "2px 7px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }}>
                      ⚡ My ESP32 Meter
                    </span>
                  ) : null}
                  <br />
                  <small style={{ color: "#64748b" }}>{device.deviceId}</small>
                </td>
                <td>{device.location || "-"}</td>
                <td><span className={`alert-row-status status-${device.status === "ACTIVE" ? "resolved" : "active"}`}>{device.status}</span></td>
                <td>{device.powerThreshold} W</td>
                <td>{new Date(device.lastHeartbeat).toLocaleString()}</td>
                <td><button className="action-btn action-btn-dismiss" type="button" onClick={() => void deleteDevice(device._id)}>Remove</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
