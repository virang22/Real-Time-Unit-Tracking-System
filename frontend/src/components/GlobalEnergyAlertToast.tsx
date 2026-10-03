import React, { useEffect, useRef, useState } from "react";
import { getToken } from "../utils/token";
import { playWarningChime, playCriticalAlarmSound } from "../utils/alertSound";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:11020/api";

type AlertState = {
  type: "WARNING" | "CRITICAL";
  limit: number;
  current: number;
  remaining: number;
} | null;

export const GlobalEnergyAlertToast: React.FC = () => {
  const [activeAlert, setActiveAlert] = useState<AlertState>(null);
  const warnedLimitRef = useRef<number | null>(null);
  const criticalLimitRef = useRef<number | null>(null);

  // Request native browser desktop notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        void Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkEnergyAndLimit = async () => {
      const token = getToken() ?? localStorage.getItem("auth_token");
      if (!token) return;

      try {
        const [liveRes, limitRes] = await Promise.all([
          fetch(`${API_BASE_URL}/live-data`),
          fetch(`${API_BASE_URL}/alerts/energy-limit`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!isMounted) return;

        if (liveRes.ok && limitRes.ok) {
          const liveData = await liveRes.json();
          const limitData = await limitRes.json();

          const currentEnergy = Number(liveData.energy || 0);
          const energyLimit = Number(limitData.energyLimit || 0);

          if (energyLimit <= 0 || currentEnergy <= 0) return;

          // 1. Early warning threshold (0.20 kWh before reaching limit)
          const warningThreshold = Number((energyLimit - 0.20).toFixed(2));

          // 2. Critical Alert: Limit reached or exceeded
          if (currentEnergy >= energyLimit) {
            if (criticalLimitRef.current !== energyLimit) {
              criticalLimitRef.current = energyLimit;
              // Play critical alarm sound ONCE
              playCriticalAlarmSound(3);

              // Native desktop notification
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("🚨 CRITICAL: Energy Limit Exceeded!", {
                  body: `Current consumption (${currentEnergy.toFixed(2)} kWh) has reached your limit of ${energyLimit.toFixed(2)} kWh.`,
                  icon: "/favicon.ico",
                });
              }

              setActiveAlert({
                type: "CRITICAL",
                limit: energyLimit,
                current: currentEnergy,
                remaining: 0,
              });

              window.dispatchEvent(new CustomEvent("energy-alert-triggered"));
            }
            return;
          }

          // 3. Early Warning Alert: Approaching limit (within 0.20 kWh before limit)
          if (currentEnergy >= warningThreshold && currentEnergy < energyLimit) {
            if (warnedLimitRef.current !== energyLimit) {
              warnedLimitRef.current = energyLimit;
              // Play warning chime ONCE
              playWarningChime();

              // Native desktop notification
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("⚠️ Warning: Approaching Energy Limit!", {
                  body: `Current consumption is ${currentEnergy.toFixed(2)} kWh. Limit is ${energyLimit.toFixed(2)} kWh (${(energyLimit - currentEnergy).toFixed(2)} kWh remaining).`,
                  icon: "/favicon.ico",
                });
              }

              setActiveAlert({
                type: "WARNING",
                limit: energyLimit,
                current: currentEnergy,
                remaining: Number((energyLimit - currentEnergy).toFixed(2)),
              });

              window.dispatchEvent(new CustomEvent("energy-alert-triggered"));
            }
          }
        }
      } catch {
        /* ignore polling errors */
      }
    };

    void checkEnergyAndLimit();
    const interval = setInterval(checkEnergyAndLimit, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!activeAlert) return null;

  const isCritical = activeAlert.type === "CRITICAL";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 9999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#ffffff",
          borderRadius: "22px",
          padding: "32px 28px",
          boxShadow: isCritical
            ? "0 25px 60px -10px rgba(220, 38, 38, 0.45), 0 0 0 3px #f87171"
            : "0 25px 60px -10px rgba(217, 119, 6, 0.45), 0 0 0 3px #fbbf24",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: "#0f172a",
        }}
      >
        {/* Animated Alarm Icon */}
        <div
          style={{
            width: "76px",
            height: "76px",
            borderRadius: "50%",
            backgroundColor: isCritical ? "#fee2e2" : "#fef3c7",
            color: isCritical ? "#dc2626" : "#d97706",
            fontSize: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: isCritical
              ? "0 0 28px rgba(220, 38, 38, 0.35)"
              : "0 0 28px rgba(217, 119, 6, 0.35)",
          }}
        >
          {isCritical ? "🚨" : "⚠️"}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            margin: "0 0 8px 0",
            color: isCritical ? "#b91c1c" : "#b45309",
            letterSpacing: "-0.4px",
          }}
        >
          {isCritical ? "CRITICAL: ENERGY LIMIT REACHED!" : "WARNING: APPROACHING ENERGY LIMIT!"}
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: "0.95rem",
            color: "#475569",
            margin: "0 0 22px 0",
            lineHeight: 1.5,
          }}
        >
          {isCritical
            ? `Your power consumption has reached your set limit! Please take action to prevent high billing or overload.`
            : `You are very close to your configured energy threshold (${activeAlert.remaining.toFixed(2)} kWh remaining).`}
        </p>

        {/* Metrics Summary Box */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            borderRadius: "14px",
            padding: "16px 20px",
            border: "1px solid #e2e8f0",
            marginBottom: "24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px",
            textAlign: "left",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Current Consumed
            </div>
            <div
              style={{
                fontSize: "1.35rem",
                fontWeight: 800,
                color: isCritical ? "#dc2626" : "#d97706",
                marginTop: "3px",
              }}
            >
              {activeAlert.current.toFixed(2)}{" "}
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>kWh</span>
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Configured Limit
            </div>
            <div
              style={{
                fontSize: "1.35rem",
                fontWeight: 800,
                color: "#1e293b",
                marginTop: "3px",
              }}
            >
              {activeAlert.limit.toFixed(2)}{" "}
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>kWh</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => (isCritical ? playCriticalAlarmSound(3) : playWarningChime())}
            style={{
              padding: "12px 20px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#334155",
              fontWeight: 600,
              fontSize: "0.92rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            🔊 Replay Sound
          </button>
          <button
            type="button"
            onClick={() => setActiveAlert(null)}
            style={{
              padding: "12px 28px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: isCritical ? "#dc2626" : "#d97706",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              boxShadow: isCritical
                ? "0 4px 16px rgba(220, 38, 38, 0.4)"
                : "0 4px 16px rgba(217, 119, 6, 0.4)",
            }}
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
