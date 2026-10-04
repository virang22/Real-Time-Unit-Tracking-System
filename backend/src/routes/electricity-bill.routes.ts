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
        if (!Number.isFinite(connectedLoadKw) || connectedLoadKw <= 0) {
            return res.status(400).json({ error: 'Connected load must be greater than zero kW' });
        }
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
            return res.status(409).json({ error: 'Insufficient stored meter readings for this period' });
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