import { type ReactNode } from "react";

type CardProps = {
  className?: string;
  children: ReactNode;
};

export default function Card({ className = "", children }: CardProps) {
  return <div className={`gridos-card ${className}`.trim()}>{children}</div>;
}
