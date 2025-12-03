import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';

async function getDb() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client.db('superacao');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      horarioFixoId, 
      data, 
      nomeExperimental, 
      telefoneExperimental, 
      emailExperimental,
      observacoesExperimental 
    } = body;

    if (!horarioFixoId || !data || !nomeExperimental || !telefoneExperimental) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios: horarioFixoId, data, nomeExperimental, telefoneExperimental' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Criar documento de aula experimental diretamente (sem validar horário)
    // O horário já foi validado no frontend
    const aulaExperimental = {
      horarioFixoId: horarioFixoId, // Manter como string para compatibilidade
      data: new Date(data),
      nomeExperimental,
      telefoneExperimental,
      emailExperimental: emailExperimental || null,
      observacoesExperimental: observacoesExperimental || null,
      status: 'agendada', // agendada, aprovada, realizada, cancelada
      compareceu: null, // null = pendente, true = veio, false = faltou (registrado pelo professor na chamada)
      dataCadastro: new Date(),
      ativo: true
    };

    const result = await db.collection('aulas_experimentais').insertOne(aulaExperimental);

    return NextResponse.json({
      success: true,
      data: {
        _id: result.insertedId,
        ...aulaExperimental
      }
    });
  } catch (error) {
    console.error('[API] Erro ao criar aula experimental:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao criar aula experimental' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const horarioFixoId = searchParams.get('horarioFixoId');
    const data = searchParams.get('data');

    const db = await getDb();

    const filter: any = { ativo: true };

    if (horarioFixoId) {
      filter.horarioFixoId = horarioFixoId; // Buscar por string
    }

    if (data) {
      const dataInicio = new Date(data);
      dataInicio.setHours(0, 0, 0, 0);
      const dataFim = new Date(data);
      dataFim.setHours(23, 59, 59, 999);
      filter.data = { $gte: dataInicio, $lte: dataFim };
    }

    const aulasExperimentais = await db
      .collection('aulas_experimentais')
      .find(filter)
      .sort({ data: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: aulasExperimentais
    });
  } catch (error) {
    console.error('[API] Erro ao buscar aulas experimentais:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar aulas experimentais' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { _id, status, compareceu, observacoesExperimental } = body;

    if (!_id) {
      return NextResponse.json(
        { success: false, error: 'ID da aula experimental é obrigatório' },
        { status: 400 }
      );
    }

    const db = await getDb();

    const updateData: any = {};
    if (status) updateData.status = status;
    if (compareceu !== undefined) updateData.compareceu = compareceu;
    if (observacoesExperimental !== undefined) updateData.observacoesExperimental = observacoesExperimental;

    const result = await db.collection('aulas_experimentais').updateOne(
      { _id: new ObjectId(_id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Aula experimental não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Erro ao atualizar aula experimental:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar aula experimental' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID da aula experimental é obrigatório' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Soft delete
    const result = await db.collection('aulas_experimentais').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ativo: false, status: 'cancelada' } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Aula experimental não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Erro ao deletar aula experimental:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar aula experimental' },
      { status: 500 }
    );
  }
}
