import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Aviso } from '@/models/Aviso';
import { Aluno } from '@/models/Aluno';
import { Matricula } from '@/models/Matricula';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'aluno-secret-key-2025';

async function getAlunoFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('alunoToken')?.value;
    
    console.log('[API Aluno Avisos] Token encontrado:', !!token);
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; nome: string; tipo: string };
    
    console.log('[API Aluno Avisos] Token decodificado:', decoded);
    
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
      console.log('[API Aluno Avisos] Token não encontrado ou inválido');
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Buscar aluno completo para pegar modalidadeId
    const aluno = await Aluno.findById(alunoToken.id);
    
    if (!aluno) {
      console.log('[API Aluno Avisos] Aluno não encontrado:', alunoToken.id);
      return NextResponse.json(
        { success: false, error: 'Aluno não encontrado' },
        { status: 404 }
      );
    }
    
    console.log('[API Aluno Avisos] Aluno encontrado:', { id: aluno._id, nome: aluno.nome, modalidadeId: aluno.modalidadeId });
    
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
    
    console.log('[API Aluno Avisos] Modalidades do aluno (direto + matrículas):', modalidadesDoAluno);

    // Pegar data de hoje no formato correto para comparação
    const hoje = new Date().toISOString().split('T')[0];
    
    console.log('[API Aluno Avisos] Data de hoje:', hoje);
    
    // Buscar avisos ativos
    // Primeiro buscar todos os avisos ativos, depois filtrar
    const todosAvisos = await Aviso.find({ ativo: true })
      .populate('modalidadesAfetadas', 'nome cor')
      .sort({ tipo: -1, dataInicio: -1 })
      .lean();
    
    console.log('[API Aluno Avisos] Total de avisos ativos:', todosAvisos.length);
    if (todosAvisos.length > 0) {
      console.log('[API Aluno Avisos] Avisos encontrados:', todosAvisos.map((a: any) => ({
        titulo: a.titulo,
        dataInicio: a.dataInicio,
        dataFim: a.dataFim,
        modalidadesAfetadas: a.modalidadesAfetadas?.map((m: any) => m._id?.toString() || m.toString())
      })));
    }
    
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
      
      const valido = dataInicio <= hoje && dataFim >= hoje;
      console.log('[API Aluno Avisos] Aviso:', aviso.titulo, '| Período:', dataInicio, '-', dataFim, '| Hoje:', hoje, '| Válido:', valido);
      return valido;
    });
    
    console.log('[API Aluno Avisos] Avisos no período:', avisosNoPeriodo.length);
    
    // Filtrar avisos que afetam a modalidade do aluno
    const avisosFiltrados = avisosNoPeriodo.filter((aviso: any) => {
      // Se não tem modalidades afetadas ou array vazio, afeta TODOS os alunos
      if (!aviso.modalidadesAfetadas || aviso.modalidadesAfetadas.length === 0) {
        console.log('[API Aluno Avisos] Aviso afeta TODAS modalidades:', aviso.titulo);
        return true;
      }
      
      // Se o aluno não tem nenhuma modalidade (nem direta nem via matrícula)
      if (modalidadesDoAluno.length === 0) {
        console.log('[API Aluno Avisos] Aluno sem modalidades, não mostra avisos específicos. Aviso:', aviso.titulo);
        return false;
      }
      
      // Verificar se alguma modalidade do aluno está nas afetadas
      const modalidadesAfetadasIds = aviso.modalidadesAfetadas.map((m: any) => 
        (m._id || m).toString()
      );
      const afetaAluno = modalidadesDoAluno.some(modId => modalidadesAfetadasIds.includes(modId));
      
      console.log('[API Aluno Avisos] Aviso:', aviso.titulo, 
        '| Modalidades do aluno:', modalidadesDoAluno,
        '| Modalidades afetadas:', modalidadesAfetadasIds, 
        '| Afeta aluno:', afetaAluno);
      
      return afetaAluno;
    });
    
    console.log('[API Aluno Avisos] Avisos filtrados para o aluno:', avisosFiltrados.length);
    
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
