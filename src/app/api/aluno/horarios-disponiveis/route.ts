import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Matricula } from '@/models/Matricula';
import { User } from '@/models/User';

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

// GET - Buscar horários disponíveis para reagendamento
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
    
    // Garantir que o modelo User esteja registrado
    void User;
    
    const { searchParams } = new URL(req.url);
    const incluirTodos = searchParams.get('todos') === 'true';
    
    // Buscar todos os horários ativos
    const horarios = await HorarioFixo.find({ ativo: true })
      .populate('modalidadeId', 'nome cor limiteAlunos')
      .populate({ path: 'professorId', model: 'User', select: 'nome' })
      .lean();
    
    // Para cada horário, buscar quantos alunos estão matriculados
    const horariosComVagas = await Promise.all(
      horarios.map(async (horario: any) => {
        const matriculasCount = await Matricula.countDocuments({
          horarioFixoId: horario._id,
          ativo: true,
          emEspera: { $ne: true }
        });
        
        const limiteAlunos = horario.modalidadeId?.limiteAlunos || 0;
        const temVaga = limiteAlunos === 0 || matriculasCount < limiteAlunos;
        
        return {
          _id: horario._id,
          diaSemana: horario.diaSemana,
          horarioInicio: horario.horarioInicio,
          horarioFim: horario.horarioFim,
          modalidade: horario.modalidadeId ? {
            _id: horario.modalidadeId._id,
            nome: horario.modalidadeId.nome,
            cor: horario.modalidadeId.cor
          } : null,
          professor: horario.professorId ? {
            _id: horario.professorId._id,
            nome: horario.professorId.nome
          } : null,
          matriculasCount,
          limiteAlunos,
          temVaga
        };
      })
    );
    
    // Se incluirTodos, retorna todos, senão filtra apenas com vagas
    const horariosRetorno = incluirTodos 
      ? horariosComVagas 
      : horariosComVagas.filter(h => h.temVaga);
    
    return NextResponse.json({
      success: true,
      horarios: horariosRetorno
    });
    
  } catch (error) {
    console.error('[API Aluno Horarios Disponiveis] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar horários disponíveis' },
      { status: 500 }
    );
  }
}
