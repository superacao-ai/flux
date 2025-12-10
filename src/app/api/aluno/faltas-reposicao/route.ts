import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { AvisoAusencia } from '@/models/AvisoAusencia';
import Feriado from '@/models/Feriado';
import { getFeriadosNacionais } from '@/lib/feriados';
import mongoose from 'mongoose';
import { JWT_SECRET } from '@/lib/auth';

async function getAlunoFromToken() {
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

// GET - Listar faltas disponíveis para reposição
export async function GET(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken();
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Buscar feriados para exclusão
    const feriadosPersonalizados = await Feriado.find({}).lean();
    const anoAtual = new Date().getFullYear();
    const feriadosNacionais = getFeriadosNacionais(anoAtual);
    
    // Criar set de datas de feriados (formato YYYY-MM-DD)
    const feriadosSet = new Set<string>();
    for (const f of feriadosPersonalizados) {
      const d = new Date(f.data);
      feriadosSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    for (const f of feriadosNacionais) {
      const d = new Date(f.data);
      feriadosSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    
    // Helper para verificar se data é feriado
    const isFeriado = (date: Date | string) => {
      const d = new Date(date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return feriadosSet.has(key);
    };
    
    // Buscar avisos de ausência confirmados que ainda têm direito a reposição
    const faltasParaReposicao = await AvisoAusencia.find({
      alunoId: aluno.id,
      status: 'confirmada',
      temDireitoReposicao: true,
      reposicoesUsadas: 0
    })
      .populate({
        path: 'horarioFixoId',
        populate: [
          { path: 'modalidadeId', select: 'nome cor' },
          { path: 'professorId', select: 'nome' }
        ]
      })
      .sort({ dataAusencia: -1 })
      .lean();
    
    // Também buscar faltas do histórico de presenças (AulaRealizada) que ainda não foram usadas
    // Isso cobre casos onde o professor registrou a falta mas o aluno não tinha avisado
    const AulaRealizada = mongoose.models.AulaRealizada || mongoose.model('AulaRealizada', new mongoose.Schema({}, { strict: false }));
    
    const faltasRegistradas = await AulaRealizada.aggregate([
      {
        $match: {
          'alunos.alunoId': new mongoose.Types.ObjectId(aluno.id),
          'alunos.presente': false,
          status: { $in: ['enviada', 'corrigida'] }
        }
      },
      { $unwind: '$alunos' },
      {
        $match: {
          'alunos.alunoId': new mongoose.Types.ObjectId(aluno.id),
          'alunos.presente': false
        }
      },
      {
        $lookup: {
          from: 'horariofixos',
          localField: 'horarioFixoId',
          foreignField: '_id',
          as: 'horario'
        }
      },
      { $unwind: { path: '$horario', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'modalidades',
          localField: 'horario.modalidadeId',
          foreignField: '_id',
          as: 'modalidade'
        }
      },
      { $unwind: { path: '$modalidade', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          data: 1,
          horarioFixoId: 1,
          horarioInicio: '$horario.horarioInicio',
          horarioFim: '$horario.horarioFim',
          modalidade: {
            _id: '$modalidade._id',
            nome: '$modalidade.nome',
            cor: '$modalidade.cor'
          },
          aluno: '$alunos'
        }
      },
      { $sort: { data: -1 } },
      { $limit: 20 }
    ]);
    
    // Verificar quais faltas já tem aviso de ausência associado (excluir feriados)
    const faltasComAviso = faltasParaReposicao
      .filter((f: any) => !isFeriado(f.dataAusencia))
      .map((f: any) => ({
        _id: f._id,
        tipo: 'aviso_ausencia',
        data: f.dataAusencia,
        horarioFixoId: f.horarioFixoId?._id,
        horarioInicio: f.horarioFixoId?.horarioInicio,
        horarioFim: f.horarioFixoId?.horarioFim,
        modalidade: f.horarioFixoId?.modalidadeId,
        motivo: f.motivo,
        temDireitoReposicao: true
      }));
    
    // Faltas registradas pelo professor que não tem aviso prévio
    // (não tem direito automático, mas pode solicitar)
    // Também exclui feriados
    const faltasSemAviso = faltasRegistradas
      .filter((f: any) => {
        // Excluir feriados
        if (isFeriado(f.data)) return false;
        
        // Verificar se essa falta já tem aviso de ausência
        const temAviso = faltasParaReposicao.some((a: any) => 
          a.dataAusencia.toISOString().split('T')[0] === f.data.split('T')[0] &&
          a.horarioFixoId?._id?.toString() === f.horarioFixoId?.toString()
        );
        return !temAviso;
      })
      .map((f: any) => ({
        _id: f._id,
        tipo: 'falta_registrada',
        data: f.data,
        horarioFixoId: f.horarioFixoId,
        horarioInicio: f.horarioInicio,
        horarioFim: f.horarioFim,
        modalidade: f.modalidade,
        temDireitoReposicao: false // Não avisou com antecedência
      }));
    
    return NextResponse.json({
      success: true,
      faltasComDireito: faltasComAviso, // Pode repor
      faltasSemDireito: faltasSemAviso, // Não pode repor (não avisou)
      totalReposicoesDisponiveis: faltasComAviso.length
    });
    
  } catch (error) {
    console.error('[API Faltas Reposição] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar faltas para reposição' },
      { status: 500 }
    );
  }
}
