import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import alertDetectionService from '../services/alert-detection.service';
import Logger from '../utils/logger.service';

const liveDataRouter = Router();

type EnergyState = {
    offset: number;
    lastRawEnergy: number;
    lastReportedEnergy: number;
    lastSampleTime?: number;
};

// Keeps the dashboard total continuous across server restarts and ESP32 reconnects.
const energyStatePath = path.resolve(process.cwd(), 'logs', 'energy-state.json');
const energyByDevice = new Map<string, EnergyState>();
const demoModeEnabled = process.env.DEMO_MODE !== 'false';
let lastRealTelemetryAt = 0;
let hasFirmwareDemoPackets = false;
let lastFirmwareDemoAt = 0;

// 1. Read persistent energy state first before initializing in-memory variables
try {
    if (fs.existsSync(energyStatePath)) {
        const savedEnergy = JSON.parse(fs.readFileSync(energyStatePath, 'utf8')) as Record<string, EnergyState>;
        Object.entries(savedEnergy).forEach(([deviceId, state]) => energyByDevice.set(deviceId, state));
    }
} catch (err) {
    Logger.error('[Energy] Error reading energy state file:', err);
}

// 2. Initialize demoEnergy from the loaded state (resumes counting from last saved value)
const savedGridEnergy = energyByDevice.get('ESP32-GRID-NODE-01')?.lastReportedEnergy ?? 237.4;
let demoEnergy = Number(savedGridEnergy.toFixed(2));
Logger.info(`[Energy] Starting/resuming total energy at: ${demoEnergy} kWh`);

function persistEnergyState(): void {
    try {
        fs.mkdirSync(path.dirname(energyStatePath), { recursive: true });
        fs.writeFileSync(energyStatePath, JSON.stringify(Object.fromEntries(energyByDevice), null, 2));
    } catch (err) {
        Logger.error('[Energy] Error saving energy state file:', err);
    }
}

// In-memory latest telemetry cache
// updatedAt starts at epoch so device is OFFLINE until real ESP32 data arrives
let latestTelemetry = {
    deviceId: 'ESP32-GRID-NODE-01',
    voltage: 0,
    current: 0,
    power: 0,
    energy: demoEnergy,
    frequency: 0,
    powerFactor: 0,
    costPerHour: 0,
    efficiency: 100,
    gridStatus: 'OFFLINE',
    relayState: 'ON',
    updatedAt: new Date(0).toISOString(), // epoch = device starts OFFLINE
};

function updateDemoTelemetry(force = false): void {
    const phase = Date.now() / 8000;
    const voltage = 228 + Math.sin(phase) * 3.5;
    const current = 1.1 + (Math.sin(phase * 1.5) + 1) * 0.15;
    const power = voltage * current * 0.96;
    demoEnergy = Number((demoEnergy + 0.01).toFixed(2));

    latestTelemetry = {
        ...latestTelemetry,
        deviceId: 'ESP32-GRID-NODE-01',
        voltage: Number(voltage.toFixed(1)),
        current: Number(current.toFixed(2)),
        power: Number(power.toFixed(1)),
        energy: demoEnergy,
        frequency: Number((50 + (Math.sin(phase * 2) * 0.15)).toFixed(1)),
        powerFactor: 0.96,
        updatedAt: new Date().toISOString(),
    };

    energyByDevice.set('ESP32-GRID-NODE-01', {
        offset: 0,
        lastRawEnergy: demoEnergy,
        lastReportedEnergy: demoEnergy,
    });
    persistEnergyState();
}

// GET /api/live-data - Frontend fetches live status
liveDataRouter.get('/', (_req: Request, res: Response) => {
    // 8000ms window: ESP32 posts every 2s, so 4x buffer before declaring offline
    const isOnline = Boolean(
        latestTelemetry.updatedAt &&
        Date.now() - new Date(latestTelemetry.updatedAt).getTime() < 8000
    );

    if (!isOnline) {
        return res.json({
            ...latestTelemetry,
            voltage: 0,
            current: 0,
            power: 0,
            frequency: 0,
            powerFactor: 0,
            energy: Number(latestTelemetry.energy || 0),
            gridStatus: 'OFFLINE',
        });
    }

    res.json({
        ...latestTelemetry,
        gridStatus: 'OPTIMAL',
    });
});

// POST /api/live-data - ESP32 posts telemetry
liveDataRouter.post('/', async (req: Request, res: Response) => {
    try {
      const {
        voltage = 0,
        current = 0,
        power = 0,
        energy = 0,
        frequency = 50.0,
        powerFactor = 1.0,
        deviceId = 'ESP32-NODE-01',
                userId = 'admin',
            } = req.body;

    const normalizedDeviceId = String(deviceId);
    const isFixedDemoPacket = normalizedDeviceId === 'ESP32-GRID-NODE-01'
        && Number(voltage) === 230
        && Number(current) === 0.85
        && Number(power) === 195.5;

    const isZeroTelemetry = Number(voltage) === 0 && Number(current) === 0 && Number(power) === 0
        && Number(frequency) === 0 && Number(powerFactor) === 0;

    // Only fall back to demo if this looks like a fixed demo packet (not real PZEM data)
    // Real PZEM data always has non-zero voltage, frequency and power factor
    if (isFixedDemoPacket) {
        hasFirmwareDemoPackets = true;
        lastFirmwareDemoAt = Date.now();
        updateDemoTelemetry(true);
        lastRealTelemetryAt = Date.now();
        persistEnergyState();
        return res.status(200).json({
            status: 'SUCCESS',
            message: 'Fixed demo packet received',
            relayControl: latestTelemetry.relayState,
            timestamp: latestTelemetry.updatedAt,
        });
    }

    // If ALL fields are zero, the ESP32 has no sensor attached – still accept but do not
    // update updatedAt so the device stays OFFLINE until real readings arrive
    if (isZeroTelemetry) {
        Logger.info('[ESP32] Zero telemetry received – waiting for real sensor data');
        return res.status(200).json({
            status: 'WAITING',
            message: 'Waiting for real sensor data',
            relayControl: latestTelemetry.relayState,
            timestamp: new Date().toISOString(),
        });
    }

    lastRealTelemetryAt = Date.now();
    const rawEnergy = Number(energy);
    const previousEnergy = energyByDevice.get(normalizedDeviceId);
    let offset = previousEnergy?.offset ?? 0;
    
    let reportedEnergy = offset + rawEnergy;

    if (previousEnergy) {
        if (rawEnergy < previousEnergy.lastRawEnergy) {
            // Device rebooted or reset
            offset = previousEnergy.lastReportedEnergy - rawEnergy;
            reportedEnergy = offset + rawEnergy;
        } else {
            // Calculate integrated energy from real-time power (since ESP32 float precision underflows at small loads)
            const now = Date.now();
            const lastTime = previousEnergy.lastSampleTime || now;
            const elapsedHours = Math.max(0, (now - lastTime) / 3600000);
            
            // Only integrate if elapsed time is reasonable (e.g. less than 5 mins) to avoid huge jumps if offline
            let integratedDelta = 0;
            if (elapsedHours > 0 && elapsedHours < 0.1) {
                integratedDelta = (Number(power) * elapsedHours) / 1000; // Power (W) to Energy (kWh)
            }
            
            const rawDelta = rawEnergy - previousEnergy.lastRawEnergy;
            
            // Use maximum of raw delta or calculated delta to ensure smooth updates without losing counts
            const actualDelta = Math.max(rawDelta, integratedDelta);
            
            reportedEnergy = previousEnergy.lastReportedEnergy + actualDelta;
            
            // Adjust offset so that (offset + rawEnergy) matches reportedEnergy seamlessly
            offset = reportedEnergy - rawEnergy;
        }
    }

    reportedEnergy = Number(reportedEnergy.toFixed(4));

    energyByDevice.set(normalizedDeviceId, {
        offset,
        lastRawEnergy: rawEnergy,
        lastReportedEnergy: reportedEnergy,
        lastSampleTime: Date.now(),
    });
    persistEnergyState();

    latestTelemetry = {
        ...latestTelemetry,
        deviceId: normalizedDeviceId,
        voltage: Number(voltage),
        current: Number(current),
        power: Number(power),
        energy: reportedEnergy,
        frequency: Number(frequency),
        powerFactor: Number(powerFactor),
        updatedAt: new Date().toISOString(),
    };

    Logger.info(`[ESP32 Ingest] V: ${voltage}V | I: ${current}A | P: ${power}W | Raw E: ${rawEnergy}kWh | Total E: ${reportedEnergy.toFixed(4)}kWh | Dev: ${normalizedDeviceId}`);

    await alertDetectionService.processTelemetry(userId, normalizedDeviceId, {
        voltage: Number(voltage),
        current: Number(current),
        power: Number(power),
        energy: reportedEnergy,
        frequency: Number(frequency),
        powerFactor: Number(powerFactor),
        costPerHour: Number(req.body.costPerHour || 0),
    });

    res.status(200).json({
        status: 'SUCCESS',
        message: 'Telemetry received and processed',
        relayControl: latestTelemetry.relayState, // Allows server to command ESP32 relay (ON/OFF)
        timestamp: latestTelemetry.updatedAt,
    });
    } catch (error) {
      Logger.error('Error processing telemetry:', error);
      res.status(500).json({ status: 'ERROR', message: 'Failed to process telemetry' });
    }
});

export default liveDataRouter;

