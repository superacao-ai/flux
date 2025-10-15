import mongoose from 'mongoose';
import React, { useState } from 'react';
import ModalNovoHorario from './ModalNovoHorario';

const modalidadeSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  descricao: {
    type: String,
    trim: true
  },
  cor: {
    type: String,
    default: '#3B82F6' // Cor padrão em hex para identificação visual
  },
  duracao: {
    type: Number,
    default: 60 // Duração padrão em minutos
  },
  limiteAlunos: {   
    type: Number,
    default: 5 // Limite máximo de alunos por horário
  },
  diasSemana: {
    type: [Number], // Array de dias da semana (0=Domingo, 6=Sábado)
    default: [] // Por padrão, nenhum dia selecionado
  },
  horariosDisponiveis: [{
    diasSemana: [Number], // Array de dias da semana (0=Domingo, 6=Sábado)
    horaInicio: String,   // Ex: "06:00"
    horaFim: String       // Ex: "09:00"
  }],
  // Horário de funcionamento padrão para a modalidade (manhã e tarde)
  horarioFuncionamento: {
    manha: {
      inicio: { type: String, default: null },
      fim: { type: String, default: null }
    },
    tarde: {
      inicio: { type: String, default: null },
      fim: { type: String, default: null }
    }
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índices
modalidadeSchema.index({ nome: 1 });
modalidadeSchema.index({ ativo: 1 });

export const Modalidade = mongoose.models.Modalidade || mongoose.model('Modalidade', modalidadeSchema);

type Horario = {
  diasSemana?: number[];
  horaInicio?: string;
  horaFim?: string;
};

type Props = {
  modalidadeId: string;
  horarios: Horario[];
  onUpdated?: (modalidade: any) => void;
};

export default function HorarioGrid({ modalidadeId, horarios = [], onUpdated }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  function handleCellClick(index: number) {
    setSelectedIndex(index);
    setModalOpen(true);
  }

  function handleClose() {
    setModalOpen(false);
    setSelectedIndex(null);
  }

  return (
    <div>
      <div className="grid gap-2">
        {(horarios || []).map((h, i) => (
          <button
            key={i}
            onClick={() => handleCellClick(i)}
            title="Clique para adicionar/editar horário"
            className="p-2 rounded border text-left hover:bg-gray-50"
          >
            <div className="font-semibold">{h.horaInicio || '—'} - {h.horaFim || '—'}</div>
            <div className="text-sm text-gray-600">{(h.diasSemana || []).join(', ')}</div>
          </button>
        ))}
      </div>

      <ModalNovoHorario
        open={modalOpen}
        onClose={handleClose}
        modalidadeId={modalidadeId}
        initial={selectedIndex != null ? horarios[selectedIndex] : null}
        onSaved={(modalidade) => {
          if (onUpdated) onUpdated(modalidade);
          handleClose();
        }}
      />
    </div>
  );
}