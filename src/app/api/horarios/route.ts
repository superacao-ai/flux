import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';

// GET - Listar todos os horários
export async function GET() {
  try {
    await connectDB();
    
    const horarios = await HorarioFixo.find({ ativo: true })
      .populate({
        path: 'alunoId',
        select: 'nome email modalidadeId',
        populate: {
          path: 'modalidadeId',
          select: 'nome cor',
          options: { strictPopulate: false }
        },
        options: { strictPopulate: false }
      })
      .populate('professorId', 'nome especialidade')
      .sort({ diaSemana: 1, horarioInicio: 1 })
      .select('-__v');
    
    return NextResponse.json({
      success: true,
      data: horarios
    });
  } catch (error) {
    console.error('Erro ao buscar horários:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// POST - Criar novo horário
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { alunoId, professorId, diaSemana, horarioInicio, horarioFim, observacoes } = body;

    console.log('📍 Dados recebidos para criar horário:', {
      alunoId,
      professorId,
      diaSemana,
      horarioInicio,
      horarioFim,
      observacoes
    });

    // Validações básicas
    if (!alunoId || !professorId || diaSemana === undefined || !horarioInicio || !horarioFim) {
      console.log('❌ Validação falhou - campos obrigatórios:', {
        alunoId: !!alunoId,
        professorId: !!professorId,
        diaSemana: diaSemana !== undefined,
        horarioInicio: !!horarioInicio,
        horarioFim: !!horarioFim
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Todos os campos obrigatórios devem ser preenchidos'
        },
        { status: 400 }
      );
    }

    // Verificar conflito de horário do ALUNO (um aluno não pode ter dois horários no mesmo momento)
    const conflitoAluno = await HorarioFixo.findOne({
      alunoId,
      diaSemana,
      ativo: true,
      $or: [
        {
          $and: [
            { horarioInicio: { $lte: horarioInicio } },
            { horarioFim: { $gt: horarioInicio } }
          ]
        },
        {
          $and: [
            { horarioInicio: { $lt: horarioFim } },
            { horarioFim: { $gte: horarioFim } }
          ]
        }
      ]
    });

    if (conflitoAluno) {
      return NextResponse.json(
        {
          success: false,
          error: 'Aluno já tem aula agendada neste horário'
        },
        { status: 400 }
      );
    }

    // Verificar se já existe exatamente o mesmo registro (mesmo aluno, professor e horário)
    const duplicataExata = await HorarioFixo.findOne({
      alunoId,
      professorId,
      diaSemana,
      horarioInicio,
      horarioFim,
      ativo: true
    });

    if (duplicataExata) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este aluno já está cadastrado neste horário com este professor'
        },
        { status: 400 }
      );
    }

    // Múltiplos alunos podem ter o mesmo horário com o mesmo professor (conceito de turma)
    // Não verificamos mais conflito de professor no mesmo horário

    // Criar horário
    const novoHorario = new HorarioFixo({
      alunoId,
      professorId,
      diaSemana,
      horarioInicio,
      horarioFim,
      observacoes
    });

    const horarioSalvo = await novoHorario.save();
    
    // Buscar com populate para retornar dados completos
    const horarioCompleto = await HorarioFixo.findById(horarioSalvo._id)
      .populate('alunoId', 'nome email')
      .populate('professorId', 'nome especialidade')
      .select('-__v');

    return NextResponse.json(
      {
        success: true,
        data: horarioCompleto,
        message: 'Horário criado com sucesso'
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('🔥 Erro detalhado ao criar horário:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      errors: error.errors
    });
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        {
          success: false,
          error: messages.join(', ')
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: `Erro interno do servidor: ${error.message}`
      },
      { status: 500 }
    );
  }
}