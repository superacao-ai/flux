import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import CreditoReposicao from '@/models/CreditoReposicao';
import UsoCredito from '@/models/UsoCredito';
import { HorarioFixo } from '@/models/HorarioFixo';
import { JWT_SECRET } from '@/lib/auth';

async function isAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) return false;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; id?: string; tipo: string };
    const tipoLower = decoded.tipo?.toLowerCase() || '';
    return tipoLower === 'adm' || tipoLower === 'professor' || tipoLower === 'root' || tipoLower === 'admin';
  } catch (error) {
    return false;
  }
}

// DELETE - Cancelar uso de crédito
export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await connectDB();

    const searchParams = req.nextUrl.searchParams;
    const usoId = searchParams.get('usoId');

    if (!usoId) {
      return NextResponse.json(
        { error: 'ID do uso é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar o uso
    const uso = await UsoCredito.findById(usoId);
    if (!uso) {
      return NextResponse.json(
        { error: 'Uso não encontrado' },
        { status: 404 }
      );
    }

    // Decrementar quantidade usada do crédito
    await CreditoReposicao.findByIdAndUpdate(uso.creditoId, {
      $inc: { quantidadeUsada: -1 }
    });

    // Remover o uso
    await UsoCredito.findByIdAndDelete(usoId);

    return NextResponse.json({
      success: true,
      message: 'Uso de crédito cancelado com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao cancelar uso de crédito:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar uso de crédito' },
      { status: 500 }
    );
  }
}

// POST - Usar crédito para agendar aula
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const { creditoId, alunoId, horarioDestinoId, dataAula, observacao } = body;

    // Validações
    if (!creditoId || !alunoId || !horarioDestinoId || !dataAula) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    // Buscar o crédito
    const credito = await CreditoReposicao.findById(creditoId);
    
    if (!credito) {
      return NextResponse.json(
        { error: 'Crédito não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se tem créditos disponíveis
    const creditosDisponiveis = credito.quantidade - credito.quantidadeUsada;
    if (creditosDisponiveis <= 0) {
      return NextResponse.json(
        { error: 'Não há créditos disponíveis' },
        { status: 400 }
      );
    }

    // Verificar se o crédito está válido
    if (new Date(credito.validade) <= new Date()) {
      return NextResponse.json(
        { error: 'Crédito expirado' },
        { status: 400 }
      );
    }

    // Verificar se a data da aula está dentro da validade
    // Criar data local corretamente para evitar problemas de fuso horário
    const [ano, mes, dia] = dataAula.split('-').map(Number);
    const dataAulaDate = new Date(ano, mes - 1, dia);
    
    const validadeDate = new Date(credito.validade);
    validadeDate.setHours(23, 59, 59, 999);
    
    if (dataAulaDate > validadeDate) {
      return NextResponse.json(
        { error: 'Data da aula excede a validade do crédito' },
        { status: 400 }
      );
    }

    // Buscar o horário destino
    const horarioDestino = await HorarioFixo.findById(horarioDestinoId);
    if (!horarioDestino) {
      return NextResponse.json(
        { error: 'Horário destino não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se a data corresponde ao dia da semana do horário
    // getDay() retorna 0-6 (Dom-Sáb)
    const diaSemanaData = dataAulaDate.getDay();
    const diaSemanaHorario = typeof horarioDestino.diaSemana === 'number' 
      ? horarioDestino.diaSemana 
      : parseInt(String(horarioDestino.diaSemana), 10);
    
    if (diaSemanaData !== diaSemanaHorario) {
      console.log(`Dia semana data: ${diaSemanaData}, Dia semana horário: ${diaSemanaHorario}, dataAula: ${dataAula}`);
      return NextResponse.json(
        { error: 'A data selecionada não corresponde ao dia da semana do horário escolhido' },
        { status: 400 }
      );
    }

    // Registrar uso do crédito (aula extra neste horário)
    await UsoCredito.create({
      creditoId,
      alunoId,
      agendamentoId: horarioDestinoId,
      tipoAgendamento: 'aula',
      dataUso: dataAulaDate,
      observacao: observacao || `Aula extra usando crédito - ${dataAula}`
    });

    // Incrementar quantidade usada do crédito
    credito.quantidadeUsada += 1;
    await credito.save();

    // Retornar informações
    return NextResponse.json({
      success: true,
      message: 'Crédito usado com sucesso! Aula agendada.',
      horario: {
        _id: horarioDestino._id,
        diaSemana: horarioDestino.diaSemana,
        horario: horarioDestino.horarioInicio,
        data: dataAula
      },
      credito: {
        _id: credito._id,
        quantidadeUsada: credito.quantidadeUsada,
        quantidadeRestante: credito.quantidade - credito.quantidadeUsada
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao usar crédito:', error);
    return NextResponse.json(
      { error: 'Erro ao usar crédito' },
      { status: 500 }
    );
  }
}
