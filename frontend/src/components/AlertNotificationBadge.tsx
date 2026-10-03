import React, { useEffect, useRef, useState } from 'react';
import '../styles/alerts.css';

interface Alert {
    _id: string;
    deviceId: string;
    deviceName?: string;
    alertType: 'DEVICE_OFFLINE' | 'HIGH_POWER' | 'ABNORMAL_BILL' | 'DEVICE_FAULT';
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
    createdAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:11020/api';

interface AlertNotificationBadgeProps {
    onBadgeClick?: () => void;
}

const AlertNotificationBadge: React.FC<AlertNotificationBadgeProps> = ({ onBadgeClick }) => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [activeAlertCount, setActiveAlertCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isRinging, setIsRinging] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef<number | null>(null);
    const ringingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerRing = () => {
        setIsRinging(true);
        if (ringingTimerRef.current) {
            clearTimeout(ringingTimerRef.current);
        }
        ringingTimerRef.current = setTimeout(() => {
            setIsRinging(false);
        }, 1500);
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const fetchAlerts = async () => {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/alerts?status=ACTIVE`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            const newAlerts = data.data || [];
            const newCount = newAlerts.length;

            // Only ring when new alerts arrive (not on initial page load)
            if (prevCountRef.current !== null && newCount > prevCountRef.current) {
                triggerRing();
            }
            prevCountRef.current = newCount;

            setAlerts(newAlerts);
            setActiveAlertCount(newCount);
        } catch (error) {
            console.error('Error fetching alerts:', error);
        }
    };

    useEffect(() => {
        void fetchAlerts();
        // Refresh every 30 seconds
        const interval = setInterval(fetchAlerts, 30000);

        // Listen for real-time energy alert triggers
        const handleEnergyAlert = () => {
            triggerRing();
            void fetchAlerts();
        };
        window.addEventListener('energy-alert-triggered', handleEnergyAlert);

        return () => {
            clearInterval(interval);
            window.removeEventListener('energy-alert-triggered', handleEnergyAlert);
            if (ringingTimerRef.current) {
                clearTimeout(ringingTimerRef.current);
            }
        };
    }, []);

    const getSeverityColor = (severity: string): string => {
        switch (severity) {
            case 'CRITICAL': return '#ff4444';
            case 'HIGH': return '#ff9800';
            case 'MEDIUM': return '#ffc107';
            case 'LOW': return '#4caf50';
            default: return '#666';
        }
    };

    return (
        <div className="alert-badge-container" ref={dropdownRef}>
            <button
                className={`alert-badge ${activeAlertCount > 0 ? 'has-alerts' : ''} ${isRinging ? 'is-ringing' : ''}`}
                onClick={() => setIsOpen((prev) => !prev)}
                title={`${activeAlertCount} active alert(s)`}
                type="button"
            >
                🔔
                {activeAlertCount > 0 && (
                    <span className="alert-count">{activeAlertCount > 9 ? '9+' : activeAlertCount}</span>
                )}
            </button>

            {isOpen && activeAlertCount > 0 && (
                <div className="alert-dropdown">
                    <div className="alert-dropdown-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>Active Alerts ({activeAlertCount})</strong>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                fontSize: '18px',
                                cursor: 'pointer',
                                color: '#64748b',
                                padding: '2px 6px',
                                lineHeight: 1,
                            }}
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="alert-list">
                        {alerts.slice(0, 5).map((alert) => (
                            <div
                                key={alert._id}
                                className="alert-item"
                                style={{ borderLeftColor: getSeverityColor(alert.severity) }}
                            >
                                <div className="alert-title">{alert.alertType}</div>
                                <div className="alert-message">{alert.message}</div>
                                <div className="alert-meta">
                                    <span className="severity-badge" style={{ backgroundColor: getSeverityColor(alert.severity) }}>
                                        {alert.severity}
                                    </span>
                                    <span className="time">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {activeAlertCount > 5 && (
                        <div className="alert-dropdown-footer">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onBadgeClick?.();
                                }}
                                className="view-all-btn"
                                type="button"
                            >
                                View All Alerts
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AlertNotificationBadge;
