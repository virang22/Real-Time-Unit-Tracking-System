import { type ReactNode } from "react";

type AuthLayoutProps = {
  brand?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function AuthLayout({
  brand = "GridOS",
  title,
  subtitle,
  children,
}: AuthLayoutProps) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="brand">{brand}</p>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
