import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import CreditoReposicao from '@/models/CreditoReposicao';
import UsoCredito from '@/models/UsoCredito';
import { HorarioFixo } from '@/models/HorarioFixo';
import { JWT_SECRET } from '@/lib/auth';

async function getAlunoFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('alunoToken')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; nome: string; tipo: string };
    
    if (decoded.tipo !== 'aluno') return null;
    
    return decoded.id;
  } catch {
    return null;
  }
}

// GET - Buscar créditos do aluno logado
export async function GET() {
  try {
    const alunoId = await getAlunoFromToken();
    
    if (!alunoId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Buscar créditos do aluno
    const creditos = await CreditoReposicao.find({
      alunoId,
      ativo: true
    })
    .sort({ criadoEm: -1 })
    .lean();
    
    // Buscar usos de cada crédito
    const creditosComUsos = await Promise.all(
      creditos.map(async (credito) => {
        const usos = await UsoCredito.find({ creditoId: credito._id })
          .sort({ dataUso: -1 })
          .lean();
        
        // Para cada uso, buscar informações do horário
        const usosComHorario = await Promise.all(
          usos.map(async (uso: any) => {
            let horarioInfo = null;
            if (uso.agendamentoId) {
              const horario = await HorarioFixo.findById(uso.agendamentoId)
                .populate('modalidadeId', 'nome cor')
                .populate('professorId', 'nome')
                .lean();
              if (horario) {
                horarioInfo = {
                  horarioInicio: (horario as any).horarioInicio,
                  modalidadeId: (horario as any).modalidadeId,
                  professorId: (horario as any).professorId
                };
              }
            }
            return {
              ...uso,
              agendamentoId: horarioInfo
            };
          })
        );
        
        return {
          ...credito,
          usos: usosComHorario
        };
      })
    );
    
    // Calcular totais
    const totalCreditos = creditos.reduce((sum, c) => sum + c.quantidade, 0);
    const totalUsados = creditos.reduce((sum, c) => sum + c.quantidadeUsada, 0);
    const totalDisponiveis = totalCreditos - totalUsados;
    
    return NextResponse.json({
      creditos: creditosComUsos,
      resumo: {
        total: totalCreditos,
        usados: totalUsados,
        disponiveis: totalDisponiveis
      }
    });
    
  } catch (error) {
    console.error('[API Aluno Créditos GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar créditos' },
      { status: 500 }
    );
  }
}
