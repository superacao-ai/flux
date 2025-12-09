import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { User } from '@/models/User';
import { Professor } from '@/models/Professor';

export async function GET(request: NextRequest, context: any) {
  try {
    await connectDB();
    const params = await Promise.resolve(context?.params || {});
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });

    // Ensure related models are registered before populate
    try {
      await import('@/models/Especialidade');
    } catch (err) {}
    try {
      await import('@/models/Modalidade');
    } catch (err) {}

    const usuario = await User.findById(id).select('-senha -__v')
      .populate('especialidades', 'nome')
      .populate('modalidadeId', 'nome cor');
    if (!usuario) return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });
    return NextResponse.json({ success: true, data: usuario });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: any) {
  try {
    await connectDB();
    const params = await Promise.resolve(context?.params || {});
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });

    // Verificar se o usuário alvo é root ou se está tentando mudar para root
    const usuarioAlvo = await User.findById(id);
    if (!usuarioAlvo) return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });

    const body = await request.json();
    const tentandoMudarParaRoot = body.tipo === 'root';
    const alvoEhRoot = usuarioAlvo.tipo === 'root';

    // Se o alvo é root OU está tentando mudar para root, verificar se quem faz a requisição é root
    if (alvoEhRoot || tentandoMudarParaRoot) {
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
        return NextResponse.json({ success: false, error: 'Apenas usuários root podem editar outros root' }, { status: 403 });
      }
    }

    const update: any = {};
    if (body.nome !== undefined) update.nome = String(body.nome).trim();
    if (body.email !== undefined) update.email = String(body.email).toLowerCase().trim();
    if (body.tipo !== undefined) {
      const allowedTipos = ['admin', 'professor', 'root', 'vendedor'];
      update.tipo = allowedTipos.includes(body.tipo) ? body.tipo : 'professor';
    }
    if (body.ativo !== undefined) update.ativo = Boolean(body.ativo);
    if (Array.isArray(body.abas)) update.abas = body.abas.map(String);
    if (body.telefone !== undefined) update.telefone = String(body.telefone).trim();
    if (Array.isArray(body.especialidades)) update.especialidades = body.especialidades.map(String);
    if (body.modalidadeId !== undefined) update.modalidadeId = body.modalidadeId || null;
    if (body.permissoes !== undefined) {
      console.log('📥 Salvando permissões:', JSON.stringify(body.permissoes, null, 2));
      update.permissoes = body.permissoes;
    }
    if (body.cor !== undefined) {
      let corVal = String(body.cor).trim();
      if (corVal && !corVal.startsWith('#')) corVal = `#${corVal}`;
      update.cor = corVal;
    }

    // Se houver email, verificar duplicidade em outro registro
    if (update.email) {
      // Ensure we exclude the current document by ObjectId to avoid false positives
      const objectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
      const outro = await User.findOne({ email: update.email, _id: { $ne: objectId } });
      if (outro) return NextResponse.json({ success: false, error: 'Email já está em uso' }, { status: 400 });
    }

    const usuario = await User.findByIdAndUpdate(id, update, { new: true }).select('-senha -__v');
    if (!usuario) return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });

    // Se for professor, sincronizar com collection Professor
    if (usuario.tipo === 'professor' && update.email) {
      try {
        const professorExistente = await Professor.findOne({ email: usuarioAlvo.email });
        if (professorExistente) {
          // Atualizar professor existente
          const professorUpdate: any = {};
          if (update.nome) professorUpdate.nome = update.nome;
          if (update.email) professorUpdate.email = update.email;
          if (update.telefone !== undefined) professorUpdate.telefone = update.telefone;
          if (update.cor) professorUpdate.cor = update.cor;
          if (update.especialidades) professorUpdate.especialidades = update.especialidades;
          if (update.ativo !== undefined) professorUpdate.ativo = update.ativo;
          
          await Professor.findByIdAndUpdate(professorExistente._id, professorUpdate);
          console.log(`✅ Professor atualizado na collection Professor: ${update.nome || usuarioAlvo.nome}`);
        } else {
          // Criar novo professor se não existir
          await Professor.create({
            nome: update.nome || usuarioAlvo.nome,
            email: update.email || usuarioAlvo.email,
            telefone: update.telefone || usuarioAlvo.telefone || '',
            cor: update.cor || usuarioAlvo.cor || '#3B82F6',
            especialidades: update.especialidades || usuarioAlvo.especialidades || [],
            ativo: update.ativo !== undefined ? update.ativo : usuarioAlvo.ativo,
          });
          console.log(`✅ Professor criado na collection Professor: ${update.nome || usuarioAlvo.nome}`);
        }
      } catch (profError) {
        console.error('⚠️ Erro ao sincronizar professor:', profError);
      }
    }

    return NextResponse.json({ success: true, data: usuario });
  } catch (error: any) {
    console.error('Erro ao atualizar usuário:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return NextResponse.json({ success: false, error: messages.join(', ') }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: any) {
  try {
    await connectDB();
    const params = await Promise.resolve(context?.params || {});
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });

    // Verificar se o usuário a ser deletado é root
    const usuarioAlvo = await User.findById(id);
    if (!usuarioAlvo) return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });

    if (usuarioAlvo.tipo === 'root') {
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
        return NextResponse.json({ success: false, error: 'Apenas usuários root podem excluir outros root' }, { status: 403 });
      }
    }

    const usuario = await User.findByIdAndDelete(id);
    if (!usuario) return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });

    // Se era professor, remover da collection Professor também
    if (usuario.tipo === 'professor' && usuario.email) {
      try {
        await Professor.deleteOne({ email: usuario.email });
        console.log(`✅ Professor removido da collection Professor: ${usuario.nome}`);
      } catch (profError) {
        console.error('⚠️ Erro ao remover professor:', profError);
      }
    }

    return NextResponse.json({ success: true, message: 'Usuário removido' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
