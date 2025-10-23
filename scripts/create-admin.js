require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  tipo: { type: String, enum: ['admin', 'professor'], default: 'professor' },
  ativo: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

const User = mongoose.model('User', UserSchema);

const MONGODB_URI = process.env.MONGODB_URI;

async function createAdmin() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set in .env.local');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  try {
    const existing = await User.findOne({ email: 'admin@admin' });
    if (existing) {
      console.log('User admin@admin already exists. No action taken.');
      return;
    }

    const hashed = await bcrypt.hash('admin123', 12);
    const admin = await User.create({
      nome: 'Administrador',
      email: 'admin@admin',
      senha: hashed,
      tipo: 'admin',
      ativo: true
    });

    console.log('Created admin user:');
    console.log(`  email: ${admin.email}`);
    console.log('  password: admin123');
  } catch (err) {
    console.error('Error creating admin user:', err.message || err);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
