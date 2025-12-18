import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import Feriado from '@/models/Feriado';
import { Reagendamento } from '@/models/Reagendamento';
import UsoCredito from '@/models/UsoCredito';
import CreditoReposicao from '@/models/CreditoReposicao';
import { AvisoAusencia } from '@/models/AvisoAusencia';
import { JWT_SECRET } from '@/lib/auth';

// Helper para verificar token
function verifyAuth(request: NextRequest): { userId: string } | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload && payload.userId) {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}

// GET /api/feriados - Listar todos os feriados ou filtrar por período
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const inicio = searchParams.get('inicio');
    const fim = searchParams.get('fim');
    
    let query: any = {};
    
    // Filtrar por período se fornecido
    if (inicio && fim) {
      query.data = {
        $gte: new Date(inicio),
        $lte: new Date(fim)
      };
    } else if (inicio) {
      query.data = { $gte: new Date(inicio) };
    } else if (fim) {
      query.data = { $lte: new Date(fim) };
    }
    
    const feriados = await Feriado.find(query)
      .populate('criadoPor', 'nome')
      .sort({ data: 1 });
    
    return NextResponse.json({ success: true, data: feriados });
  } catch (error) {
    console.error('Erro ao buscar feriados:', error);
    return NextResponse.json({ success: false, error: 'Erro ao buscar feriados' }, { status: 500 });
  }
}

// POST /api/feriados - Criar um novo feriado
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    // Verificar autenticação
    const decoded = verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }
    
    const body = await request.json();
    const { data, motivo } = body;
    
    if (!data) {
      return NextResponse.json({ success: false, error: 'Data é obrigatória' }, { status: 400 });
    }
    
    // Normalizar a data para meia-noite UTC
    const dataFeriado = new Date(data);
    dataFeriado.setUTCHours(12, 0, 0, 0); // Meio-dia para evitar problemas de fuso
    
    // Calcular início e fim do dia para verificação
    const dataInicioVerificacao = new Date(dataFeriado.toISOString().split('T')[0]);
    const dataFimVerificacao = new Date(dataInicioVerificacao);
    dataFimVerificacao.setDate(dataFimVerificacao.getDate() + 1);
    
    // Verificar se já existe feriado PERSONALIZADO nessa data (permitir sobrescrever feriados nacionais)
    const existente = await Feriado.findOne({ 
      data: {
        $gte: dataInicioVerificacao,
        $lt: dataFimVerificacao
      }
    });
    
    if (existente) {
      return NextResponse.json({ success: false, error: 'Já existe um feriado personalizado cadastrado para esta data' }, { status: 400 });
    }
    
    // Criar o feriado
    const feriado = await Feriado.create({
      data: dataFeriado,
      motivo: motivo || '',
      criadoPor: decoded.userId
    });
    
    // === DESFAZER REAGENDAMENTOS E CRÉDITOS PARA ESTE DIA ===
    const dataInicio = new Date(dataFeriado.toISOString().split('T')[0]);
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + 1);
    
    // 1. Cancelar TODOS os reagendamentos que têm novaData neste dia (normais, reposições, etc)
    const reagendamentosCancelados = await Reagendamento.updateMany(
      {
        novaData: { $gte: dataInicio, $lt: dataFim },
        status: { $in: ['pendente', 'aprovado'] }
      },
      {
        $set: { 
          status: 'rejeitado',
          motivo: `${motivo || 'Sem expediente'} - Cancelado automaticamente por feriado`
        }
      }
    );
    
    // 2. Cancelar avisos de ausência para este dia (reverter para status 'pendente')
    const avisosCancelados = await AvisoAusencia.updateMany(
      {
        dataAusencia: { $gte: dataInicio, $lt: dataFim },
        status: { $in: ['confirmada', 'usada'] }
      },
      {
        $set: { 
          status: 'cancelada',
          reposicoesUsadas: 0
        }
      }
    );
    
    // 3. Reverter uso de créditos neste dia
    const usosCredito = await UsoCredito.find({
      dataUso: { $gte: dataInicio, $lt: dataFim }
    });
    
    // Para cada uso de crédito, decrementar o quantidadeUsada do crédito correspondente
    for (const uso of usosCredito) {
      await CreditoReposicao.findByIdAndUpdate(
        uso.creditoId,
        { $inc: { quantidadeUsada: -1 } }
      );
    }
    
    // Deletar os registros de uso de crédito
    const creditosRevertidos = await UsoCredito.deleteMany({
      dataUso: { $gte: dataInicio, $lt: dataFim }
    });
    
    console.log(`🗓️  Feriado criado: ${dataFeriado.toISOString().split('T')[0]}`);
    console.log(`   ↳ Reagendamentos cancelados: ${reagendamentosCancelados.modifiedCount}`);
    console.log(`   ↳ Avisos de ausência cancelados: ${avisosCancelados.modifiedCount}`);
    console.log(`   ↳ Créditos revertidos: ${creditosRevertidos.deletedCount}`);
    
    return NextResponse.json({ 
      success: true, 
      data: feriado,
      desfeitos: {
        reagendamentos: reagendamentosCancelados.modifiedCount,
        avisos: avisosCancelados.modifiedCount,
        creditos: creditosRevertidos.deletedCount
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar feriado:', error);
    return NextResponse.json({ success: false, error: 'Erro ao criar feriado' }, { status: 500 });
  }
}

// DELETE /api/feriados - Remover feriado por data
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    
    // Verificar autenticação
    const decoded = verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data');
    
    if (!data) {
      return NextResponse.json({ success: false, error: 'Data é obrigatória' }, { status: 400 });
    }
    
    const dataFeriado = new Date(data);
    const dataInicio = new Date(dataFeriado.toISOString().split('T')[0]);
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + 1);
    
    const result = await Feriado.findOneAndDelete({ 
      data: {
        $gte: dataInicio,
        $lt: dataFim
      }
    });
    
    if (!result) {
      return NextResponse.json({ success: false, error: 'Feriado não encontrado' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: 'Feriado removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover feriado:', error);
    return NextResponse.json({ success: false, error: 'Erro ao remover feriado' }, { status: 500 });
  }
}
