import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { AlteracaoHorario } from '@/models/AlteracaoHorario';

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_forte';

async function isAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return false;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; id?: string; tipo: string };
    const tipoLower = decoded.tipo?.toLowerCase() || '';
    return tipoLower === 'adm' || tipoLower === 'professor' || tipoLower === 'root' || tipoLower === 'admin';
  } catch (error) {
    console.error('[API Clear Alterações] Erro ao verificar admin:', error);
    return false;
  }
}

// DELETE - Limpar histórico de alterações (apenas aprovados e rejeitados)
export async function DELETE() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    await connectDB();

    // Deletar apenas alterações aprovadas e rejeitadas, mantendo as pendentes
    const result = await AlteracaoHorario.deleteMany({
      status: { $in: ['aprovado', 'rejeitado'] }
    });

    return NextResponse.json({
      success: true,
      message: `${result.deletedCount} alterações removidas do histórico`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('[API Clear Alterações] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao limpar histórico' },
      { status: 500 }
    );
  }
}
