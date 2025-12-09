// Script para corrigir slots que têm modalidadeId no slotKey mas não no campo
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const BlockedSlotSchema = new mongoose.Schema({
  slotKey: { type: String, required: true, unique: true },
  horarioSlot: { type: String, required: true },
  dayIndex: { type: Number, required: true },
  modalidadeId: { type: String, required: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: false }
});

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const BlockedSlot = mongoose.models.BlockedSlot || mongoose.model('BlockedSlot', BlockedSlotSchema);
  
  // Buscar todos sem modalidadeId
  const all = await BlockedSlot.find({ modalidadeId: { $exists: false } }).lean();
  console.log('Slots without modalidadeId:', all.length);
  
  let updated = 0;
  for (const slot of all) {
    // Extrair modalidadeId do slotKey se existir
    // Formato: horarioSlot-dayIndex-modalidadeId (ex: 08:00-2-68f146938200ec00bd68f939)
    const parts = slot.slotKey.split('-');
    if (parts.length >= 3) {
      // Pegar tudo depois do segundo hífen como modalidadeId
      const modalidadeId = parts.slice(2).join('-');
      if (modalidadeId && modalidadeId.length > 0) {
        console.log(`Updating ${slot.slotKey} with modalidadeId: ${modalidadeId}`);
        await BlockedSlot.updateOne(
          { _id: slot._id },
          { $set: { modalidadeId } }
        );
        updated++;
      }
    }
  }
  
  console.log(`\nUpdated ${updated} slots`);
  
  // Verificar
  const withModal = await BlockedSlot.find({ modalidadeId: { $exists: true, $ne: null } }).lean();
  console.log('Slots with modalidadeId now:', withModal.length);
  
  await mongoose.disconnect();
}

main().catch(console.error);
