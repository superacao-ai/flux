import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';
import { HorarioFixo } from '@/models/HorarioFixo';
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
    if (!status || !['aprovado', 'rejeitado', 'pendente'].includes(status)) {
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
        { path: 'professorId', model: 'User', select: 'nome especialidade' }
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

  // If approved, we treat this as a TEMPORARY move: validate the destination
  // but do NOT create/deactivate Matricula documents. Only mark reagendamento aprovado.
  if (status === 'aprovado') {
      // Log approval attempt to file for reproduction debugging
      try {
        const logDir = path.resolve(process.cwd(), 'logs');
        try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir); } catch(e) {}
        const logfile = path.join(logDir, 'debug-reagendamentos.log');
        const bodyForLog = { ts: new Date().toISOString(), route: `PUT /api/reagendamentos/${id}`, body };
        fs.appendFileSync(logfile, JSON.stringify(bodyForLog) + '\n');
  console.warn('[DEBUG REAG] PUT approval logged to', logfile, 'body:', body);
      } catch (lgErr:any) {
        console.warn('Failed to append debug log for PUT /api/reagendamentos', String(lgErr?.message || lgErr));
      }
      
    
      try {
        // prefer explicit target id from the reagendamento
        const novoHorarioFixoId = (reagendamento as any).novoHorarioFixoId || null;

        // determine day-of-week from novaData
        const novaData = (reagendamento as any).novaData;
        if (!novaData) throw new Error('NOVA_DATA_INDEFINIDA');
        const dt = new Date(novaData);
        if (isNaN(dt.getTime())) throw new Error('NOVA_DATA_INVALIDA');

        // Resolve the target HorarioFixo. Prefer explicit novoHorarioFixoId but
        // if a desired professor was provided, ensure we locate a HorarioFixo
        // that belongs to that professor (same start/end/diaSemana). If mismatch,
        // try to locate an alternate HorarioFixo for the requested professor/time.
        let target: any = null;
        if (novoHorarioFixoId) {
          target = await HorarioFixo.findById(novoHorarioFixoId);
        }

        const requestedProf = (reagendamento as any).novoHorarioProfessorId || null;
        const slotStart = (reagendamento as any).novoHorarioInicio || null;
        const slotEnd = (reagendamento as any).novoHorarioFim || null;

        // Removido: validação de professor igual. Permitir reagendamento para qualquer turma ativa no horário/dia, independente do professor.

        if (!target) throw new Error('NO_TARGET_FOUND');

        // NOTA: Reagendamentos são temporários (para uma data específica)
        // O aluno permanece na turma de origem e a lógica de exibição no calendário
        // controla quando ele aparece cinza (origem) e quando aparece no destino
        reagendamento.status = 'aprovado';
        await reagendamento.save();

        // Log origin vs destination professor if available (informational)
        try {
          const origemProf = reagendamento.professorOrigemId && (reagendamento.professorOrigemId as any)._id ? String((reagendamento.professorOrigemId as any)._id) : String(reagendamento.professorOrigemId || '');
          let destinoProf = '';
          if (reagendamento.novoHorarioFixoId) {
            const t = await HorarioFixo.findById(String(reagendamento.novoHorarioFixoId)).select('professorId').lean();
            destinoProf = (t && (t as any).professorId) ? String((t as any).professorId) : '';
          } else if ((reagendamento as any).novoHorarioProfessorId) {
            destinoProf = String((reagendamento as any).novoHorarioProfessorId);
          }
          if (origemProf && destinoProf && origemProf !== destinoProf) {
            const logDir = path.resolve(process.cwd(), 'logs');
            try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir); } catch(e) {}
            const logfile = path.join(logDir, 'debug-reagendamentos.log');
            fs.appendFileSync(logfile, JSON.stringify({ ts: new Date().toISOString(), event: 'aprovado_diferente_professor', reagendamentoId: String(reagendamento._id), origemProf, destinoProf }) + '\n');
          }
        } catch (logErr:any) {
          console.warn('Erro ao logar comparacao professorOrigem/destino:', String(logErr?.message || logErr));
        }
      } catch (err: any) {
        console.error('Erro ao validar/aprovar reagendamento (temp-only):', err && err.message ? err.message : err);
        const s = String(err || '');
        if (s.includes('NOVA_DATA_INDEFINIDA') || s.includes('NOVA_DATA_INVALIDA')) {
          return NextResponse.json({ success: false, error: 'Dados inválidos no reagendamento' }, { status: 400 });
        }
        if (s.includes('NO_TARGET_FOUND')) {
          return NextResponse.json({ success: false, error: 'Não foi encontrado um HorarioFixo destino apropriado. Verifique professor/horário.' }, { status: 400 });
        }
        if (s.includes('TARGET_PROF_MISMATCH')) {
          return NextResponse.json({ success: false, error: 'O horário destino não pertence ao professor selecionado. Refaça a seleção.' }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: 'Erro interno ao aprovar reagendamento' }, { status: 500 });
      }
    } else if (status === 'pendente') {
      // Voltando para pendente (desaprovando)
      // Reagendamentos são temporários, não há matrícula para reverter
      reagendamento.status = 'pendente';
      reagendamento.aprovadoPor = undefined;
      await reagendamento.save();
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

// DELETE - Cancelar/excluir reagendamento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const reagendamento = await Reagendamento.findById(id);

    if (!reagendamento) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reagendamento não encontrado'
        },
        { status: 404 }
      );
    }

    // NOTA: Reagendamentos são temporários, não há matrícula para reverter
    // O aluno permanece na turma de origem

    // Excluir o reagendamento
    await Reagendamento.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Reagendamento cancelado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar reagendamento:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}