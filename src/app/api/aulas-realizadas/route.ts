import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import AulaRealizada from '@/models/AulaRealizada';
import ReagendamentoRealizado from '@/models/ReagendamentoRealizado';
import Presenca from '@/models/Presenca';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Matricula } from '@/models/Matricula';
import { Aluno } from '@/models/Aluno';
import { Reagendamento } from '@/models/Reagendamento';
import { User } from '@/models/User';
import { Professor } from '@/models/Professor';
import { AvisoAusencia } from '@/models/AvisoAusencia';
import { JWT_SECRET } from '@/lib/auth';

// POST - Enviar/finalizar aula
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
    const { horarioFixoId, data, alunos_marcados, reagendamentos_marcados } = body;

    console.log('[POST /api/aulas-realizadas] Body recebido:', {
      horarioFixoId,
      data,
      alunos_marcados_count: alunos_marcados?.length,
      reagendamentos_marcados_count: reagendamentos_marcados?.length,
    });

    // Validações
    if (!horarioFixoId || !data || !Array.isArray(alunos_marcados)) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: horarioFixoId, data, alunos_marcados (array)' },
        { status: 400 }
      );
    }

    // Buscar usuário e validar se é professor/admin
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar se é admin/root ou professor
    const isAdmin = user.tipo === 'admin' || user.tipo === 'root';
    const isProfessor = user.tipo === 'professor';
    
    if (!isAdmin && !isProfessor) {
      return NextResponse.json(
        { error: 'Apenas professores e administradores podem enviar aulas' },
        { status: 403 }
      );
    }

    // Se for professor, buscar o documento Professor pelo email
    let professorId = null;
    if (isProfessor && user.email) {
      const professor = await Professor.findOne({ email: user.email, ativo: true });
      if (professor) {
        professorId = professor._id;
        console.log('[POST /api/aulas-realizadas] Professor encontrado:', { 
          email: user.email, 
          nome: professor.nome, 
          _id: professorId 
        });
      } else {
        console.warn('[POST /api/aulas-realizadas] Professor não encontrado na collection Professor:', user.email);
        console.warn('[POST /api/aulas-realizadas] A aula será registrada sem professorId. Cadastre o professor na aba Professores.');
      }
    }

    // Buscar horário fixo e suas informações
    const horario = await HorarioFixo.findById(horarioFixoId).populate('modalidadeId', 'nome');
    if (!horario) {
      return NextResponse.json({ error: 'Horário não encontrado' }, { status: 404 });
    }

    // Normalizar data para UTC
    const dataNormalizada = new Date(data);
    dataNormalizada.setUTCHours(0, 0, 0, 0);

    // Buscar alunos da aula (matriculas)
    const matriculas = await Matricula.find({
      horarioFixoId,
      ativo: true,
    }).populate('alunoId', 'nome congelado ausente emEspera');

    console.log('[POST /api/aulas-realizadas] Matrículas encontradas:', matriculas.length);

    // Montar array de alunos com seus dados
    const alunosAula = matriculas.map(m => {
      const marcado = alunos_marcados.find((a: any) => a.alunoId === m.alunoId._id.toString());
      const aluno = m.alunoId as any;

      return {
        alunoId: m.alunoId._id,
        nome: aluno.nome,
        presente: marcado?.presente ?? null,
        statusNaEpoca: {
          congelado: aluno.congelado ?? false,
          ausente: aluno.ausente ?? false,
          emEspera: aluno.emEspera ?? false,
        },
        era_reagendamento: false,
        observacoes: marcado?.observacoes || '',
        avisouComAntecedencia: marcado?.avisouComAntecedencia ?? false,
      };
    });

    // Buscar reagendamentos realizados neste horário/data
    const reagendamentosDodia = reagendamentos_marcados || [];
    let alunosReagendados: any[] = [];

    if (reagendamentosDodia.length > 0) {
      // Buscar detalhes dos reagendamentos
      const reags = await Reagendamento.find({
        _id: { $in: reagendamentosDodia.map((r: any) => r.reagendamentoId) },
      }).populate('horarioFixoId', 'horarioInicio').populate('matriculaId', 'alunoId');

      for (const reag of reags) {
        const marcado = reagendamentosDodia.find(
          (r: any) => r.reagendamentoId === reag._id.toString()
        );

        // Buscar dados do aluno
        let alunoId;
        if (reag.matriculaId) {
          alunoId = (reag.matriculaId as any).alunoId;
        }

        if (alunoId) {
          const aluno = await Aluno.findById(alunoId, 'nome congelado ausente emEspera');

          alunosReagendados.push({
            alunoId,
            nome: aluno?.nome || 'Aluno',
            presente: marcado?.presente ?? null,
            statusNaEpoca: {
              congelado: aluno?.congelado ?? false,
              ausente: aluno?.ausente ?? false,
              emEspera: aluno?.emEspera ?? false,
            },
            era_reagendamento: true,
            observacoes: marcado?.observacoes || '',
            reagendamentoId: reag._id,
          });
        }
      }
    }

    // Combinar alunos regulares + reagendados
    const todosAlunos = [...alunosAula, ...alunosReagendados];

    // Calcular resumo (excluindo alunos com justificativa: congelado, ausente, em_espera)
    const alunosAtivos = todosAlunos.filter(a => 
      !['congelado', 'ausente', 'em_espera'].includes(a.observacoes)
    );
    
    const total_alunos = alunosAtivos.length;
    const total_presentes = alunosAtivos.filter(a => a.presente === true).length;
    const total_faltas = alunosAtivos.filter(a => a.presente === false).length;
    const total_reagendamentos = alunosReagendados.length;

    console.log('[POST /api/aulas-realizadas] Resumo:', {
      total_alunos,
      total_presentes,
      total_faltas,
      total_reagendamentos,
      todosAlunos_count: todosAlunos.length,
    });

    // Remover qualquer aula pendente para o mesmo horário/data
    await AulaRealizada.deleteMany({
      horarioFixoId,
      data: dataNormalizada,
      status: 'pendente'
    });

    // Criar AulaRealizada
    const aulaRealizada = await AulaRealizada.create({
      horarioFixoId,
      professorId: professorId,
      data: dataNormalizada,
      diaSemana: horario.diaSemana,
      modalidade: (horario.modalidadeId as any)?.nome || '',
      horarioInicio: horario.horarioInicio,
      horarioFim: horario.horarioFim,
      alunos: todosAlunos,
      status: 'enviada',
      enviouEm: new Date(),
      enviadoPor: userId,
      total_alunos,
      total_presentes,
      total_faltas,
      total_reagendamentos,
    });

    // Atualizar avisos de ausência para 'confirmada' quando a aula é enviada
    // Isso habilita o direito do aluno a repor a aula
    const alunosQueFaltaram = todosAlunos.filter(a => a.presente === false && a.avisouComAntecedencia);
    for (const alunoFalta of alunosQueFaltaram) {
      await AvisoAusencia.findOneAndUpdate(
        {
          alunoId: alunoFalta.alunoId,
          horarioFixoId: horarioFixoId,
          dataAusencia: { $gte: dataNormalizada, $lt: new Date(dataNormalizada.getTime() + 24 * 60 * 60 * 1000) },
          status: 'pendente'
        },
        {
          status: 'confirmada',
          confirmedAt: new Date()
        }
      );
      console.log(`[POST /api/aulas-realizadas] Aviso de ausência confirmado para aluno ${alunoFalta.alunoId}`);
    }

    // Criar ReagendamentoRealizado para cada reagendamento
    for (const alunoReag of alunosReagendados) {
      const reag = await Reagendamento.findById(alunoReag.reagendamentoId);
      
      if (reag) {
        const statusReag = alunoReag.presente === true
          ? 'realizado'
          : alunoReag.presente === false
          ? 'falta_registrada'
          : 'pendente';

        await ReagendamentoRealizado.findOneAndUpdate(
          { reagendamentoId: reag._id, alunoId: alunoReag.alunoId },
          {
            reagendamentoId: reag._id,
            alunoId: alunoReag.alunoId,
            aulaRealizadaId: aulaRealizada._id,
            dataOriginal: reag.dataOriginal,
            novaData: reag.novaData,
            horarioOriginal: reag.horarioInicio || '',
            horarioNovo: (reag.horarioInicio as any) || '',
            modalidade: (horario.modalidadeId as any)?.nome || '',
            presente_no_reagendamento: alunoReag.presente,
            marcadoEm: new Date(),
            observacoes: alunoReag.observacoes,
            status: statusReag,
            registradoPor: userId,
          },
          { upsert: true, new: true }
        );
      }
    }

    return NextResponse.json({
      message: 'Aula enviada com sucesso',
      aulaRealizada: {
        _id: aulaRealizada._id,
        data: aulaRealizada.data,
        status: aulaRealizada.status,
        total_alunos: aulaRealizada.total_alunos,
        total_presentes: aulaRealizada.total_presentes,
        total_faltas: aulaRealizada.total_faltas,
        total_reagendamentos: aulaRealizada.total_reagendamentos,
      },
    });
  } catch (error: any) {
    console.error('Erro ao enviar aula:', error);
    console.error('Stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Erro ao enviar aula', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// GET - Verificar status de aula OU listar todas as aulas
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const horarioFixoId = searchParams.get('horarioFixoId');
    const data = searchParams.get('data');
    const listarTodas = searchParams.get('listarTodas');

    // Se pedir para listar todas (para relatórios)
    if (listarTodas === 'true') {
      const todasAulas = await AulaRealizada.find({})
        .populate('professorId', 'nome email cor _id')
        .sort({ data: -1 });

      return NextResponse.json(todasAulas);
    }

    // Buscar aula específica
    if (!horarioFixoId || !data) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: horarioFixoId, data (ou listarTodas=true)' },
        { status: 400 }
      );
    }

    const dataNormalizada = new Date(data);
    dataNormalizada.setUTCHours(0, 0, 0, 0);

    const aulaRealizada = await AulaRealizada.findOne({
      horarioFixoId,
      data: dataNormalizada,
    }).select('status enviouEm total_alunos total_presentes total_faltas');

    return NextResponse.json({
      aula: aulaRealizada || null,
      enviada: !!aulaRealizada && aulaRealizada.status !== 'pendente',
    });
  } catch (error: any) {
    console.error('Erro ao buscar status da aula:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar aula', details: error.message },
      { status: 500 }
    );
  }
}
