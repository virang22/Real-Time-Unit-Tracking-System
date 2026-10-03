import React from "react";

interface MetricCardProps {
  title: string;
  value?: string;
  unit?: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor: string;
}

export default function MetricCard({
  title,
  value = "0",
  unit = "",
  subtitle = "",
  icon,
  iconColor
}: MetricCardProps) {
  return (
    <div className="ac-metric-card">
      <div className="ac-metric-header">
        <h3 className="ac-metric-title">{title}</h3>
        <div className="ac-metric-icon" style={{ color: iconColor }}>
          {icon}
        </div>
      </div>
      <div className="ac-metric-body">
        <div className="ac-metric-value">
          {value}
          <span className="ac-metric-unit">{unit}</span>
        </div>
        <div className="ac-metric-subtitle">{subtitle}</div>
      </div>
      <div 
        className="ac-metric-circle" 
        style={{ backgroundColor: iconColor, opacity: 0.1 }}
      />
    </div>
  );
}
