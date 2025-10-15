import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Modalidade } from '@/models/Modalidade';

// GET - Listar todas as modalidades
export async function GET() {
  try {
    await connectDB();
    
    const modalidades = await Modalidade.find({ ativo: true })
      .sort({ nome: 1 })
      .select('-__v');
    
    return NextResponse.json({
      success: true,
      data: modalidades
    });
  } catch (error) {
    console.error('Erro ao buscar modalidades:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// POST - Criar nova modalidade
export async function POST(request: NextRequest) {
  await connectDB();

  let body: any = {};
  try {
    body = await request.json();
  } catch (parseErr) {
    // Se falhar ao parsear JSON, leia o corpo como texto para debug e logue
    try {
      const raw = await request.text();
      console.error('Invalid JSON body received on /api/modalidades POST. Raw body:', raw);
    } catch (tErr) {
      console.error('Invalid JSON and failed to read raw body:', tErr);
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, modalidadeId, horario } = body;

  if (action === 'addHorario') {
    if (!modalidadeId || !horario) {
      return NextResponse.json({ error: 'modalidadeId and horario are required' }, { status: 400 });
    }
    try {
      const modalidade = await Modalidade.findById(modalidadeId);
      if (!modalidade) return NextResponse.json({ error: 'Modalidade not found' }, { status: 404 });

      modalidade.horariosDisponiveis = modalidade.horariosDisponiveis || [];
      modalidade.horariosDisponiveis.push({ ...horario });

      await modalidade.save();
      return NextResponse.json({ success: true, modalidade }, { status: 200 });
    } catch (err: any) {
      return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
    }
  }

  // Se não for ação específica, tratar como criação de nova modalidade
  try {
    const { nome, descricao, cor, duracao, limiteAlunos, diasSemana, horarioFuncionamento, horariosDisponiveis } = body;

    if (!nome || typeof nome !== 'string') {
      return NextResponse.json({ success: false, error: 'Nome é obrigatório' }, { status: 400 });
    }

    // Verificar existência
    const exists = await Modalidade.findOne({ nome: { $regex: new RegExp(`^${nome}$`, 'i') }, ativo: true });
    if (exists) {
      return NextResponse.json({ success: false, error: 'Já existe uma modalidade com este nome' }, { status: 400 });
    }

    // Normalize horarioFuncionamento: convert empty strings to null
    const normalizePeriod = (p: any) => ({ inicio: p?.inicio || null, fim: p?.fim || null });
    const hf = horarioFuncionamento
      ? { manha: normalizePeriod(horarioFuncionamento.manha), tarde: normalizePeriod(horarioFuncionamento.tarde) }
      : { manha: { inicio: null, fim: null }, tarde: { inicio: null, fim: null } };

    const createObj: any = {
      nome: nome.trim(),
      descricao: descricao || '',
      cor: cor || '#3B82F6',
      duracao: duracao || 60,
      limiteAlunos: limiteAlunos || 5,
      diasSemana: diasSemana || [],
      horarioFuncionamento: hf,
      ativo: true
    };

    // Include horariosDisponiveis if provided and is an array
    if (Array.isArray(horariosDisponiveis) && horariosDisponiveis.length > 0) {
      createObj.horariosDisponiveis = horariosDisponiveis.map((h: any) => ({ diasSemana: h.diasSemana || [], horaInicio: h.horaInicio || h.hora_inicio || h.inicio || '', horaFim: h.horaFim || h.hora_fim || h.fim || '' }));
    }

    let created;
    try {
      created = await Modalidade.create(createObj);
    } catch (createErr: any) {
      // Handle duplicate key error more gracefully
      if (createErr && createErr.code === 11000) {
        return NextResponse.json({ success: false, error: 'Já existe uma modalidade com este nome' }, { status: 400 });
      }
      console.error('Erro criando modalidade, body:', body, 'error:', createErr);
      throw createErr;
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err: any) {
    console.error('Erro ao criar modalidade:', err);
    return NextResponse.json({ success: false, error: String(err.message || err) }, { status: 500 });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}