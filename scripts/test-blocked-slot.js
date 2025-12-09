// Script para testar BlockedSlot diretamente
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
  
  // Listar todos
  console.log('\n=== All blocked slots ===');
  const all = await BlockedSlot.find().lean();
  console.log('Total:', all.length);
  
  // Ver quais têm modalidadeId
  const withModal = all.filter(x => x.modalidadeId);
  console.log('With modalidadeId:', withModal.length);
  
  // Ver os últimos criados
  console.log('\n=== Last 5 slots ===');
  const last5 = await BlockedSlot.find().sort({ criadoEm: -1 }).limit(5).lean();
  last5.forEach(s => console.log(JSON.stringify(s, null, 2)));
  
  // Tentar criar um novo com modalidadeId
  console.log('\n=== Creating test slot ===');
  const testSlot = await BlockedSlot.findOneAndUpdate(
    { slotKey: 'test-script-slot-123' },
    { $set: { slotKey: 'test-script-slot-123', horarioSlot: '10:00', dayIndex: 1, modalidadeId: 'testModalDirect' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  console.log('Created:', JSON.stringify(testSlot, null, 2));
  
  // Verificar se foi salvo
  const found = await BlockedSlot.findOne({ slotKey: 'test-script-slot-123' }).lean();
  console.log('Found again:', JSON.stringify(found, null, 2));
  
  // Limpar teste
  await BlockedSlot.deleteOne({ slotKey: 'test-script-slot-123' });
  
  await mongoose.disconnect();
}

main().catch(console.error);
