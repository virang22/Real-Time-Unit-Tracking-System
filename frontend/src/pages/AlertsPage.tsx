import React, { useEffect, useState } from 'react';
import '../styles/alerts.css';
import { getToken } from '../utils/token';
import { playAlarmSound } from '../utils/alertSound';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:11020/api';

interface Alert {
    _id: string;
    deviceId: string;
    deviceName?: string;
    alertType: 'DEVICE_OFFLINE' | 'HIGH_POWER' | 'ABNORMAL_BILL' | 'DEVICE_FAULT' | 'ENERGY_LIMIT';
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
    createdAt: string;
    resolvedAt?: string;
}

interface AlertStats {
    total: number;
    active: number;
    critical: number;
    high: number;
}

const AlertsPage: React.FC = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [stats, setStats] = useState<AlertStats>({
        total: 0,
        active: 0,
        critical: 0,
        high: 0
    });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'newest' | 'severity'>('newest');
    const [energyLimit, setEnergyLimit] = useState('1');
    const [currentEnergy, setCurrentEnergy] = useState<number>(0);
    const [savingLimit, setSavingLimit] = useState(false);
    const [limitMessage, setLimitMessage] = useState('');

    const authHeaders = { 'Authorization': `Bearer ${getToken() ?? ''}` };

    const loadEnergyLimit = async () => {
        try {
            const [limitRes, liveRes] = await Promise.all([
                fetch(`${API_BASE_URL}/alerts/energy-limit`, { headers: authHeaders }),
                fetch(`${API_BASE_URL}/live-data`)
            ]);
            let liveEnergy = 0;
            if (liveRes.ok) {
                const liveData = await liveRes.json();
                liveEnergy = Number(liveData.energy || 0);
                setCurrentEnergy(liveEnergy);
            }
            if (limitRes.status === 401) {
                localStorage.removeItem('auth_token');
                window.location.href = '/login';
                return;
            }
            if (limitRes.ok) {
                const data = await limitRes.json();
                if (data.currentEnergy) {
                    liveEnergy = Math.max(liveEnergy, Number(data.currentEnergy));
                    setCurrentEnergy(liveEnergy);
                }
                const savedLimit = Number(data.energyLimit);
                if (!isNaN(savedLimit) && savedLimit > 0) {
                    setEnergyLimit(String(savedLimit));
                } else if (liveEnergy > 0) {
                    setEnergyLimit(String(Math.ceil(liveEnergy + 10)));
                } else {
                    setEnergyLimit('1');
                }
            }
        } catch {
            // ignore network error
        }
    };

    useEffect(() => {
        fetchAlerts();
        // Fetch again when the selected filter or sort mode changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, sortBy]);

    useEffect(() => {
        void loadEnergyLimit();
        // This request runs once when the alerts page opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!energyLimit) return;
        let isCancelled = false;

        const checkEnergyThreshold = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/live-data`);
                const telemetry = await response.json();
                if (isCancelled) return;

                const telemetryEnergy = Number(telemetry.energy || 0);
                setCurrentEnergy(telemetryEnergy);
                const limitVal = Number(energyLimit);

                if (limitVal > 0 && telemetryEnergy >= limitVal) {
                    const soundKey = `energy-alarm-${limitVal}`;
                    if (sessionStorage.getItem(soundKey) !== 'true') {
                        sessionStorage.setItem(soundKey, 'true');
                        playAlarmSound(4);
                    }

                    setAlerts((currentAlerts) => currentAlerts.some((alert) => alert._id === 'demo-energy-limit')
                        ? currentAlerts
                        : [{
                            _id: 'demo-energy-limit',
                            deviceId: telemetry.deviceId || 'ESP32-GRID-NODE-01',
                            deviceName: telemetry.deviceId || 'ESP32 Smart Meter',
                            alertType: 'ENERGY_LIMIT',
                            message: `⚠️ CRITICAL: Energy consumption reached ${telemetryEnergy.toFixed(2)} kWh (limit ${limitVal.toFixed(2)} kWh).`,
                            severity: 'CRITICAL',
                            status: 'ACTIVE',
                            createdAt: new Date().toISOString(),
                        }, ...currentAlerts]);
                }
            } catch {
                /* ignore */
            }
        };

        void checkEnergyThreshold();
        const interval = setInterval(checkEnergyThreshold, 2500);

        return () => {
            isCancelled = true;
            clearInterval(interval);
        };
    }, [energyLimit]);

    const saveEnergyLimit = async () => {
        const val = Number(energyLimit);
        if (isNaN(val) || val <= 0) {
            setLimitMessage('Please enter a valid energy limit.');
            return;
        }
        if (currentEnergy > 0 && val <= currentEnergy) {
            setLimitMessage(`Energy alert limit must be greater than current consumption (${currentEnergy.toFixed(2)} kWh).`);
            return;
        }

        setSavingLimit(true);
        setLimitMessage('');
        try {
            const response = await fetch(`${API_BASE_URL}/alerts/energy-limit`, {
                method: 'PATCH',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ energyLimit: val }),
            });
            const body = await response.text();
            const data = body ? JSON.parse(body) : {};
            if (response.status === 401) {
                localStorage.removeItem('auth_token');
                window.location.href = '/login';
                return;
            }
            if (!response.ok) throw new Error(data.error || 'Unable to save limit');
            setEnergyLimit(String(data.energyLimit));
            setLimitMessage(`Energy limit saved successfully (${data.energyLimit} kWh)`);
        } catch (error) {
            setLimitMessage(error instanceof Error ? error.message : 'Unable to save limit');
        } finally {
            setSavingLimit(false);
        }
    };

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const query = filter !== 'ALL' ? `?status=${filter}` : '';
            const response = await fetch(`${API_BASE_URL}/alerts${query}`, {
                headers: authHeaders
            });
            const data = await response.json();
            
            const fetchedAlerts = data.data || [];
            
            // Sort
            if (sortBy === 'severity') {
                const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                fetchedAlerts.sort((a: Alert, b: Alert) =>
                    severityOrder[a.severity as keyof typeof severityOrder] - 
                    severityOrder[b.severity as keyof typeof severityOrder]
                );
            } else {
                fetchedAlerts.sort((a: Alert, b: Alert) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
            }
            
            setAlerts(fetchedAlerts);
            
            // Fetch stats
            const statsResponse = await fetch(`${API_BASE_URL}/alerts/stats`, {
                headers: authHeaders
            });
            const statsData = await statsResponse.json();
            setStats(statsData.data || { total: 0, active: 0, critical: 0, high: 0 });
        } catch (error) {
            console.error('Error fetching alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAcknowledge = async (alertId: string) => {
        try {
            await fetch(`${API_BASE_URL}/alerts/${alertId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${getToken() ?? ''}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'ACKNOWLEDGED' })
            });
            fetchAlerts();
        } catch (error) {
            console.error('Error acknowledging alert:', error);
        }
    };

    const handleResolve = async (alertId: string) => {
        try {
            await fetch(`${API_BASE_URL}/alerts/${alertId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${getToken() ?? ''}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'RESOLVED' })
            });
            fetchAlerts();
        } catch (error) {
            console.error('Error resolving alert:', error);
        }
    };

    const handleDismiss = async (alertId: string) => {
        try {
            await fetch(`${API_BASE_URL}/alerts/${alertId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken() ?? ''}` }
            });
            fetchAlerts();
        } catch (error) {
            console.error('Error dismissing alert:', error);
        }
    };

    const getSeverityClass = (severity: string): string => {
        return `severity-${severity.toLowerCase()}`;
    };

    const getStatusClass = (status: string): string => {
        return `status-${status.toLowerCase()}`;
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="alerts-container">
            <div className="alerts-header">
                <h1 className="alerts-title">⚠️ Alerts & Notifications</h1>
                <div className="alerts-filters">
                    <button
                        className={`filter-btn ${filter === 'ACTIVE' ? 'active' : ''}`}
                        onClick={() => setFilter('ACTIVE')}
                    >
                        Active
                    </button>
                    <button
                        className={`filter-btn ${filter === 'ACKNOWLEDGED' ? 'active' : ''}`}
                        onClick={() => setFilter('ACKNOWLEDGED')}
                    >
                        Acknowledged
                    </button>
                    <button
                        className={`filter-btn ${filter === 'RESOLVED' ? 'active' : ''}`}
                        onClick={() => setFilter('RESOLVED')}
                    >
                        Resolved
                    </button>
                    <button
                        className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setFilter('ALL')}
                    >
                        All
                    </button>
                </div>
            </div>

            <div className="energy-limit-panel">
                <div>
                    <strong>Energy alert limit</strong>
                    <p>Get an alert when total consumption reaches your selected limit.</p>
                    {currentEnergy > 0 && (
                        <p style={{ marginTop: '4px', fontSize: '0.85rem', color: '#94a3b8' }}>
                            Current consumption: <strong style={{ color: '#38bdf8' }}>{currentEnergy.toFixed(2)} kWh</strong> (Minimum required limit: &gt; {currentEnergy.toFixed(2)} kWh)
                        </p>
                    )}
                </div>
                <div className="energy-limit-controls">
                    <input
                        aria-label="Energy alert limit in kWh"
                        min={currentEnergy > 0 ? (currentEnergy + 0.1).toFixed(2) : "0.1"}
                        step="0.5"
                        type="number"
                        value={energyLimit}
                        onChange={(event) => setEnergyLimit(event.target.value)}
                    />
                    <span>kWh</span>
                    <button
                        className="action-btn action-btn-resolve"
                        type="button"
                        disabled={savingLimit || (currentEnergy > 0 && Number(energyLimit) <= currentEnergy)}
                        onClick={() => void saveEnergyLimit()}
                    >
                        {savingLimit ? 'Saving...' : 'Save limit'}
                    </button>
                </div>
                {limitMessage ? (
                    <small style={{ color: limitMessage.includes('must be greater') || limitMessage.includes('cannot be less') || limitMessage.includes('Unable') || limitMessage.includes('Failed') ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                        {limitMessage}
                    </small>
                ) : null}
            </div>

            {/* Statistics */}
            <div className="alert-stats">
                <div className="stat-card active">
                    <div className="stat-value">{stats.active}</div>
                    <div className="stat-label">Active Alerts</div>
                </div>
                <div className="stat-card critical">
                    <div className="stat-value">{stats.critical}</div>
                    <div className="stat-label">Critical</div>
                </div>
                <div className="stat-card high">
                    <div className="stat-value">{stats.high}</div>
                    <div className="stat-label">High Priority</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total Alerts</div>
                </div>
            </div>

            {/* Sort Options */}
            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                <button
                    className={`filter-btn ${sortBy === 'newest' ? 'active' : ''}`}
                    onClick={() => setSortBy('newest')}
                >
                    Sort: Newest
                </button>
                <button
                    className={`filter-btn ${sortBy === 'severity' ? 'active' : ''}`}
                    onClick={() => setSortBy('severity')}
                >
                    Sort: Severity
                </button>
            </div>

            {/* Alerts Table */}
            {loading ? (
                <div className="empty-state">
                    <div className="empty-state-icon">⏳</div>
                    <div className="empty-state-text">Loading alerts...</div>
                </div>
            ) : alerts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">✨</div>
                    <div className="empty-state-text">No alerts at the moment. Everything is running smoothly!</div>
                </div>
            ) : (
                <div className="alerts-table-container">
                    <table className="alerts-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Device</th>
                                <th>Message</th>
                                <th>Severity</th>
                                <th>Status</th>
                                <th>Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alerts.map((alert) => (
                                <tr key={alert._id}>
                                    <td className="alert-row-type">{alert.alertType}</td>
                                    <td>{alert.deviceName || alert.deviceId}</td>
                                    <td>{alert.message}</td>
                                    <td>
                                        <span className={`alert-row-severity ${getSeverityClass(alert.severity)}`}>
                                            {alert.severity}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`alert-row-status ${getStatusClass(alert.status)}`}>
                                            {alert.status}
                                        </span>
                                    </td>
                                    <td>{formatDate(alert.createdAt)}</td>
                                    <td>
                                        <div className="alert-actions">
                                            {alert.status === 'ACTIVE' && (
                                                <>
                                                    <button
                                                        className="action-btn action-btn-acknowledge"
                                                        onClick={() => handleAcknowledge(alert._id)}
                                                    >
                                                        Acknowledge
                                                    </button>
                                                    <button
                                                        className="action-btn action-btn-resolve"
                                                        onClick={() => handleResolve(alert._id)}
                                                    >
                                                        Resolve
                                                    </button>
                                                </>
                                            )}
                                            {alert.status === 'ACKNOWLEDGED' && (
                                                <button
                                                    className="action-btn action-btn-resolve"
                                                    onClick={() => handleResolve(alert._id)}
                                                >
                                                    Resolve
                                                </button>
                                            )}
                                            <button
                                                className="action-btn action-btn-dismiss"
                                                onClick={() => handleDismiss(alert._id)}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AlertsPage;
