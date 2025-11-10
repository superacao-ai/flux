import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Banco de dados não conectado' }, { status: 500 });
    }
    
    // Ativar todos os alunos sem campo 'ativo' ou com ativo: false
    const resultAlunos = await db.collection('alunos').updateMany(
      { $or: [{ ativo: { $exists: false } }, { ativo: false }] },
      { $set: { ativo: true } }
    );
    
    // Ativar todos os horários fixos sem campo 'ativo' ou com ativo: false  
    const resultHorarios = await db.collection('horariofixos').updateMany(
      { $or: [{ ativo: { $exists: false } }, { ativo: false }] },
      { $set: { ativo: true } }
    );
    
    // Verificar totais
    const totalAlunos = await db.collection('alunos').countDocuments({ ativo: true });
    const totalHorarios = await db.collection('horariofixos').countDocuments({ ativo: true });
    
    return NextResponse.json({
      success: true,
      message: 'Registros ativados com sucesso',
      alunosAtualizados: resultAlunos.modifiedCount,
      horariosAtualizados: resultHorarios.modifiedCount,
      totais: {
        alunos: totalAlunos,
        horarios: totalHorarios
      }
    });
    
  } catch (error) {
    console.error('Erro ao ativar registros:', error);
    return NextResponse.json(
      { error: 'Erro ao ativar registros' },
      { status: 500 }
    );
  }
}
