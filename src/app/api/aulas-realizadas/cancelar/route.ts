import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import AulaRealizada from '@/models/AulaRealizada';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Matricula } from '@/models/Matricula';
import { Aluno } from '@/models/Aluno';
import { User } from '@/models/User';
import CreditoReposicao from '@/models/CreditoReposicao';
import { JWT_SECRET } from '@/lib/auth';

// POST - Cancelar aula pendente (gera crédito de reposição para todos os alunos)
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Verificar autenticação
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const token = auth.split(' ')[1];

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId;
    const body = await request.json();
    const { horarioFixoId, data, motivoCancelamento } = body;

    console.log('[POST /api/aulas-realizadas/cancelar] Body recebido:', {
      horarioFixoId,
      data,
      motivoCancelamento,
    });

    // Validações
    if (!horarioFixoId || !data) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: horarioFixoId, data' },
        { status: 400 }
      );
    }

    // Buscar usuário e validar se é admin
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const isAdmin = user.tipo === 'admin' || user.tipo === 'root';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Apenas administradores podem cancelar aulas' },
        { status: 403 }
      );
    }

    // Buscar horário fixo e suas informações
    const horario = await HorarioFixo.findById(horarioFixoId)
      .populate('modalidadeId', 'nome')
      .populate('professorId', 'nome _id');
    
    if (!horario) {
      return NextResponse.json({ error: 'Horário não encontrado' }, { status: 404 });
    }

    // Normalizar data para UTC
    const dataNormalizada = new Date(data);
    dataNormalizada.setUTCHours(0, 0, 0, 0);

    // Verificar se já existe aula para este horário/data
    const aulaExistente = await AulaRealizada.findOne({
      horarioFixoId,
      data: dataNormalizada,
    });

    if (aulaExistente) {
      return NextResponse.json(
        { error: 'Já existe uma aula registrada para este horário/data. Use a opção de editar.' },
        { status: 400 }
      );
    }

    // Buscar alunos matriculados no horário (apenas ativos e não congelados/ausentes)
    const matriculas = await Matricula.find({
      horarioFixoId,
      ativo: true,
    }).populate('alunoId', 'nome congelado ausente emEspera');

    const alunosAtivos = matriculas.filter(m => {
      const aluno = m.alunoId as any;
      return aluno && !aluno.congelado && !aluno.ausente && !aluno.emEspera;
    });

    if (alunosAtivos.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum aluno ativo encontrado neste horário' },
        { status: 400 }
      );
    }

    // Montar array de alunos - todos marcados como falta
    const alunosAula = matriculas.map(m => {
      const aluno = m.alunoId as any;
      const isAtivo = aluno && !aluno.congelado && !aluno.ausente && !aluno.emEspera;

      return {
        alunoId: aluno._id,
        nome: aluno.nome,
        presente: isAtivo ? false : null, // Falta apenas para alunos ativos
        statusNaEpoca: {
          congelado: aluno?.congelado ?? false,
          ausente: aluno?.ausente ?? false,
          emEspera: aluno?.emEspera ?? false,
        },
        era_reagendamento: false,
        observacoes: isAtivo ? 'Aula cancelada pelo studio' : (aluno?.congelado ? 'congelado' : aluno?.ausente ? 'ausente' : 'em_espera'),
      };
    });

    // Criar AulaRealizada com status cancelada
    const aulaRealizada = await AulaRealizada.create({
      horarioFixoId,
      professorId: (horario.professorId as any)?._id || horario.professorId,
      data: dataNormalizada,
      diaSemana: horario.diaSemana,
      modalidade: (horario.modalidadeId as any)?.nome || '',
      horarioInicio: horario.horarioInicio,
      horarioFim: horario.horarioFim,
      alunos: alunosAula,
      status: 'cancelada',
      cancelada: true,
      canceladaEm: new Date(),
      canceladaPor: userId,
      motivoCancelamento: motivoCancelamento || 'Aula cancelada - crédito gerado',
      enviouEm: new Date(),
      enviadoPor: userId,
      total_alunos: alunosAtivos.length,
      total_presentes: 0,
      total_faltas: alunosAtivos.length,
      total_reagendamentos: 0,
    });

    // Gerar crédito de reposição para cada aluno ativo
    let creditosGerados = 0;
    const errosCreditos: string[] = [];
    
    // Calcular data de validade (90 dias a partir de agora)
    const dataValidade = new Date();
    dataValidade.setDate(dataValidade.getDate() + 90);
    
    console.log('[POST /api/aulas-realizadas/cancelar] Tentando criar créditos:', {
      alunosAtivos: alunosAtivos.length,
      dataValidade,
      userId,
      modalidadeId: (horario.modalidadeId as any)?._id || horario.modalidadeId,
    });
    
    for (const matricula of alunosAtivos) {
      const aluno = matricula.alunoId as any;
      
      try {
        const creditoData = {
          alunoId: aluno._id,
          quantidade: 1,
          quantidadeUsada: 0,
          modalidadeId: (horario.modalidadeId as any)?._id || horario.modalidadeId,
          motivo: motivoCancelamento || 'Aula cancelada pelo studio',
          validade: dataValidade,
          concedidoPor: userId,
          aulaRealizadaId: aulaRealizada._id,
          ativo: true,
        };
        
        console.log('[POST /api/aulas-realizadas/cancelar] Criando crédito para aluno:', aluno._id, creditoData);
        
        const credito = await CreditoReposicao.create(creditoData);
        console.log('[POST /api/aulas-realizadas/cancelar] Crédito criado:', credito._id);
        creditosGerados++;
      } catch (err: any) {
        console.error(`Erro ao criar crédito para aluno ${aluno._id}:`, err.message, err);
        errosCreditos.push(`${aluno.nome}: ${err.message}`);
      }
    }

    console.log('[POST /api/aulas-realizadas/cancelar] Aula cancelada:', {
      aulaId: aulaRealizada._id,
      creditosGerados,
      alunosAtivos: alunosAtivos.length,
      errosCreditos,
    });

    return NextResponse.json({
      success: true,
      message: `Aula cancelada! Crédito de reposição gerado para ${creditosGerados} aluno(s).${errosCreditos.length > 0 ? ` Erros: ${errosCreditos.join(', ')}` : ''}`,
      aulaRealizada: {
        _id: aulaRealizada._id,
        data: aulaRealizada.data,
        status: aulaRealizada.status,
        total_alunos: aulaRealizada.total_alunos,
        total_faltas: aulaRealizada.total_faltas,
      },
      creditosGerados,
      errosCreditos,
    });
  } catch (error: any) {
    console.error('Erro ao cancelar aula:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar aula', details: error.message },
      { status: 500 }
    );
  }
}
