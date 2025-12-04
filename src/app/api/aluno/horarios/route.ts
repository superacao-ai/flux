import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';
import { User } from '@/models/User';
import { Matricula } from '@/models/Matricula';

const JWT_SECRET = process.env.JWT_SECRET || 'aluno-secret-key-2025';

async function getAlunoFromToken(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('alunoToken')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; nome: string; tipo: string };
    
    if (decoded.tipo !== 'aluno') return null;
    
    return decoded;
  } catch {
    return null;
  }
}

// GET - Buscar horários do aluno logado
export async function GET(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken(req);
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Garantir que o modelo User esteja registrado para o populate funcionar
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _User = User;
    
    // Buscar matrículas do aluno
    const matriculas = await Matricula.find({
      alunoId: aluno.id,
      ativo: true
    }).populate({
      path: 'horarioFixoId',
      populate: [
        { path: 'modalidadeId', select: 'nome cor' },
        { path: 'professorId', model: 'User', select: 'nome' }
      ]
    });
    
    // Extrair horários das matrículas
    const horarios = matriculas
      .filter((m: any) => m.horarioFixoId && m.horarioFixoId.ativo)
      .map((m: any) => ({
        _id: m.horarioFixoId._id,
        diaSemana: m.horarioFixoId.diaSemana,
        horarioInicio: m.horarioFixoId.horarioInicio,
        horarioFim: m.horarioFixoId.horarioFim,
        modalidadeId: m.horarioFixoId.modalidadeId,
        professorId: m.horarioFixoId.professorId
      }));
    
    return NextResponse.json({
      success: true,
      horarios
    });
    
  } catch (error) {
    console.error('[API Aluno Horarios] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar horários' },
      { status: 500 }
    );
  }
}
