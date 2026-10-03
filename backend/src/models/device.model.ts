import { model, models, Schema, Types } from 'mongoose';

export interface DeviceDocument {
    _id: Types.ObjectId;
    deviceId: string;
    userId: Types.ObjectId;
    deviceName: string;
    location: string;
    deviceType: 'METER' | 'EQUIPMENT'; // Smart meter or appliance
    status: 'ACTIVE' | 'INACTIVE' | 'FAULT'; // Current status
    lastHeartbeat: Date; // Last data received
    powerThreshold: number; // Max power in watts for this device
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const deviceSchema = new Schema<DeviceDocument>(
    {
        deviceId: { type: String, required: true, unique: true }, // ESP32 Device ID
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        deviceName: { type: String, required: true },
        location: { type: String },
        deviceType: { 
            type: String, 
            enum: ['METER', 'EQUIPMENT'], 
            default: 'EQUIPMENT' 
        },
        status: { 
            type: String, 
            enum: ['ACTIVE', 'INACTIVE', 'FAULT'], 
            default: 'ACTIVE' 
        },
        lastHeartbeat: { type: Date, default: Date.now },
        powerThreshold: { type: Number, default: 3000 }, // Default 3000W threshold
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const Device = models.Device || model<DeviceDocument>('Device', deviceSchema);

export default Device;
