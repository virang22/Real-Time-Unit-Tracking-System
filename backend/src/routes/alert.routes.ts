import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import Alert from '../models/alert.model';
import alertDetectionService from '../services/alert-detection.service';
import Logger from '../utils/logger.service';
import User from '../models/user.model';

const alertRouter = Router();

function getCurrentEnergy(): number {
    try {
        const energyStatePath = path.resolve(process.cwd(), 'logs', 'energy-state.json');
        if (fs.existsSync(energyStatePath)) {
            const savedEnergy = JSON.parse(fs.readFileSync(energyStatePath, 'utf8'));
            const node = savedEnergy['ESP32-GRID-NODE-01'] || Object.values(savedEnergy)[0];
            if (node && typeof node.lastReportedEnergy === 'number') {
                return Number(node.lastReportedEnergy.toFixed(2));
            }
        }
    } catch {
        // ignore
    }
    return 0;
}

alertRouter.get('/energy-limit', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const user = await User.findById(userId).select('energyLimit');
        const currentEnergy = getCurrentEnergy();
        const savedLimit = user?.energyLimit;
        // If user configured a limit (> 0), ALWAYS preserve and return it! Never discard it.
        const effectiveLimit = (typeof savedLimit === 'number' && savedLimit > 0)
            ? savedLimit
            : (currentEnergy > 0 ? Math.ceil(currentEnergy + 10) : 1);

        res.json({
            success: true,
            energyLimit: effectiveLimit,
            currentEnergy
        });
    } catch (error) {
        Logger.error('Error fetching energy limit:', error);
        res.status(500).json({ error: 'Failed to fetch energy limit' });
    }
});

alertRouter.patch('/energy-limit', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const energyLimit = Number(req.body.energyLimit);
        if (!Number.isFinite(energyLimit) || energyLimit <= 0) {
            return res.status(400).json({ error: 'Energy limit must be greater than 0' });
        }

        const currentEnergy = getCurrentEnergy();
        if (currentEnergy > 0 && energyLimit <= currentEnergy) {
            return res.status(400).json({
                error: `Energy alert limit (${energyLimit} kWh) cannot be less than or equal to current consumption (${currentEnergy} kWh). Please set a higher limit.`
            });
        }

        const user = await User.findByIdAndUpdate(userId, { energyLimit }, { new: true }).select('energyLimit');
        res.json({ success: true, energyLimit: user?.energyLimit ?? energyLimit, currentEnergy });
    } catch (error) {
        Logger.error('Error saving energy limit:', error);
        res.status(500).json({ error: 'Failed to save energy limit' });
    }
});

/**
 * GET /api/alerts - Get all active alerts for current user
 */
alertRouter.get('/', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId; // From auth middleware
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const status = req.query.status as string | undefined;
        const query: Record<string, unknown> = { userId };
        if (status && status !== 'ALL') {
            query.status = status;
        }
        const alerts = await Alert.find(query).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: alerts,
            count: alerts.length
        });
    } catch (error) {
        Logger.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

/**
 * GET /api/alerts/history - Get alert history
 */
alertRouter.get('/history', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const alerts = await alertDetectionService.getAlertHistory(userId, limit);

        res.json({
            success: true,
            data: alerts,
            count: alerts.length
        });
    } catch (error) {
        Logger.error('Error fetching alert history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/**
 * PATCH /api/alerts/:alertId - Mark alert as read/acknowledged
 */
alertRouter.patch('/:alertId', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { alertId } = req.params;
        const { status } = req.body; // 'ACKNOWLEDGED' or 'RESOLVED'

        if (!['ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const alert = await Alert.findOneAndUpdate(
            { _id: alertId, userId },
            {
                status,
                isRead: true,
                ...(status === 'RESOLVED' && { resolvedAt: new Date() })
            },
            { new: true }
        );

        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        res.json({
            success: true,
            message: `Alert ${status.toLowerCase()}`,
            data: alert
        });
    } catch (error) {
        Logger.error('Error updating alert:', error);
        res.status(500).json({ error: 'Failed to update alert' });
    }
});

/**
 * DELETE /api/alerts/:alertId - Delete/dismiss alert
 */
alertRouter.delete('/:alertId', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { alertId } = req.params;

        const alert = await Alert.findOneAndDelete({ _id: alertId, userId });

        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        res.json({
            success: true,
            message: 'Alert dismissed'
        });
    } catch (error) {
        Logger.error('Error deleting alert:', error);
        res.status(500).json({ error: 'Failed to delete alert' });
    }
});

/**
 * GET /api/alerts/stats - Get alert statistics
 */
alertRouter.get('/stats', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;

        const stats = await Alert.aggregate([
            { $match: { userId: (req as any).userId } },
            {
                $facet: {
                    byType: [
                        { $group: { _id: '$alertType', count: { $sum: 1 } } }
                    ],
                    bySeverity: [
                        { $group: { _id: '$severity', count: { $sum: 1 } } }
                    ],
                    activeCount: [
                        { $match: { status: 'ACTIVE' } },
                        { $count: 'count' }
                    ],
                    unresolvedCount: [
                        { $match: { status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] } } },
                        { $count: 'count' }
                    ]
                }
            }
        ]);

        res.json({
            success: true,
            data: stats[0]
        });
    } catch (error) {
        Logger.error('Error fetching alert stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

export default alertRouter;
