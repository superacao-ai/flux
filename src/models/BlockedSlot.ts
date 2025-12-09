import mongoose, { Schema, model, models } from 'mongoose';

export interface IBlockedSlot {
  slotKey: string; // `${horarioSlot}-${dayIndex}-${modalidadeId}`
  horarioSlot: string; // e.g. '08:00'
  dayIndex: number; // 0..6
  modalidadeId?: string; // ID da modalidade (bloqueio por modalidade)
  createdBy?: mongoose.Types.ObjectId | null;
  criadoEm?: Date;
}

const BlockedSlotSchema = new Schema<IBlockedSlot>({
  slotKey: { type: String, required: true, unique: true },
  horarioSlot: { type: String, required: true },
  dayIndex: { type: Number, required: true },
  modalidadeId: { type: String, required: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: false }
});

BlockedSlotSchema.index({ slotKey: 1 }, { unique: true });
BlockedSlotSchema.index({ modalidadeId: 1, horarioSlot: 1, dayIndex: 1 });

export const BlockedSlot = models.BlockedSlot || model<IBlockedSlot>('BlockedSlot', BlockedSlotSchema);
