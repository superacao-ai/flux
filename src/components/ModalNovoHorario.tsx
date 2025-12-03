import React, { useEffect, useState } from 'react';

type Horario = {
  diasSemana?: number[];
  horaInicio?: string;
  horaFim?: string;
  // ...outras props possíveis...
};

type Props = {
  open: boolean;
  onClose: () => void;
  modalidadeId: string;
  initial?: Horario | null;
  onSaved?: (modalidade: any) => void;
};

export default function ModalNovoHorario({ open, onClose, modalidadeId, initial = null, onSaved }: Props) {
  const [horaInicio, setHoraInicio] = useState(initial?.horaInicio || '');
  const [horaFim, setHoraFim] = useState(initial?.horaFim || '');
  const [diasSemana, setDiasSemana] = useState<number[]>(initial?.diasSemana || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setHoraInicio(initial?.horaInicio || '');
      setHoraFim(initial?.horaFim || '');
      setDiasSemana(initial?.diasSemana || []);
    }
  }, [open, initial]);

  function toggleDia(d: number) {
    setDiasSemana(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]));
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!modalidadeId) return;
    setLoading(true);
    try {
      const payload = {
        action: 'addHorario',
        modalidadeId,
        horario: { horaInicio, horaFim, diasSemana }
      };
      const res = await fetch('/api/modalidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        if (onSaved) onSaved(data.modalidade);
        onClose();
      } else {
        console.error('Erro ao salvar horário', data);
      }
    } catch (err) {
      console.error('Network error', err);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <div className="bg-white rounded-lg p-4 sm:p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-2">Novo horário</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm">Hora início</label>
            <input required value={horaInicio} onChange={e => setHoraInicio(e.target.value)} type="time" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm">Hora fim</label>
            <input required value={horaFim} onChange={e => setHoraFim(e.target.value)} type="time" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Dias da semana</label>
            <div className="flex gap-1 flex-wrap">
              {['D','S','T','Q','Q','S','S'].map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDia(idx)}
                  className={`px-2 py-1 border rounded ${diasSemana.includes(idx) ? 'bg-blue-500 text-white' : 'bg-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2 border rounded-md text-sm hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
