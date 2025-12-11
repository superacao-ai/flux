import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { AvisoAusencia } from '@/models/AvisoAusencia';
import { JWT_SECRET } from '@/lib/auth';

// GET - Buscar avisos de ausência para uma data específica
export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Token não fornecido' }, { status: 401 });
    }
    const token = auth.split(' ')[1];

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    if (!payload || !payload.userId) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data');

    if (!data) {
      return NextResponse.json({ success: false, error: 'Data é obrigatória' }, { status: 400 });
    }

    // Buscar avisos de ausência para a data especificada
    // Incluir tanto pendentes quanto confirmados
    const dataInicio = new Date(data + 'T00:00:00.000Z');
    const dataFim = new Date(data + 'T23:59:59.999Z');

    const avisos = await AvisoAusencia.find({
      dataAusencia: { $gte: dataInicio, $lte: dataFim },
      status: { $in: ['pendente', 'confirmada'] }
    })
      .populate({
        path: 'alunoId',
        select: 'nome email telefone'
      })
      .populate({
        path: 'horarioFixoId',
        select: '_id diaSemana horarioInicio horarioFim'
      })
      .lean();

    // Criar um mapa de alunoId + horarioFixoId para fácil lookup
    const avisosMap: Record<string, { 
      alunoId: string; 
      horarioFixoId: string; 
      motivo: string; 
      status: string;
      temDireitoReposicao: boolean;
    }> = {};

    avisos.forEach((aviso: any) => {
      const key = `${aviso.alunoId?._id || aviso.alunoId}_${aviso.horarioFixoId?._id || aviso.horarioFixoId}`;
      avisosMap[key] = {
        alunoId: String(aviso.alunoId?._id || aviso.alunoId),
        horarioFixoId: String(aviso.horarioFixoId?._id || aviso.horarioFixoId),
        motivo: aviso.motivo,
        status: aviso.status,
        temDireitoReposicao: aviso.temDireitoReposicao
      };
    });

    return NextResponse.json({ 
      success: true, 
      data: avisos,
      avisosMap 
    });
  } catch (error) {
    console.error('Erro em /api/avisos-ausencia:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
