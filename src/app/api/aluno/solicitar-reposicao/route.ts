import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Matricula } from '@/models/Matricula';
import { AvisoAusencia } from '@/models/AvisoAusencia';
import { JWT_SECRET } from '@/lib/auth';
import mongoose from 'mongoose';

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

// POST - Solicitar reposição de aula
export async function POST(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken();
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const body = await req.json();
    const { faltaId, tipoFalta, novoHorarioFixoId, novaData, horarioFixoOriginalId, dataOriginalFalta } = body;
    
    // Validações
    if (!faltaId || !novoHorarioFixoId || !novaData) {
      return NextResponse.json(
        { success: false, error: 'Falta, novo horário e nova data são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Verificar se a nova data é futura
    const novaDataDate = new Date(novaData + 'T12:00:00');
    const hoje = new Date();
    const agora = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (novaDataDate < hoje) {
      return NextResponse.json(
        { success: false, error: 'A data da reposição deve ser futura' },
        { status: 400 }
      );
    }
    
    // Buscar o novo horário
    const novoHorario = await HorarioFixo.findById(novoHorarioFixoId)
      .populate('modalidadeId', 'nome cor')
      .populate('professorId', 'nome');
    
    if (!novoHorario) {
      return NextResponse.json(
        { success: false, error: 'Novo horário não encontrado' },
        { status: 404 }
      );
    }
    
    // Se a reposição é para hoje, verificar se o horário da aula ainda não passou
    const novaDataNormalizada = new Date(novaData + 'T00:00:00');
    novaDataNormalizada.setHours(0, 0, 0, 0);
    
    if (novaDataNormalizada.getTime() === hoje.getTime()) {
      const [horaAula, minutoAula] = novoHorario.horarioInicio.split(':').map(Number);
      const dataHoraAula = new Date();
      dataHoraAula.setHours(horaAula, minutoAula, 0, 0);
      
      // Exigir pelo menos 15 minutos de antecedência
      const diffMs = dataHoraAula.getTime() - agora.getTime();
      const diffMinutos = Math.floor(diffMs / (1000 * 60));
      
      if (diffMinutos < 15) {
        const mensagem = diffMinutos < 0 
          ? 'Esta aula já começou. Escolha outro horário.'
          : `Faltam apenas ${diffMinutos} minutos para a aula. É necessário no mínimo 15 minutos de antecedência.`;
        return NextResponse.json(
          { success: false, error: mensagem },
          { status: 400 }
        );
      }
    }
    
    if (!novoHorario) {
      return NextResponse.json(
        { success: false, error: 'Novo horário não encontrado' },
        { status: 404 }
      );
    }
    
    // Verificar se o dia da semana corresponde
    const diaSemanaNovaData = novaDataDate.getDay();
    if (novoHorario.diaSemana !== diaSemanaNovaData) {
      return NextResponse.json(
        { success: false, error: 'A data selecionada não corresponde ao dia da semana do horário' },
        { status: 400 }
      );
    }
    
    let horarioFixoOriginal = null;
    let dataOriginal = null;
    let motivoReposicao = '';
    let aulaRealizadaId = null;
    
    // Processar de acordo com o tipo de falta
    if (tipoFalta === 'aviso_ausencia') {
      // Buscar o aviso de ausência
      const avisoAusencia = await AvisoAusencia.findOne({
        _id: faltaId,
        alunoId: aluno.id,
        status: 'confirmada',
        temDireitoReposicao: true,
        reposicoesUsadas: 0
      }).populate('horarioFixoId');
      
      if (!avisoAusencia) {
        return NextResponse.json(
          { success: false, error: 'Aviso de ausência não encontrado ou sem direito a reposição' },
          { status: 404 }
        );
      }
      
      horarioFixoOriginal = avisoAusencia.horarioFixoId;
      dataOriginal = avisoAusencia.dataAusencia;
      motivoReposicao = `[Reposição - Avisou com antecedência] Falta do dia ${new Date(avisoAusencia.dataAusencia).toLocaleDateString('pt-BR')}. Motivo: ${avisoAusencia.motivo}`;
      
      // Buscar a AulaRealizada correspondente para vincular
      const AulaRealizada = mongoose.models.AulaRealizada || mongoose.model('AulaRealizada', new mongoose.Schema({}, { strict: false }));
      const dataAusenciaNormalizada = new Date(avisoAusencia.dataAusencia);
      dataAusenciaNormalizada.setHours(0, 0, 0, 0);
      const dataStr = dataAusenciaNormalizada.toISOString().split('T')[0];
      
      const aulaRealizada = await AulaRealizada.findOne({
        horarioFixoId: horarioFixoOriginal._id,
        data: { $gte: dataStr, $lt: new Date(dataAusenciaNormalizada.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
        'alunos.alunoId': new mongoose.Types.ObjectId(aluno.id),
        status: { $in: ['enviada', 'corrigida'] }
      });
      
      if (aulaRealizada) {
        aulaRealizadaId = aulaRealizada._id;
      }
      
    } else if (tipoFalta === 'falta_registrada') {
      // Falta registrada pelo professor na AulaRealizada
      const AulaRealizada = mongoose.models.AulaRealizada || mongoose.model('AulaRealizada', new mongoose.Schema({}, { strict: false }));
      
      const aulaComFalta = await AulaRealizada.findOne({
        _id: faltaId,
        'alunos.alunoId': new mongoose.Types.ObjectId(aluno.id),
        'alunos.presente': false,
        status: { $in: ['enviada', 'corrigida'] }
      }).populate('horarioFixoId');
      
      if (!aulaComFalta) {
        return NextResponse.json(
          { success: false, error: 'Falta não encontrada ou aula ainda não foi enviada pelo professor' },
          { status: 404 }
        );
      }
      
      horarioFixoOriginal = aulaComFalta.horarioFixoId;
      dataOriginal = aulaComFalta.data;
      motivoReposicao = `[Reposição - Falta registrada] Falta do dia ${new Date(aulaComFalta.data).toLocaleDateString('pt-BR')}. Professor confirmou a ausência.`;
      aulaRealizadaId = aulaComFalta._id;
      
    } else {
      // Fallback para compatibilidade - tenta buscar como aviso de ausência
      const avisoAusencia = await AvisoAusencia.findOne({
        _id: faltaId,
        alunoId: aluno.id,
        status: 'confirmada',
        temDireitoReposicao: true,
        reposicoesUsadas: 0
      }).populate('horarioFixoId');
      
      if (avisoAusencia) {
        horarioFixoOriginal = avisoAusencia.horarioFixoId;
        dataOriginal = avisoAusencia.dataAusencia;
        motivoReposicao = `[Reposição] Falta do dia ${new Date(avisoAusencia.dataAusencia).toLocaleDateString('pt-BR')}`;
      } else {
        return NextResponse.json(
          { success: false, error: 'Falta não encontrada' },
          { status: 404 }
        );
      }
    }
    
    // Verificar se já existe solicitação pendente para esta falta
    const solicitacaoExistente = await Reagendamento.findOne({
      alunoId: aluno.id,
      isReposicao: true,
      status: 'pendente',
      motivo: { $regex: faltaId }
    });
    
    if (solicitacaoExistente) {
      return NextResponse.json(
        { success: false, error: 'Já existe uma solicitação de reposição pendente para esta falta' },
        { status: 400 }
      );
    }
    
    // Buscar matrícula do aluno
    const matricula = await Matricula.findOne({
      alunoId: aluno.id,
      horarioFixoId: horarioFixoOriginal?._id,
      ativo: true
    });
    
    // Criar solicitação de reposição
    const reposicao = new Reagendamento({
      horarioFixoId: horarioFixoOriginal?._id,
      dataOriginal: dataOriginal,
      novaData: novaDataDate,
      novoHorarioInicio: novoHorario.horarioInicio,
      novoHorarioFim: novoHorario.horarioFim,
      novoHorarioFixoId: novoHorarioFixoId,
      matriculaId: matricula?._id,
      alunoId: aluno.id,
      professorOrigemId: horarioFixoOriginal?.professorId || null,
      motivo: `${motivoReposicao} [ID: ${faltaId}]`,
      status: 'pendente',
      isReposicao: true,
      solicitadoPor: 'aluno',
      aulaRealizadaId: aulaRealizadaId // Vincular com a aula que teve a falta
    });
    
    await reposicao.save();
    
    return NextResponse.json({
      success: true,
      message: 'Solicitação de reposição enviada! Aguarde a aprovação da administração.',
      reposicao
    });
    
  } catch (error) {
    console.error('[API Solicitar Reposição] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao solicitar reposição' },
      { status: 500 }
    );
  }
}
