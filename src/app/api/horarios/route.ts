import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Matricula } from '@/models/Matricula';
import { Modalidade } from '@/models/Modalidade';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// GET - Listar todos os horários
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const modalidadeFilter = searchParams.get('modalidadeId');

    const query: any = { ativo: true };
    // We will not restrict by horario.modalidadeId here because the selected modalidade
    // can belong to the aluno referenced by alunoId. We'll apply modalidade filtering
    // after populating so we can consider both HorarioFixo.modalidadeId and aluno.modalidadeId.
    // Excluir documentos que não têm professorId populado (registros inválidos)
    query.professorId = { $exists: true, $ne: null };

    let horarios = await HorarioFixo.find(query)
      .populate({
        path: 'alunoId',
        select: 'nome email modalidadeId periodoTreino parceria observacoes congelado ausente emEspera',
        populate: {
          path: 'modalidadeId',
          select: 'nome cor',
          options: { strictPopulate: false }
        },
        options: { strictPopulate: false }
      })
      .populate('professorId', 'nome especialidade cor')
      .populate('modalidadeId', 'nome cor limiteAlunos')
      .sort({ diaSemana: 1, horarioInicio: 1 })
      .lean();

    // Debug: log primeiro horário para verificar campos
    if (horarios.length > 0) {
      const firstH = horarios[0] as any;
      console.log('[/api/horarios] Primeiro horário - campos importantes:', {
        _id: firstH._id,
        alunoNome: firstH.alunoId?.nome,
        'aluno.congelado': firstH.alunoId?.congelado,
        'aluno.ausente': firstH.alunoId?.ausente,
        'aluno.emEspera': firstH.alunoId?.emEspera,
        periodoTreino: firstH.alunoId?.periodoTreino,
        parceria: firstH.alunoId?.parceria
      });
      
      // Log de TODOS os horários com flags ativas DO ALUNO
      const withFlags = horarios.filter((h: any) => h.alunoId?.congelado || h.alunoId?.ausente || h.alunoId?.emEspera);
      if (withFlags.length > 0) {
        console.log(`[/api/horarios] ${withFlags.length} horário(s) com flags ativas no aluno:`);
        withFlags.forEach((h: any) => {
          console.log(`  - ${h._id}: ${h.alunoId?.nome || 'sem aluno'} - congelado:${h.alunoId?.congelado}, ausente:${h.alunoId?.ausente}, emEspera:${h.alunoId?.emEspera}`);
        });
      }
    }

    // Optional filter by professorId (supports string id matching populated or raw field)
    try {
      const { searchParams } = new URL(request.url);
      const profFilter = searchParams.get('professorId');
      if (profFilter) {
        const pid = String(profFilter);
        console.log('[/api/horarios] filtro professorId recebido:', pid);
        horarios = horarios.filter((h: any) => {
          const p = h.professorId;
          if (!p) return false;
          const pidRaw = typeof p === 'string' ? p : String(p._id || p);
          return String(pidRaw) === pid;
        });
        console.log('[/api/horarios] quantidade apos filtro professorId:', horarios.length);
      }
    } catch (e) {
      // ignore URL parsing errors
      const emsg = (e && typeof e === 'object' && 'message' in e) ? (e as any).message : JSON.stringify(e);
      console.warn('[/api/horarios] erro ao parsear query params', emsg);
    }

    // If the client requested a modalidade filter, include horarios where either
    // the HorarioFixo.modalidadeId equals the filter OR the populated alunoId.modalidadeId equals it.
    if (modalidadeFilter) {
      const mId = String(modalidadeFilter);
      horarios = horarios.filter((h: any) => {
        if (h.modalidadeId) {
          const mid = typeof h.modalidadeId === 'string' ? h.modalidadeId : String(h.modalidadeId._id || h.modalidadeId);
          if (mid === mId) return true;
        }
        if (h.alunoId && h.alunoId.modalidadeId) {
          const am = h.alunoId.modalidadeId;
          const amid = typeof am === 'string' ? am : String(am._id || am);
          if (amid === mId) return true;
        }
        return false;
      });
    }
    
    // Fetch active matriculas for the listed horarios and attach them to each horario.
    try {
      const horarioIds = horarios.map((h: any) => String(h._id));
      if (horarioIds.length > 0) {
        const matriculas = await Matricula.find({ horarioFixoId: { $in: horarioIds }, ativo: true })
          .populate({
            path: 'alunoId',
            select: 'nome email modalidadeId periodoTreino parceria observacoes congelado ausente emEspera',
            populate: { path: 'modalidadeId', select: 'nome cor' }
          })
          .lean();

        const byHorario: Record<string, any[]> = {};
        for (const m of matriculas) {
          const key = String(m.horarioFixoId);
          byHorario[key] = byHorario[key] || [];
          byHorario[key].push(m);
        }

        horarios = horarios.map((h: any) => {
          const key = String(h._id);
          const ms = byHorario[key] || [];
          // Attach matriculas array
          h.matriculas = ms;
          // For backwards compatibility, set alunoId to the first matricula's aluno when present
          if ((!h.alunoId || h.alunoId === null) && ms.length > 0) {
            h.alunoId = ms[0].alunoId;
          }
          return h;
        });
      }
    } catch (matErr:any) {
      console.warn('Erro ao popular matriculas para horarios:', String(matErr?.message || matErr));
    }
    
    // Garantir que os campos booleanos sempre existem - LENDO DO ALUNO
    horarios = horarios.map((h: any) => ({
      ...h,
      congelado: h.alunoId?.congelado === true,
      ausente: h.alunoId?.ausente === true,
      emEspera: h.alunoId?.emEspera === true
    }));
    
    return NextResponse.json({
      success: true,
      data: horarios
    });
  } catch (error) {
    console.error('Erro ao buscar horários:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// POST - Criar novo horário
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
  let { alunoId, professorId, diaSemana, horarioInicio, horarioFim, observacoes, modalidadeId } = body;

  // Normalize alunoId: treat empty string as not provided
  if (typeof alunoId === 'string' && alunoId.trim() === '') {
    alunoId = undefined;
  }

  // Protection: optionally block clients from creating HorarioFixo with alunoId.
  // This helps during frontend migration to ensure enrollments go through /api/matriculas.
  // Control via env var: set BLOCK_HORARIO_WITH_ALUNOID='false' or '0' to disable.
  try {
    const blockEnv = (process.env.BLOCK_HORARIO_WITH_ALUNOID || '').toLowerCase();
    const blockEnabled = blockEnv === '' ? true : !(blockEnv === 'false' || blockEnv === '0');
    if (blockEnabled && alunoId !== undefined && alunoId !== null) {
      return NextResponse.json(
        {
          success: false,
          error: 'Criação direta de HorarioFixo com alunoId não permitida. Use POST /api/matriculas para matricular um aluno em um horário existente.'
        },
        { status: 400 }
      );
    }
  } catch (e) {
    // If any unexpected error occurs, continue without blocking to avoid breaking requests.
  }

  // If an alunoId was provided, validate it's a proper ObjectId
  if (alunoId !== undefined && alunoId !== null) {
    const isValid = mongoose.Types.ObjectId.isValid(alunoId);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'alunoId inválido'
        },
        { status: 400 }
      );
    }
  }

  // Validate and coerce professorId early to give clearer errors
  if (!professorId) {
    // professorId required check will also fire later, but return early with clear message
    return NextResponse.json(
      { success: false, error: 'professorId é obrigatório' },
      { status: 400 }
    );
  }
  if (typeof professorId === 'string' && !mongoose.Types.ObjectId.isValid(professorId)) {
    return NextResponse.json(
      { success: false, error: 'professorId inválido' },
      { status: 400 }
    );
  }

    // Coerce alunoId/professorId/modalityId to ObjectId instances for queries and creation
  if (alunoId) {
    alunoId = new mongoose.Types.ObjectId(alunoId);
  }
  if (professorId) {
    professorId = new mongoose.Types.ObjectId(professorId);
  }
    if (modalidadeId) {
      modalidadeId = new mongoose.Types.ObjectId(modalidadeId);
    }

    // Helper: parse "HH:MM" to minutes
    const parseTimeToMinutes = (t: string) => {
      if (!t || typeof t !== 'string') return 0;
      const [hh, mm] = t.split(':').map((x:any) => parseInt(x, 10) || 0);
      return hh * 60 + mm;
    };

    const generateTimes = (start: string, end: string, stepMin: number) => {
      const times: string[] = [];
      try {
        const [sh, sm] = (start || '00:00').split(':').map(Number);
        const [eh, em] = (end || '23:59').split(':').map(Number);
        let cur = new Date();
        cur.setHours(sh, sm, 0, 0);
        const endDate = new Date();
        endDate.setHours(eh, em, 0, 0);
        while (cur <= endDate) {
          const hh = String(cur.getHours()).padStart(2, '0');
          const mm = String(cur.getMinutes()).padStart(2, '0');
          times.push(`${hh}:${mm}`);
          cur = new Date(cur.getTime() + stepMin * 60 * 1000);
        }
      } catch (e) {
        // fallback
      }
      return times;
    };

    // Validate that horarioInicio aligns with the modalidade's duration/availability when modalidadeId is provided
    if (modalidadeId) {
      try {
        const modDoc: any = await Modalidade.findById(modalidadeId).lean();
        if (modDoc) {
          const dur = typeof modDoc.duracao === 'number' ? Number(modDoc.duracao) : parseInt(String(modDoc.duracao || '30')) || 30;
          // If modalidade defines explicit horariosDisponiveis, build allowed starts using the modalidade duration
          let allowedStarts = new Set<string>();
          if (Array.isArray(modDoc.horariosDisponiveis) && modDoc.horariosDisponiveis.length > 0) {
            for (const hd of modDoc.horariosDisponiveis) {
              const hdDays = Array.isArray(hd.diasSemana) && hd.diasSemana.length > 0 ? hd.diasSemana.map((d:number)=> d>6? d-1: d) : null;
              // only consider entries that include the requested diaSemana (or entries without days)
              if (hdDays && Array.isArray(hdDays) && hdDays.length > 0 && (!hdDays.includes(diaSemana))) continue;
              const start = hd.horaInicio || hd.hora_inicio || '';
              const end = hd.horaFim || hd.hora_fim || '';
              if (!start || !end) continue;
              const slots = generateTimes(start, end, dur);
              for (const s of slots) allowedStarts.add(s);
            }
          } else if (modDoc.horarioFuncionamento) {
            const hf = modDoc.horarioFuncionamento || {};
            if (hf.manha?.inicio && hf.manha?.fim) {
              const slots = generateTimes(hf.manha.inicio, hf.manha.fim, dur);
              for (const s of slots) allowedStarts.add(s);
            }
            if (hf.tarde?.inicio && hf.tarde?.fim) {
              const slots = generateTimes(hf.tarde.inicio, hf.tarde.fim, dur);
              for (const s of slots) allowedStarts.add(s);
            }
          }

          // If we built an allowedStarts set, require horarioInicio to be one of them
          if (allowedStarts.size > 0) {
            if (!allowedStarts.has(horarioInicio)) {
              return NextResponse.json({ success: false, error: 'Horario de inicio nao condiz com a duracao/horarios da modalidade' }, { status: 400 });
            }
          } else {
            // Fallback: require minute alignment (e.g., minutes % dur === 0)
            const m = parseTimeToMinutes(horarioInicio);
            if (m % dur !== 0) {
              return NextResponse.json({ success: false, error: 'Horario de inicio nao alinhado com a duracao da modalidade' }, { status: 400 });
            }
          }
        }
      } catch (e) {
        // if validation fails unexpectedly, continue and let save handle other errors
        console.warn('Erro validacao modalidade alignment:', e);
      }
    }

    console.log('📍 Dados recebidos para criar horário:', {
      alunoId,
      professorId,
      diaSemana,
      horarioInicio,
      horarioFim,
      observacoes
    });

    // Validações básicas
    // professorId, diaSemana, horarioInicio and horarioFim are required.
    // alunoId is optional: when absent, we create a horario 'template' (turma) that can later receive alunos.
    if (!professorId || diaSemana === undefined || !horarioInicio || !horarioFim) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campos obrigatórios: professorId, diaSemana, horarioInicio, horarioFim'
        },
        { status: 400 }
      );
    }

    // Se alunoId foi fornecido, fazemos validações específicas de conflito para o aluno
  if (alunoId) {
      // Build base query for conflicts including modalidadeId if provided.
      const baseQuery: any = {
        alunoId,
        diaSemana,
        ativo: true
      };

      // If modalidadeId is provided, only consider records with the same modalidadeId.
      // If not provided, consider records where modalidadeId is missing/null to avoid false conflicts across modalidades.
      if (modalidadeId) {
        baseQuery.modalidadeId = modalidadeId;
      } else {
        baseQuery.$or = [ { modalidadeId: { $exists: false } }, { modalidadeId: null } ];
      }

      const conflitoAluno = await HorarioFixo.findOne({
        ...baseQuery,
        $or: [
          {
            $and: [
              { horarioInicio: { $lte: horarioInicio } },
              { horarioFim: { $gt: horarioInicio } }
            ]
          },
          {
            $and: [
              { horarioInicio: { $lt: horarioFim } },
              { horarioFim: { $gte: horarioFim } }
            ]
          }
        ]
      });

      if (conflitoAluno) {
        return NextResponse.json(
          {
            success: false,
            error: 'Aluno já tem aula agendada neste horário'
          },
          { status: 400 }
        );
      }

      // Verificar se já existe exatamente o mesmo registro (mesmo aluno, professor, horário e modalidade)
      const duplicataExataQuery: any = {
        alunoId,
        professorId,
        diaSemana,
        horarioInicio,
        horarioFim,
        ativo: true
      };
      if (modalidadeId) duplicataExataQuery.modalidadeId = modalidadeId;
      else duplicataExataQuery.$or = [ { modalidadeId: { $exists: false } }, { modalidadeId: null } ];

      const duplicataExata = await HorarioFixo.findOne(duplicataExataQuery);

      if (duplicataExata) {
        return NextResponse.json(
          {
            success: false,
            error: 'Este aluno já está cadastrado neste horário com este professor'
          },
          { status: 400 }
        );
      }
    }

    // Múltiplos alunos podem ter o mesmo horário com o mesmo professor (conceito de turma)
    // Não verificamos mais conflito de professor no mesmo horário

    // Criar horário
    const payload: any = {
      professorId,
      diaSemana,
      horarioInicio,
      horarioFim,
      observacoes
    };
  // Não salvar alunoId no HorarioFixo. Matrícula é feita via /api/matriculas.
    if (modalidadeId) payload.modalidadeId = modalidadeId;

    // Ensure we don't set alunoId to null (convert falsy to undefined) so partial unique index works
    if (!payload.alunoId) delete payload.alunoId;

    // Before saving, detect if the database still has the old unique index
    // { alunoId:1, diaSemana:1, horarioInicio:1 } and try to migrate it to include modalidadeId
    try {
      const indexes = await HorarioFixo.collection.indexes();
      // find an index whose key exactly matches the old pattern (order may vary)
      const oldIdx = indexes.find((ix: any) => {
        const keys = ix.key || {};
        const keyNames = Object.keys(keys).join(',');
        return (keys.alunoId === 1 || keys.alunoId === '1') && (keys.diaSemana === 1 || keys.diaSemana === '1') && (keys.horarioInicio === 1 || keys.horarioInicio === '1') && !keys.modalidadeId;
      });
      if (oldIdx) {
        const idxName = typeof oldIdx.name === 'string' ? oldIdx.name : undefined;
        console.log('🔁 Índice antigo detectado em horariofixos:', idxName, '— atualizando para incluir modalidadeId');
        try {
          // drop the old index by name (if we have a name)
          if (idxName) await HorarioFixo.collection.dropIndex(idxName);
        } catch (dropErr:any) {
          console.warn('⚠️ Falha ao dropar índice antigo (continuando):', String(dropErr?.message || dropErr));
        }
        try {
          await HorarioFixo.collection.createIndex(
            { alunoId: 1, diaSemana: 1, horarioInicio: 1, modalidadeId: 1 },
            { unique: true, partialFilterExpression: { alunoId: { $exists: true, $ne: null }, ativo: true } }
          );
          console.log('✅ Índice migrado: agora inclui modalidadeId');
        } catch (createErr:any) {
          console.warn('⚠️ Falha ao criar novo índice com modalidadeId (continuando):', String(createErr?.message || createErr));
        }
      }
    } catch (idxErr:any) {
      console.warn('⚠️ Não foi possível listar índices de horariofixos (continuando):', String(idxErr?.message || idxErr));
    }

    const novoHorario = new HorarioFixo(payload);

    // Diagnostic logging: if a HorarioFixo is being created with an alunoId, log caller info
    try {
      if (payload.alunoId) {
        const logObj: any = {
          ts: new Date().toISOString(),
          payload: {
            alunoId: String(payload.alunoId),
            professorId: String(payload.professorId),
            diaSemana,
            horarioInicio,
            horarioFim,
            observacoes: payload.observacoes || null,
            modalidadeId: payload.modalidadeId ? String(payload.modalidadeId) : null
          },
          stack: new Error('STACK TRACE FOR HorarioFixo.save()').stack
        };
        try {
          const logDir = path.resolve(process.cwd(), 'logs');
          try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir); } catch(e) {}
          const logfile = path.join(logDir, 'debug-horarios-post.log');
          fs.appendFileSync(logfile, JSON.stringify(logObj) + '\n');
        } catch (fileErr:any) {
          console.warn('DEBUG: failed to write debug-horarios-post.log', String(fileErr?.message || fileErr));
        }

        console.warn('DEBUG: Creating HorarioFixo with alunoId detected. payload:', {
          alunoId: String(payload.alunoId),
          professorId: String(payload.professorId),
          diaSemana,
          horarioInicio,
          horarioFim
        });
        console.warn(logObj.stack);
      }
    } catch (logErr:any) {
      console.warn('DEBUG: failed to log HorarioFixo diagnostic', String(logErr?.message || logErr));
    }

    let horarioSalvo;
    try {
      horarioSalvo = await novoHorario.save();
    } catch (saveErr: any) {
      // Handle duplicate key error (E11000) defensively and give more context
      if (saveErr && saveErr.code === 11000) {
        // Log details for debugging
        console.error('🔒 Duplicate key error on HorarioFixo.save:', {
          message: saveErr.message,
          keyValue: saveErr.keyValue,
          keyPattern: saveErr.keyPattern
        });

        // Try to find the existing conflicting document to return a clearer response
        try {
          const keyValue = saveErr.keyValue || {};
          const conflictQuery: any = { ativo: true };
          // copy known fields from keyValue into a query
          for (const k of Object.keys(keyValue)) {
            // convert string ids to ObjectId where appropriate
            if ((k === 'alunoId' || k === 'professorId' || k === 'modalidadeId') && mongoose.Types.ObjectId.isValid(keyValue[k])) {
              conflictQuery[k] = new mongoose.Types.ObjectId(keyValue[k]);
            } else {
              conflictQuery[k] = keyValue[k];
            }
          }
          // include diaSemana and horarioInicio if provided in the payload (common unique combo)
          if (diaSemana !== undefined) conflictQuery.diaSemana = diaSemana;
          if (horarioInicio) conflictQuery.horarioInicio = horarioInicio;

          const existing = await HorarioFixo.findOne(conflictQuery).select('_id alunoId professorId diaSemana horarioInicio horarioFim');
          if (existing) {
            return NextResponse.json(
              { success: false, error: 'Conflito: registro duplicado', existingId: existing._id, existing },
              { status: 409 }
            );
          }
        } catch (innerErr) {
          console.error('Erro ao buscar documento conflitante após E11000:', innerErr);
        }

        return NextResponse.json(
          { success: false, error: 'Conflito: registro duplicado' },
          { status: 409 }
        );
      }
      throw saveErr;
    }
    
    // Buscar com populate para retornar dados completos
    const horarioCompleto = await HorarioFixo.findById(horarioSalvo._id)
      .populate('alunoId', 'nome email periodoTreino parceria observacoes')
      .populate('professorId', 'nome especialidade cor')
      .select('-__v');

    return NextResponse.json(
      {
        success: true,
        data: horarioCompleto,
        message: 'Horário criado com sucesso'
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('🔥 Erro detalhado ao criar horário:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      errors: error.errors
    });
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        {
          success: false,
          error: messages.join(', ')
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: `Erro interno do servidor: ${error.message}`
      },
      { status: 500 }
    );
  }
}