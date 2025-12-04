import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import AulaRealizada from '@/models/AulaRealizada';
import mongoose from 'mongoose';

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

// GET - Buscar histórico de presenças do aluno
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
    
    const { searchParams } = new URL(req.url);
    const limite = parseInt(searchParams.get('limite') || '30');
    const pagina = parseInt(searchParams.get('pagina') || '1');
    
    const alunoObjectId = new mongoose.Types.ObjectId(aluno.id);
    
    // Buscar aulas onde o aluno participou
    const aulas = await AulaRealizada.find({
      'alunos.alunoId': alunoObjectId,
      status: { $in: ['enviada', 'corrigida'] }
    })
      .sort({ data: -1 })
      .skip((pagina - 1) * limite)
      .limit(limite)
      .lean();
    
    // Formatar dados para retorno
    const historico = aulas.map((aula: any) => {
      const alunoNaAula = aula.alunos.find((a: any) => 
        a.alunoId.toString() === aluno.id
      );
      
      return {
        _id: aula._id,
        data: aula.data,
        diaSemana: aula.diaSemana,
        modalidade: aula.modalidade,
        horarioInicio: aula.horarioInicio,
        horarioFim: aula.horarioFim,
        presente: alunoNaAula?.presente,
        eraReagendamento: alunoNaAula?.era_reagendamento || false,
        observacoes: alunoNaAula?.observacoes
      };
    });
    
    // Contar total para paginação
    const total = await AulaRealizada.countDocuments({
      'alunos.alunoId': alunoObjectId,
      status: { $in: ['enviada', 'corrigida'] }
    });
    
    // Estatísticas resumidas
    const estatisticas = await AulaRealizada.aggregate([
      { $match: { 'alunos.alunoId': alunoObjectId, status: { $in: ['enviada', 'corrigida'] } } },
      { $unwind: '$alunos' },
      { $match: { 'alunos.alunoId': alunoObjectId } },
      {
        $group: {
          _id: null,
          totalAulas: { $sum: 1 },
          presencas: { $sum: { $cond: [{ $eq: ['$alunos.presente', true] }, 1, 0] } },
          faltas: { $sum: { $cond: [{ $eq: ['$alunos.presente', false] }, 1, 0] } },
          reagendamentos: { $sum: { $cond: ['$alunos.era_reagendamento', 1, 0] } }
        }
      }
    ]);
    
    const stats = estatisticas[0] || { totalAulas: 0, presencas: 0, faltas: 0, reagendamentos: 0 };
    const percentualPresenca = stats.totalAulas > 0 
      ? Math.round((stats.presencas / stats.totalAulas) * 100) 
      : 0;
    
    return NextResponse.json({
      success: true,
      historico,
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite)
      },
      estatisticas: {
        ...stats,
        percentualPresenca
      }
    });
    
  } catch (error) {
    console.error('[API Aluno Presencas] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar histórico' },
      { status: 500 }
    );
  }
}
