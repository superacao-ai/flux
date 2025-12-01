import mongoose, { Schema, model, models } from 'mongoose';

export interface IBlockedSlot {
  slotKey: string; // `${horarioSlot}-${dayIndex}`
  horarioSlot: string; // e.g. '08:00'
  dayIndex: number; // 0..6
  createdBy?: mongoose.Types.ObjectId | null;
  criadoEm?: Date;
}

const BlockedSlotSchema = new Schema<IBlockedSlot>({
  slotKey: { type: String, required: true, unique: true },
  horarioSlot: { type: String, required: true },
  dayIndex: { type: Number, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: false }
});

BlockedSlotSchema.index({ slotKey: 1 }, { unique: true });

export const BlockedSlot = models.BlockedSlot || model<IBlockedSlot>('BlockedSlot', BlockedSlotSchema);
