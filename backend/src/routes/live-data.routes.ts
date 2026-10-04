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

// 2. Initialize demoEnergy from the loaded state (resumes counting from last saved value)
const savedGridEnergy = energyByDevice.get('ESP32-GRID-NODE-01')?.lastReportedEnergy ?? 0;
let totalEnergy = Number(savedGridEnergy.toFixed(4));
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
            if (!periodLatest) return 0;

            const baseline = await Telemetry.findOne({ deviceId, timestamp: { $lte: start } })
                .sort({ timestamp: -1 })
                .select('energy');
            const firstInPeriod = baseline ?? await Telemetry.findOne({ deviceId, timestamp: { $gte: start, $lt: end } })
                .sort({ timestamp: 1 })
                .select('energy');

            if (!firstInPeriod) return 0;
            return Number(Math.max(0, periodLatest.energy - firstInPeriod.energy).toFixed(4));
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
        let selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let selectedMonthDaily: number[] = [];
        let availableMonths: string[] = [];
        if (monthMatch) {
            const year = Number(monthMatch[1]);
            const month = Number(monthMatch[2]);
            selectedMonth = requestedMonth!;
            const daysInMonth = new Date(year, month, 0).getDate();
            selectedMonthDaily = await Promise.all(Array.from({ length: daysInMonth }, (_, index) => {
                const start = new Date(year, month - 1, index + 1);
                const end = new Date(year, month - 1, index + 2);
                return consumptionBetween(start, end);
            }));
            const storedMonths = await Telemetry.aggregate([
                { $match: { deviceId } },
                { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$timestamp' } } } },
                { $sort: { _id: -1 } },
                { $limit: 36 },
            ]);
            availableMonths = storedMonths.map(({ _id }) => String(_id));
        }
        const todayIndex = (now.getDay() + 6) % 7;
        const thisWeek = Number(weekDaily.reduce((sum, value) => sum + value, 0).toFixed(4));

        res.json({
            today: weekDaily[todayIndex],
            thisWeek,
            thisMonth: yearMonthly[now.getMonth()],
            total: latest ? Number(latest.energy.toFixed(4)) : 0,
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

    energyByDevice.set(normalizedDeviceId, {
        offset,
        lastRawEnergy: rawEnergy,
        lastReportedEnergy: reportedEnergy,
        lastSampleTime: Date.now(),
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
        updatedAt: new Date().toISOString(),
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

