import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { Matricula } from '@/models/Matricula';
import Presenca from '@/models/Presenca';
import { Reagendamento } from '@/models/Reagendamento';
import { HorarioFixo } from '@/models/HorarioFixo';
import { User } from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_forte';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    
    const { id } = await params;

    // Auth
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }
    const token = auth.split(' ')[1];
    let payload: any;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (e) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }
    if (!payload || !payload.userId) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });

    const user = await User.findById(payload.userId);
    if (!user || user.role !== 'ADM') return NextResponse.json({ success: false, error: 'Apenas administradores podem usar vales' }, { status: 403 });

    if (!id || !mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });

    const body = await request.json();
    const { origemData, origemHorarioFixoId, novoHorarioFixoId, novaData, observacoes } = body || {};
    if (!origemData || !origemHorarioFixoId || !novoHorarioFixoId || !novaData) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios: origemData, origemHorarioFixoId, novoHorarioFixoId, novaData' }, { status: 400 });
    }

    // Validate matricula
    const matricula = await Matricula.findById(id);
    if (!matricula) return NextResponse.json({ success: false, error: 'Matrícula não encontrada' }, { status: 404 });
    if (!matricula.ativo) return NextResponse.json({ success: false, error: 'Matrícula inativa' }, { status: 400 });

    if ((matricula.reposicoesDisponiveis || 0) <= 0) return NextResponse.json({ success: false, error: 'Sem vales disponíveis para esta matrícula' }, { status: 400 });

    // Validate origem presenca (must be a recorded falta)
    const origemDate = new Date(origemData);
    origemDate.setHours(0,0,0,0);
    const presenca = await Presenca.findOne({ alunoId: matricula.alunoId, horarioFixoId: origemHorarioFixoId, data: origemDate });
    if (!presenca || presenca.presente !== false) return NextResponse.json({ success: false, error: 'Falta (presença=false) não encontrada para a origem indicada' }, { status: 400 });
    if ((presenca as any).compensadaPor) return NextResponse.json({ success: false, error: 'Esta falta já foi compensada' }, { status: 409 });

    // Validate target horario
    const horarioDestino = await HorarioFixo.findById(novoHorarioFixoId);
    if (!horarioDestino || horarioDestino.ativo === false) return NextResponse.json({ success: false, error: 'Horário destino inválido ou inativo' }, { status: 400 });

    // Check conflict: optionally ensure student isn't already enrolled same day/time (basic check)
    // For simplicity, we won't block here but you can add checks as business rules.

    // Create reagendamento + decrement matricula atomically
    const session = await mongoose.startSession();
    let created: any = null;
    try {
      await session.withTransaction(async () => {
        const novoReag = await Reagendamento.create([{
          horarioFixoId: origemHorarioFixoId,
          dataOriginal: origemDate,
          novaData: new Date(novaData),
          novoHorarioInicio: horarioDestino.horarioInicio || horarioDestino.horario || '00:00',
          novoHorarioFim: horarioDestino.horarioFim || horarioDestino.horario || '00:00',
          novoHorarioFixoId: horarioDestino._id,
          matriculaId: matricula._id,
          professorOrigemId: horarioDestino.professorId || null,
          motivo: observacoes || 'Reposição usada por admin',
          status: 'aprovado',
          isReposicao: true,
          aprovadoPor: user._id
        }], { session });

        created = novoReag[0];

        // decrement saldo
        await Matricula.updateOne({ _id: matricula._id }, { $inc: { reposicoesDisponiveis: -1 }, $push: { reposicoesHistorico: { reagendamentoId: created._id, usadoEm: new Date(), usadoPor: user._id } } }, { session });

        // mark presenca as compensated
        presenca.compensadaPor = created._id;
        await presenca.save({ session });
      });
    } finally {
      session.endSession();
    }

    return NextResponse.json({ success: true, message: 'Reposição criada com sucesso', reagendamento: created });
  } catch (error: any) {
    console.error('Erro em POST /api/admin/matriculas/:id/reposicao', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor', details: error.message }, { status: 500 });
  }
}
