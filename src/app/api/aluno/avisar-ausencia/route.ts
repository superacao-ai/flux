import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Matricula } from '@/models/Matricula';
import { HorarioFixo } from '@/models/HorarioFixo';
import { AvisoAusencia } from '@/models/AvisoAusencia';

const JWT_SECRET = process.env.JWT_SECRET || 'aluno-secret-key-2025';

async function getAlunoFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('alunoToken')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; nome: string; tipo: string };
    
    if (decoded.tipo !== 'aluno') return null;
    
    return decoded;
  } catch {
    return null;
  }
}

// GET - Listar avisos de ausência do aluno
export async function GET(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken();
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const avisos = await AvisoAusencia.find({
      alunoId: aluno.id
    })
      .populate({
        path: 'horarioFixoId',
        populate: [
          { path: 'modalidadeId', select: 'nome cor' },
          { path: 'professorId', select: 'nome' }
        ]
      })
      .sort({ dataAusencia: -1 })
      .limit(30);
    
    // Contar reposições disponíveis
    const reposicoesDisponiveis = await AvisoAusencia.countDocuments({
      alunoId: aluno.id,
      status: 'confirmada',
      temDireitoReposicao: true,
      reposicoesUsadas: 0
    });
    
    return NextResponse.json({
      success: true,
      avisos,
      reposicoesDisponiveis
    });
    
  } catch (error) {
    console.error('[API Avisar Ausência] Erro ao buscar:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar avisos de ausência' },
      { status: 500 }
    );
  }
}

// POST - Criar aviso de ausência (aluno avisando que vai faltar)
export async function POST(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken();
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const body = await req.json();
    const { horarioFixoId, dataAusencia, motivo } = body;
    
    // Validações
    if (!horarioFixoId || !dataAusencia || !motivo) {
      return NextResponse.json(
        { success: false, error: 'Horário, data e motivo são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Verificar se o aluno está matriculado neste horário
    const matricula = await Matricula.findOne({
      alunoId: aluno.id,
      horarioFixoId: horarioFixoId,
      ativo: true
    });
    
    if (!matricula) {
      return NextResponse.json(
        { success: false, error: 'Você não está matriculado neste horário' },
        { status: 403 }
      );
    }
    
    // Verificar se a data é futura
    const dataAusenciaDate = new Date(dataAusencia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dataAusenciaDate.setHours(0, 0, 0, 0);
    
    if (dataAusenciaDate < hoje) {
      return NextResponse.json(
        { success: false, error: 'Não é possível avisar ausência para datas passadas' },
        { status: 400 }
      );
    }
    
    // Verificar se já existe aviso para este horário nesta data
    const avisoExistente = await AvisoAusencia.findOne({
      alunoId: aluno.id,
      horarioFixoId: horarioFixoId,
      dataAusencia: {
        $gte: new Date(dataAusenciaDate.setHours(0, 0, 0, 0)),
        $lt: new Date(dataAusenciaDate.setHours(23, 59, 59, 999))
      },
      status: { $in: ['pendente', 'confirmada'] }
    });
    
    if (avisoExistente) {
      return NextResponse.json(
        { success: false, error: 'Já existe um aviso de ausência para esta aula' },
        { status: 400 }
      );
    }
    
    // Verificar se está avisando com antecedência mínima (pelo menos no dia anterior)
    const diferencaHoras = (dataAusenciaDate.getTime() - hoje.getTime()) / (1000 * 60 * 60);
    const temDireitoReposicao = diferencaHoras >= 24; // Pelo menos 24h de antecedência
    
    // Criar aviso de ausência
    const aviso = new AvisoAusencia({
      alunoId: aluno.id,
      matriculaId: matricula._id,
      horarioFixoId: horarioFixoId,
      dataAusencia: new Date(dataAusencia),
      motivo,
      status: 'pendente',
      temDireitoReposicao
    });
    
    await aviso.save();
    
    const mensagem = temDireitoReposicao 
      ? 'Ausência registrada! Você terá direito a reposição após a confirmação da falta.'
      : 'Ausência registrada. Aviso com menos de 24h de antecedência não gera direito a reposição.';
    
    return NextResponse.json({
      success: true,
      message: mensagem,
      aviso,
      temDireitoReposicao
    });
    
  } catch (error) {
    console.error('[API Avisar Ausência] Erro ao criar:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao registrar ausência' },
      { status: 500 }
    );
  }
}

// DELETE - Cancelar aviso de ausência (aluno decidiu que vai comparecer)
export async function DELETE(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken();
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(req.url);
    const avisoId = searchParams.get('id');
    
    if (!avisoId) {
      return NextResponse.json(
        { success: false, error: 'ID do aviso é obrigatório' },
        { status: 400 }
      );
    }
    
    await connectDB();
    
    const aviso = await AvisoAusencia.findOne({
      _id: avisoId,
      alunoId: aluno.id,
      status: 'pendente'
    });
    
    if (!aviso) {
      return NextResponse.json(
        { success: false, error: 'Aviso não encontrado ou não pode ser cancelado' },
        { status: 404 }
      );
    }
    
    aviso.status = 'cancelada';
    await aviso.save();
    
    return NextResponse.json({
      success: true,
      message: 'Aviso de ausência cancelado. Bom treino!'
    });
    
  } catch (error) {
    console.error('[API Avisar Ausência] Erro ao cancelar:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao cancelar aviso' },
      { status: 500 }
    );
  }
}
