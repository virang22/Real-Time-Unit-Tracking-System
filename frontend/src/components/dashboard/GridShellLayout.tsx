import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearToken, getUser, clearUser } from "../../utils/token";
import "../../styles/dashboard.css";
import {
  IconBolt,
  IconChart,
  IconDatabase,
  IconLayoutDashboard,
  IconPlus,
  IconSettings,
  IconSwap,
  IconWallet,
} from "./gridosIcons";
import AlertNotificationBadge from "../AlertNotificationBadge";
import { GlobalEnergyAlertToast } from "../GlobalEnergyAlertToast";

export default function GridShellLayout() {
  const navigate = useNavigate();

  const user = getUser();

  const onLogout = () => {
    clearToken();
    clearUser();
    navigate("/login");
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `gridos-nav-item${isActive ? " gridos-nav-item--active" : ""}`;

  const deployClass = ({ isActive }: { isActive: boolean }) =>
    `gridos-deploy${isActive ? " gridos-deploy--active" : ""}`;

  const footClass = ({ isActive }: { isActive: boolean }) =>
    `gridos-sidebar-foot-link${isActive ? " gridos-sidebar-foot-link--active" : ""}`;

  return (
    <div className="gridos-app">
      <GlobalEnergyAlertToast />
      <aside className="gridos-sidebar" aria-label="Primary">
        <NavLink to="/dashboard" className="gridos-logo-link">
          <p className="gridos-logo">GridOS</p>
        </NavLink>

        <div className="gridos-node-card">
          <p className="gridos-node-label">Logged in as</p>
          <p className="gridos-node-name">{user?.name || user?.email || "User"}</p>
          <span className="gridos-badge">{user?.email || "User Profile"}</span>
        </div>

        <nav className="gridos-nav" aria-label="Main navigation">
          <NavLink to="/dashboard" className={navClass} end>
            <IconLayoutDashboard />
            Dashboard
          </NavLink>
          <NavLink to="/analytics" className={navClass}>
            <IconChart />
            Analytics
          </NavLink>
          <NavLink to="/wallet" className={navClass}>
            <IconWallet />
            Wallet
          </NavLink>
          <NavLink to="/p2p" className={navClass}>
            <IconSwap />
            P2P Marketplace
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            <IconSettings />
            Settings
          </NavLink>
          <NavLink to="/alerts" className={navClass}>
            <span aria-hidden>!</span>
            Alerts
          </NavLink>
          <NavLink to="/devices" className={navClass}>
            <IconDatabase />
            Devices
          </NavLink>
        </nav>

        <NavLink to="/deploy" className={deployClass}>
          <IconPlus />
          Deploy Contract
        </NavLink>

        <div className="gridos-sidebar-foot">
          <NavLink to="/support" className={footClass}>
            Support
          </NavLink>
          <NavLink to="/logs" className={footClass}>
            Logs
          </NavLink>
          <button type="button" className="gridos-logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="gridos-main">
        <header className="gridos-topbar">
          <div className="gridos-stat-chip gridos-stat-chip--green">
            <IconBolt />
            <span>
              Grid Status: <strong>OPTIMAL</strong>
            </span>
          </div>
          <div className="gridos-stat-chip">
            <IconDatabase />
            <span>
              Sync: <strong>99.98%</strong>
            </span>
          </div>
          <div className="gridos-stat-chip gridos-stat-chip--green">
            <span>
              Throughput: <strong>0.42 kWh/s</strong>
            </span>
          </div>
          <div className="gridos-topbar-spacer" />
          <div className="gridos-topbar-actions">
            <AlertNotificationBadge onBadgeClick={() => navigate("/alerts")} />
            <button type="button" className="gridos-avatar" aria-label="Profile">
              {(user?.name || user?.email || "U").substring(0, 2).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="gridos-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
