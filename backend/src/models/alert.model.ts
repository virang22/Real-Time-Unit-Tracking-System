import { model, models, Schema, Types } from 'mongoose';

export type AlertType = 'DEVICE_OFFLINE' | 'HIGH_POWER' | 'ABNORMAL_BILL' | 'DEVICE_FAULT' | 'ENERGY_LIMIT';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED';

export interface AlertDocument {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    deviceId: string;
    deviceName: string;
    alertType: AlertType;
    severity: AlertSeverity;
    status: AlertStatus;
    title: string;
    message: string;
    value?: number; // Current power value, bill amount, etc.
    threshold?: number; // What was the threshold
    detectedAt: Date;
    resolvedAt?: Date;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const alertSchema = new Schema<AlertDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        deviceId: { type: String, required: true, index: true },
        deviceName: { type: String, required: true },
        alertType: { 
            type: String, 
            enum: ['DEVICE_OFFLINE', 'HIGH_POWER', 'ABNORMAL_BILL', 'DEVICE_FAULT', 'ENERGY_LIMIT'],
            required: true,
            index: true
        },
        severity: { 
            type: String, 
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            default: 'MEDIUM'
        },
        status: { 
            type: String, 
            enum: ['ACTIVE', 'RESOLVED', 'ACKNOWLEDGED'],
            default: 'ACTIVE',
            index: true
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        value: { type: Number }, // Current detected value
        threshold: { type: Number }, // Configured threshold
        detectedAt: { type: Date, default: Date.now },
        resolvedAt: { type: Date },
        isRead: { type: Boolean, default: false, index: true },
    },
    { timestamps: true }
);

const Alert = models.Alert || model<AlertDocument>('Alert', alertSchema);

export default Alert;
