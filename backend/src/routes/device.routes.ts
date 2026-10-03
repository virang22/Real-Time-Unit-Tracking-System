import { Router, Request, Response } from 'express';
import Device from '../models/device.model';
import Logger from '../utils/logger.service';

const deviceRouter = Router();

/**
 * GET /api/devices - Get all devices for current user
 */
deviceRouter.get('/', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if user has devices
        let devices = await Device.find({ userId, isDeleted: false }).sort({ createdAt: 1 });

        if (devices.length === 0) {
            const seedDevices = [
                {
                    deviceId: 'ESP32-GRID-NODE-01',
                    deviceName: 'Main Smart Energy Meter (ESP32)',
                    location: 'Main Incomer Panel',
                    deviceType: 'METER',
                    status: 'ACTIVE',
                    powerThreshold: 3000,
                    userId,
                    lastHeartbeat: new Date()
                },
                {
                    deviceId: 'SOLAR-ROOF-02',
                    deviceName: 'Rooftop Solar Inverter',
                    location: 'Terrace Solar Plant',
                    deviceType: 'EQUIPMENT',
                    status: 'ACTIVE',
                    powerThreshold: 5000,
                    userId,
                    lastHeartbeat: new Date(Date.now() - 1000 * 60 * 4)
                },
                {
                    deviceId: 'EV-CHARGER-03',
                    deviceName: 'Tesla Wall Connector EV Charger',
                    location: 'Garage Bay 1',
                    deviceType: 'EQUIPMENT',
                    status: 'ACTIVE',
                    powerThreshold: 7400,
                    userId,
                    lastHeartbeat: new Date(Date.now() - 1000 * 60 * 15)
                },
                {
                    deviceId: 'HVAC-NODE-04',
                    deviceName: 'Sub-Zero HVAC Climate Unit',
                    location: 'First Floor AC Zone',
                    deviceType: 'EQUIPMENT',
                    powerThreshold: 2500,
                    userId,
                    lastHeartbeat: new Date(Date.now() - 1000 * 60 * 2)
                }
            ];

            for (const item of seedDevices) {
                await Device.findOneAndUpdate(
                    { deviceId: item.deviceId },
                    { $set: item, $setOnInsert: { isDeleted: false } },
                    { upsert: true, new: true }
                );
            }
            devices = await Device.find({ userId, isDeleted: false }).sort({ createdAt: 1 });
        }

        res.json({
            success: true,
            data: devices,
            count: devices.length
        });
    } catch (error) {
        Logger.error('Error fetching devices:', error);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

/**
 * POST /api/devices - Register a new device
 */
deviceRouter.post('/', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { deviceId, deviceName, location, deviceType, powerThreshold } = req.body;

        if (!deviceId || !deviceName) {
            return res.status(400).json({ error: 'deviceId and deviceName are required' });
        }

        // Check if device already exists
        const existing = await Device.findOne({ deviceId });
        if (existing) {
            return res.status(400).json({ error: 'Device already registered' });
        }

        const device = new Device({
            deviceId,
            userId,
            deviceName,
            location,
            deviceType: deviceType || 'EQUIPMENT',
            powerThreshold: powerThreshold || 3000,
            lastHeartbeat: new Date()
        });

        await device.save();

        res.status(201).json({
            success: true,
            message: 'Device registered successfully',
            data: device
        });
    } catch (error) {
        Logger.error('Error registering device:', error);
        res.status(500).json({ error: 'Failed to register device' });
    }
});

/**
 * PATCH /api/devices/:deviceId - Update device configuration
 */
deviceRouter.patch('/:deviceId', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { deviceId } = req.params;
        const { deviceName, location, powerThreshold } = req.body;

        const device = await Device.findOneAndUpdate(
            { _id: deviceId, userId },
            {
                ...(deviceName && { deviceName }),
                ...(location && { location }),
                ...(powerThreshold && { powerThreshold })
            },
            { new: true }
        );

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({
            success: true,
            message: 'Device updated successfully',
            data: device
        });
    } catch (error) {
        Logger.error('Error updating device:', error);
        res.status(500).json({ error: 'Failed to update device' });
    }
});

/**
 * DELETE /api/devices/:deviceId - Delete device
 */
deviceRouter.delete('/:deviceId', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { deviceId } = req.params;

        const device = await Device.findOneAndUpdate(
            { _id: deviceId, userId },
            { isDeleted: true },
            { new: true }
        );

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({
            success: true,
            message: 'Device deleted successfully'
        });
    } catch (error) {
        Logger.error('Error deleting device:', error);
        res.status(500).json({ error: 'Failed to delete device' });
    }
});

/**
 * GET /api/devices/:deviceId/status - Get device real-time status
 */
deviceRouter.get('/:deviceId/status', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { deviceId } = req.params;

        const device = await Device.findOne({ _id: deviceId, userId });
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Calculate if device is online (received data in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const isOnline = device.lastHeartbeat > fiveMinutesAgo;

        res.json({
            success: true,
            data: {
                device,
                isOnline,
                lastHeartbeat: device.lastHeartbeat,
                minutesSinceLastUpdate: Math.round((Date.now() - device.lastHeartbeat.getTime()) / 60000)
            }
        });
    } catch (error) {
        Logger.error('Error fetching device status:', error);
        res.status(500).json({ error: 'Failed to fetch device status' });
    }
});

export default deviceRouter;
