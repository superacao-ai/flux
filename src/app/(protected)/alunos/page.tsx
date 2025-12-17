"use client";
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import ReagendarAulaModal from "@/components/ReagendarAulaModal";

import { useState, useEffect, useMemo } from 'react';
// Link removed; modal will be used for creating new alunos
import ProtectedPage from '@/components/ProtectedPage';
import { permissoesAlunos } from '@/lib/permissoes';

interface Modalidade {
  _id: string;
  nome: string;
  cor: string;
  duracao: number;
  limiteAlunos: number;
}

interface Professor {
  _id: string;
  nome: string;
  especialidade: string;
}

interface Aluno {
  _id: string;
  nome: string;
  email: string;
  telefone: string;
  endereco?: string;
  cpf?: string;
  dataNascimento?: string;
  modalidadeId: Modalidade;
  plano?: string;
  observacoes?: string;
  ativo: boolean;
  modalidades?: { _id: string; nome: string; cor?: string }[];
  horarios?: AlunoHorario[];
  congelado?: boolean;
  ausente?: boolean;
  // emEspera removed
  periodoTreino?: string | null;
  parceria?: string | null;
  caracteristicas?: string[];
}

interface AlunoHorario {
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  professorNome?: string;
  modalidadeNome?: string;
  horarioId?: string;
  matriculaId?: string;
}

export default function AlunosPage() {
    const [mounted, setMounted] = useState(false);
    const [showReagendarModal, setShowReagendarModal] = useState(false);
    const [reagendarData, setReagendarData] = useState<any>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);

  // Marcar como montado no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch all alunos and attach their horarios (so students without horarios are included)
  const fetchAlunos = async () => {
    try {
      // Determinar parâmetros de busca baseado no filtro de status
      let url = '/api/alunos';
      if (appliedFilterStatus === 'inativo') {
        url += '?onlyInactive=true';
      } else if (appliedFilterStatus === 'all') {
        url += '?includeInactive=true';
      }
      // Se 'ativo', usa o padrão (só ativos)
      
      // Fetch all alunos
      const respAlunos = await fetch(url);
      const dataAlunos = await respAlunos.json();
      let alunosList: any[] = [];
      if (dataAlunos && dataAlunos.success) {
        alunosList = dataAlunos.data || [];
      }

      // Fetch all horarios to attach schedule info per aluno
      const respHor = await fetch('/api/horarios');
      const dataHor = await respHor.json();
      const horarios = (dataHor && dataHor.success) ? (dataHor.data as any[]) : [];

      // Build a map of alunoId -> horarios
      // Prefer the newer `matriculas` shape on HorarioFixo: expand matriculas into per-aluno entries.
      // Fallback to legacy HorarioFixo.alunoId when present (for older seeds/backups).
      const horariosMap: Record<string, AlunoHorario[]> = {};
      horarios.forEach(h => {
        try {
          const ms = (h as any).matriculas;
              if (Array.isArray(ms) && ms.length > 0) {
            // expand each matricula into a horario entry for the referenced aluno
            for (let i = 0; i < ms.length; i++) {
              const m = ms[i] || {};
              // matricula.alunoId may be populated or just an id string
              const alunoRef = m.alunoId || null;
              const alunoId = alunoRef && (typeof alunoRef === 'string' ? alunoRef : (alunoRef._id || alunoRef)) || null;
              if (!alunoId) continue;

              const mod = (h.modalidadeId && (h.modalidadeId.nome || h.modalidadeId._id)) ? h.modalidadeId : ((m && (m.modalidadeId || null)) || null);
              let professorNome = (m && (m.professorNome || m.professorNome === '') && m.professorNome) ? m.professorNome : (h.professorId && (h.professorId.nome || h.professorId) ? (h.professorId.nome || String(h.professorId)) : '');
              // Verificar se é ObjectId de professor apagado
              if (professorNome && typeof professorNome === 'string' && /^[0-9a-f]{24}$/i.test(professorNome)) {
                professorNome = 'Sem professor';
              }
                  const horarioEntry: AlunoHorario = {
                diaSemana: h.diaSemana,
                horarioInicio: h.horarioInicio,
                horarioFim: h.horarioFim,
                professorNome: professorNome,
                modalidadeNome: mod ? (mod.nome || '') : ''
                    , horarioId: h._id || undefined
                    , matriculaId: (m && (m._id || m.id)) ? String(m._id || m.id) : undefined
              };
              horariosMap[String(alunoId)] = horariosMap[String(alunoId)] || [];
              horariosMap[String(alunoId)].push(horarioEntry);
            }
          } else {
            // legacy shape: horario has a single alunoId field
            const aluno = h.alunoId;
            if (aluno && aluno._id) {
              const mod = (h.modalidadeId && (h.modalidadeId.nome || h.modalidadeId._id)) ? h.modalidadeId : (aluno.modalidadeId || null);
              let professorNome = h.professorId && (h.professorId.nome || h.professorId) ? (h.professorId.nome || String(h.professorId)) : '';
              // Verificar se é ObjectId de professor apagado
              if (professorNome && typeof professorNome === 'string' && /^[0-9a-f]{24}$/i.test(professorNome)) {
                professorNome = 'Sem professor';
              }
              const horarioEntry: AlunoHorario = {
                diaSemana: h.diaSemana,
                horarioInicio: h.horarioInicio,
                horarioFim: h.horarioFim,
                professorNome: professorNome,
                modalidadeNome: mod ? (mod.nome || '') : ''
                , horarioId: h._id || undefined
              };
              horariosMap[String(aluno._id)] = horariosMap[String(aluno._id)] || [];
              horariosMap[String(aluno._id)].push(horarioEntry);
            }
          }
        } catch (e) {
          // ignore problematic horario entries
          console.warn('Erro ao processar horario para map de alunos:', e);
        }
      });

      // Compose final alunos array: ensure every aluno appears, attach modalidade(s) and horarios
      const finalAlunos = alunosList.map(a => {
        // collect modalidades: combine aluno.modalidadeId and any modalidade info from horarios
        const modalidadesSet = new Map<string, { _id: string; nome: string; cor?: string }>();
        if (a.modalidadeId && a.modalidadeId._id) {
          modalidadesSet.set(String(a.modalidadeId._id), { _id: String(a.modalidadeId._id), nome: a.modalidadeId.nome || 'N/A', cor: a.modalidadeId.cor || '#3B82F6' });
        }
        const alunoHorarios = horariosMap[String(a._id)] || [];
        alunoHorarios.forEach(h => {
          if (h.modalidadeNome) {
            // we don't have modalidade _id here, use name as key
            modalidadesSet.set(h.modalidadeNome, { _id: h.modalidadeNome, nome: h.modalidadeNome, cor: '#3B82F6' });
          }
        });

        // Derive characteristic flags from the aluno object first; if missing, try to infer from horarios (matriculas or h.alunoId)
        let congelado = a.congelado === true;
        let ausente = a.ausente === true;
        // emEspera flag removed from summary derivation
        let periodoTreino = a.periodoTreino || null;
        let parceria = a.parceria || a.parceriaNome || null;

        if (!congelado || !ausente || !periodoTreino || !parceria) {
          for (let i = 0; i < horarios.length; i++) {
            const h = horarios[i];
            try {
              // check matriculas shape
              const ms = (h as any).matriculas;
              if (Array.isArray(ms)) {
                for (let j = 0; j < ms.length; j++) {
                  const m = ms[j] || {};
                  const alunoRef = m.alunoId || null;
                  const alunoId = alunoRef && (typeof alunoRef === 'string' ? alunoRef : (alunoRef._id || alunoRef)) || null;
                  if (!alunoId) continue;
                  if (String(alunoId) === String(a._id)) {
                    if (!congelado && m.congelado === true) congelado = true;
                    if (!ausente && m.ausente === true) ausente = true;
                    // emEspera field ignored
                    if (!periodoTreino && m.periodoTreino) periodoTreino = m.periodoTreino;
                    if (!parceria && (m.parceria || m.parceriaNome)) parceria = m.parceria || m.parceriaNome || parceria;
                  }
                }
              } else {
                // legacy horario.alunoId shape
                const hhAluno = h.alunoId;
                if (hhAluno && (hhAluno._id || hhAluno)) {
                  const hhId = hhAluno._id || hhAluno;
                  if (String(hhId) === String(a._id)) {
                    if (!congelado && hhAluno.congelado === true) congelado = true;
                    if (!ausente && hhAluno.ausente === true) ausente = true;
                    // emEspera field ignored
                    if (!periodoTreino && hhAluno.periodoTreino) periodoTreino = hhAluno.periodoTreino;
                    if (!parceria && (hhAluno.parceria || hhAluno.parceriaNome)) parceria = hhAluno.parceria || hhAluno.parceriaNome || parceria;
                  }
                }
              }
            } catch (e) {
              // ignore per-entry errors
            }
            // if we already have everything truthy, break early
            if (congelado && ausente && periodoTreino && parceria) break;
          }
        }

        const alunoObj = {
          _id: a._id,
          nome: a.nome,
          email: a.email || '',
          telefone: a.telefone || 'Não informado',
          endereco: a.endereco || '',
          cpf: a.cpf || '',
          dataNascimento: a.dataNascimento || '',
          modalidadeId: a.modalidadeId || { _id: '', nome: 'N/A', cor: '#3B82F6', duracao: 0, limiteAlunos: 0 },
          plano: a.plano,
          observacoes: a.observacoes,
          ativo: a.ativo !== undefined ? a.ativo : true,
          modalidades: Array.from(modalidadesSet.values()),
          horarios: alunoHorarios,
          congelado,
          ausente,
          periodoTreino,
          parceria,
          caracteristicas: Array.isArray(a.caracteristicas) ? a.caracteristicas : [],
        } as Aluno;

        return alunoObj;
      });

      setAlunos(finalAlunos);
      // ...reposições removidas
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
    } finally {
      setLoading(false);
    }
  };

  // ...reposições removidas

  const fetchModalidades = async () => {
    try {
      const response = await fetch('/api/modalidades');
      const data = await response.json();
      if (data.success) {
        setModalidades(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar modalidades:', error);
    }
  };

  const fetchProfessores = async () => {
    try {
      const response = await fetch('/api/usuarios');
      const data = await response.json();
      let usuariosList: any[] = [];
      if (Array.isArray(data)) usuariosList = data;
      else if (data && data.data) usuariosList = data.data;
      const professores = usuariosList
        .filter((u: any) => String(u.tipo || '').toLowerCase() === 'professor')
        .map((u: any) => ({
          _id: u._id,
          nome: u.nome,
          email: u.email || '',
          telefone: u.telefone || '',
          especialidades: u.especialidades || [],
          especialidade: (u.especialidades && u.especialidades.length > 0) ? (typeof u.especialidades[0] === 'string' ? u.especialidades.join(', ') : u.especialidades.map((e:any)=> e.nome || e).join(', ')) : '',
          cor: u.cor || '#3B82F6',
          ativo: u.ativo !== undefined ? u.ativo : true,
          tipo: u.tipo,
          abas: u.abas || [],
          isUsuario: true
        }));
      setProfessores(professores);
    } catch (error) {
      console.error('Erro ao buscar professores:', error);
    }
  };

  // Resolve a canonical color for a modalidade entry using the global modalidades list
  const getModalidadeColor = (m: any) => {
    if (!m) return '#3B82F6';
    // try find by id or name in global modalidades state
    const id = (m && ((m._id || (m as any).id))) || null;
    const nome = m && (m.nome || '');
    const found = modalidades.find(md => (id && String(md._id) === String(id)) || (md.nome && md.nome === nome));
    return (found && found.cor) || m.cor || '#3B82F6';
  };

  // Função para padronizar nomes: converter para MAIÚSCULAS
  const padronizarNome = (nome: string): string => {
    return String(nome || '').trim().toUpperCase();
  };

  

  // Estados para edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAluno, setEditingAluno] = useState<Aluno | null>(null);
  const [editFormData, setEditFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    endereco: '',
    observacoes: '',
    cpf: '',
    dataNascimento: ''
  });

  const [editFlags, setEditFlags] = useState<{
    congelado: boolean;
    ausente: boolean;
    periodoTreino: string | null;
    parceria: string | null;
    ativo: boolean;
  }>({ congelado: false, ausente: false, periodoTreino: null, parceria: null, ativo: true });
  const [editCaracteristicas, setEditCaracteristicas] = useState<string[]>([]);
  const [newCaracteristica, setNewCaracteristica] = useState('');

  // ...modal de reposição removido

  // ...debug modal reposição removido

  // Estados para seleção múltipla
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [query, setQuery] = useState('');
  // Filtros da página (staged / applied below)

  // Staged UI filter values (user edits these, then clicks Aplicar filtros)
  const [uiFilterModalidade, setUiFilterModalidade] = useState('');
  const [uiFilterStatus, setUiFilterStatus] = useState<'all' | 'ativo' | 'inativo'>('all');
  const [uiFilterCaracteristica, setUiFilterCaracteristica] = useState('');
  const [uiFilterProfessor, setUiFilterProfessor] = useState('');

  // Applied filters used for actual filtering
  const [appliedFilterModalidade, setAppliedFilterModalidade] = useState('');
  const [appliedFilterStatus, setAppliedFilterStatus] = useState<'all' | 'ativo' | 'inativo'>('ativo');
  const [appliedFilterCaracteristica, setAppliedFilterCaracteristica] = useState('');
  const [appliedFilterProfessor, setAppliedFilterProfessor] = useState('');

  // Carregar dados quando o filtro de status mudar
  useEffect(() => {
    fetchAlunos();
    fetchModalidades();
    fetchProfessores();
  }, [appliedFilterStatus]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Counts for quick stats
  const caracteristicasCounts = useMemo(() => {
    let congelado = 0;
    let ausente = 0;
    let totalpass = 0;
    let periodo1236 = 0;
    alunos.forEach(a => {
      if (a.congelado) congelado++;
      if (a.ausente) ausente++;
      if (String(a.parceria || '').toLowerCase() === 'totalpass') totalpass++;
      if (String(a.periodoTreino || '').toLowerCase() === '12/36') periodo1236++;
    });
    return { congelado, ausente, totalpass, periodo1236 };
  }, [alunos]);

  // Função para abrir modal de edição
  const abrirEdicao = (aluno: Aluno) => {
    setEditingAluno(aluno);
    // Formatar data de nascimento para input date (YYYY-MM-DD)
    let dataNascimentoFormatted = '';
    if (aluno.dataNascimento) {
      try {
        const d = new Date(aluno.dataNascimento);
        dataNascimentoFormatted = d.toISOString().split('T')[0];
      } catch { /* ignore */ }
    }
    // Formatar CPF com máscara (XXX.XXX.XXX-XX)
    let cpfFormatted = '';
    if (aluno.cpf) {
      const cpfLimpo = String(aluno.cpf).replace(/\D/g, '');
      if (cpfLimpo.length === 11) {
        cpfFormatted = `${cpfLimpo.slice(0,3)}.${cpfLimpo.slice(3,6)}.${cpfLimpo.slice(6,9)}-${cpfLimpo.slice(9)}`;
      } else {
        cpfFormatted = aluno.cpf;
      }
    }
    setEditFormData({
      nome: aluno.nome,
      email: aluno.email || '',
      telefone: aluno.telefone,
      endereco: aluno.endereco || '',
      observacoes: aluno.observacoes || '',
      cpf: cpfFormatted,
      dataNascimento: dataNascimentoFormatted
    });
    // set flags for edit modal
    setEditFlags({
      congelado: aluno.congelado === true,
      ausente: aluno.ausente === true,
      periodoTreino: aluno.periodoTreino || null,
      parceria: aluno.parceria || null,
      ativo: aluno.ativo !== undefined ? aluno.ativo : true,
    });
    // custom características
    setEditCaracteristicas(Array.isArray((aluno as any).caracteristicas) ? (aluno as any).caracteristicas.slice() : []);
    setShowEditModal(true);
  };

  const abrirNovoAluno = () => {
    setEditingAluno(null);
    setEditFormData({ nome: '', email: '', telefone: '', endereco: '', observacoes: '', cpf: '', dataNascimento: '' });
    setEditFlags({ congelado: false, ausente: false, periodoTreino: null, parceria: null, ativo: true });
    setEditCaracteristicas([]);
    setShowEditModal(true);
  };

  // ...toda lógica de modal de reposição removida

  // Função para salvar edição
  const salvarEdicao = async () => {
    try {
      if (!editFormData.nome || String(editFormData.nome).trim() === '') { toast.warning('Nome é obrigatório'); return; }

      // Limpar CPF (apenas números)
      const cpfLimpo = editFormData.cpf ? editFormData.cpf.replace(/\D/g, '') : '';
      if (cpfLimpo && cpfLimpo.length !== 11) {
        toast.warning('CPF deve ter 11 dígitos');
        return;
      }

      const payload: any = {
        nome: editFormData.nome,
        email: (typeof editFormData.email === 'string' ? String(editFormData.email).trim() : editFormData.email),
        telefone: (typeof editFormData.telefone === 'string' ? String(editFormData.telefone).trim() : editFormData.telefone),
        endereco: (typeof editFormData.endereco === 'string' ? String(editFormData.endereco).trim() : editFormData.endereco),
        observacoes: (typeof editFormData.observacoes === 'string' ? String(editFormData.observacoes).trim() : editFormData.observacoes) || '',
        cpf: cpfLimpo || undefined,
        dataNascimento: editFormData.dataNascimento || undefined,
        congelado: !!editFlags.congelado,
        ausente: !!editFlags.ausente,
        periodoTreino: editFlags.periodoTreino,
        parceria: editFlags.parceria,
        ativo: !!editFlags.ativo,
        caracteristicas: Array.isArray(editCaracteristicas) && editCaracteristicas.length > 0 ? editCaracteristicas : undefined,
      };

      // Do not send an empty email (''), it can violate unique sparse index — omit the field instead
      if (!payload.email) delete payload.email;
      // Also omit other empty string fields to keep documents clean
      if (!payload.telefone) delete payload.telefone;
      if (!payload.endereco) delete payload.endereco;
      // observacoes: sempre enviar (pode ser string vazia para limpar)
      if (!payload.cpf) delete payload.cpf;
      if (!payload.dataNascimento) delete payload.dataNascimento;

      let response;
      if (editingAluno && editingAluno._id) {
        response = await fetch(`/api/alunos/${editingAluno._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`/api/alunos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();
      console.log('salvarEdicao response:', data);
      if (data && data.success) {
        // If we just created a student, some backends ignore custom flags on POST.
        // As a fallback, if we created a new aluno, call PUT to ensure flags are persisted.
              if (!editingAluno) {
          const createdId = data.data?._id || data.data?.id || data.id || null;
          if (createdId) {
            try {
              const flagsPayload = {
                congelado: !!payload.congelado,
                ausente: !!payload.ausente,
                periodoTreino: payload.periodoTreino,
                parceria: payload.parceria,
                ativo: !!payload.ativo,
              };
              const respFlags = await fetch(`/api/alunos/${createdId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(flagsPayload) });
              const dataFlags = await respFlags.json();
              console.log('flags PUT response:', dataFlags);
            } catch (err) {
              console.warn('Falha ao atualizar flags via PUT após criação:', err);
            }
          }
        }

        await fetchAlunos();
        setShowEditModal(false);
        toast.success(editingAluno ? 'Aluno atualizado com sucesso!' : 'Aluno criado com sucesso!');
      } else {
        toast.error('Erro: ' + (data && data.error ? data.error : 'erro'));
      }
    } catch (error) {
      console.error('Erro ao salvar aluno:', error);
      toast.error('Erro ao salvar aluno');
    }
  };

  // Função para reativar aluno
  const reativarAluno = async (id: string, nome: string) => {
    try {
      // Primeiro, buscar informações das matrículas do aluno
      const checkResponse = await fetch(`/api/alunos/${id}/matriculas-check`);
      const checkData = await checkResponse.json();
      
      let warningMessage = `Deseja reativar o aluno "${nome}"?`;
      let hasIssues = false;
      
      if (checkData.success && checkData.matriculas && checkData.matriculas.length > 0) {
        const problematicas = checkData.matriculas.filter((m: any) => m.turmaLotada || m.horarioInexistente);
        
        if (problematicas.length > 0) {
          hasIssues = true;
          warningMessage = `O aluno "${nome}" possui ${problematicas.length} matrícula(s) com problemas:\n\n`;
          
          problematicas.forEach((m: any) => {
            if (m.horarioInexistente) {
              warningMessage += `• Horário ${m.diaSemana} ${m.horarioInicio}-${m.horarioFim} não existe mais\n`;
            } else if (m.turmaLotada) {
              warningMessage += `• Turma ${m.diaSemana} ${m.horarioInicio}-${m.horarioFim} está lotada (${m.alunosAtuais}/${m.limiteAlunos})\n`;
            }
          });
          
          warningMessage += `\nAo reativar, essas matrículas NÃO serão reativadas automaticamente. Você precisará matricular o aluno novamente.`;
        }
      }

      const result = await Swal.fire({
        title: 'Reativar aluno?',
        text: warningMessage,
        icon: hasIssues ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, reativar',
        cancelButtonText: 'Cancelar'
      });
      
      if (!result.isConfirmed) {
        return;
      }

      // Reativar o aluno
      const response = await fetch(`/api/alunos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: true }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchAlunos();
        if (hasIssues) {
          toast.success('Aluno reativado. Atenção: matricule o aluno novamente nas turmas desejadas.');
        } else {
          toast.success('Aluno reativado com sucesso');
        }
      } else {
        toast.error(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao reativar aluno:', error);
      toast.error('Erro ao reativar aluno');
    }
  };

  // Função para excluir aluno individual
  const excluirAluno = async (id: string, nome: string, isAtivo: boolean) => {
    // Se o aluno já está inativo, oferecer exclusão definitiva
    if (!isAtivo) {
      const result = await Swal.fire({
        title: 'Excluir permanentemente?',
        text: `O aluno "${nome}" já está inativo. Deseja excluí-lo permanentemente do banco de dados?`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, excluir permanentemente',
        cancelButtonText: 'Cancelar',
        footer: '<span class="text-sm text-gray-500">Esta ação não pode ser desfeita!</span>'
      });
      
      if (!result.isConfirmed) {
        return;
      }

      try {
        const response = await fetch(`/api/alunos/${id}?permanent=true`, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (data.success) {
          await fetchAlunos();
          toast.success('Aluno excluído permanentemente');
        } else {
          toast.error(`Erro: ${data.error}`);
        }
      } catch (error) {
        console.error('Erro ao excluir aluno:', error);
        toast.error('Erro ao excluir aluno');
      }
      return;
    }

    // Exclusão normal (soft delete)
    const result = await Swal.fire({
      title: 'Excluir aluno?',
      text: `Tem certeza que deseja excluir o aluno "${nome}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });
    
    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/alunos/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchAlunos();
        toast.success('Aluno excluído com sucesso');
      } else {
        toast.error(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao excluir aluno:', error);
      toast.error('Erro ao excluir aluno');
    }
  };

  // Cancelar reagendamento (quando criado a partir do modal de faltas)
  const cancelarReagendamento = async (reagendamentoId: string) => {
    if (!reagendamentoId) return;
    const result = await Swal.fire({
      title: 'Cancelar reagendamento?',
      text: 'Tem certeza que deseja cancelar este reagendamento?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, cancelar',
      cancelButtonText: 'Não'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/reagendamentos/${reagendamentoId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data && data.success) {
        // recarregar dados para atualizar estado
        await fetchAlunos();
        toast.success('Reagendamento cancelado com sucesso');
      } else {
        toast.error('Erro ao cancelar reagendamento: ' + (data && (data.error || data.message) ? (data.error || data.message) : 'erro'));
      }
    } catch (e) {
      console.error('Erro ao cancelar reagendamento', e);
      toast.error('Erro ao cancelar reagendamento');
    }
  };

  // Filter alunos by query (name, email, phone, modalidades, modalidadeId.nome, plano)
  // Also support searching by status keywords typed into the main search input: e.g. "congelado", "ausente", "12/36", "totalpass", "ativo", "inativo".
  const filteredAlunos = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    const wantsCongelado = q.includes('congelado');
    const wantsAusente = q.includes('ausente') || q.includes('parou') || q.includes('paroude') || q.includes('paroudevir');
    const wants12_36 = q.includes('12/36') || q.includes('1236');
    const wantsTotalpass = q.includes('totalpass');
    const wantsAtivo = q.includes('ativo') && !q.includes('inativo');
    const wantsInativo = q.includes('inativo');
    const wantsAnyKeyword = wantsCongelado || wantsAusente || wants12_36 || wantsTotalpass || wantsAtivo || wantsInativo;

    return alunos.filter(aluno => {
      const nome = String(aluno.nome || '').toLowerCase();
      const email = String(aluno.email || '').toLowerCase();
      const telefone = String(aluno.telefone || '').toLowerCase();
      const telefoneLimpo = telefone.replace(/\D/g, ''); // Telefone sem formatação para busca
      const plano = String(aluno.plano || '').toLowerCase();
      const modIdNome = String(aluno.modalidadeId?.nome || '').toLowerCase();
      const modalidadesStr = (aluno.modalidades || []).map(m => String(m.nome || '').toLowerCase()).join(' ');
      const cpf = String(aluno.cpf || '').toLowerCase();
      const cpfLimpo = cpf.replace(/\D/g, ''); // CPF sem formatação para busca
      const qLimpo = q.replace(/\D/g, ''); // Query sem formatação para comparar com CPF/telefone

      // base query match (name, email, phone, plano, modalidade, cpf)
      const baseMatch = q === '' || 
        nome.includes(q) || 
        email.includes(q) || 
        telefone.includes(q) || 
        (qLimpo.length >= 3 && telefoneLimpo.includes(qLimpo)) ||
        plano.includes(q) || 
        modIdNome.includes(q) || 
        modalidadesStr.includes(q) ||
        cpf.includes(q) ||
        (qLimpo.length >= 3 && cpfLimpo.includes(qLimpo)); // Busca CPF com pelo menos 3 dígitos

      // If the user typed any of the special status keywords, require those to match.
      if (wantsAnyKeyword) {
        if (wantsCongelado && !aluno.congelado) return false;
        if (wantsAusente && !aluno.ausente) return false;
        if (wants12_36 && String(aluno.periodoTreino || '').toLowerCase() !== '12/36') return false;
        if (wantsTotalpass && String(aluno.parceria || '').toLowerCase() !== 'totalpass') return false;
        if (wantsAtivo && !aluno.ativo) return false;
        if (wantsInativo && aluno.ativo) return false;
        // Also allow combination queries such as "joão congelado": in that case the baseMatch must also be satisfied
        if (!baseMatch && q.split(' ').filter(Boolean).length > 1) return false;
      } else {
        if (!baseMatch) return false;
      }

      // apply applied filters (UI filters remain authoritative)
      if (appliedFilterModalidade) {
        const has = (aluno.modalidades || []).some(m => String(m.nome || '').toLowerCase() === String(appliedFilterModalidade).toLowerCase()) || String(aluno.modalidadeId?.nome || '').toLowerCase() === String(appliedFilterModalidade).toLowerCase();
        if (!has) return false;
      }

      if (appliedFilterCaracteristica) {
        const c = String(appliedFilterCaracteristica).toLowerCase();
        if (c === 'congelado' && !aluno.congelado) return false;
        if (c === 'ausente' && !aluno.ausente) return false;
        if (c === '12/36' && String(aluno.periodoTreino || '').toLowerCase() !== '12/36') return false;
        if (c === 'totalpass' && String(aluno.parceria || '').toLowerCase() !== 'totalpass') return false;
        // custom caracteristicas
        if (c !== 'congelado' && c !== 'ausente' && c !== '12/36' && c !== 'totalpass') {
          const hasCustom = Array.isArray(aluno.caracteristicas) && aluno.caracteristicas.some(x => String(x || '').toLowerCase() === c);
          if (!hasCustom) return false;
        }
      }

      // Filtro por professor
      if (appliedFilterProfessor) {
        const professorFilter = String(appliedFilterProfessor).toLowerCase();
        const alunoProfs = (aluno.horarios || []).map(h => String(h.professorNome || '').toLowerCase());
        const hasProfessor = alunoProfs.some(p => p === professorFilter);
        if (!hasProfessor) return false;
      }

      return true;
    });
  }, [alunos, query, appliedFilterModalidade, appliedFilterStatus, appliedFilterCaracteristica, appliedFilterProfessor]);

  // available custom caracteristicas
  const availableCaracteristicas = useMemo(() => {
    const s = new Set<string>();
    alunos.forEach(a => {
      if (Array.isArray(a.caracteristicas)) a.caracteristicas.forEach(c => { if (c) s.add(String(c)); });
    });
    return Array.from(s).sort();
  }, [alunos]);

  // available professores (extracted from aluno horarios)
  const availableProfessores = useMemo(() => {
    const s = new Set<string>();
    alunos.forEach(a => {
      if (Array.isArray(a.horarios)) {
        a.horarios.forEach(h => {
          if (h.professorNome) s.add(String(h.professorNome));
        });
      }
    });
    return Array.from(s).sort();
  }, [alunos]);

  // Fechar modais com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEditModal) {
          setShowEditModal(false);
          setEditingAluno(null);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showEditModal]);

  // Pagination: slice the filtered list
  const totalPages = Math.max(1, Math.ceil(filteredAlunos.length / pageSize));
  const pagedAlunos = filteredAlunos.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Função para selecionar/deselecionar todos os alunos
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedAlunos([]);
    } else {
      setSelectedAlunos(pagedAlunos.map(aluno => aluno._id));
    }
  };

  // Função para selecionar/deselecionar aluno individual
  const toggleSelectAluno = (alunoId: string) => {
    setSelectedAlunos(prev => {
      const newSelected = prev.includes(alunoId)
        ? prev.filter(id => id !== alunoId)
        : [...prev, alunoId];
      return newSelected;
    });
  };

  // Keep selectAll in sync with current selection and filtered list
  useEffect(() => {
    setSelectAll(selectedAlunos.length > 0 && pagedAlunos.length > 0 && selectedAlunos.length === pagedAlunos.length);
  }, [selectedAlunos, pagedAlunos]);

  // Clamp currentPage when the number of pages changes
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages]);

  

  // Função para excluir alunos selecionados em massa
  const excluirSelecionados = async () => {
    if (selectedAlunos.length === 0) {
      toast.warning('Nenhum aluno selecionado');
      return;
    }

    // Verificar se algum dos alunos selecionados está inativo
    const alunosSelecionadosData = alunos.filter(a => selectedAlunos.includes(a._id));
    const algumInativo = alunosSelecionadosData.some(a => !a.ativo);

    let result;
    if (algumInativo) {
      result = await Swal.fire({
        title: 'Excluir permanentemente?',
        text: `Você selecionou ${selectedAlunos.length} aluno(s). Alguns já estão inativos. Deseja excluí-los permanentemente?`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, excluir permanentemente',
        cancelButtonText: 'Cancelar',
        footer: '<span class="text-sm text-gray-500">Esta ação não pode ser desfeita!</span>'
      });
    } else {
      result = await Swal.fire({
        title: 'Excluir alunos selecionados?',
        text: `Tem certeza que deseja excluir ${selectedAlunos.length} aluno(s) selecionado(s)?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, excluir todos',
        cancelButtonText: 'Cancelar'
      });
    }
    
    if (!result.isConfirmed) {
      return;
    }

    try {
      const promises = selectedAlunos.map(id => {
        const aluno = alunos.find(a => a._id === id);
        const url = aluno && !aluno.ativo ? `/api/alunos/${id}?permanent=true` : `/api/alunos/${id}`;
        return fetch(url, { method: 'DELETE' });
      });

      const responses = await Promise.all(promises);
      const results = await Promise.all(responses.map(r => r.json()));

      const sucessos = results.filter(r => r.success).length;
      const erros = results.length - sucessos;

      await fetchAlunos();
      setSelectedAlunos([]);
      setSelectAll(false);

      if (erros === 0) {
        toast.success(`${sucessos} aluno(s) excluído(s) com sucesso`);
      } else {
        toast.warning(`${sucessos} excluído(s), ${erros} erro(s)`);
      }
    } catch (error) {
      console.error('Erro ao excluir alunos:', error);
      toast.error('Erro ao excluir alunos selecionados');
    }
  };

  // Skeleton loading enquanto não está montado
  if (!mounted) {
    return (
      <ProtectedPage tab="alunos" title="Alunos - Superação Flux" fullWidth>
        <div className="px-4 py-6 sm:px-0">
          {/* Header skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <div className="h-5 bg-gray-200 rounded w-24 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-72 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-10 w-24 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
          
          {/* Search skeleton */}
          <div className="mb-6">
            <div className="h-10 bg-gray-200 rounded-lg w-full max-w-md animate-pulse" />
          </div>
          
          {/* Table skeleton */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
                ))}
              </div>
            </div>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="border-b border-gray-200 px-4 py-4 flex gap-6 items-center">
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                <div className="h-6 bg-gray-200 rounded-full w-20 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
  <ProtectedPage tab="alunos" title="Alunos - Superação Flux" fullWidth>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Desktop Header - mantido original */}
        <div className="hidden md:flex items-center justify-between gap-4 mb-6 fade-in-1">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-user-graduate text-green-600"></i>
              Alunos
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Gerencie o cadastro de alunos do studio
            </p>
          </div>

          <div className="flex items-center gap-3">
            {permissoesAlunos.criar() && (
              <button type="button" onClick={abrirNovoAluno} className="h-10 inline-flex items-center justify-center rounded-full bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700">
                <i className="fas fa-plus mr-2" aria-hidden="true"></i>
                Novo Aluno
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (appliedFilterStatus === 'inativo') {
                  setAppliedFilterStatus('ativo');
                } else {
                  setAppliedFilterStatus('inativo');
                }
                setCurrentPage(1);
              }}
              className={`h-10 inline-flex items-center justify-center rounded-full px-4 text-sm font-medium transition-colors ${
                appliedFilterStatus === 'inativo'
                  ? 'bg-gray-700 text-white hover:bg-gray-800'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={appliedFilterStatus === 'inativo' ? 'Voltar para ativos' : 'Ver alunos excluídos/inativos'}
            >
              <i className={`fas ${appliedFilterStatus === 'inativo' ? 'fa-arrow-left' : 'fa-user-slash'} mr-2`} aria-hidden="true"></i>
              {appliedFilterStatus === 'inativo' ? 'Voltar' : 'Excluídos'}
            </button>
            {selectedAlunos.length > 0 && (
              <button
                type="button"
                onClick={excluirSelecionados}
                className="h-10 inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                <span className="hidden sm:inline"></span>
                <span>Excluir ({selectedAlunos.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Header - minimalista */}
        <div className="md:hidden mb-4 fade-in-1">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Alunos</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (appliedFilterStatus === 'inativo') {
                    setAppliedFilterStatus('ativo');
                  } else {
                    setAppliedFilterStatus('inativo');
                  }
                  setCurrentPage(1);
                }}
                className={`h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors ${
                  appliedFilterStatus === 'inativo'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <i className={`fas ${appliedFilterStatus === 'inativo' ? 'fa-arrow-left' : 'fa-trash'} text-xs`}></i>
              </button>
              <button 
                type="button" 
                onClick={abrirNovoAluno} 
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-green-600 text-white"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>
          </div>
          {selectedAlunos.length > 0 && (
            <button
              type="button"
              onClick={excluirSelecionados}
              className="mt-2 w-full h-9 inline-flex items-center justify-center rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-200"
            >
              <i className="fas fa-trash mr-2 text-xs"></i>
              Excluir selecionados ({selectedAlunos.length})
            </button>
          )}
        </div>

        {/* Search row placed above the table for clearer layout */}
        {/* Busca */}
        <div className="mb-4 fade-in-2">
          <div className="relative w-full">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar aluno..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none text-sm"
            />
          </div>
        </div>

        {/* Filtros Compactos - Mobile */}
        <div className="md:hidden mb-4 fade-in-2">
          <div className="flex flex-wrap gap-2">
            <select 
              value={uiFilterModalidade} 
              onChange={(e) => { setUiFilterModalidade(e.target.value); setAppliedFilterModalidade(e.target.value); setCurrentPage(1); }} 
              className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
            >
              <option value="">Modalidade</option>
              {modalidades.map(m => (
                <option key={m._id} value={m.nome}>{m.nome}</option>
              ))}
            </select>
            <select 
              value={uiFilterProfessor} 
              onChange={(e) => { setUiFilterProfessor(e.target.value); setAppliedFilterProfessor(e.target.value); setCurrentPage(1); }} 
              className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
            >
              <option value="">Professor</option>
              {availableProfessores.map(prof => (
                <option key={prof} value={prof}>{prof}</option>
              ))}
            </select>
            <select 
              value={uiFilterCaracteristica} 
              onChange={(e) => { setUiFilterCaracteristica(e.target.value); setAppliedFilterCaracteristica(e.target.value); setCurrentPage(1); }} 
              className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
            >
              <option value="">Status</option>
              <option value="congelado">Congelado</option>
              <option value="ausente">Ausente</option>
              <option value="reposicao">Com Reposição</option>
            </select>
            {(appliedFilterModalidade || appliedFilterProfessor || appliedFilterCaracteristica) && (
              <button
                type="button"
                onClick={() => { 
                  setUiFilterModalidade(''); 
                  setUiFilterCaracteristica(''); 
                  setUiFilterProfessor('');
                  setAppliedFilterModalidade('');
                  setAppliedFilterCaracteristica('');
                  setAppliedFilterProfessor('');
                  setCurrentPage(1); 
                }}
                className="px-2 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {filteredAlunos.length} {filteredAlunos.length === 1 ? 'resultado' : 'resultados'}
          </div>
        </div>

        {/* Filtros - Desktop */}
        <div className="hidden md:block bg-white rounded-lg border border-gray-200 p-4 mb-6 fade-in-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex flex-wrap items-center gap-3">
              <select 
                value={uiFilterModalidade} 
                onChange={(e) => { setUiFilterModalidade(e.target.value); setAppliedFilterModalidade(e.target.value); setCurrentPage(1); }} 
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todas as modalidades</option>
                {modalidades.map(m => (
                  <option key={m._id} value={m.nome}>{m.nome}</option>
                ))}
              </select>

              <select 
                value={uiFilterProfessor} 
                onChange={(e) => { setUiFilterProfessor(e.target.value); setAppliedFilterProfessor(e.target.value); setCurrentPage(1); }} 
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todos os professores</option>
                {availableProfessores.map(prof => (
                  <option key={prof} value={prof}>{prof}</option>
                ))}
              </select>

              <select 
                value={uiFilterCaracteristica} 
                onChange={(e) => { setUiFilterCaracteristica(e.target.value); setAppliedFilterCaracteristica(e.target.value); setCurrentPage(1); }} 
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todas as características</option>
                <option value="congelado">Congelado</option>
                <option value="ausente">Parou de Vir</option>
                <option value="12/36">12/36</option>
                <option value="TOTALPASS">TOTALPASS</option>
                {availableCaracteristicas.length > 0 && (
                  <optgroup label="Personalizadas">
                    {availableCaracteristicas.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { 
                  setUiFilterModalidade(''); 
                  setUiFilterCaracteristica(''); 
                  setUiFilterProfessor('');
                  setAppliedFilterModalidade('');
                  setAppliedFilterCaracteristica('');
                  setAppliedFilterProfessor('');
                  setSelectedAlunos([]); 
                  setCurrentPage(1); 
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                title="Limpar filtros">
                <i className="fas fa-eraser text-xs" aria-hidden="true" />
                <span>Limpar</span>
              </button>
              <div className="text-sm text-gray-600">
                {filteredAlunos.length} {filteredAlunos.length === 1 ? 'resultado' : 'resultados'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col">
          {/* Versão Desktop - Tabela */}
          <div className="hidden md:block -my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8 fade-in-3">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden rounded-md border border-gray-200">
                <table className="w-full table-fixed text-sm border-collapse text-center">
                  <thead className="bg-white border-b border-gray-200">
                    <tr className="text-center">
                      <th scope="col" className="w-12 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary-600"
                          checked={selectAll}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        Nome
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ maxWidth: '180px', width: '180px' }}>
                        Modalidades
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        Telefone
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        Ativo
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {loading && (
                      <>
                        {[1, 2, 3, 4, 5].map(i => (
                          <tr key={i} className="animate-pulse">
                            <td colSpan={7} className="px-3 py-3 border-b border-gray-200">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}

                    {!loading && filteredAlunos.length > 0 && (
                      pagedAlunos.map((aluno, idx) => {
                        const isMuted = !!(aluno.congelado || aluno.ausente);
                        const isInativo = !aluno.ativo;
                        const isLast = idx === pagedAlunos.length - 1;
                        const fadeClass = isLast ? 'fade-in-8' : `fade-in-${Math.min((idx % 8) + 1, 8)}`;
                        const rowClass = isInativo ? 'bg-gray-200 text-gray-600' : isMuted ? 'bg-gray-50 text-gray-500' : '';
                        return (
                          <tr key={aluno._id} className={`${rowClass} ${fadeClass}`}>
                            <td className="w-12 px-2 py-3 text-sm border-r border-b border-gray-200 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                                checked={selectedAlunos.includes(aluno._id)}
                                onChange={() => toggleSelectAluno(aluno._id)}
                              />
                            </td>
                            <td className="px-3 py-3 text-sm border-r border-b border-gray-200 text-center">
                              <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2 justify-center w-full">
                                  {typeof (aluno as any).frequencia !== 'undefined' ? (
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-semibold rounded-md bg-gray-100 text-gray-800">
                                      {(aluno as any).frequencia}%
                                    </span>
                                  ) : null}

                                  <div className={`truncate font-medium ${isMuted ? 'text-gray-500' : 'text-gray-900'}`} title={aluno.nome}>{aluno.nome}</div>
                                </div>

                                {aluno.observacoes && (
                                  <span className={`inline-block mt-2 px-3 py-1.5 rounded-full text-xs font-semibold border max-w-[12rem] truncate ${isMuted ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`} title={aluno.observacoes}>
                                    <i className="fas fa-sticky-note mr-1" />
                                    {aluno.observacoes}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-500 border-r border-b border-gray-200 text-center align-middle" style={{ maxWidth: '180px' }}>
                              <div className="flex flex-col items-center gap-2">
                                {(aluno.modalidades && aluno.modalidades.length > 0) ? (
                                  aluno.modalidades.map(m => {
                                    const hs = (aluno.horarios || []).filter(h => String(h.modalidadeNome || '').toLowerCase() === String(m.nome || '').toLowerCase());
                                    return (
                                      <div key={(m._id || m.nome)} className="w-full">
                                        <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-gray-100 border border-gray-200 text-gray-700'}`}>
                                          <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isMuted ? '#D1D5DB' : getModalidadeColor(m) }} />
                                          <span className="truncate max-w-[100px] text-xs">{m.nome}</span>
                                        </div>
                                        {hs && hs.length > 0 ? (
                                          <div className="mt-1 text-[10px] text-gray-600 space-y-0.5">
                                            {hs.map((h, i) => (
                                              <div key={`${h.diaSemana}-${h.horarioInicio}-${h.horarioFim}-${i}`} className="text-[10px] text-gray-500">
                                                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][h.diaSemana]} {h.horarioInicio}–{h.horarioFim}{h.professorNome ? (<span className="text-[10px] text-gray-400"> — {h.professorNome}</span>) : null}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="mt-1 text-xs text-gray-400">—</div>
                                        )}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div>
                                    {aluno.horarios && aluno.horarios.length > 0 ? (
                                      <div className="mt-1 text-[10px] text-gray-600 space-y-0.5">
                                        {aluno.horarios.map((h, i) => (
                                          <div key={i} className="text-[10px] text-gray-500">
                                            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][h.diaSemana]} {h.horarioInicio}–{h.horarioFim}{h.professorNome ? (<span className="text-[10px] text-gray-400"> — {h.professorNome}</span>) : null}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="mt-1 text-xs text-gray-400">—</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-3 py-3 text-sm text-gray-500 border-r border-b border-gray-200 text-center">
                              <div className="flex items-center justify-center gap-2 flex-wrap">
                                {(aluno.congelado) && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
                                    <i className="fas fa-snowflake" />
                                    <span>Congelado</span>
                                  </span>
                                )}

                                {(aluno.ausente) && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                                    <i className="fas fa-user-clock" />
                                    <span>Parou de Vir</span>
                                  </span>
                                )}

                                {(aluno.periodoTreino === '12/36') && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-green-50 border-green-200 text-green-700'}`}>
                                    <i className="fas fa-clock" />
                                    <span>12/36</span>
                                  </span>
                                )}

                                {(aluno.parceria === 'TOTALPASS') && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>
                                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="TOTALPASS" className={`w-3 h-3 ${isMuted ? 'opacity-50 filter grayscale' : ''}`} />
                                    <span>TOTALPASS</span>
                                  </span>
                                )}

                                {/* custom caracteristicas */}
                                {Array.isArray(aluno.caracteristicas) && aluno.caracteristicas.length > 0 && (
                                  aluno.caracteristicas.map((c, i) => (
                                    <span key={String(c) + i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                                      {c}
                                    </span>
                                  ))
                                )}

                                {(!aluno.congelado && !aluno.ausente && aluno.periodoTreino !== '12/36' && !aluno.parceria && (!Array.isArray(aluno.caracteristicas) || aluno.caracteristicas.length === 0)) && (
                                  <div className="text-xs text-gray-400">—</div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-500 border-r border-b border-gray-200 text-center">
                              {aluno.telefone}
                            </td>
                            <td className="px-3 py-3 text-sm border-r border-b border-gray-200 text-center">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                isInativo 
                                  ? 'bg-gray-400 text-white' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {isInativo ? 'Inativo' : 'Ativo'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-sm border-b border-gray-200">
                              <div className="flex items-center justify-center gap-2">
                                {isInativo ? (
                                  <>
                                    <button 
                                      onClick={() => reativarAluno(aluno._id, aluno.nome)} 
                                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-green-50 border border-green-200 text-green-700 hover:bg-green-100"
                                      title="Reativar aluno"
                                    >
                                      <i className="fas fa-undo w-3" aria-hidden="true" />
                                      <span>Reativar</span>
                                    </button>
                                    <button 
                                      onClick={() => excluirAluno(aluno._id, aluno.nome, aluno.ativo)} 
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-red-50 border border-red-100 text-red-700 hover:bg-red-100"
                                      title="Excluir permanentemente"
                                    >
                                      <i className="fas fa-trash w-3" aria-hidden="true" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {permissoesAlunos.editar() && (
                                      <button onClick={() => abrirEdicao(aluno)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white border border-gray-100 hover:bg-gray-50 text-primary-600">
                                        <i className="fas fa-edit w-3" aria-hidden="true" />
                                      </button>
                                    )}
                                    {permissoesAlunos.excluir() && (
                                      <button onClick={() => excluirAluno(aluno._id, aluno.nome, aluno.ativo)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-red-50 border border-red-100 text-red-700 hover:bg-red-100">
                                        <i className="fas fa-trash w-3" aria-hidden="true" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Versão Mobile - Cards */}
          <div className="md:hidden space-y-3 fade-in-3">
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && filteredAlunos.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <i className="fas fa-users text-3xl mb-2 text-gray-300"></i>
                <p>Nenhum aluno encontrado</p>
              </div>
            )}

            {!loading && pagedAlunos.map((aluno, idx) => {
              const isMuted = !!(aluno.congelado || aluno.ausente);
              const isInativo = !aluno.ativo;
              const fadeClass = `fade-in-${Math.min((idx % 8) + 1, 8)}`;
              
              return (
                <div 
                  key={aluno._id} 
                  className={`bg-white rounded-xl border shadow-sm overflow-hidden ${fadeClass} ${isInativo ? 'border-gray-300 bg-gray-50' : isMuted ? 'border-gray-200' : 'border-gray-200'}`}
                >
                  {/* Header do Card */}
                  <div className={`px-4 py-3 ${isInativo ? 'bg-gray-100' : isMuted ? 'bg-gray-50' : 'bg-gradient-to-r from-green-50 to-white'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-green-600"
                          checked={selectedAlunos.includes(aluno._id)}
                          onChange={() => toggleSelectAluno(aluno._id)}
                        />
                        <div>
                          <div className={`font-semibold text-sm ${isMuted || isInativo ? 'text-gray-500' : 'text-gray-900'}`}>
                            {aluno.nome}
                          </div>
                          {aluno.telefone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <i className="fas fa-phone text-[10px]"></i>
                              {aluno.telefone}
                            </div>
                          )}
                          {(aluno.cpf || aluno.dataNascimento) && (
                            <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                              {aluno.cpf && (
                                <span className="flex items-center gap-1">
                                  <i className="fas fa-id-card text-[10px]"></i>
                                  {aluno.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                </span>
                              )}
                              {aluno.dataNascimento && (
                                <span className="flex items-center gap-1">
                                  <i className="fas fa-birthday-cake text-[10px]"></i>
                                  {new Date(aluno.dataNascimento).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        isInativo 
                          ? 'bg-gray-200 text-gray-600' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {isInativo ? 'Inativo' : 'Ativo'}
                      </span>
                    </div>
                  </div>

                  {/* Conteúdo do Card */}
                  <div className="px-4 py-3 space-y-3">
                    {/* Status Tags */}
                    {(aluno.congelado || aluno.ausente || aluno.periodoTreino === '12/36' || aluno.parceria === 'TOTALPASS' || (aluno.caracteristicas && aluno.caracteristicas.length > 0)) && (
                      <div className="flex flex-wrap gap-1.5">
                        {aluno.congelado && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700">
                            <i className="fas fa-snowflake"></i> Congelado
                          </span>
                        )}
                        {aluno.ausente && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700">
                            <i className="fas fa-user-clock"></i> Parou
                          </span>
                        )}
                        {aluno.periodoTreino === '12/36' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                            <i className="fas fa-clock"></i> 12/36
                          </span>
                        )}
                        {aluno.parceria === 'TOTALPASS' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                            TOTALPASS
                          </span>
                        )}
                        {Array.isArray(aluno.caracteristicas) && aluno.caracteristicas.map((c, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Observações */}
                    {aluno.observacoes && (
                      <div className={`text-xs p-2 rounded-lg border-l-3 ${isMuted ? 'bg-gray-50 border-gray-300 text-gray-500' : 'bg-yellow-50 border-yellow-400 text-yellow-800'}`}>
                        <i className="fas fa-sticky-note mr-1.5 text-yellow-500"></i>
                        {aluno.observacoes}
                      </div>
                    )}

                    {/* Modalidades e Horários */}
                    {(aluno.modalidades && aluno.modalidades.length > 0) && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Modalidades</div>
                        {aluno.modalidades.map(m => {
                          const hs = (aluno.horarios || []).filter(h => String(h.modalidadeNome || '').toLowerCase() === String(m.nome || '').toLowerCase());
                          return (
                            <div key={(m._id || m.nome)} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isMuted ? '#9CA3AF' : getModalidadeColor(m) }} />
                                <span className={`text-xs font-medium ${isMuted ? 'text-gray-500' : 'text-gray-800'}`}>{m.nome}</span>
                              </div>
                              {hs && hs.length > 0 && (
                                <div className="ml-4 space-y-0.5">
                                  {hs.map((h, i) => (
                                    <div key={`${h.diaSemana}-${h.horarioInicio}-${i}`} className="text-[11px] text-gray-500 flex items-center gap-1">
                                      <i className="fas fa-calendar-day text-[9px] text-gray-400"></i>
                                      <span className="font-medium">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][h.diaSemana]}</span>
                                      <span>{h.horarioInicio}–{h.horarioFim}</span>
                                      {h.professorNome && <span className="text-gray-400">• {h.professorNome}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Frequência */}
                    {typeof (aluno as any).frequencia !== 'undefined' && (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Frequência</span>
                        <span className={`text-sm font-bold ${(aluno as any).frequencia >= 80 ? 'text-green-600' : (aluno as any).frequencia >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {(aluno as any).frequencia}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer - Ações */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center justify-end">
                      <div className="flex items-center gap-1.5">
                        {isInativo ? (
                          <>
                            <button 
                              onClick={() => reativarAluno(aluno._id, aluno.nome)} 
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                            >
                              <i className="fas fa-undo text-[10px]"></i> Reativar
                            </button>
                            <button 
                              onClick={() => excluirAluno(aluno._id, aluno.nome, aluno.ativo)} 
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                            >
                              <i className="fas fa-trash text-xs"></i>
                            </button>
                          </>
                        ) : (
                          <>
                            {permissoesAlunos.editar() && (
                              <button 
                                onClick={() => abrirEdicao(aluno)} 
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-green-600 hover:bg-green-50 transition-colors"
                              >
                                <i className="fas fa-edit text-xs"></i>
                              </button>
                            )}
                            {permissoesAlunos.excluir() && (
                              <button 
                                onClick={() => excluirAluno(aluno._id, aluno.nome, aluno.ativo)} 
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <i className="fas fa-trash text-xs"></i>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      
          {/* Pagination controls */}
          <div className="mt-4 px-4 sm:px-0 fade-in-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Mostrando {pagedAlunos.length} de {filteredAlunos.length} resultados</div>
              <div className="flex items-center gap-2">
                <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-3 py-1 border border-gray-200 rounded-md bg-white text-sm disabled:opacity-50">Anterior</button>
                <div className="text-sm text-gray-700">Página {currentPage} de {totalPages}</div>
                <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1 border border-gray-200 rounded-md bg-white text-sm disabled:opacity-50">Próxima</button>
              </div>
            </div>
          </div>

          {/* keep currentPage within bounds when filtered results change */}
        

      {/* Modal de Edição */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 p-3 sm:p-4">
          <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            {/* Header + Info */}
            <div className="mb-4 border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className={`fas fa-edit text-primary-600 text-lg`} aria-hidden="true" />
                  <h3 className="text-base font-semibold text-gray-900">{editingAluno ? 'Editar Aluno' : 'Novo Aluno'}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Fechar"
                >
                  <i className="fas fa-times text-lg" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <i className="fas fa-info-circle text-primary-600 text-xs" aria-hidden="true" />
                <span className="text-xs text-gray-500">Edite os dados do aluno abaixo.</span>
              </div>
            </div>
            {/* Form */}
            <form
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                salvarEdicao();
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={editFormData.nome}
                    onChange={(e) => setEditFormData({...editFormData, nome: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium"
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone <span className="text-gray-400 text-xs">(pode ser &quot;Não informado&quot;)</span></label>
                  <input
                    type="tel"
                    value={editFormData.telefone}
                    onChange={(e) => {
                      const input = e.target.value;
                      // Se começar com letra, permitir texto livre (ex: "Não informado")
                      if (/^[a-zA-ZÀ-ÿ]/.test(input)) {
                        setEditFormData({...editFormData, telefone: input});
                        return;
                      }
                      // Aceitar apenas números e limitar a 11 dígitos
                      const value = input.replace(/\D/g, '').slice(0, 11);
                      // Formatar com máscara (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
                      let formatted = value;
                      if (value.length > 10) {
                        formatted = `(${value.slice(0,2)}) ${value.slice(2,7)}-${value.slice(7)}`;
                      } else if (value.length > 6) {
                        formatted = `(${value.slice(0,2)}) ${value.slice(2,6)}-${value.slice(6)}`;
                      } else if (value.length > 2) {
                        formatted = `(${value.slice(0,2)}) ${value.slice(2)}`;
                      } else if (value.length > 0) {
                        formatted = `(${value}`;
                      }
                      setEditFormData({...editFormData, telefone: formatted});
                    }}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium"
                    placeholder="(11) 99999-9999 ou Não informado"
                  />
                </div>
              </div>

              {/* Campos para acesso do aluno */}
              <div className="relative border border-primary-200 rounded-md p-4 bg-primary-50/30">
                <div className="absolute -top-3 left-4 bg-white px-2 text-sm font-medium text-primary-700">
                  <i className="fas fa-mobile-alt mr-1"></i> Acesso do Aluno
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Preencha estes campos para permitir que o aluno acesse o sistema e solicite reagendamentos.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CPF <span className="text-gray-400 text-xs">(apenas números)</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.cpf}
                      onChange={(e) => {
                        // Aceitar apenas números e limitar a 11 dígitos
                        const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                        // Formatar com máscara
                        let formatted = value;
                        if (value.length > 9) {
                          formatted = `${value.slice(0,3)}.${value.slice(3,6)}.${value.slice(6,9)}-${value.slice(9)}`;
                        } else if (value.length > 6) {
                          formatted = `${value.slice(0,3)}.${value.slice(3,6)}.${value.slice(6)}`;
                        } else if (value.length > 3) {
                          formatted = `${value.slice(0,3)}.${value.slice(3)}`;
                        }
                        setEditFormData({...editFormData, cpf: formatted});
                      }}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium"
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                    <input
                      type="date"
                      value={editFormData.dataNascimento}
                      onChange={(e) => setEditFormData({...editFormData, dataNascimento: e.target.value})}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Status do plano */}
              <div className="relative border border-gray-200 rounded-md p-4">
                <div className="absolute -top-3 left-4 bg-white px-2 text-sm font-medium text-gray-700">Status do plano</div>
                <div className="mt-1 flex flex-wrap gap-2 pb-1 items-center">
                  <button type="button" onClick={() => setEditFlags({...editFlags, congelado: !editFlags.congelado})} className={`px-2 py-1 rounded-full border text-xs font-medium inline-flex items-center gap-1 ${editFlags.congelado ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <i className="fas fa-snowflake text-xs" />
                    <span className="whitespace-nowrap">Congelado</span>
                  </button>

                  <button type="button" onClick={() => setEditFlags({...editFlags, ausente: !editFlags.ausente})} className={`px-2 py-1 rounded-full border text-xs font-medium inline-flex items-center gap-1 ${editFlags.ausente ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <i className="fas fa-user-clock text-xs" />
                    <span className="whitespace-nowrap">Parou de Vir</span>
                  </button>

                  <button type="button" onClick={() => setEditFlags({...editFlags, periodoTreino: editFlags.periodoTreino === '12/36' ? null : '12/36'})} className={`px-2 py-1 rounded-full border text-xs font-medium inline-flex items-center gap-1 ${editFlags.periodoTreino === '12/36' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <i className="fas fa-clock text-xs" />
                    <span className="whitespace-nowrap">12/36</span>
                  </button>

                  <button type="button" onClick={() => setEditFlags({...editFlags, parceria: editFlags.parceria === 'TOTALPASS' ? null : 'TOTALPASS'})} className={`px-2 py-1 rounded-full border text-xs font-medium inline-flex items-center gap-1 ${editFlags.parceria === 'TOTALPASS' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="TOTALPASS" className="w-3 h-3" />
                    <span>TOTALPASS</span>
                  </button>
                </div>

                {Array.isArray(editCaracteristicas) && editCaracteristicas.length > 0 && (
                  <div className="w-full flex gap-2 flex-wrap mt-2">
                    {editCaracteristicas.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs">
                        <span className="truncate max-w-[10rem]">{c}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={editFormData.observacoes}
                  onChange={(e) => setEditFormData({...editFormData, observacoes: e.target.value})}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium h-10"
                  rows={1}
                  placeholder="Observações sobre o aluno"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <i className="fas fa-times text-black" aria-hidden="true" /> Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 flex items-center gap-2"
                >
                  <i className="fas fa-save text-white mr-2" aria-hidden="true" /> {editingAluno ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    {/* Modal de reagendamento compartilhado */}
    {showReagendarModal && reagendarData && (
      <ReagendarAulaModal
        open={showReagendarModal}
        onClose={() => setShowReagendarModal(false)}
        aluno={reagendarData.aluno}
        horarioOriginal={reagendarData.falta.horarioOriginal || reagendarData.falta.horario || null}
        dataOriginal={reagendarData.falta.data || null}
        matricula={reagendarData.falta.matricula || reagendarData.falta.matriculaId || reagendarData.falta.matricula_id || null}
        onCreated={() => {}}
      />
    )}
    </ProtectedPage>
  );
}