import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import AulaRealizada from '@/models/AulaRealizada';
import ReagendamentoRealizado from '@/models/ReagendamentoRealizado';
import mongoose from 'mongoose';

// GET /api/alunos/reposicoes?ids=<comma-separated-alunoIds>
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids') || '';
    const rawIds = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (rawIds.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    // Convert to ObjectId where possible, fallback to string
    const objectIds = rawIds.map(id => {
      try { return new mongoose.Types.ObjectId(id); } catch (e) { return id; }
    });

    // 1) Count faltas per aluno from AulaRealizada -> alunos array where presente === false
    const faltasAgg = await AulaRealizada.aggregate([
      { $unwind: '$alunos' },
      { $match: { 'alunos.alunoId': { $in: objectIds }, 'alunos.presente': false } },
      { $group: { _id: '$alunos.alunoId', faltas: { $sum: 1 } } }
    ]).allowDiskUse(true as any);

    const faltasMap: Record<string, number> = {};
    faltasAgg.forEach((r: any) => {
      const key = String(r._id);
      faltasMap[key] = r.faltas || 0;
    });

    // 2) Count reagendamentos realizados (consumidos) per aluno
    const reagsAgg = await ReagendamentoRealizado.aggregate([
      { $match: { alunoId: { $in: objectIds }, status: 'realizado' } },
      { $group: { _id: '$alunoId', realizados: { $sum: 1 } } }
    ]).allowDiskUse(true as any);

    const realizadosMap: Record<string, number> = {};
    reagsAgg.forEach((r: any) => {
      const key = String(r._id);
      realizadosMap[key] = r.realizados || 0;
    });

    // Build response mapping each requested id to saldo = faltas - realizados (min 0)
    const data: Record<string, { saldo: number }> = {};
    rawIds.forEach(id => {
      const key = id;
      const faltas = faltasMap[key] || 0;
      const realizados = realizadosMap[key] || 0;
      const saldo = Math.max(0, faltas - realizados);
      data[key] = { saldo };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao calcular reposições por aluno:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
