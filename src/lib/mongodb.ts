import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  MONGODB_URI não definida. Configure no arquivo .env.local para usar o banco de dados.');
}

interface CachedConnection {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
}

let cached: CachedConnection = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB(): Promise<mongoose.Connection> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI não definida. Configure no arquivo .env.local');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose.connection;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  // Ensure key models are imported/registered with mongoose to avoid
  // MissingSchemaError when calling populate() in API routes. Dynamic
  // imports here avoid potential circular import issues and ensure the
  // model definitions run after a successful DB connection.
  try {
    await Promise.all([
      import('@/models/Aluno'),
      import('@/models/Professor'),
      import('@/models/Especialidade'),
      import('@/models/Modalidade'),
      import('@/models/HorarioFixo'),
      import('@/models/CreditoReposicao'),
      import('@/models/UsoCredito')
    ]);
  } catch (err) {
    // Non-fatal: models import failures will surface elsewhere, but log for debugging
    // Keep the connection usable even if model imports fail here.
    // eslint-disable-next-line no-console
    console.warn('Warning importing models after DB connect:', err);
  }

  return cached.conn;
}

export default connectDB;