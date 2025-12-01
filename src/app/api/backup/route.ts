import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Aluno } from '@/models/Aluno';
import { Professor } from '@/models/Professor';
import { Modalidade } from '@/models/Modalidade';
import { HorarioFixo } from '@/models/HorarioFixo';
import AulaRealizada from '@/models/AulaRealizada';
import { Reagendamento } from '@/models/Reagendamento';
import { User } from '@/models/User';
import { Matricula } from '@/models/Matricula';

// GET - Exportar backup completo do banco
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const collections = searchParams.get('collections')?.split(',') || ['all'];
    const includeAll = collections.includes('all');

    const backup: Record<string, any[]> = {};
    const metadata = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      collections: [] as string[],
    };

    // Exportar cada coleção
    if (includeAll || collections.includes('alunos')) {
      backup.alunos = await Aluno.find({}).lean();
      metadata.collections.push('alunos');
    }

    if (includeAll || collections.includes('professores')) {
      backup.professores = await Professor.find({}).lean();
      metadata.collections.push('professores');
    }

    if (includeAll || collections.includes('modalidades')) {
      backup.modalidades = await Modalidade.find({}).lean();
      metadata.collections.push('modalidades');
    }

    if (includeAll || collections.includes('horarios')) {
      backup.horarios = await HorarioFixo.find({}).lean();
      metadata.collections.push('horarios');
    }

    if (includeAll || collections.includes('aulasRealizadas')) {
      backup.aulasRealizadas = await AulaRealizada.find({}).lean();
      metadata.collections.push('aulasRealizadas');
    }

    if (includeAll || collections.includes('reagendamentos')) {
      backup.reagendamentos = await Reagendamento.find({}).lean();
      metadata.collections.push('reagendamentos');
    }

    if (includeAll || collections.includes('usuarios')) {
      // Não exportar senhas
      backup.usuarios = await User.find({}).select('-senha').lean();
      metadata.collections.push('usuarios');
    }

    if (includeAll || collections.includes('matriculas')) {
      backup.matriculas = await Matricula.find({}).lean();
      metadata.collections.push('matriculas');
    }

    // Contar registros
    const counts: Record<string, number> = {};
    for (const [key, value] of Object.entries(backup)) {
      counts[key] = value.length;
    }

    return NextResponse.json({
      success: true,
      metadata: {
        ...metadata,
        counts,
        totalRecords: Object.values(counts).reduce((a, b) => a + b, 0),
      },
      data: backup,
    });
  } catch (error) {
    console.error('Erro ao exportar backup:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao exportar backup' },
      { status: 500 }
    );
  }
}

// POST - Importar backup (restaurar dados)
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { data, options } = body;

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Dados de backup não fornecidos' },
        { status: 400 }
      );
    }

    const results: Record<string, { imported: number; errors: number }> = {};
    const mode = options?.mode || 'merge'; // 'merge' ou 'replace'

    // Importar cada coleção
    if (data.modalidades && Array.isArray(data.modalidades)) {
      results.modalidades = { imported: 0, errors: 0 };
      if (mode === 'replace') {
        await Modalidade.deleteMany({});
      }
      for (const item of data.modalidades) {
        try {
          const { _id, ...rest } = item;
          if (mode === 'merge') {
            await Modalidade.findByIdAndUpdate(_id, rest, { upsert: true });
          } else {
            await Modalidade.create({ _id, ...rest });
          }
          results.modalidades.imported++;
        } catch (e) {
          results.modalidades.errors++;
        }
      }
    }

    if (data.professores && Array.isArray(data.professores)) {
      results.professores = { imported: 0, errors: 0 };
      if (mode === 'replace') {
        await Professor.deleteMany({});
      }
      for (const item of data.professores) {
        try {
          const { _id, ...rest } = item;
          if (mode === 'merge') {
            await Professor.findByIdAndUpdate(_id, rest, { upsert: true });
          } else {
            await Professor.create({ _id, ...rest });
          }
          results.professores.imported++;
        } catch (e) {
          results.professores.errors++;
        }
      }
    }

    if (data.alunos && Array.isArray(data.alunos)) {
      results.alunos = { imported: 0, errors: 0 };
      if (mode === 'replace') {
        await Aluno.deleteMany({});
      }
      for (const item of data.alunos) {
        try {
          const { _id, ...rest } = item;
          if (mode === 'merge') {
            await Aluno.findByIdAndUpdate(_id, rest, { upsert: true });
          } else {
            await Aluno.create({ _id, ...rest });
          }
          results.alunos.imported++;
        } catch (e) {
          results.alunos.errors++;
        }
      }
    }

    if (data.horarios && Array.isArray(data.horarios)) {
      results.horarios = { imported: 0, errors: 0 };
      if (mode === 'replace') {
        await HorarioFixo.deleteMany({});
      }
      for (const item of data.horarios) {
        try {
          const { _id, ...rest } = item;
          if (mode === 'merge') {
            await HorarioFixo.findByIdAndUpdate(_id, rest, { upsert: true });
          } else {
            await HorarioFixo.create({ _id, ...rest });
          }
          results.horarios.imported++;
        } catch (e) {
          results.horarios.errors++;
        }
      }
    }

    if (data.aulasRealizadas && Array.isArray(data.aulasRealizadas)) {
      results.aulasRealizadas = { imported: 0, errors: 0 };
      if (mode === 'replace') {
        await AulaRealizada.deleteMany({});
      }
      for (const item of data.aulasRealizadas) {
        try {
          const { _id, ...rest } = item;
          if (mode === 'merge') {
            await AulaRealizada.findByIdAndUpdate(_id, rest, { upsert: true });
          } else {
            await AulaRealizada.create({ _id, ...rest });
          }
          results.aulasRealizadas.imported++;
        } catch (e) {
          results.aulasRealizadas.errors++;
        }
      }
    }

    if (data.reagendamentos && Array.isArray(data.reagendamentos)) {
      results.reagendamentos = { imported: 0, errors: 0 };
      if (mode === 'replace') {
        await Reagendamento.deleteMany({});
      }
      for (const item of data.reagendamentos) {
        try {
          const { _id, ...rest } = item;
          if (mode === 'merge') {
            await Reagendamento.findByIdAndUpdate(_id, rest, { upsert: true });
          } else {
            await Reagendamento.create({ _id, ...rest });
          }
          results.reagendamentos.imported++;
        } catch (e) {
          results.reagendamentos.errors++;
        }
      }
    }

    if (data.matriculas && Array.isArray(data.matriculas)) {
      results.matriculas = { imported: 0, errors: 0 };
      if (mode === 'replace') {
        await Matricula.deleteMany({});
      }
      for (const item of data.matriculas) {
        try {
          const { _id, ...rest } = item;
          if (mode === 'merge') {
            await Matricula.findByIdAndUpdate(_id, rest, { upsert: true });
          } else {
            await Matricula.create({ _id, ...rest });
          }
          results.matriculas.imported++;
        } catch (e) {
          results.matriculas.errors++;
        }
      }
    }

    const totalImported = Object.values(results).reduce((a, b) => a + b.imported, 0);
    const totalErrors = Object.values(results).reduce((a, b) => a + b.errors, 0);

    return NextResponse.json({
      success: true,
      message: `Backup restaurado: ${totalImported} registros importados, ${totalErrors} erros`,
      results,
    });
  } catch (error) {
    console.error('Erro ao importar backup:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao importar backup' },
      { status: 500 }
    );
  }
}
