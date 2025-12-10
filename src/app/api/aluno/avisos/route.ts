import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Aviso } from '@/models/Aviso';
import { Aluno } from '@/models/Aluno';
import { Matricula } from '@/models/Matricula';
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
  } catch (error) {
    console.error('[API Aluno Avisos] Erro ao decodificar token:', error);
    return null;
  }
}

// GET - Buscar avisos ativos para o aluno
export async function GET(req: NextRequest) {
  try {
    const alunoToken = await getAlunoFromToken();
    
    if (!alunoToken) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Buscar aluno completo para pegar modalidadeId
    const aluno = await Aluno.findById(alunoToken.id);
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Aluno não encontrado' },
        { status: 404 }
      );
    }
    
    // Buscar modalidades do aluno de duas formas:
    // 1. Direto do campo modalidadeId (alunos adicionados em lote)
    // 2. Via Matrículas -> HorarioFixo (alunos adicionados à turma)
    const modalidadesDoAluno: string[] = [];
    
    // Modalidade direta
    if (aluno.modalidadeId) {
      modalidadesDoAluno.push(aluno.modalidadeId.toString());
    }
    
    // Modalidades via matrículas
    const matriculas = await Matricula.find({
      alunoId: new mongoose.Types.ObjectId(alunoToken.id),
      ativo: true
    }).populate({
      path: 'horarioFixoId',
      select: 'modalidadeId'
    });
    
    matriculas.forEach((m: any) => {
      if (m.horarioFixoId?.modalidadeId) {
        const modId = m.horarioFixoId.modalidadeId.toString();
        if (!modalidadesDoAluno.includes(modId)) {
          modalidadesDoAluno.push(modId);
        }
      }
    });

    // Pegar data de hoje no formato correto para comparação
    const hoje = new Date().toISOString().split('T')[0];
    
    // Buscar avisos ativos
    // Primeiro buscar todos os avisos ativos, depois filtrar
    const todosAvisos = await Aviso.find({ ativo: true })
      .populate('modalidadesAfetadas', 'nome cor')
      .sort({ tipo: -1, dataInicio: -1 })
      .lean();
    
    // Filtrar avisos que estão no período válido
    const avisosNoPeriodo = todosAvisos.filter((aviso: any) => {
      // Converter datas para string YYYY-MM-DD
      let dataInicio: string;
      let dataFim: string;
      
      if (aviso.dataInicio instanceof Date) {
        dataInicio = aviso.dataInicio.toISOString().split('T')[0];
      } else {
        dataInicio = String(aviso.dataInicio).split('T')[0];
      }
      
      if (aviso.dataFim instanceof Date) {
        dataFim = aviso.dataFim.toISOString().split('T')[0];
      } else {
        dataFim = String(aviso.dataFim).split('T')[0];
      }
      
      return dataInicio <= hoje && dataFim >= hoje;
    });
    
    // Filtrar avisos que afetam a modalidade do aluno
    const avisosFiltrados = avisosNoPeriodo.filter((aviso: any) => {
      // Se não tem modalidades afetadas ou array vazio, afeta TODOS os alunos
      if (!aviso.modalidadesAfetadas || aviso.modalidadesAfetadas.length === 0) {
        return true;
      }
      
      // Se o aluno não tem nenhuma modalidade (nem direta nem via matrícula)
      if (modalidadesDoAluno.length === 0) {
        return false;
      }
      
      // Verificar se alguma modalidade do aluno está nas afetadas
      const modalidadesAfetadasIds = aviso.modalidadesAfetadas.map((m: any) => 
        (m._id || m).toString()
      );
      return modalidadesDoAluno.some(modId => modalidadesAfetadasIds.includes(modId));
    });
    
    // Verificar se algum aviso é de cancelamento para hoje
    const temCancelamentoHoje = avisosFiltrados.some((a: any) => a.tipo === 'cancelamento');
    
    return NextResponse.json({
      success: true,
      avisos: avisosFiltrados,
      temCancelamentoHoje
    });
    
  } catch (error) {
    console.error('[API Aluno Avisos] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar avisos' },
      { status: 500 }
    );
  }
}
