import type { CSSProperties } from "react";

type MetricGaugeProps = {
  label: string;
  value: string;
  unit: string;
  trend?: string;
  /** 0–1 portion of ring filled */
  fillPortion?: number;
};

export default function MetricGauge({
  label,
  value,
  unit,
  trend,
  fillPortion = 0,
}: MetricGaugeProps) {
  return (
    <div className="metric-gauge" aria-label={`${label} ${value} ${unit}`}>
      <div className="metric-gauge__track" />
      <div
        className="metric-gauge__fill"
        style={{ "--pct": fillPortion } as CSSProperties}
      />
      <div className="metric-gauge__center">
        <div>
          <p className="metric-gauge__label">{label}</p>
          <p className="metric-gauge__value">
            {value} <span className="metric-gauge__unit">{unit}</span>
          </p>
          {trend ? <p className="metric-gauge__trend">{trend}</p> : null}
        </div>
      </div>
    </div>
  );
}
