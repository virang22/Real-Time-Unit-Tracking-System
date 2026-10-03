# Fault Detection System - Complete Implementation Guide

## Overview

The Real-Time Unit Tracking System now includes a **comprehensive 3-tier fault detection system** that proactively identifies and alerts users about:

1. **Device Connectivity Issues** - When IoT devices go offline
2. **Abnormal Power Consumption** - When equipment uses excessive power
3. **Billing Anomalies** - When monthly bills exceed expected thresholds

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     ESP32 IoT Device                         │
│           (Sends Telemetry via HTTP POST)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ POST /api/live-data
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Live-Data Route Handler                     │
│   • Receives voltage, current, power, energy, frequency      │
│   • Validates and parses telemetry data                      │
│   • Stores in-memory cache (latestTelemetry)               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Alert Detection Service                         │
│                  (Singleton Pattern)                         │
│                                                              │
│  ├─ processTelemetry()                                      │
│  │  ├─ Save to Telemetry collection                        │
│  │  ├─ Update Device lastHeartbeat                         │
│  │  └─ Run anomaly detection                               │
│  │                                                          │
│  ├─ detectAnomalies()                                       │
│  │  ├─ Voltage check (180-250V safe range)                 │
│  │  ├─ Frequency check (48-52Hz safe range)                │
│  │  └─ Power consumption check (vs. powerThreshold)        │
│  │                                                          │
│  ├─ checkOfflineDevices() [Periodic - Every 2 min]         │
│  │  └─ Find devices not reporting for 5+ minutes           │
│  │                                                          │
│  └─ checkAbnormalBills() [Periodic - Every hour]           │
│     └─ Aggregate 30-day cost, alert if > threshold         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                MongoDB Collections                           │
│                                                              │
│  Device          │ Telemetry         │ Alert               │
│  ─────────────   │ ──────────────    │ ─────────────       │
│  • deviceId      │ • voltage         │ • alertType         │
│  • userId        │ • current         │ • deviceId          │
│  • status        │ • power           │ • severity          │
│  • lastHeartbeat │ • energy          │ • status            │
│  • powerThreshold│ • timestamp       │ • message           │
│                  │ • TTL:90 days     │ • createdAt         │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Alert API Routes                           │
│                                                              │
│  GET  /api/alerts              - List active alerts         │
│  GET  /api/alerts/history      - Alert history (50 max)     │
│  PATCH /api/alerts/:alertId    - Update status              │
│  DELETE /api/alerts/:alertId   - Dismiss alert              │
│  GET  /api/alerts/stats        - Alert statistics           │
│                                                              │
│  GET  /api/devices             - List all devices           │
│  POST /api/devices             - Register new device        │
│  PATCH /api/devices/:deviceId  - Update device settings     │
│  DELETE /api/devices/:deviceId - Deregister device          │
│  GET  /api/devices/:deviceId/status - Real-time status      │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                Frontend Components                           │
│                                                              │
│  • AlertNotificationBadge    - Real-time badge in header    │
│  • AlertsPage                - Full alert management UI     │
│  • Device Management         - Register/manage devices      │
└─────────────────────────────────────────────────────────────┘
```

---

## Detection Types

### 1. Device Offline Detection

**When?** Every 2 minutes (via scheduler)

**How?** 
- Finds all devices where `lastHeartbeat > 5 minutes ago`
- Creates CRITICAL alert for offline devices

**Configuration:**
```typescript
const OFFLINE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL = 2 * 60 * 1000;  // Every 2 minutes
```

**Example Alert:**
```json
{
  "alertType": "DEVICE_OFFLINE",
  "deviceId": "ESP32-NODE-01",
  "message": "Device has not reported data for 5 minutes",
  "severity": "CRITICAL",
  "status": "ACTIVE"
}
```

### 2. Power Consumption Anomaly Detection

**When?** Immediately on telemetry arrival (in POST /api/live-data)

**How?**
- Checks real-time power consumption against device's `powerThreshold`
- Validates voltage (180-250V safe range)
- Validates frequency (48-52Hz safe range)

**Configuration:**
```typescript
const DEFAULT_POWER_THRESHOLD = 3000; // watts
const VOLTAGE_MIN = 180;  // volts
const VOLTAGE_MAX = 250;  // volts
const FREQUENCY_MIN = 48; // Hz
const FREQUENCY_MAX = 52; // Hz
```

**Example Alerts:**
```json
{
  "alertType": "HIGH_POWER",
  "message": "Device consuming 3500W (threshold: 3000W)",
  "severity": "HIGH",
  "status": "ACTIVE"
}
```

### 3. Abnormal Bill Detection

**When?** Every hour (via scheduler)

**How?**
- Aggregates all telemetry for past 30 days
- Sums up hourly costs (calculated from power consumption)
- Alerts if total > monthly bill threshold (₹5000)

**Configuration:**
```typescript
const MONTHLY_BILL_THRESHOLD = 5000; // INR
```

**Example Alert:**
```json
{
  "alertType": "ABNORMAL_BILL",
  "message": "High Monthly Bill: ₹6500",
  "severity": "HIGH",
  "status": "ACTIVE"
}
```

---

## Data Models

### Device Model

```typescript
interface DeviceDocument {
  deviceId: string;           // ESP32 device ID (unique)
  userId: ObjectId;           // Owner reference
  deviceName: string;         // User-friendly name
  location: string;           // Physical location
  deviceType: string;         // EQUIPMENT, APPLIANCE, etc.
  status: 'ACTIVE' | 'INACTIVE' | 'FAULT';
  lastHeartbeat: Date;        // Last data received
  powerThreshold: number;     // Max watts before alert (default: 3000)
  isDeleted: boolean;         // Soft delete flag
  createdAt: Date;
  updatedAt: Date;
}
```

### Telemetry Model

```typescript
interface TelemetryDocument {
  userId: ObjectId;
  deviceId: string;
  voltage: number;            // Volts
  current: number;            // Amperes
  power: number;              // Watts (instantaneous)
  energy: number;             // kWh (cumulative)
  frequency: number;          // Hz (50/60 depending on region)
  powerFactor: number;        // 0-1 (power quality indicator)
  costPerHour: number;        // ₹ per hour (calculated)
  timestamp: Date;
  // TTL Index: Auto-delete after 90 days
}
```

### Alert Model

```typescript
interface AlertDocument {
  userId: ObjectId;
  deviceId: string;
  deviceName: string;
  alertType: 'DEVICE_OFFLINE' | 'HIGH_POWER' | 'ABNORMAL_BILL' | 'DEVICE_FAULT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  isRead: boolean;
  value?: number;             // Current value (e.g., power consumed)
  threshold?: number;         // Expected limit
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}
```

---

## API Endpoints

### Alert Management

#### GET `/api/alerts` - List Alerts
```bash
curl -X GET "http://localhost:11020/api/alerts?status=ACTIVE" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "deviceId": "ESP32-NODE-01",
      "deviceName": "Main Breaker",
      "alertType": "HIGH_POWER",
      "severity": "HIGH",
      "message": "Device consuming 3500W",
      "status": "ACTIVE",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### PATCH `/api/alerts/:alertId` - Update Alert Status
```bash
curl -X PATCH "http://localhost:11020/api/alerts/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "ACKNOWLEDGED"}'
```

#### DELETE `/api/alerts/:alertId` - Dismiss Alert
```bash
curl -X DELETE "http://localhost:11020/api/alerts/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### GET `/api/alerts/stats` - Alert Statistics
```bash
curl -X GET "http://localhost:11020/api/alerts/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "success": true,
  "data": {
    "total": 15,
    "active": 3,
    "critical": 1,
    "high": 2,
    "medium": 4,
    "low": 5,
    "byType": {
      "DEVICE_OFFLINE": 1,
      "HIGH_POWER": 2,
      "ABNORMAL_BILL": 0,
      "DEVICE_FAULT": 0
    }
  }
}
```

### Device Management

#### POST `/api/devices` - Register Device
```bash
curl -X POST "http://localhost:11020/api/devices" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ESP32-NODE-01",
    "deviceName": "Main Breaker",
    "location": "Electrical Panel",
    "powerThreshold": 3000
  }'
```

#### GET `/api/devices/:deviceId/status` - Device Real-time Status
```bash
curl -X GET "http://localhost:11020/api/devices/507f1f77bcf86cd799439011/status" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "success": true,
  "data": {
    "device": { ... },
    "isOnline": true,
    "lastHeartbeat": "2024-01-15T10:35:22.123Z",
    "minutesSinceLastUpdate": 2
  }
}
```

---

## Backend Services

### Alert Detection Service
**File:** `backend/src/services/alert-detection.service.ts`

```typescript
class AlertDetectionService {
  // Real-time telemetry processing
  async processTelemetry(userId, deviceId, telemetryData)

  // Immediate anomaly detection
  private async detectAnomalies()

  // Scheduled offline check (runs every 2 minutes)
  async checkOfflineDevices()

  // Scheduled bill check (runs every hour)
  async checkAbnormalBills()

  // Create new alert in database
  private async createAlert(...)

  // Get active alerts for user
  async getActiveAlerts(userId)

  // Get alert history
  async getAlertHistory(userId, limit)

  // Configuration management
  updateConfig(newConfig)
  getConfig()
}
```

### Scheduler Service
**File:** `backend/src/services/scheduler.service.ts`

```typescript
class SchedulerService {
  // Initialize all background jobs
  static initializeSchedules()

  // Check for offline devices every 2 minutes
  private static scheduleOfflineDeviceCheck()

  // Check for abnormal bills every hour
  private static scheduleAbnormalBillCheck()
}
```

---

## Frontend Components

### AlertNotificationBadge Component
**File:** `frontend/src/components/AlertNotificationBadge.tsx`

- Shows notification badge in header/navbar
- Displays active alert count
- Dropdown preview of top 5 alerts
- Auto-refreshes every 30 seconds
- Color-coded by severity

```tsx
<AlertNotificationBadge onBadgeClick={() => navigate('/alerts')} />
```

### AlertsPage Component
**File:** `frontend/src/pages/AlertsPage.tsx`

- Full-screen alert management interface
- Filter by status (ACTIVE, ACKNOWLEDGED, RESOLVED, ALL)
- Sort by newest or severity
- Statistics cards showing alert metrics
- Action buttons: Acknowledge, Resolve, Dismiss
- Time-based relative timestamps

---

## Configuration

### Alert Detection Config

Edit alert thresholds in `backend/src/services/alert-detection.service.ts`:

```typescript
const config: AlertConfig = {
    powerThresholds: {
        'ESP32-NODE-01': 3000,  // watts
        'ESP32-NODE-02': 5000,
    },
    offlineTimeoutMinutes: 5,
    monthlyBillThreshold: 5000, // INR
    enableDeviceOfflineAlert: true,
    enablePowerAnomalyAlert: true,
    enableBillAnomalyAlert: true,
};
```

### Scheduler Config

Edit cron schedules in `backend/src/services/scheduler.service.ts`:

```typescript
// Check offline devices every 2 minutes
cron.schedule('*/2 * * * *', async () => { ... });

// Check bills every hour at minute 0
cron.schedule('0 * * * *', async () => { ... });
```

---

## Testing the System

### 1. Start the Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 2. Send Mock Telemetry from ESP32

```bash
# Test high power consumption alert
curl -X POST "http://localhost:11020/api/live-data" \
  -H "Content-Type: application/json" \
  -d '{
    "voltage": 220,
    "current": 15,
    "power": 4500,
    "energy": 12.5,
    "frequency": 50,
    "powerFactor": 0.95,
    "costPerHour": 8.5,
    "deviceId": "ESP32-NODE-01",
    "userId": "admin"
  }'
```

### 3. Check for Alerts

```bash
# View active alerts
curl -X GET "http://localhost:11020/api/alerts?status=ACTIVE" \
  -H "Authorization: Bearer YOUR_TOKEN"

# View alert statistics
curl -X GET "http://localhost:11020/api/alerts/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Test Offline Detection

Wait 5+ minutes without sending telemetry, then scheduler will automatically:
1. Detect the device as offline
2. Create a CRITICAL alert
3. Update device status to 'INACTIVE'

### 5. Frontend Testing

- Open http://localhost:5173
- Navigate to Alerts page
- See alerts displayed with proper filtering and sorting
- Click "Acknowledge" or "Resolve" buttons
- See statistics update in real-time

---

## Error Handling

All services include comprehensive error handling:

```typescript
try {
    // Detection logic
    await alertDetectionService.processTelemetry(...);
} catch (error) {
    Logger.error('Error processing telemetry:', error);
    // Alert creation continues even if specific check fails
}
```

Errors are logged but don't stop alert processing.

---

## Performance Considerations

### Telemetry Storage
- **TTL Index:** Telemetry automatically deleted after 90 days
- **Volume:** ~86,400 records/day per device (1 data point/sec)
- **Retention:** ~7.8M records per device over 90 days

### Database Indexes
- `Device`: Indexed on `userId`, `deviceId`, `lastHeartbeat`
- `Telemetry`: Indexed on `userId`, `deviceId`, `timestamp` (with TTL)
- `Alert`: Indexed on `userId`, `status`, `createdAt`

### Background Jobs
- **Offline Check:** 2-minute intervals (quick query on index)
- **Bill Check:** Hourly aggregation pipeline (resource-intensive)
- Both run asynchronously without blocking main API

---

## Security Notes

1. **Authentication:** All alert/device routes need auth middleware
2. **Authorization:** Users can only see their own alerts/devices
3. **Rate Limiting:** Consider adding to `/api/live-data` for ESP32 submissions
4. **Data Privacy:** Sensitive power/billing data is user-scoped

---

## Future Enhancements

- [ ] Email notifications on CRITICAL alerts
- [ ] SMS alerts via Twilio
- [ ] Predictive analytics (ML-based anomaly detection)
- [ ] Alert escalation rules
- [ ] Webhook integrations (Slack, Teams, etc.)
- [ ] Custom alert rules editor
- [ ] Alert suppression windows
- [ ] Batch alert resolution
- [ ] Alert impact analysis
- [ ] Integration with smart relay controls

---

## Troubleshooting

### Alerts Not Appearing

1. Check MongoDB connection
2. Verify alert creation logs: `Logger.info()` output
3. Check alert thresholds are configured correctly
4. Verify userId is being sent with telemetry

### Offline Detection Not Working

1. Ensure scheduler initialized in `server.ts`
2. Check cron job logs
3. Verify `lastHeartbeat` being updated on telemetry arrival

### High Bill Alerts Never Trigger

1. Verify `costPerHour` is being calculated in telemetry
2. Check bill threshold (default ₹5000)
3. Ensure aggregation pipeline is correct

---

**Last Updated:** January 2024  
**System Status:** ✅ Production Ready
