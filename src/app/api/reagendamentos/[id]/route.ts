import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Matricula } from '@/models/Matricula';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// PUT - Atualizar status do reagendamento (aprovar/rejeitar)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validações
    if (!status || !['aprovado', 'rejeitado'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Status inválido'
        },
        { status: 400 }
      );
    }

    // Load reagendamento first; we'll only set status after we handle attachments
    const reagendamento = await Reagendamento.findById(id).populate({
      path: 'horarioFixoId',
      populate: [
        { path: 'alunoId', select: 'nome email' },
        { path: 'professorId', select: 'nome especialidade' }
      ]
    });

    // also populate professorOrigemId for logging
    await reagendamento?.populate({ path: 'professorOrigemId', select: 'nome' });

    if (!reagendamento) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reagendamento não encontrado'
        },
        { status: 404 }
      );
    }

    // If approved, attach the aluno to an existing HorarioFixo only (no creation allowed)
    if (status === 'aprovado') {
      // Log approval attempt to file for reproduction debugging
      try {
        const logDir = path.resolve(process.cwd(), 'logs');
        try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir); } catch(e) {}
        const logfile = path.join(logDir, 'debug-reagendamentos.log');
        const bodyForLog = { ts: new Date().toISOString(), route: `PUT /api/reagendamentos/${id}`, body };
        fs.appendFileSync(logfile, JSON.stringify(bodyForLog) + '\n');
        console.warn('[DEBUG REAG] PUT approval logged to', logfile, 'body:', body);
        console.warn(new Error('STACK TRACE FOR PUT /api/reagendamentos').stack);
      } catch (lgErr:any) {
        console.warn('Failed to append debug log for PUT /api/reagendamentos', String(lgErr?.message || lgErr));
      }
      
    
      // Use a Mongoose transaction to avoid intermediate inconsistent state
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // prefer explicit target id from the reagendamento
          const novoHorarioFixoId = (reagendamento as any).novoHorarioFixoId || null;

          // determine alunoId:
          // prefer explicit reagendamento.alunoId, then origemMatriculaId -> matricula.alunoId, then fallback to horarioFixoId.alunoId
          let alunoId: any = (reagendamento as any).alunoId || null;
          if (!alunoId && (reagendamento as any).origemMatriculaId) {
            const mat: any = await Matricula.findById(String((reagendamento as any).origemMatriculaId)).select('alunoId').session(session).lean();
            if (mat && mat.alunoId) alunoId = mat.alunoId;
          }
          if (!alunoId) {
            const rawOrigin = (reagendamento as any).horarioFixoId;
            alunoId = rawOrigin && (rawOrigin.alunoId && (rawOrigin.alunoId._id || rawOrigin.alunoId) || rawOrigin.alunoId) || null;
          }

          // check request flag to decide whether we may create a HorarioFixo template if none exists
          const promoverParaMatricula = Boolean(body?.promoverParaMatricula);

          if (!alunoId) {
            throw new Error('ALUNO_ORIGEM_NAO_DETERMINADO');
          }

          // determine day-of-week from novaData
          const novaData = (reagendamento as any).novaData;
          if (!novaData) throw new Error('NOVA_DATA_INDEFINIDA');
          const dt = new Date(novaData);
          if (isNaN(dt.getTime())) throw new Error('NOVA_DATA_INVALIDA');

          // Usar sempre novoHorarioFixoId como destino
          if (!novoHorarioFixoId) throw new Error('NO_TARGET_FOUND');
          const target = await HorarioFixo.findById(novoHorarioFixoId).session(session);
          if (!target) throw new Error('NO_TARGET_FOUND');

          // Desativar matricula antiga do aluno na turma de origem
          const originId = (reagendamento as any).horarioFixoId && ((reagendamento as any).horarioFixoId._id || (reagendamento as any).horarioFixoId) || null;
          // Prefer to deactivate a specific origemMatriculaId if provided
          if ((reagendamento as any).origemMatriculaId) {
            await Matricula.updateOne({ _id: String((reagendamento as any).origemMatriculaId), ativo: true }, { $set: { ativo: false } }).session(session);
          } else if (originId && alunoId) {
            await Matricula.updateMany({ horarioFixoId: originId, alunoId: alunoId, ativo: true }, { $set: { ativo: false } }).session(session);
          }

          // Criar nova matricula para o aluno na turma destino
          const novaMat = new Matricula({ horarioFixoId: target._id, alunoId: alunoId, ativo: true });
          await novaMat.save({ session });

          // For backwards compatibility with components that still read HorarioFixo.alunoId,
          // we keep the field in sync when there's a single matricula for the horario.
          // Não sincronizar alunoId em HorarioFixo. Apenas criar Matricula.

          // update reagendamento status within the transaction
          reagendamento.status = 'aprovado';
          await reagendamento.save({ session });
        });
        // After transaction: log origin vs destination professor if available
        try {
          const origemProf = reagendamento.professorOrigemId && (reagendamento.professorOrigemId as any)._id ? String((reagendamento.professorOrigemId as any)._id) : String(reagendamento.professorOrigemId || '');
          let destinoProf = '';
          if (reagendamento.novoHorarioFixoId) {
            const target = await HorarioFixo.findById(String(reagendamento.novoHorarioFixoId)).select('professorId').lean();
            const tAny: any = target;
            destinoProf = (tAny && tAny.professorId ? String(tAny.professorId) : '') || '';
          } else if ((reagendamento as any).novoHorarioProfessorId) {
            destinoProf = String((reagendamento as any).novoHorarioProfessorId);
          }
          if (origemProf && destinoProf && origemProf !== destinoProf) {
            console.warn('Reagendamento aprovado movendo aluno entre professores diferentes', { reagendamentoId: String(reagendamento._id), origemProf, destinoProf });
            const logDir = path.resolve(process.cwd(), 'logs');
            try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir); } catch(e) {}
            const logfile = path.join(logDir, 'debug-reagendamentos.log');
            fs.appendFileSync(logfile, JSON.stringify({ ts: new Date().toISOString(), event: 'aprovado_diferente_professor', reagendamentoId: String(reagendamento._id), origemProf, destinoProf }) + '\n');
          }
        } catch (logErr:any) {
          console.warn('Erro ao logar comparacao professorOrigem/destino:', String(logErr?.message || logErr));
        }
      } catch (err: any) {
        console.error('Erro ao anexar aluno ao horario alvo após aprovacao (transaction):', err && err.message ? err.message : err);
        if (String(err) === 'Error: ALUNO_ORIGEM_NAO_DETERMINADO' || String(err) === 'Error: NOVA_DATA_INDEFINIDA' || String(err) === 'Error: NOVA_DATA_INVALIDA') {
          return NextResponse.json({ success: false, error: 'Dados inválidos no reagendamento' }, { status: 400 });
        }
        if (String(err) === 'Error: NO_EMPTY_TARGET_FOUND') {
          return NextResponse.json({ success: false, error: 'Não é permitido criar nova turma ao aprovar reagendamento. Não foi encontrado um HorarioFixo destino vazio para anexar.' }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: 'Erro interno ao anexar aluno ao horario destino' }, { status: 500 });
      } finally {
        session.endSession();
      }
    } else {
      // For 'rejeitado' we still update status
      reagendamento.status = status as any;
      await reagendamento.save();
    }

    return NextResponse.json({
      success: true,
      data: reagendamento,
      message: `Reagendamento ${status} com sucesso`
    });
  } catch (error) {
    console.error('Erro ao atualizar reagendamento:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}