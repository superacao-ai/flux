import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import Presenca from '@/models/Presenca';
import { User } from '@/models/User';
import { Professor } from '@/models/Professor';
import { JWT_SECRET } from '@/lib/auth';

// GET - Listar presenças com filtros
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data');
    const alunoId = searchParams.get('alunoId');
    const horarioFixoId = searchParams.get('horarioFixoId');
    const professorId = searchParams.get('professorId');

    // Construir query
    const query: any = {};
    
    if (data) {
      // Buscar presenças de uma data específica
      const dataInicio = new Date(data);
      dataInicio.setHours(0, 0, 0, 0);
      const dataFim = new Date(data);
      dataFim.setHours(23, 59, 59, 999);
      query.data = { $gte: dataInicio, $lte: dataFim };
    }

    if (alunoId) {
      query.alunoId = alunoId;
    }

    if (horarioFixoId) {
      query.horarioFixoId = horarioFixoId;
    }

    if (professorId) {
      query.professorId = professorId;
    }

    const presencas = await Presenca.find(query)
      .populate('alunoId', 'nome email')
      .populate('horarioFixoId', 'horarioInicio horarioFim diaSemana')
      .populate('professorId', 'nome')
      .populate('registradoPor', 'nome email')
      .sort({ data: -1 })
      .lean();

    return NextResponse.json(presencas);
  } catch (error: any) {
    console.error('Erro ao buscar presenças:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar presenças', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Marcar presença/falta
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Verificar autenticação
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado - Token JWT obrigatório' }, { status: 401 });
    }
    const token = auth.split(' ')[1];

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('Token JWT inválido:', err);
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 });
    }

    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token sem userId' }, { status: 401 });
    }

    const userId = payload.userId;

    const body = await request.json();
    const { alunoId, horarioFixoId, data, presente, observacoes } = body;

    // Validações
    if (!alunoId || !horarioFixoId || !data || presente === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: alunoId, horarioFixoId, data, presente' },
        { status: 400 }
      );
    }

    // Verificar se o usuário é professor ou admin
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    let professorId = null;
    
    // Se não for admin, deve ser professor
    if (user.role !== 'ADM') {
      const professor = await Professor.findOne({ email: user.email });
      if (!professor) {
        return NextResponse.json(
          { error: 'Apenas professores e administradores podem marcar presença' },
          { status: 403 }
        );
      }
      professorId = professor._id;
    }

    // Validar data (não pode ser futura)
    const dataPresenca = new Date(data);
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);

    if (dataPresenca > hoje) {
      return NextResponse.json(
        { error: 'Não é possível marcar presença para datas futuras' },
        { status: 400 }
      );
    }

    // Normalizar data para início do dia
    dataPresenca.setHours(0, 0, 0, 0);

    // Verificar se já existe registro (upsert)
    const presencaExistente = await Presenca.findOne({
      alunoId,
      horarioFixoId,
      data: dataPresenca,
    });

    if (presencaExistente) {
      // Atualizar registro existente
      presencaExistente.presente = presente;
      presencaExistente.observacoes = observacoes || '';
      presencaExistente.registradoEm = new Date();
      presencaExistente.registradoPor = userId;
      await presencaExistente.save();

      const presencaAtualizada = await Presenca.findById(presencaExistente._id)
        .populate('alunoId', 'nome email')
        .populate('horarioFixoId', 'horarioInicio horarioFim diaSemana')
        .lean();

      return NextResponse.json({
        message: 'Presença atualizada com sucesso',
        presenca: presencaAtualizada,
      });
    } else {
      // Criar novo registro
      const novaPresenca = await Presenca.create({
        alunoId,
        horarioFixoId,
        professorId,
        data: dataPresenca,
        presente,
        observacoes: observacoes || '',
        registradoEm: new Date(),
        registradoPor: userId,
      });

      const presencaCriada = await Presenca.findById(novaPresenca._id)
        .populate('alunoId', 'nome email')
        .populate('horarioFixoId', 'horarioInicio horarioFim diaSemana')
        .lean();

      return NextResponse.json({
        message: 'Presença registrada com sucesso',
        presenca: presencaCriada,
      }, { status: 201 });
    }
  } catch (error: any) {
    console.error('Erro ao registrar presença:', error);
    
    // Tratar erro de duplicata
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Já existe um registro de presença para este aluno neste horário e data' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao registrar presença', details: error.message },
      { status: 500 }
    );
  }
}
