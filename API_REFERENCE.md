# Fault Detection System - API Reference Guide

## Quick Reference

### Base URL
```
http://localhost:11020/api
```

### Authentication
All endpoints (except `/auth`) require:
```
Authorization: Bearer <jwt_token>
```

---

## Alert Management APIs

### 1. Get Active Alerts
```
GET /alerts?status=ACTIVE
```

**Query Parameters:**
- `status` - Filter by status (ACTIVE, ACKNOWLEDGED, RESOLVED)
- `severity` - Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)
- `type` - Filter by alert type (DEVICE_OFFLINE, HIGH_POWER, ABNORMAL_BILL, DEVICE_FAULT)
- `limit` - Max results (default: 50)

**Example:**
```bash
curl -X GET "http://localhost:11020/api/alerts?status=ACTIVE&severity=CRITICAL" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f1f77bcf86cd799439012",
      "deviceId": "ESP32-NODE-01",
      "deviceName": "Main Breaker",
      "alertType": "DEVICE_OFFLINE",
      "severity": "CRITICAL",
      "title": "Device Offline",
      "message": "Device has not reported data for 5 minutes",
      "status": "ACTIVE",
      "isRead": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "acknowledgedAt": null,
      "resolvedAt": null
    }
  ],
  "count": 1
}
```

---

### 2. Get Alert History
```
GET /alerts/history?limit=50
```

**Query Parameters:**
- `limit` - Max results (default: 50, max: 500)
- `skip` - Pagination offset (default: 0)
- `userId` - (admin only) Filter by user

**Example:**
```bash
curl -X GET "http://localhost:11020/api/alerts/history?limit=25&skip=0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "count": 25,
  "total": 142
}
```

---

### 3. Get Alert Statistics
```
GET /alerts/stats
```

**Example:**
```bash
curl -X GET "http://localhost:11020/api/alerts/stats" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 142,
    "active": 3,
    "acknowledged": 8,
    "resolved": 131,
    "bySeverity": {
      "CRITICAL": 1,
      "HIGH": 2,
      "MEDIUM": 4,
      "LOW": 10
    },
    "byType": {
      "DEVICE_OFFLINE": 1,
      "HIGH_POWER": 2,
      "ABNORMAL_BILL": 0,
      "DEVICE_FAULT": 0
    }
  }
}
```

---

### 4. Update Alert Status
```
PATCH /alerts/:alertId
Content-Type: application/json

{
  "status": "ACKNOWLEDGED" | "RESOLVED"
}
```

**Example:**
```bash
curl -X PATCH "http://localhost:11020/api/alerts/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"status": "ACKNOWLEDGED"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Alert status updated",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "ACKNOWLEDGED",
    "acknowledgedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

---

### 5. Delete/Dismiss Alert
```
DELETE /alerts/:alertId
```

**Example:**
```bash
curl -X DELETE "http://localhost:11020/api/alerts/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response:**
```json
{
  "success": true,
  "message": "Alert deleted successfully"
}
```

---

## Device Management APIs

### 1. List All Devices
```
GET /devices
```

**Example:**
```bash
curl -X GET "http://localhost:11020/api/devices" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "deviceId": "ESP32-NODE-01",
      "userId": "507f1f77bcf86cd799439012",
      "deviceName": "Main Breaker",
      "location": "Electrical Panel",
      "deviceType": "EQUIPMENT",
      "status": "ACTIVE",
      "lastHeartbeat": "2024-01-15T10:45:22.123Z",
      "powerThreshold": 3000,
      "isDeleted": false,
      "createdAt": "2024-01-10T08:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Register New Device
```
POST /devices
Content-Type: application/json

{
  "deviceId": "ESP32-NODE-01",
  "deviceName": "Main Breaker",
  "location": "Electrical Panel",
  "deviceType": "EQUIPMENT",
  "powerThreshold": 3000
}
```

**Required Fields:**
- `deviceId` - Unique device identifier
- `deviceName` - Human-readable name

**Optional Fields:**
- `location` - Physical location (default: "")
- `deviceType` - Type of device (default: "EQUIPMENT")
- `powerThreshold` - Power limit in watts (default: 3000)

**Example:**
```bash
curl -X POST "http://localhost:11020/api/devices" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ESP32-NODE-02",
    "deviceName": "AC Compressor",
    "location": "Floor 2",
    "deviceType": "EQUIPMENT",
    "powerThreshold": 5000
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Device registered successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "deviceId": "ESP32-NODE-02",
    "deviceName": "AC Compressor",
    "powerThreshold": 5000
  }
}
```

---

### 3. Update Device Configuration
```
PATCH /devices/:deviceId
Content-Type: application/json

{
  "deviceName": "Updated Name",
  "location": "New Location",
  "powerThreshold": 4000
}
```

**Example:**
```bash
curl -X PATCH "http://localhost:11020/api/devices/507f1f77bcf86cd799439014" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "powerThreshold": 4000,
    "location": "Roof"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Device updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "powerThreshold": 4000,
    "location": "Roof"
  }
}
```

---

### 4. Get Device Real-time Status
```
GET /devices/:deviceId/status
```

**Example:**
```bash
curl -X GET "http://localhost:11020/api/devices/507f1f77bcf86cd799439014/status" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "device": {
      "_id": "507f1f77bcf86cd799439014",
      "deviceId": "ESP32-NODE-02",
      "deviceName": "AC Compressor",
      "status": "ACTIVE"
    },
    "isOnline": true,
    "lastHeartbeat": "2024-01-15T10:50:22.123Z",
    "minutesSinceLastUpdate": 2
  }
}
```

---

### 5. Delete Device
```
DELETE /devices/:deviceId
```

**Example:**
```bash
curl -X DELETE "http://localhost:11020/api/devices/507f1f77bcf86cd799439014" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response:**
```json
{
  "success": true,
  "message": "Device deleted successfully"
}
```

---

## Telemetry Ingestion API (ESP32)

### Send Telemetry Data
```
POST /live-data
Content-Type: application/json

{
  "voltage": 220,
  "current": 15.5,
  "power": 3410,
  "energy": 23.5,
  "frequency": 50.2,
  "powerFactor": 0.95,
  "costPerHour": 8.5,
  "deviceId": "ESP32-NODE-01",
  "userId": "admin"
}
```

**Required Fields:**
- `deviceId` - Unique device ID
- `userId` - User ID (for scoping)

**Optional Fields:**
- `voltage` - Voltage (default: 0)
- `current` - Current in amps (default: 0)
- `power` - Power in watts (default: 0)
- `energy` - Energy in kWh (default: 0)
- `frequency` - Frequency in Hz (default: 50.0)
- `powerFactor` - Power factor 0-1 (default: 1.0)
- `costPerHour` - Cost per hour (default: 0)

**Example:**
```bash
curl -X POST "http://localhost:11020/api/live-data" \
  -H "Content-Type: application/json" \
  -d '{
    "voltage": 225,
    "current": 14.2,
    "power": 3195,
    "energy": 45.2,
    "frequency": 49.8,
    "powerFactor": 0.96,
    "costPerHour": 7.98,
    "deviceId": "ESP32-NODE-01",
    "userId": "admin"
  }'
```

**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Telemetry received and processed",
  "relayControl": "OFF",
  "timestamp": "2024-01-15T10:55:30.123Z"
}
```

**Telemetry Triggers:**
1. Saves data to MongoDB `telemetry` collection
2. Updates device `lastHeartbeat` 
3. Runs anomaly detection:
   - Checks voltage (180-250V)
   - Checks frequency (48-52Hz)
   - Checks power vs threshold
4. Creates alerts if violations detected

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "deviceId and deviceName are required"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "error": "Device not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to process request",
  "message": "Detailed error description"
}
```

---

## Testing Scripts

### Test High Power Alert
```bash
#!/bin/bash
TOKEN="your-jwt-token"

# Send high power telemetry
curl -X POST "http://localhost:11020/api/live-data" \
  -H "Content-Type: application/json" \
  -d '{
    "power": 5000,
    "voltage": 220,
    "current": 23,
    "frequency": 50,
    "powerFactor": 0.95,
    "deviceId": "ESP32-NODE-01",
    "userId": "admin"
  }'

# Wait 1 second
sleep 1

# Check alerts
curl -X GET "http://localhost:11020/api/alerts?status=ACTIVE&severity=HIGH" \
  -H "Authorization: Bearer $TOKEN"
```

### Test Offline Detection
```bash
#!/bin/bash
TOKEN="your-jwt-token"

# Send one telemetry message
curl -X POST "http://localhost:11020/api/live-data" \
  -H "Content-Type: application/json" \
  -d '{
    "power": 2000,
    "voltage": 220,
    "deviceId": "ESP32-OFFLINE-TEST",
    "userId": "admin"
  }'

# Wait 5+ minutes
echo "Waiting 5 minutes for offline detection..."
sleep 300

# Check for DEVICE_OFFLINE alert (created by scheduler)
curl -X GET "http://localhost:11020/api/alerts?type=DEVICE_OFFLINE" \
  -H "Authorization: Bearer $TOKEN"
```

### Bulk Device Registration
```bash
#!/bin/bash
TOKEN="your-jwt-token"

for i in {1..5}; do
  curl -X POST "http://localhost:11020/api/devices" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"deviceId\": \"ESP32-BULK-$i\",
      \"deviceName\": \"Device $i\",
      \"location\": \"Room $i\",
      \"powerThreshold\": 3000
    }"
  echo ""
done
```

---

## Performance Tips

1. **Batch Updates**: Use `/alerts/stats` instead of fetching individual alerts
2. **Pagination**: Use `limit` and `skip` for large alert lists
3. **Filtering**: Apply filters at API level, not in frontend
4. **Caching**: Frontend should cache alert stats (refresh every 30-60 sec)
5. **Real-time**: Use WebSocket for live updates (future enhancement)

---

## Rate Limiting (Future)

Recommended rate limits:
```
/live-data        - 100 requests/minute (ESP32 data)
/alerts/*         - 30 requests/minute (UI)
/devices/*        - 10 requests/minute (Management)
```

---

## Webhook Integration (Future)

Proposed webhook events:
```
- alert.created
- alert.acknowledged
- alert.resolved
- device.offline
- device.online
- power.threshold_exceeded
```

---

**Last Updated:** January 2024  
**API Version:** 1.0.0
