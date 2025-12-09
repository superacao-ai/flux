import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Modalidade } from '@/models/Modalidade';

// PUT - Atualizar modalidade
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
  const { nome, descricao, cor, duracao, preco, diasSemana, limiteAlunos, horarioFuncionamento, horariosDisponiveis, linkWhatsapp, modalidadesVinculadas } = body;

    // Build update object conditionally so PUT can be used to toggle `ativo` without requiring other fields
    const updateObj: any = {};

    // If caller provided a nome, validate and check duplicates
    if (typeof nome !== 'undefined') {
      const nomeTrim = String(nome || '').trim();
      if (!nomeTrim) {
        return NextResponse.json({ success: false, error: 'Nome é obrigatório' }, { status: 400 });
      }
      // Verificar se já existe outra modalidade com esse nome
      const modalidadeExistente = await Modalidade.findOne({
        nome: { $regex: new RegExp(`^${nomeTrim}$`, 'i') },
        ativo: true,
        _id: { $ne: id }
      });
      if (modalidadeExistente) {
        return NextResponse.json({ success: false, error: 'Já existe uma modalidade com este nome' }, { status: 400 });
      }
      updateObj.nome = nomeTrim;
    }

    if (typeof descricao !== 'undefined') updateObj.descricao = descricao?.trim() || '';
    if (typeof cor !== 'undefined') updateObj.cor = cor || '#3B82F6';
    if (typeof duracao !== 'undefined') updateObj.duracao = duracao || 60;
    if (typeof limiteAlunos !== 'undefined') updateObj.limiteAlunos = limiteAlunos || 5;
    if (typeof diasSemana !== 'undefined') updateObj.diasSemana = diasSemana || [];
    if (typeof preco !== 'undefined') updateObj.preco = preco || 0;
    if (typeof horarioFuncionamento !== 'undefined') {
      updateObj.horarioFuncionamento = {
        manha: {
          inicio: horarioFuncionamento?.manha?.inicio || null,
          fim: horarioFuncionamento?.manha?.fim || null
        },
        tarde: {
          inicio: horarioFuncionamento?.tarde?.inicio || null,
          fim: horarioFuncionamento?.tarde?.fim || null
        }
      };
    }

    // If caller provided horariosDisponiveis, normalize and include in update
    if (Array.isArray(horariosDisponiveis)) {
      try {
        updateObj.horariosDisponiveis = horariosDisponiveis.map((h: any) => ({
          diasSemana: Array.isArray(h.diasSemana) ? h.diasSemana : (h.dias || []),
          horaInicio: h.horaInicio || h.hora_inicio || h.inicio || h.hora || '',
          horaFim: h.horaFim || h.hora_fim || h.fim || h.horaFim || ''
        }));
      } catch (e) {
        // ignore normalization errors and don't set the field
      }
    }

    // Link do grupo do WhatsApp
    if (typeof linkWhatsapp !== 'undefined') {
      updateObj.linkWhatsapp = linkWhatsapp?.trim() || '';
    }

    // Modalidades vinculadas (mesmo espaço físico) - sincronização bidirecional
    if (Array.isArray(modalidadesVinculadas)) {
      // Buscar vinculações anteriores para saber quais remover
      const modalidadeAtual = await Modalidade.findById(id).lean();
      const vinculacoesAnteriores: string[] = ((modalidadeAtual as any)?.modalidadesVinculadas || []).map((v: any) => v.toString());
      const novasVinculacoes: string[] = modalidadesVinculadas.map((v: any) => v.toString());
      
      // Modalidades que foram removidas da vinculação
      const removidas = vinculacoesAnteriores.filter(v => !novasVinculacoes.includes(v));
      
      // Modalidades que foram adicionadas à vinculação
      const adicionadas = novasVinculacoes.filter(v => !vinculacoesAnteriores.includes(v));
      
      // Remover esta modalidade das modalidades que não estão mais vinculadas
      if (removidas.length > 0) {
        await Modalidade.updateMany(
          { _id: { $in: removidas } },
          { $pull: { modalidadesVinculadas: id } }
        );
      }
      
      // Adicionar esta modalidade às novas modalidades vinculadas
      if (adicionadas.length > 0) {
        await Modalidade.updateMany(
          { _id: { $in: adicionadas } },
          { $addToSet: { modalidadesVinculadas: id } }
        );
      }
      
      updateObj.modalidadesVinculadas = modalidadesVinculadas;
    }

    // Allow caller to set ativo flag when provided (reactivate/activate)
    if (typeof body.ativo === 'boolean') {
      updateObj.ativo = body.ativo;
    }

    // Atualizar modalidade
    const modalidade = await Modalidade.findByIdAndUpdate(id, updateObj, { new: true });

    if (!modalidade) {
      return NextResponse.json(
        {
          success: false,
          error: 'Modalidade não encontrada'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: modalidade,
      message: 'Modalidade atualizada com sucesso'
    });
    
  } catch (error: any) {
    console.error('Erro ao atualizar modalidade:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Já existe outra modalidade com este nome'
        },
        { status: 400 }
      );
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        {
          success: false,
          error: 'Dados inválidos',
          details: errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Desativar modalidade (soft delete) ou excluir permanentemente (hard delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const url = new URL(request.url);
    const permanent = url.searchParams.get('permanent') === 'true';

    if (permanent) {
      // Hard delete (remove document from collection permanently)
      const removed = await Modalidade.findByIdAndDelete(id);
      if (!removed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Modalidade não encontrada'
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, message: 'Modalidade excluída permanentemente', data: removed });
    }

    // Soft delete - apenas marca como inativo
    const modalidade = await Modalidade.findByIdAndUpdate(
      id,
      { ativo: false },
      { new: true }
    );

    if (!modalidade) {
      return NextResponse.json(
        {
          success: false,
          error: 'Modalidade não encontrada'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Modalidade movida para lixeira'
    });
  } catch (error) {
    console.error('Erro ao deletar modalidade:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}
