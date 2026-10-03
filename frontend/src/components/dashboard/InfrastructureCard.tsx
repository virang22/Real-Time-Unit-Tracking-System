import { type ReactNode } from "react";

type InfrastructureCardProps = {
  name: string;
  kw: string;
  status: "active" | "standby";
  icon: ReactNode;
  sparkPoints: string;
};

export default function InfrastructureCard({
  name,
  kw,
  status,
  icon,
  sparkPoints,
}: InfrastructureCardProps) {
  return (
    <article className="gridos-infra-card">
      <div className="gridos-infra-head">
        <div className="gridos-infra-icon">{icon}</div>
        <span
          className={
            status === "active" ? "gridos-status-dot" : "gridos-status-dot gridos-status-dot--standby"
          }
          title={status === "active" ? "Active" : "Standby"}
        />
      </div>
      <p className="gridos-infra-name">{name}</p>
      <p className="gridos-infra-kw">{kw}</p>
      <svg className="gridos-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={sparkPoints}
        />
      </svg>
    </article>
  );
}
