import { model, models, Schema, Types } from 'mongoose';

export interface UserDocument {
    _id: Types.ObjectId;
    name?: string;
    email?: string;
    password?: string;
    mobile?: string;
    address?: string;
    energyLimit: number;
    isDeleted: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    deletedBy?: Types.ObjectId;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
    {
        name: { type: String },
        email: { type: String, lowercase: true, trim: true },
        password: { type: String },
        mobile: { type: String },
        address: { type: String },
        energyLimit: { type: Number, default: 1 },
        isDeleted: { type: Boolean, default: false },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        deletedAt: { type: Date },
    },
    { timestamps: true }
);

const User = models.User || model<UserDocument>('User', userSchema);

export default User;
