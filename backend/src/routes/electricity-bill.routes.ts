import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import ElectricityBill from '../models/electricity-bill.model';
import Telemetry from '../models/telemetry.model';
import Logger from '../utils/logger.service';
import {
    calculateGujaratBillCharges,
    getGujaratTariffTable,
    getMissingUtilityChargeSettings,
    type MonthlyEnergySlice,
} from '../services/electricity-bill-calculator.service';

const electricityBillRouter = Router();
const MAX_RESIDENTIAL_CONNECTED_LOAD_KW = 15;

function getUserId(req: Request): string | undefined {
    return (req as Request & { userId?: string }).userId;
}

function getStatus(status: 'PENDING' | 'PAID', dueDate: Date): 'PENDING' | 'PAID' | 'OVERDUE' {
    if (status === 'PAID') return 'PAID';
    return dueDate.getTime() < Date.now() ? 'OVERDUE' : 'PENDING';
}

function serializeBill(bill: InstanceType<typeof ElectricityBill>) {
    return { ...bill.toObject(), status: getStatus(bill.status, bill.dueDate) };
}

async function getStoredConnectedLoadKw(userId: string, deviceId: string): Promise<number | undefined> {
    const latestBill = await ElectricityBill.findOne({ userId, deviceId })
        .sort({ createdAt: -1 })
        .select('connectedLoadKw');
    return latestBill?.connectedLoadKw;
}

function getConnectedLoadError(connectedLoadKw: number, configuredLoadKw?: number): string | null {
    if (!Number.isFinite(connectedLoadKw) || connectedLoadKw < 0.1 || connectedLoadKw > MAX_RESIDENTIAL_CONNECTED_LOAD_KW) {
        return `Connected load must be between 0.1 and ${MAX_RESIDENTIAL_CONNECTED_LOAD_KW} kW for residential tariffs`;
    }
    if (configuredLoadKw !== undefined && connectedLoadKw > configuredLoadKw) {
        return `Connected load cannot exceed the ${configuredLoadKw} kW load recorded for this meter`;
    }
    return null;
}

async function getStoredTelemetryWindow(userId: string, deviceId: string) {
    const query = { userId, deviceId };
    const [first, last] = await Promise.all([
        Telemetry.findOne(query).sort({ timestamp: 1 }).select('timestamp'),
        Telemetry.findOne(query).sort({ timestamp: -1 }).select('timestamp'),
    ]);
    return { first: first?.timestamp, last: last?.timestamp };
}

function getInsufficientReadingsMessage(
    window: { first?: Date; last?: Date },
    period: { start: Date; end: Date },
): string {
    const span = window.first && window.last
        ? ` Stored readings for this meter span ${window.first.toISOString()} through ${window.last.toISOString()}.`
        : ' No stored readings exist for this meter and account.';
    return `Insufficient stored meter readings for this period; no bill was created.${span} A reading on or before ${period.start.toISOString()} and a closing reading before ${period.end.toISOString()} are required.`;
}

type BillingPeriodType = 'LAST_10_DAYS' | 'LAST_20_DAYS' | 'ONE_MONTH' | 'TWO_MONTHS' | 'CUSTOM';

function parseDateOnly(value: unknown): Date | null {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function dateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function resolvePeriod(body: Record<string, unknown>): { type: BillingPeriodType; label: string; key: string; start: Date; end: Date } | null {
    const type = body.periodType as BillingPeriodType;
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    let start: Date;
    let end: Date;
    let label: string;
    let key: string;

    if (type === 'LAST_10_DAYS' || type === 'LAST_20_DAYS') {
        const days = type === 'LAST_10_DAYS' ? 10 : 20;
        end = tomorrow;
        start = new Date(end);
        start.setDate(start.getDate() - days);
        label = `Last ${days} Days (${dateKey(start)} to ${dateKey(new Date(end.getTime() - 86400000))})`;
        key = `${type}:${dateKey(start)}:${dateKey(new Date(end.getTime() - 86400000))}`;
    } else if (type === 'ONE_MONTH' || type === 'TWO_MONTHS') {
        const month = typeof body.month === 'string' ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(body.month) : null;
        if (!month) return null;
        const selectedYear = Number(month[1]);
        const selectedMonth = Number(month[2]);
        const duration = type === 'ONE_MONTH' ? 1 : 2;
        const calendarEnd = new Date(selectedYear, selectedMonth, 1);
        start = new Date(selectedYear, selectedMonth - duration, 1);
        if (start > today) return null;
        end = calendarEnd > tomorrow ? tomorrow : calendarEnd;
        label = type === 'ONE_MONTH'
            ? start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
            : `${start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} – ${new Date(selectedYear, selectedMonth - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
        key = `${type}:${body.month}`;
    } else if (type === 'CUSTOM') {
        const from = parseDateOnly(body.fromDate);
        const to = parseDateOnly(body.toDate);
        if (!from || !to || to < from) return null;
        start = from;
        end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
        if (end > tomorrow || (end.getTime() - start.getTime()) / 86400000 > 90) return null;
        label = `Custom (${dateKey(start)} to ${dateKey(to)})`;
        key = `${type}:${dateKey(start)}:${dateKey(to)}`;
    } else {
        return null;
    }

    return { type, label, key, start, end };
}

electricityBillRouter.get('/config', (_req: Request, res: Response) => {
    try {
        const table = getGujaratTariffTable();
        const missingUtilitySettings = getMissingUtilityChargeSettings(table);
        res.json({
            success: true,
            data: {
                scheduleName: table.scheduleName,
                effectiveFrom: table.effectiveFrom,
                sourceUrl: table.sourceUrl,
                discoms: table.discoms,
                tariffs: table.tariffs,
                utilityCharges: table.utilityCharges,
                ready: missingUtilitySettings.length === 0,
                missingUtilitySettings,
            },
        });
    } catch (error) {
        Logger.error('Error loading Gujarat tariff configuration:', error);
        res.status(500).json({ error: 'Could not load the Gujarat DISCOM tariff table' });
    }
});

electricityBillRouter.get('/current-estimation', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { deviceId, discom, tariffCategory, isBpl: isBplStr, connectedLoadKw: connectedLoadKwStr } = req.query;
        if (!deviceId || typeof deviceId !== 'string') return res.status(400).json({ error: 'deviceId is required' });
        if (!discom || typeof discom !== 'string') return res.status(400).json({ error: 'discom is required' });
        if (!tariffCategory || !['RGP', 'RGP_RURAL'].includes(String(tariffCategory))) return res.status(400).json({ error: 'tariffCategory is required' });

        const isBpl = isBplStr === 'true';
        const connectedLoadKw = Number(connectedLoadKwStr);
        const configuredLoadKw = await getStoredConnectedLoadKw(userId, deviceId);
        const connectedLoadError = getConnectedLoadError(connectedLoadKw, configuredLoadKw);
        if (connectedLoadError) return res.status(400).json({ error: connectedLoadError });

        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonthEnd = currentMonthStart;

        const table = getGujaratTariffTable();
        const missingUtilitySettings = getMissingUtilityChargeSettings(table);
        if (missingUtilitySettings.length > 0) {
            return res.status(503).json({ error: 'Tariff configuration missing' });
        }

        const [currentMonthOpening, currentLatest] = await Promise.all([
            Telemetry.findOne({ userId, deviceId, timestamp: { $lt: currentMonthStart } }).sort({ timestamp: -1 }).select('energy timestamp'),
            Telemetry.findOne({ userId, deviceId, timestamp: { $gte: currentMonthStart } }).sort({ timestamp: -1 }).select('energy timestamp')
        ]);

        if (!currentMonthOpening || !currentLatest || currentLatest.timestamp < currentMonthStart) {
            const window = await getStoredTelemetryWindow(userId, deviceId);
            return res.status(404).json({
                error: getInsufficientReadingsMessage(window, { start: currentMonthStart, end: currentMonthEnd }),
            });
        }

        const consumedUnits = Math.max(0, currentLatest.energy - currentMonthOpening.energy);
        const daysElapsed = (currentLatest.timestamp.getTime() - currentMonthStart.getTime()) / (1000 * 60 * 60 * 24);
        const averageDaily = daysElapsed > 0.1 ? consumedUnits / daysElapsed : 0;
        const daysInMonth = (currentMonthEnd.getTime() - currentMonthStart.getTime()) / (1000 * 60 * 60 * 24);
        const estimatedMonthEndUnits = averageDaily * daysInMonth;

        const estimatedSlices: MonthlyEnergySlice[] = [{
            units: estimatedMonthEndUnits,
            periodFraction: 1
        }];

        const estimatedCharges = calculateGujaratBillCharges({
            table,
            tariffCategory: tariffCategory as 'RGP' | 'RGP_RURAL',
            isBpl,
            connectedLoadKw,
            monthlySlices: estimatedSlices
        });

        const [prevMonthOpening, prevMonthClosing] = await Promise.all([
            Telemetry.findOne({ userId, deviceId, timestamp: { $lt: previousMonthStart } }).sort({ timestamp: -1 }).select('energy timestamp'),
            Telemetry.findOne({ userId, deviceId, timestamp: { $lt: previousMonthEnd } }).sort({ timestamp: -1 }).select('energy timestamp')
        ]);

        let previousUnits = 0;
        let previousBillAmount = 0;

        if (prevMonthOpening && prevMonthClosing && prevMonthClosing.timestamp >= previousMonthStart) {
            previousUnits = Math.max(0, prevMonthClosing.energy - prevMonthOpening.energy);
            const prevSlices: MonthlyEnergySlice[] = [{
                units: previousUnits,
                periodFraction: 1
            }];
            const prevCharges = calculateGujaratBillCharges({
                table,
                tariffCategory: tariffCategory as 'RGP' | 'RGP_RURAL',
                isBpl,
                connectedLoadKw,
                monthlySlices: prevSlices
            });
            previousBillAmount = prevCharges.totalPayable;
        }

        const unitDifference = estimatedMonthEndUnits - previousUnits;
        const percentageChange = previousUnits > 0 ? (unitDifference / previousUnits) * 100 : 0;
        const amountDifference = estimatedCharges.totalPayable - previousBillAmount;

        res.json({
            success: true,
            data: {
                currentConsumption: {
                    previousReading: currentMonthOpening.energy,
                    currentReading: currentLatest.energy,
                    consumedUnits,
                    periodLabel: currentMonthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                },
                estimatedBill: {
                    consumptionSoFar: consumedUnits,
                    daysElapsed,
                    averageDaily,
                    estimatedMonthEndUnits,
                    estimatedMonthEndBill: estimatedCharges.totalPayable,
                    breakdown: estimatedCharges.breakdown
                },
                previousComparison: {
                    previousUnits,
                    currentUnits: estimatedMonthEndUnits,
                    unitDifference,
                    percentageChange,
                    previousBillAmount,
                    currentBillAmount: estimatedCharges.totalPayable,
                    amountDifference
                }
            }
        });

    } catch (error) {
        Logger.error('Error generating current estimation:', error);
        res.status(500).json({ error: 'Failed to generate current estimation' });
    }
});

electricityBillRouter.get('/', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const bills = await ElectricityBill.find({ userId }).sort({ periodStart: -1 });
        res.json({ success: true, data: bills.map(serializeBill) });
    } catch (error) {
        Logger.error('Error fetching electricity bills:', error);
        res.status(500).json({ error: 'Failed to fetch electricity bills' });
    }
});

electricityBillRouter.post('/', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const body = req.body as Record<string, unknown>;
        const deviceId = typeof body.deviceId === 'string' ? body.deviceId : '';
        const period = resolvePeriod(body);
        const discom = typeof body.discom === 'string' ? body.discom : '';
        const tariffCategory = body.tariffCategory;
        const isBpl = body.isBpl === true;
        const connectedLoadKw = Number(body.connectedLoadKw);
        const dueDate = parseDateOnly(body.dueDate);
        if (!deviceId || !period || !dueDate || !['RGP', 'RGP_RURAL'].includes(String(tariffCategory))) {
            return res.status(400).json({ error: 'Choose a meter, billing period, tariff category, and due date' });
        }
        const configuredLoadKw = await getStoredConnectedLoadKw(userId, deviceId);
        const connectedLoadError = getConnectedLoadError(connectedLoadKw, configuredLoadKw);
        if (connectedLoadError) return res.status(400).json({ error: connectedLoadError });
        const table = getGujaratTariffTable();
        if (!table.discoms.includes(discom)) return res.status(400).json({ error: 'Select a supported Gujarat state DISCOM' });
        const missingUtilitySettings = getMissingUtilityChargeSettings(table);
        if (missingUtilitySettings.length > 0) {
            return res.status(503).json({
                error: `Tariff table is missing verified utility charges: ${missingUtilitySettings.join(', ')}. Configure backend/config/gujarat-discom-tariffs.json before generating bills.`,
            });
        }
        const effectiveFrom = new Date(`${table.effectiveFrom}T00:00:00`);
        if (period.start < effectiveFrom) {
            return res.status(400).json({ error: `The configured tariff is effective from ${table.effectiveFrom}; this period requires an earlier tariff schedule` });
        }

        const existingBill = await ElectricityBill.findOne({ userId, deviceId, period: period.key });
        if (existingBill) {
            return res.status(409).json({ error: 'A bill already exists for this period' });
        }

        const [previous, current] = await Promise.all([
            Telemetry.findOne({ userId, deviceId, timestamp: { $lt: period.start } })
                .sort({ timestamp: -1 })
                .select('energy timestamp'),
            Telemetry.findOne({ userId, deviceId, timestamp: { $lt: period.end } })
                .sort({ timestamp: -1 })
                .select('energy timestamp'),
        ]);

        if (!previous || !current || current.timestamp < period.start) {
            const window = await getStoredTelemetryWindow(userId, deviceId);
            return res.status(409).json({
                error: getInsufficientReadingsMessage(window, period),
                availableDataPeriod: window.first && window.last
                    ? { from: window.first, through: window.last }
                    : null,
            });
        }
        if (current.energy < previous.energy) {
            return res.status(409).json({ error: 'Meter readings are not monotonic for this period' });
        }

        const consumedUnits = Number((current.energy - previous.energy).toFixed(4));
        const monthlySlices: MonthlyEnergySlice[] = [];
        for (let cursor = new Date(period.start); cursor < period.end;) {
            const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
            const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
            const sliceEnd = monthEnd < period.end ? monthEnd : period.end;
            const [sliceOpening, sliceClosing] = await Promise.all([
                cursor.getTime() === period.start.getTime()
                    ? Promise.resolve(previous)
                    : Telemetry.findOne({ userId, deviceId, timestamp: { $lt: cursor } }).sort({ timestamp: -1 }).select('energy timestamp'),
                Telemetry.findOne({ userId, deviceId, timestamp: { $lt: sliceEnd } }).sort({ timestamp: -1 }).select('energy timestamp'),
            ]);
            const hasSliceReading = sliceClosing && sliceClosing.timestamp >= cursor;
            if (sliceOpening && hasSliceReading) {
                if (sliceClosing.energy < sliceOpening.energy) {
                    return res.status(409).json({ error: 'Meter readings are not monotonic for this period' });
                }
                monthlySlices.push({
                    units: Number((sliceClosing.energy - sliceOpening.energy).toFixed(4)),
                    periodFraction: (sliceEnd.getTime() - cursor.getTime()) / (monthEnd.getTime() - monthStart.getTime()),
                });
            } else {
                monthlySlices.push({
                    units: 0,
                    periodFraction: (sliceEnd.getTime() - cursor.getTime()) / (monthEnd.getTime() - monthStart.getTime()),
                });
            }
            cursor = sliceEnd;
        }

        const charges = calculateGujaratBillCharges({
            table,
            tariffCategory: tariffCategory as 'RGP' | 'RGP_RURAL',
            isBpl,
            connectedLoadKw,
            monthlySlices,
        });
        const totalPayable = charges.totalPayable;
        const finalDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), 23, 59, 59, 999);
        const tariffLabel = table.tariffs[tariffCategory as 'RGP' | 'RGP_RURAL'].label;
        const bill = await ElectricityBill.create({
            userId: new Types.ObjectId(userId),
            deviceId,
            period: period.key,
            periodType: period.type,
            periodLabel: period.label,
            periodStart: period.start,
            periodEnd: period.end,
            previousReading: previous.energy,
            previousReadingAt: previous.timestamp,
            currentReading: current.energy,
            currentReadingAt: current.timestamp,
            consumedUnits,
            tariffRate: charges.tariffRate,
            discom,
            tariffCategory: tariffCategory as 'RGP' | 'RGP_RURAL',
            isBpl,
            connectedLoadKw,
            tariffScheduleName: table.scheduleName,
            tariffEffectiveFrom: effectiveFrom,
            tariffSourceUrl: table.sourceUrl,
            energyCharges: charges.energyCharges,
            fixedCharges: charges.fixedCharges,
            otherCharges: charges.utilityCharges,
            fppasCharges: charges.fppasCharges,
            electricityDuty: charges.electricityDuty,
            chargeBreakdown: charges.breakdown,
            totalPayable,
            dueDate: finalDueDate,
            status: 'PENDING',
        });

        res.status(201).json({ success: true, data: serializeBill(bill) });
    } catch (error) {
        Logger.error('Error generating electricity bill:', error);
        res.status(500).json({ error: 'Failed to generate electricity bill' });
    }
});

electricityBillRouter.patch('/:billId/pay', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const billId = req.params.billId;
        const transactionId = String(req.body.transactionId ?? '').trim();
        const paymentMethod = String(req.body.paymentMethod ?? '').trim();
        if (typeof billId !== 'string' || !Types.ObjectId.isValid(billId) || !transactionId || !paymentMethod) {
            return res.status(400).json({ error: 'Bill and payment details are required' });
        }

        const bill = await ElectricityBill.findOne({ _id: billId, userId });
        if (!bill) return res.status(404).json({ error: 'Bill not found' });
        if (bill.status === 'PAID') return res.status(409).json({ error: 'Bill is already paid' });

        bill.status = 'PAID';
        bill.transactionId = transactionId;
        bill.paymentMethod = paymentMethod;
        bill.paidAt = new Date();
        await bill.save();

        res.json({ success: true, data: serializeBill(bill) });
    } catch (error) {
        Logger.error('Error recording electricity bill payment:', error);
        res.status(500).json({ error: 'Failed to record bill payment' });
    }
});

export default electricityBillRouter;