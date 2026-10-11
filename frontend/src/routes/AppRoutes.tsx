import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";
import AnalyticsPage from "../pages/AnalyticsPage";
import WalletPage from "../pages/WalletPage";
import SettingsPage from "../pages/SettingsPage";
import SupportPage from "../pages/SupportPage";
import LogsPage from "../pages/LogsPage";
import AlertsPage from "../pages/AlertsPage";
import ElectricityBillsPage from "../pages/ElectricityBillsPage";
import GridShellLayout from "../components/dashboard/GridShellLayout";
import ProtectedRoute from "./ProtectedRoute";
import { getToken } from "../utils/token";

export default function AppRoutes() {
  const token = getToken();

  return (
    <Routes>
      <Route path="/" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <GridShellLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/bills" element={<ElectricityBillsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}
