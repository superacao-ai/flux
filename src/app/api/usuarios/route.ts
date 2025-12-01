import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { User } from '@/models/User';
import { Professor } from '@/models/Professor';

// GET - listar usuários
export async function GET() {
  try {
    await connectDB();
    // Ensure related models are registered before calling populate
    try {
      await import('@/models/Especialidade');
    } catch (err) {
      // ignore: model might already be registered or not needed
    }
    try {
      await import('@/models/Modalidade');
    } catch (err) {
      // ignore
    }

    const usuarios = await User.find({}).sort({ nome: 1 }).select('-senha -__v')
      .populate('especialidades', 'nome')
      .populate('modalidadeId', 'nome cor');
    return NextResponse.json({ success: true, data: usuarios });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - criar usuário
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const nome = (body.nome || '').trim();
    const email = (body.email || '').toLowerCase().trim();
    const senha = String(body.senha || '').trim();
    const especialidades = Array.isArray(body.especialidades) ? body.especialidades.map(String) : [];
    const modalidadeId = body.modalidadeId || null;
    const allowedTipos = ['admin', 'professor', 'root'];
    const tipo = allowedTipos.includes(body.tipo) ? body.tipo : 'professor';
    const ativo = body.ativo === undefined ? true : Boolean(body.ativo);
    const abas = Array.isArray(body.abas) ? body.abas.map(String) : [];

    // Verificar se está tentando criar um root - apenas root pode fazer isso
    if (tipo === 'root') {
      const authHeader = request.headers.get('authorization');
      let currentUserTipo = '';
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const jwt = await import('jsonwebtoken');
          const decoded: any = jwt.default.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_super_forte');
          const currentUser = await User.findById(decoded.userId);
          currentUserTipo = currentUser?.tipo || '';
        } catch (e) {}
      }
      if (currentUserTipo !== 'root') {
        return NextResponse.json({ success: false, error: 'Apenas usuários root podem criar outros root' }, { status: 403 });
      }
    }

    if (!nome) return NextResponse.json({ success: false, error: 'Nome é obrigatório' }, { status: 400 });
    if (!email) return NextResponse.json({ success: false, error: 'Email é obrigatório' }, { status: 400 });
    if (!senha || senha.length < 6) return NextResponse.json({ success: false, error: 'Senha inválida (mínimo 6 caracteres)' }, { status: 400 });

    // verificar email duplicado
    const existente = await User.findOne({ email });
    if (existente) return NextResponse.json({ success: false, error: 'Email já está em uso' }, { status: 400 });

    // normalize color to ensure it starts with '#'
    let corVal = (body.cor || '').trim();
    if (corVal && !corVal.startsWith('#')) corVal = `#${corVal}`;
    const novo = new User({ nome, email, senha, tipo, ativo, abas, telefone: body.telefone || '', cor: corVal, especialidades, modalidadeId });
    await novo.save();

    // Se for professor, criar automaticamente na collection Professor
    if (tipo === 'professor') {
      try {
        // Verificar se já existe um professor com este email
        const professorExistente = await Professor.findOne({ email });
        if (!professorExistente) {
          await Professor.create({
            nome,
            email,
            telefone: body.telefone || '',
            cor: corVal || '#3B82F6',
            especialidades,
            ativo,
          });
          console.log(`✅ Professor criado automaticamente na collection Professor: ${nome} (${email})`);
        }
      } catch (profError) {
        console.error('⚠️ Erro ao criar professor automaticamente:', profError);
        // Não retorna erro para não bloquear a criação do usuário
      }
    }

    const retorno = novo.toObject();
    delete retorno.senha;

    return NextResponse.json({ success: true, data: retorno }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar usuário:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return NextResponse.json({ success: false, error: messages.join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
