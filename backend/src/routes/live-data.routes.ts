import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import alertDetectionService from '../services/alert-detection.service';
import Telemetry from '../models/telemetry.model';
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

// 1. Read persistent energy state first before initializing in-memory variables
try {
    if (fs.existsSync(energyStatePath)) {
        const savedEnergy = JSON.parse(fs.readFileSync(energyStatePath, 'utf8')) as Record<string, EnergyState>;
        Object.entries(savedEnergy).forEach(([deviceId, state]) => energyByDevice.set(deviceId, state));
    }
} catch (err) {
    Logger.error('[Energy] Error reading energy state file:', err);
}

// 2. Initialize totalEnergy from the loaded state (resumes counting from last saved value)
const savedGridEnergy = energyByDevice.get('ESP32-GRID-NODE-01')?.lastReportedEnergy ?? 0;
let totalEnergy = Number(savedGridEnergy.toFixed(6));
Logger.info(`[Energy] Starting/resuming total energy at: ${totalEnergy} kWh`);

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
    energy: totalEnergy,
    frequency: 0,
    powerFactor: 0,
    costPerHour: 0,
    efficiency: 100,
    gridStatus: 'OFFLINE',
    relayState: 'ON',
    updatedAt: new Date(0).toISOString(), // epoch = device starts OFFLINE
};

// GET /api/live-data - Frontend fetches live status
liveDataRouter.get('/', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

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
            energy: Number((latestTelemetry.energy || 0).toFixed(6)),
            gridStatus: 'OFFLINE',
        });
    }

    res.json({
        ...latestTelemetry,
        energy: Number((latestTelemetry.energy || 0).toFixed(6)),
        gridStatus: 'OPTIMAL',
    });
});

liveDataRouter.get('/energy-analysis', async (_req: Request, res: Response) => {
    try {
        const deviceId = latestTelemetry.deviceId;
        const latest = await Telemetry.findOne({ deviceId })
            .sort({ timestamp: -1 })
            .select('energy timestamp');

        const now = new Date();
        const requestedMonth = typeof _req.query.month === 'string' ? _req.query.month : undefined;
        const monthMatch = requestedMonth ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(requestedMonth) : null;
        if (requestedMonth && !monthMatch) {
            return res.status(400).json({ message: 'Month must use YYYY-MM format' });
        }
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        const currentYearStart = new Date(now.getFullYear(), 0, 1);

        const consumptionBetween = async (start: Date, end: Date): Promise<number> => {
            const periodLatest = await Telemetry.findOne({ deviceId, timestamp: { $gte: start, $lt: end } })
                .sort({ timestamp: -1 })
                .select('energy');

            const isCurrentPeriod = start <= now && end > now;
            let currentPeriodEnergy = periodLatest ? periodLatest.energy : 0;
            if (isCurrentPeriod && latestTelemetry.deviceId === deviceId && latestTelemetry.energy > 0) {
                currentPeriodEnergy = Math.max(currentPeriodEnergy, latestTelemetry.energy);
            }

            if (!periodLatest && !isCurrentPeriod) return 0;

            const baseline = await Telemetry.findOne({ deviceId, timestamp: { $lte: start } })
                .sort({ timestamp: -1 })
                .select('energy');
            const firstInPeriod = baseline ?? await Telemetry.findOne({ deviceId, timestamp: { $gte: start, $lt: end } })
                .sort({ timestamp: 1 })
                .select('energy');

            if (!firstInPeriod) return 0;
            return Number(Math.max(0, currentPeriodEnergy - firstInPeriod.energy).toFixed(4));
        };

        const weekDays = Array.from({ length: 7 }, (_, index) => {
            const start = new Date(weekStart);
            start.setDate(start.getDate() + index);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            return { start, end };
        });
        const yearMonths = Array.from({ length: 12 }, (_, index) => ({
            start: new Date(currentYearStart.getFullYear(), index, 1),
            end: new Date(currentYearStart.getFullYear(), index + 1, 1),
        }));
        const [weekDaily, yearMonthly] = await Promise.all([
            Promise.all(weekDays.map(({ start, end }) => consumptionBetween(start, end))),
            Promise.all(yearMonths.map(({ start, end }) => consumptionBetween(start, end))),
        ]);

        const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const targetMonthStr = monthMatch ? requestedMonth! : defaultMonth;
        const [targetYear, targetMonthNum] = targetMonthStr.split('-').map(Number);
        const selectedMonth = targetMonthStr;
        const daysInMonth = new Date(targetYear, targetMonthNum, 0).getDate();
        const selectedMonthDaily = await Promise.all(Array.from({ length: daysInMonth }, (_, index) => {
            const start = new Date(targetYear, targetMonthNum - 1, index + 1);
            const end = new Date(targetYear, targetMonthNum - 1, index + 2);
            return consumptionBetween(start, end);
        }));

        const storedMonths = await Telemetry.aggregate([
            { $match: { deviceId } },
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$timestamp' } } } },
            { $sort: { _id: -1 } },
            { $limit: 36 },
        ]);
        const availableMonths: string[] = storedMonths.map(({ _id }) => String(_id));
        if (!availableMonths.includes(defaultMonth)) {
            availableMonths.unshift(defaultMonth);
        }
        const todayIndex = (now.getDay() + 6) % 7;
        const thisWeek = Number(weekDaily.reduce((sum, value) => sum + value, 0).toFixed(4));

        res.json({
            today: weekDaily[todayIndex],
            thisWeek,
            thisMonth: yearMonthly[now.getMonth()],
            total: latest ? Number(latest.energy.toFixed(6)) : Number(totalEnergy.toFixed(6)),
            weekDaily,
            yearMonthly,
            selectedMonth,
            selectedMonthDaily,
            availableMonths,
        });
    } catch (error) {
        Logger.error('Error fetching energy analysis:', error);
        res.status(500).json({ message: 'Failed to fetch energy analysis' });
    }
});

liveDataRouter.get('/history', async (req: Request, res: Response) => {
    try {
        const requestedLimit = Number(req.query.limit);
        const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, 1000)
            : 200;
        const deviceId = typeof req.query.deviceId === 'string' && req.query.deviceId.trim()
            ? req.query.deviceId.trim()
            : latestTelemetry.deviceId;
        const query: Record<string, unknown> = { deviceId };

        if (typeof req.query.from === 'string' || typeof req.query.to === 'string') {
            const timestamp: Record<string, Date> = {};
            if (typeof req.query.from === 'string') {
                const from = new Date(req.query.from);
                if (!Number.isFinite(from.getTime())) return res.status(400).json({ message: 'Invalid from timestamp' });
                timestamp.$gte = from;
            }
            if (typeof req.query.to === 'string') {
                const to = new Date(req.query.to);
                if (!Number.isFinite(to.getTime())) return res.status(400).json({ message: 'Invalid to timestamp' });
                timestamp.$lte = to;
            }
            query.timestamp = timestamp;
        }

        const readings = await Telemetry.find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .select('deviceId timestamp voltage current power energy frequency powerFactor');
        res.json({ data: readings.reverse(), count: readings.length });
    } catch (error) {
        Logger.error('Error fetching telemetry history:', error);
        res.status(500).json({ message: 'Failed to fetch telemetry history' });
    }
});

// POST /api/live-data - ESP32 posts telemetry
liveDataRouter.post('/', async (req: Request, res: Response) => {
    try {
      const { voltage, current, power, energy, frequency, powerFactor, deviceId, userId = 'admin' } = req.body ?? {};
      const numericFields = { voltage, current, power, energy, frequency, powerFactor };
      const hasInvalidNumber = Object.values(numericFields).some((value) =>
          typeof value !== 'number' || !Number.isFinite(value)
      );

      if (typeof deviceId !== 'string' || !deviceId.trim() || hasInvalidNumber) {
          return res.status(400).json({ status: 'ERROR', message: 'Telemetry requires deviceId and finite numeric readings' });
      }
      if (voltage < 0 || current < 0 || power < 0 || energy < 0 || frequency < 0 || powerFactor < 0 || powerFactor > 1) {
          return res.status(400).json({ status: 'ERROR', message: 'Telemetry readings are outside valid ranges' });
      }
      if (voltage === 0 && current === 0 && power === 0 && frequency === 0 && powerFactor === 0) {
          return res.status(200).json({
              status: 'WAITING',
              message: 'Waiting for real sensor data',
              relayControl: latestTelemetry.relayState,
              timestamp: new Date().toISOString(),
          });
      }

    const normalizedDeviceId = deviceId.trim();
    const rawEnergy = Number(energy);
    const pwr = Number(power);
    const now = Date.now();
    const previousEnergy = energyByDevice.get(normalizedDeviceId);

    let reportedEnergy: number;
    let offset: number;

    if (previousEnergy) {
        const lastReported = previousEnergy.lastReportedEnergy;
        const lastSampleTime = previousEnergy.lastSampleTime || (now - 1000);
        const elapsedMs = Math.max(100, Math.min(10000, now - lastSampleTime));
        const elapsedHours = elapsedMs / 3600000;

        // Accurate numerical integration of real sensor active power (W * hours / 1000 = kWh)
        const integratedDelta = pwr > 0 ? (pwr * elapsedHours) / 1000 : 0;
        const rawDelta = rawEnergy - previousEnergy.lastRawEnergy;

        // If firmware sends high-resolution energy updates (< 0.0005 kWh = 0.5 Wh), track firmware delta.
        // Otherwise use real sensor active power integration so energy increases smoothly every second
        // without quantization freeze and without double-counting coarse PZEM register ticks.
        let energyDelta: number;
        if (rawDelta > 0 && rawDelta < 0.0005) {
            energyDelta = Math.max(rawDelta, integratedDelta);
        } else {
            energyDelta = integratedDelta;
        }

        reportedEnergy = Number((lastReported + energyDelta).toFixed(6));
        offset = Number((reportedEnergy - rawEnergy).toFixed(6));
    } else {
        reportedEnergy = totalEnergy > 0 ? Number(totalEnergy.toFixed(6)) : Number(rawEnergy.toFixed(6));
        offset = Number((reportedEnergy - rawEnergy).toFixed(6));
    }

    Logger.info(`[ESP32 Ingest] V: ${voltage}V | I: ${current}A | P: ${power}W | Raw E: ${rawEnergy}kWh | Total E: ${reportedEnergy.toFixed(6)}kWh | Dev: ${normalizedDeviceId}`);

    const tariffPerKwh = 6.0;
    const calculatedCostPerHour = Number(((pwr / 1000) * tariffPerKwh).toFixed(4));
    const costPerHour = Number(req.body.costPerHour || calculatedCostPerHour);

    const receivedAt = new Date();
    await alertDetectionService.processTelemetry(userId, normalizedDeviceId, {
        voltage: Number(voltage),
        current: Number(current),
        power: Number(power),
        energy: reportedEnergy,
        frequency: Number(frequency),
        powerFactor: Number(powerFactor),
        costPerHour,
        timestamp: receivedAt,
    });

    energyByDevice.set(normalizedDeviceId, {
        offset,
        lastRawEnergy: rawEnergy,
        lastReportedEnergy: reportedEnergy,
        lastSampleTime: now,
    });
    persistEnergyState();

    totalEnergy = reportedEnergy;
    latestTelemetry = {
        ...latestTelemetry,
        deviceId: normalizedDeviceId,
        voltage: Number(voltage),
        current: Number(current),
        power: Number(power),
        energy: totalEnergy,
        frequency: Number(frequency),
        powerFactor: Number(powerFactor),
        costPerHour,
        updatedAt: receivedAt.toISOString(),
    };

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
