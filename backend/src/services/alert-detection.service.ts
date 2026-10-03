import { Types } from 'mongoose';
import Alert, { AlertType, AlertSeverity } from '../models/alert.model';
import Device from '../models/device.model';
import Telemetry from '../models/telemetry.model';
import Logger from '../utils/logger.service';
import User from '../models/user.model';

interface AlertConfig {
    powerThresholds: { [key: string]: number }; // Device ID -> Max watts
    enableDeviceOfflineAlert: boolean;
    offlineTimeoutMinutes: number; // After how many minutes to alert
    enableBillAlert: boolean;
    monthlyBillThreshold: number; // Alert if monthly bill exceeds this
}

class AlertDetectionService {
    private config: AlertConfig = {
        powerThresholds: {},
        enableDeviceOfflineAlert: true,
        offlineTimeoutMinutes: 5, // Alert if device offline for 5 minutes
        enableBillAlert: true,
        monthlyBillThreshold: 5000, // INR
    };

    /**
     * Process incoming telemetry and check for anomalies
     */
    async processTelemetry(
        userId: string,
        deviceId: string,
        data: {
            voltage: number;
            current: number;
            power: number;
            energy: number;
            frequency: number;
            powerFactor: number;
            costPerHour: number;
        }
    ) {
        try {
            // Resolve a valid ObjectId for userId
            let resolvedUserId: Types.ObjectId;
            if (userId && Types.ObjectId.isValid(userId)) {
                resolvedUserId = new Types.ObjectId(userId);
            } else {
                const device = await Device.findOne({ deviceId });
                if (device?.userId && Types.ObjectId.isValid(device.userId)) {
                    resolvedUserId = device.userId;
                } else {
                    let user = await User.findOne({ isDeleted: false });
                    if (!user) {
                        user = await User.create({
                            name: 'Admin',
                            email: 'admin@example.com',
                            energyLimit: 100,
                        });
                    }
                    resolvedUserId = user._id;
                }
            }

            // Ensure device exists and update heartbeat
            await Device.findOneAndUpdate(
                { deviceId },
                { 
                    $setOnInsert: {
                        userId: resolvedUserId,
                        deviceName: deviceId,
                        deviceType: 'METER',
                    },
                    lastHeartbeat: new Date(),
                    status: 'ACTIVE'
                },
                { upsert: true, new: true }
            );

            // 1. Save telemetry to database
            const telemetry = new Telemetry({
                userId: resolvedUserId,
                deviceId,
                ...data,
                timestamp: new Date(),
            });
            await telemetry.save();

            // 3. Check for anomalies
            const userIdStr = resolvedUserId.toString();
            await this.detectAnomalies(userIdStr, deviceId, data);
            await this.detectEnergyLimit(userIdStr, deviceId, data.energy);

        } catch (error) {
            Logger.error('Error processing telemetry:', error);
        }
    }

    private async detectEnergyLimit(userId: string, deviceId: string, energy: number) {
        const user = await User.findById(userId).select('energyLimit');
        const limit = user?.energyLimit;
        if (!limit || limit <= 0) return;

        // 1. Early warning alert (triggers 0.2 kWh before the limit)
        const warningThreshold = Number((limit - 0.2).toFixed(2));
        if (energy >= warningThreshold && energy < limit) {
            const existingWarn = await Alert.findOne({
                userId,
                deviceId,
                alertType: 'ENERGY_LIMIT',
                severity: 'HIGH',
                status: 'ACTIVE'
            });
            if (!existingWarn) {
                const device = await Device.findOne({ deviceId });
                await this.createAlert(
                    userId,
                    deviceId,
                    device?.deviceName || deviceId,
                    'ENERGY_LIMIT',
                    'HIGH',
                    `⚠️ Approaching Energy Limit: ${limit.toFixed(2)} kWh`,
                    `Current consumption is ${energy.toFixed(2)} kWh (${(limit - energy).toFixed(2)} kWh remaining before limit).`,
                    energy,
                    limit
                );
            }
        }

        // 2. Critical limit reached/exceeded
        if (energy >= limit) {
            const existingAlert = await Alert.findOne({
                userId,
                deviceId,
                alertType: 'ENERGY_LIMIT',
                severity: 'CRITICAL',
                status: 'ACTIVE'
            });
            if (!existingAlert) {
                const device = await Device.findOne({ deviceId });
                await this.createAlert(
                    userId,
                    deviceId,
                    device?.deviceName || deviceId,
                    'ENERGY_LIMIT',
                    'CRITICAL',
                    `🚨 Energy limit reached: ${limit.toFixed(2)} kWh`,
                    `Energy consumption reached ${energy.toFixed(2)} kWh, exceeding your configured limit of ${limit.toFixed(2)} kWh.`,
                    energy,
                    limit
                );
            }
        }
    }

    /**
     * Detect power consumption anomalies
     */
    private async detectAnomalies(
        userId: string,
        deviceId: string,
        data: { power: number; voltage: number; frequency: number }
    ) {
        try {
            const device = await Device.findOne({ deviceId });
            if (!device) return;

            // 1. Check voltage anomaly (should be 220-240V in India)
            if (data.voltage < 180 || data.voltage > 250) {
                await this.createAlert(
                    userId,
                    deviceId,
                    device.deviceName,
                    'DEVICE_FAULT',
                    'HIGH',
                    `Abnormal Voltage: ${data.voltage.toFixed(1)}V`,
                    `Device voltage is abnormal. Expected: 220-240V, Got: ${data.voltage.toFixed(1)}V`,
                    data.voltage,
                    220
                );
            }

            // 2. Check frequency (should be around 50Hz)
            if (data.frequency < 48 || data.frequency > 52) {
                await this.createAlert(
                    userId,
                    deviceId,
                    device.deviceName,
                    'DEVICE_FAULT',
                    'MEDIUM',
                    `Grid Frequency Issue: ${data.frequency.toFixed(1)}Hz`,
                    `Grid frequency is abnormal. Expected: 50Hz, Got: ${data.frequency.toFixed(1)}Hz`,
                    data.frequency,
                    50
                );
            }

            // 3. Check power consumption threshold
            if (data.power > device.powerThreshold) {
                await this.createAlert(
                    userId,
                    deviceId,
                    device.deviceName,
                    'HIGH_POWER',
                    'HIGH',
                    `High Power Consumption: ${data.power.toFixed(1)}W`,
                    `Device is consuming more power than configured threshold. Current: ${data.power.toFixed(1)}W, Limit: ${device.powerThreshold}W`,
                    data.power,
                    device.powerThreshold
                );
            }

        } catch (error) {
            Logger.error('Error detecting anomalies:', error);
        }
    }

    /**
     * Check for device offline (called periodically)
     */
    async checkOfflineDevices() {
        try {
            const timeoutMinutes = this.config.offlineTimeoutMinutes;
            const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

            const offlineDevices = await Device.find({
                lastHeartbeat: { $lt: timeoutDate },
                status: 'ACTIVE',
                isDeleted: false
            });

            for (const device of offlineDevices) {
                // Check if alert already exists
                const existingAlert = await Alert.findOne({
                    deviceId: device.deviceId,
                    alertType: 'DEVICE_OFFLINE',
                    status: 'ACTIVE'
                });

                if (!existingAlert) {
                    await this.createAlert(
                        device.userId.toString(),
                        device.deviceId,
                        device.deviceName,
                        'DEVICE_OFFLINE',
                        'CRITICAL',
                        `Device Offline: ${device.deviceName}`,
                        `Device has not sent data for more than ${timeoutMinutes} minutes. Last heartbeat: ${device.lastHeartbeat}`,
                        undefined,
                        undefined
                    );

                    // Mark device as inactive
                    await Device.findByIdAndUpdate(device._id, { status: 'INACTIVE' });
                }
            }
        } catch (error) {
            Logger.error('Error checking offline devices:', error);
        }
    }

    /**
     * Check for abnormal bills
     */
    async checkAbnormalBills() {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            // Group telemetry by userId and deviceId for last 30 days
            const billData = await Telemetry.aggregate([
                {
                    $match: {
                        timestamp: { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            userId: '$userId',
                            deviceId: '$deviceId'
                        },
                        totalCost: { $sum: '$costPerHour' },
                        avgPower: { $avg: '$power' }
                    }
                }
            ]);

            for (const bill of billData) {
                if (bill.totalCost > this.config.monthlyBillThreshold) {
                    const device = await Device.findOne({ deviceId: bill._id.deviceId });
                    if (!device) continue;

                    // Check if alert already exists
                    const existingAlert = await Alert.findOne({
                        deviceId: bill._id.deviceId,
                        alertType: 'ABNORMAL_BILL',
                        status: 'ACTIVE',
                        createdAt: { $gte: thirtyDaysAgo }
                    });

                    if (!existingAlert) {
                        await this.createAlert(
                            bill._id.userId.toString(),
                            bill._id.deviceId,
                            device.deviceName,
                            'ABNORMAL_BILL',
                            'HIGH',
                            `High Monthly Bill: ₹${bill.totalCost.toFixed(2)}`,
                            `This month's bill (₹${bill.totalCost.toFixed(2)}) exceeds your threshold of ₹${this.config.monthlyBillThreshold}. Average power: ${bill.avgPower.toFixed(1)}W`,
                            bill.totalCost,
                            this.config.monthlyBillThreshold
                        );
                    }
                }
            }
        } catch (error) {
            Logger.error('Error checking abnormal bills:', error);
        }
    }

    /**
     * Create a new alert
     */
    private async createAlert(
        userId: string,
        deviceId: string,
        deviceName: string,
        alertType: AlertType,
        severity: AlertSeverity,
        title: string,
        message: string,
        value?: number,
        threshold?: number
    ) {
        try {
            const alert = new Alert({
                userId,
                deviceId,
                deviceName,
                alertType,
                severity,
                title,
                message,
                value,
                threshold,
                status: 'ACTIVE',
                isRead: false
            });

            await alert.save();
            Logger.info(`Alert created: ${alertType} for device ${deviceId}`);

            // TODO: Send email/SMS notification here
            // await this.notificationService.sendAlert(userId, alert);

        } catch (error) {
            Logger.error('Error creating alert:', error);
        }
    }

    /**
     * Resolve an alert
     */
    async resolveAlert(alertId: string) {
        try {
            await Alert.findByIdAndUpdate(alertId, {
                status: 'RESOLVED',
                resolvedAt: new Date()
            });
            Logger.info(`Alert resolved: ${alertId}`);
        } catch (error) {
            Logger.error('Error resolving alert:', error);
        }
    }

    /**
     * Get all active alerts for a user
     */
    async getActiveAlerts(userId: string) {
        try {
            return await Alert.find({
                userId,
                status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] }
            }).sort({ createdAt: -1 });
        } catch (error) {
            Logger.error('Error fetching alerts:', error);
            return [];
        }
    }

    /**
     * Get alert history
     */
    async getAlertHistory(userId: string, limit = 50) {
        try {
            return await Alert.find({ userId }).sort({ createdAt: -1 }).limit(limit);
        } catch (error) {
            Logger.error('Error fetching alert history:', error);
            return [];
        }
    }

    /**
     * Update alert configuration
     */
    updateConfig(newConfig: Partial<AlertConfig>) {
        this.config = { ...this.config, ...newConfig };
        Logger.info('Alert config updated:', this.config);
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return this.config;
    }
}

export default new AlertDetectionService();
