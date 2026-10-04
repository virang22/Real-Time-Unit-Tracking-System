import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";
import AnalyticsPage from "../pages/AnalyticsPage";
import WalletPage from "../pages/WalletPage";
import P2PPage from "../pages/P2PPage";
import SettingsPage from "../pages/SettingsPage";
import DeployContractPage from "../pages/DeployContractPage";
import SupportPage from "../pages/SupportPage";
import LogsPage from "../pages/LogsPage";
import AlertsPage from "../pages/AlertsPage";
import DevicesPage from "../pages/DevicesPage";
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
        <Route path="/p2p" element={<P2PPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/deploy" element={<DeployContractPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/devices" element={<DevicesPage />} />
      </Route>
      <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}
