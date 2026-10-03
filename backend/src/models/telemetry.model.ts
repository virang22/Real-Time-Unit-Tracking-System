import { model, models, Schema, Types } from 'mongoose';

export interface TelemetryDocument {
    _id: Types.ObjectId;
    deviceId: string;
    userId: Types.ObjectId;
    voltage: number;
    current: number;
    power: number;
    energy: number;
    frequency: number;
    powerFactor: number;
    costPerHour: number;
    timestamp: Date;
    createdAt: Date;
}

const telemetrySchema = new Schema<TelemetryDocument>(
    {
        deviceId: { type: String, required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        voltage: { type: Number, required: true },
        current: { type: Number, required: true },
        power: { type: Number, required: true },
        energy: { type: Number, required: true },
        frequency: { type: Number, default: 50.0 },
        powerFactor: { type: Number, default: 1.0 },
        costPerHour: { type: Number, default: 0 },
        timestamp: { type: Date, default: Date.now, index: true },
    },
    { timestamps: false }
);

// TTL Index - automatically delete data older than 90 days
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

const Telemetry = models.Telemetry || model<TelemetryDocument>('Telemetry', telemetrySchema);

export default Telemetry;
