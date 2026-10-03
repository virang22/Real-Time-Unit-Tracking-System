import { Navigate } from "react-router-dom";
import { getToken } from "../utils/token";
import { type ReactNode } from "react";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
