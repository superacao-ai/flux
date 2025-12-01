import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Matricula } from '@/models/Matricula';
import { HorarioFixo } from '@/models/HorarioFixo';
import mongoose from 'mongoose';

// GET - Verificar status das matrículas de um aluno inativo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;

    // Validar ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID inválido'
        },
        { status: 400 }
      );
    }

    const alunoObjectId = new mongoose.Types.ObjectId(id);

    // Buscar matrículas inativas do aluno
    const matriculas = await Matricula.find({ 
      alunoId: alunoObjectId,
      ativo: false 
    }).lean() as any[];

    const matriculasComStatus: any[] = [];

    for (const matricula of matriculas) {
      const horarioFixoId = matricula.horarioFixoId;
      
      if (!horarioFixoId) {
        matriculasComStatus.push({
          ...matricula,
          horarioInexistente: true,
          turmaLotada: false,
        });
        continue;
      }

      // Buscar o horário fixo
      const horario = await HorarioFixo.findById(horarioFixoId)
        .populate('modalidadeId')
        .lean() as any;

      if (!horario || horario.ativo === false) {
        matriculasComStatus.push({
          ...matricula,
          horarioInexistente: true,
          turmaLotada: false,
          diaSemana: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][matricula.diaSemana || 0],
          horarioInicio: matricula.horarioInicio || '?',
          horarioFim: matricula.horarioFim || '?',
        });
        continue;
      }

      // Contar quantos alunos ativos tem nesse horário
      const matriculasAtivas = await Matricula.countDocuments({
        horarioFixoId: horarioFixoId,
        ativo: true
      });

      // Buscar limite de alunos da modalidade
      const modalidade = horario.modalidadeId as any;
      const limiteAlunos = modalidade?.limiteAlunos || 10;

      const turmaLotada = matriculasAtivas >= limiteAlunos;

      matriculasComStatus.push({
        ...matricula,
        horarioInexistente: false,
        turmaLotada,
        alunosAtuais: matriculasAtivas,
        limiteAlunos,
        diaSemana: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][horario.diaSemana],
        horarioInicio: horario.horarioInicio,
        horarioFim: horario.horarioFim,
        modalidadeNome: modalidade?.nome || 'N/A',
      });
    }

    return NextResponse.json({
      success: true,
      matriculas: matriculasComStatus
    });
  } catch (error) {
    console.error('Erro ao verificar matrículas:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}
