import { model, models, Schema, Types } from 'mongoose';

export type ElectricityBillStatus = 'PENDING' | 'PAID';

export interface ElectricityBillDocument {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    deviceId: string;
    period: string;
    periodType?: string;
    periodLabel?: string;
    periodStart: Date;
    periodEnd: Date;
    previousReading: number;
    previousReadingAt: Date;
    currentReading: number;
    currentReadingAt: Date;
    consumedUnits: number;
    tariffRate: number;
    discom?: string;
    tariffCategory?: 'RGP' | 'RGP_RURAL';
    isBpl?: boolean;
    connectedLoadKw?: number;
    tariffScheduleName?: string;
    tariffEffectiveFrom?: Date;
    tariffSourceUrl?: string;
    energyCharges: number;
    fixedCharges: number;
    otherCharges: number;
    fppasCharges?: number;
    electricityDuty?: number;
    chargeBreakdown?: { label: string; amount: number }[];
    totalPayable: number;
    dueDate: Date;
    status: ElectricityBillStatus;
    transactionId?: string;
    paymentMethod?: string;
    paidAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const electricityBillSchema = new Schema<ElectricityBillDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        deviceId: { type: String, required: true },
        period: { type: String, required: true },
        periodType: { type: String },
        periodLabel: { type: String },
        periodStart: { type: Date, required: true },
        periodEnd: { type: Date, required: true },
        previousReading: { type: Number, required: true },
        previousReadingAt: { type: Date, required: true },
        currentReading: { type: Number, required: true },
        currentReadingAt: { type: Date, required: true },
        consumedUnits: { type: Number, required: true },
        tariffRate: { type: Number, required: true },
        discom: { type: String },
        tariffCategory: { type: String, enum: ['RGP', 'RGP_RURAL'] },
        isBpl: { type: Boolean },
        connectedLoadKw: { type: Number },
        tariffScheduleName: { type: String },
        tariffEffectiveFrom: { type: Date },
        tariffSourceUrl: { type: String },
        energyCharges: { type: Number, required: true },
        fixedCharges: { type: Number, required: true },
        otherCharges: { type: Number, required: true },
        fppasCharges: { type: Number },
        electricityDuty: { type: Number },
        chargeBreakdown: [{ label: { type: String, required: true }, amount: { type: Number, required: true } }],
        totalPayable: { type: Number, required: true },
        dueDate: { type: Date, required: true },
        status: { type: String, enum: ['PENDING', 'PAID'], default: 'PENDING' },
        transactionId: { type: String },
        paymentMethod: { type: String },
        paidAt: { type: Date },
    },
    { timestamps: true }
);

electricityBillSchema.index({ userId: 1, periodStart: -1 });
electricityBillSchema.index({ userId: 1, deviceId: 1, period: 1 }, { unique: true });

const ElectricityBill = models.ElectricityBill || model<ElectricityBillDocument>('ElectricityBill', electricityBillSchema);

export default ElectricityBill;